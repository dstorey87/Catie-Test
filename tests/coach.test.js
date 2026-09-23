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
