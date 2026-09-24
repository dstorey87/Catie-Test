// Tests for coach.js — run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const coach = require('../coach.js');

// ---------- flags: kept until she un-flags, merged question by question ----------

test('a flag on either device survives a sync', () => {
  const phone = { flags: { q1: { t: 100, src: 'learn' } }, cleared: {} };
  const ipad = { flags: { q2: { t: 200, src: 'test' } }, cleared: {} };
  const m = coach.mergeFlags(phone, ipad);
  assert.deepEqual(Object.keys(m.flags).sort(), ['q1', 'q2']);
});

test('an un-flag made after the flag wins, on whichever device it happened', () => {
  const phone = { flags: { q1: { t: 100, src: 'learn' } }, cleared: {} };
  const ipad = { flags: {}, cleared: { q1: 150 } };
  assert.deepEqual(coach.mergeFlags(phone, ipad).flags, {});
  assert.deepEqual(coach.mergeFlags(ipad, phone).flags, {});
  assert.equal(coach.mergeFlags(phone, ipad).cleared.q1, 150);
});

test('flagging again after an un-flag brings it back', () => {
  const phone = { flags: { q1: { t: 300, src: 'learn' } }, cleared: {} };
  const ipad = { flags: {}, cleared: { q1: 150 } };
  const m = coach.mergeFlags(phone, ipad);
  assert.deepEqual(m.flags.q1, { t: 300, src: 'learn' });
  assert.equal(m.cleared.q1, undefined);
});

test('missing or old-format data is treated as empty, never as an error', () => {
  assert.deepEqual(coach.mergeFlags(undefined, null), { flags: {}, cleared: {} });
  const m = coach.mergeFlags({ flags: { q1: { t: 5 } } }, {});
  assert.deepEqual(Object.keys(m.flags), ['q1']);
});

// ---------- activity summary (Admin → Activity) ----------
const BANK = {
  q1: { id: 'q1', topic: 1, question: 'Q one?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  q2: { id: 'q2', topic: 2, question: 'Q two?', options: ['a', 'b', 'c', 'd'], correctIndex: 2 },
};
const ev = (at, kind, qid, data) => ({ at, kind, qid: qid || null, data: data || {}, learner: 'Catie', user_id: 'u1' });

test('the activity summary counts answers, accuracy, time and help used per day', () => {
  const events = [
    ev('2026-09-24T09:00:00Z', 'session_start'),
    ev('2026-09-24T09:00:10Z', 'answer', 'q1', { ok: false, p: 1, ms: 8000 }),
    ev('2026-09-24T09:00:20Z', 'answer', 'q1', { ok: true, p: 0, ms: 4000 }),
    ev('2026-09-24T09:00:30Z', 'answer', 'q2', { ok: false, p: 3, ms: 12000 }),
    ev('2026-09-24T09:00:31Z', 'hint_used', 'q2'),
    ev('2026-09-24T09:00:32Z', 'read_aloud', 'q2'),
    ev('2026-09-24T09:10:00Z', 'session_end', null, { secs: 600 }),
    ev('2026-09-23T18:00:00Z', 'answer', 'q2', { ok: false, p: 3, ms: 6000 }),
    ev('2026-09-23T18:30:00Z', 'test_end', null, { secs: 1800, score: 40, total: 50 }),
  ];
  const a = coach.activity(events, BANK);
  assert.equal(a.totals.answered, 4);
  assert.equal(a.totals.right, 1);
  assert.equal(a.totals.hints, 1);
  assert.equal(a.totals.readAloud, 1);
  assert.equal(a.totals.secs, 2400);
  assert.deepEqual(a.days.map(d => d.day), ['2026-09-24', '2026-09-23'], 'newest day first');
  assert.equal(a.days[0].answered, 3);
  assert.equal(a.days[1].mocks, 1);
});

test('most-missed lists the questions she gets wrong most, with the answer she usually picks', () => {
  const events = [
    ev('2026-09-24T09:00:00Z', 'answer', 'q2', { ok: false, p: 3 }),
    ev('2026-09-24T09:01:00Z', 'answer', 'q2', { ok: false, p: 3 }),
    ev('2026-09-24T09:02:00Z', 'answer', 'q2', { ok: false, p: 1 }),
    ev('2026-09-24T09:03:00Z', 'answer', 'q1', { ok: false, p: 2 }),
    ev('2026-09-24T09:04:00Z', 'answer', 'gone', { ok: false, p: 2 }),   // not in the bank: ignored
  ];
  const m = coach.activity(events, BANK).missed;
  assert.deepEqual(m.map(x => x.qid), ['q2', 'q1']);
  assert.equal(m[0].wrong, 3);
  assert.equal(m[0].usualPick, 3);
});

test('answer time is averaged per topic, slowest first', () => {
  const events = [
    ev('2026-09-24T09:00:00Z', 'answer', 'q1', { ok: true, ms: 4000 }),
    ev('2026-09-24T09:00:00Z', 'answer', 'q2', { ok: true, ms: 10000 }),
    ev('2026-09-24T09:00:00Z', 'answer', 'q2', { ok: true, ms: 20000 }),
  ];
  const t = coach.activity(events, BANK).topicTime;
  assert.deepEqual(t.map(x => [x.topic, x.avgSecs]), [[2, 15], [1, 4]]);
});

// ---------- Drill me: a test built from her own answers ----------
const DAY = 86400000, NOW = Date.UTC(2026, 8, 24, 12);
const mk = (id, topic) => ({ id, topic, question: id + '?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 });
const DB = ['s1', 's2', 'f1', 'd1', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'ok1'].map((id, i) => mk(id, (i % 4) + 1));
const at = (q, daysAgo, ok) => ({ q, t: NOW - daysAgo * DAY, ok });

test('stuck: missed 3 times, or missed on two different days, and not since got right twice running', () => {
  const p = coach.profile([at('s1', 3, false), at('s1', 3, false), at('s1', 2, false),
    at('s2', 5, false), at('s2', 1, false),
    at('ok1', 9, false), at('ok1', 8, false), at('ok1', 7, true), at('ok1', 6, true)], {}, DB, NOW);
  assert.equal(p.s1.stuck, true);
  assert.equal(p.s2.stuck, true);
  assert.equal(p.ok1.stuck, false, 'two right in a row since: no longer stuck');
});

test('spacing: each right answer in a row pushes the next review further out', () => {
  const once = coach.profile([at('d1', 2, true)], {}, DB, NOW).d1;            // 1 right: due after 1 day
  const twice = coach.profile([at('d1', 4, true), at('d1', 2, true)], {}, DB, NOW).d1;   // 2 right: 3 days
  assert.equal(once.due, true);
  assert.equal(twice.due, false);
  assert.equal(coach.profile([at('d1', 4, true), at('d1', 3.5, true)], {}, DB, NOW).d1.due, true);
});

test('Drill me takes stuck first, then flagged, then due, then a few new ones, and says why', () => {
  const hist = [at('s1', 3, false), at('s1', 3, false), at('s1', 2, false), at('d1', 2, true), at('ok1', 0.5, true)];
  const d = coach.buildDrill(coach.profile(hist, { f1: { t: 1 } }, DB, NOW), DB, { n: 6, newMax: 2 });
  // 3 to review in a drill of 6: the other 3 are new (newMax only limits new ones when
  // there is more reviewing to do than room for).
  assert.deepEqual(d.reasons, { stuck: 1, flagged: 1, due: 1, weak: 0, fresh: 3 });
  assert.ok(!d.ids.includes('ok1'), 'answered right yesterday: not due yet');
  assert.equal(d.ids.filter(x => x === 's1').length, 2, 'a stuck question comes back later in the same drill');
});

test('Drill me only ever returns questions that are in the bank', () => {
  const hist = [at('gone', 1, false), at('gone', 1, false), at('gone', 1, false), at('s1', 1, false)];
  const d = coach.buildDrill(coach.profile(hist, { gone2: { t: 1 } }, DB, NOW), DB, { n: 20 });
  const bankIds = new Set(DB.map(q => q.id));
  assert.ok(d.ids.length > 0);
  d.ids.forEach(id => assert.ok(bankIds.has(id), id + ' is not in the bank'));
});

test('topics alternate: no two questions from the same topic side by side when there is a choice', () => {
  const d = coach.buildDrill(coach.profile([], {}, DB, NOW), DB, { n: 8, newMax: 8 });
  const topics = d.ids.map(id => DB.find(q => q.id === id).topic);
  for (let i = 1; i < topics.length; i++) assert.notEqual(topics[i], topics[i - 1], 'same topic twice at ' + i);
});

test('a missed drill question comes back 3 later, at most twice', () => {
  let ids = ['a', 'b', 'c', 'd', 'e', 'f'], reps = {};
  let r = coach.requeue(ids, 0, reps); ids = r.ids; reps = r.repeats;
  assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'a', 'e', 'f']);
  r = coach.requeue(ids, 4, reps); ids = r.ids; reps = r.repeats;
  assert.deepEqual(ids.filter(x => x === 'a').length, 3);
  r = coach.requeue(ids, 8, reps);
  assert.equal(r.ids.filter(x => x === 'a').length, 3, 'not a third time');
  assert.deepEqual(coach.requeue(['x', 'y'], 1, {}).ids, ['x', 'y', 'y'], 'near the end it goes last');
});

test('with lots to review, new questions are held to newMax', () => {
  const hist = ['s1', 's2', 'f1', 'd1', 'n1', 'n2'].map(q => at(q, 5, true));
  const d = coach.buildDrill(coach.profile(hist, {}, DB, NOW), DB, { n: 6, newMax: 2 });
  assert.equal(d.reasons.due, 6);
  assert.equal(d.reasons.fresh, 0);
});
