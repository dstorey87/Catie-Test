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

// =========================================================================================
// ---------- insights: pass prediction, what to work on, study plan, misconceptions,
//            badge closeness, streak freeze ----------

// A bank of 14 topics x 5 questions, ids like t3q2. Option 0 is right unless said otherwise.
const TB = [];
for (let t = 1; t <= 14; t++) for (let i = 1; i <= 5; i++) TB.push(mk('t' + t + 'q' + i, t));
const T0 = Date.UTC(2026, 8, 24, 12);                      // "her newest answer" in these tests
// n answers in a topic, `right` of them right, all `daysAgo` before T0.
const answers = (topic, n, right, daysAgo = 0) => Array.from({ length: n }, (_, i) =>
  ({ q: 't' + topic + 'q' + ((i % 5) + 1), t: T0 - daysAgo * DAY, ok: i < right, topic }));

// Exact binomial tail by a different method (combinations), to cross-check the coach's sum.
const comb = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; };
const binomAtLeast = (n, p, k) => { let s = 0; for (let j = k; j <= n; j++) s += comb(n, j) * p ** j * (1 - p) ** (n - j); return s; };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, (msg || '') + ` ${a} vs ${b}`);

// ---------- 1. pass prediction ----------

test('prediction: no answers yet means no prediction and "not enough answers"', () => {
  const p = coach.passPrediction([], [], TB);
  assert.equal(p.expected, null);
  assert.equal(p.probability, null);
  assert.equal(p.evidence, 0);
  assert.equal(p.enough, false);
  assert.equal(p.passMark, 43);
  assert.equal(p.total, 50);
});

test('prediction: expected score = per-topic rate x questions in the mock, pass chance is exact', () => {
  // Topic 1 all right, topic 2 half right; a mock of 25 + 25. With no blending (priorAnswers 0)
  // the expected score is 25x1 + 25x0.5 = 37.5, and passing needs 18+ of the 25 coin-flips.
  const hist = answers(1, 10, 10).concat(answers(2, 10, 5));
  const p = coach.passPrediction(hist, [], TB, { mix: { 1: 25, 2: 25 }, priorAnswers: 0 });
  close(p.expected, 37.5);
  close(p.probability, binomAtLeast(25, 0.5, 18), 'Poisson-binomial matches the binomial here');
  assert.deepEqual(p.topics.map(t => [t.topic, t.n, t.answers]), [[1, 25, 10], [2, 25, 10]]);
});

test('prediction: a single rate everywhere gives the plain binomial chance of 43+ of 50', () => {
  const p = coach.passPrediction(answers(1, 10, 8), [], TB, { mix: { 1: 25, 2: 25 } });
  close(p.overall, 0.8);
  close(p.expected, 40, 'topic 2 has no answers: it takes her overall rate');
  close(p.probability, binomAtLeast(50, 0.8, 43));
});

test('prediction: recent answers count more than old ones', () => {
  // Same 10 wrong + 10 right, in opposite orders: the newer half decides.
  const improving = answers(1, 10, 0, 60).concat(answers(1, 10, 10, 0));
  const slipping = answers(1, 10, 10, 60).concat(answers(1, 10, 0, 0));
  const up = coach.passPrediction(improving, [], TB, { mix: { 1: 50 }, priorAnswers: 0 }).topics[0].acc;
  const down = coach.passPrediction(slipping, [], TB, { mix: { 1: 50 }, priorAnswers: 0 }).topics[0].acc;
  assert.ok(up > 0.9, 'got better lately: ' + up);
  assert.ok(down < 0.1, 'got worse lately: ' + down);
  // Exactly: weight of a 60-day-old answer = 0.5^(60/14).
  close(up, 10 / (10 + 10 * 0.5 ** (60 / 14)));
});

test('prediction: deterministic, and measured from her newest answer, not the clock', () => {
  const hist = answers(1, 12, 9, 3).concat(answers(5, 8, 3, 1), answers(9, 20, 17, 0));
  const a = coach.passPrediction(hist, [], TB), b = coach.passPrediction(hist, [], TB);
  assert.deepEqual(a, b);
  const later = hist.map(x => Object.assign({}, x, { t: x.t + 30 * DAY }));   // same history, a month on
  assert.deepEqual(coach.passPrediction(later, [], TB), a);
});

test('prediction: evidence counts answers; under one mock\'s worth is "not enough"', () => {
  assert.equal(coach.passPrediction(answers(1, 49, 40), [], TB).enough, false);
  const p = coach.passPrediction(answers(1, 50, 40), [], TB);
  assert.equal(p.enough, true);
  assert.equal(p.evidence, 50);
  assert.ok(p.expected > 0 && p.expected <= 50);
});

test('prediction: one topic only - every other topic takes her overall rate, with 0 answers shown', () => {
  const p = coach.passPrediction(answers(3, 20, 15), [], TB);
  const t3 = p.topics.find(t => t.topic === 3);
  assert.equal(t3.answers, 20);
  p.topics.filter(t => t.topic !== 3).forEach(t => { assert.equal(t.answers, 0); close(t.acc, p.overall); });
});

test('prediction: the mock mix copies the app\'s balanced builder', () => {
  // The real bank: 14 topics of 27 - topics 1-8 get 4 questions, 9-14 get 3.
  const real = [1, 2, 3, 4, 5].flatMap(n => require('../questions-' + n + '.json'));
  const mix = coach.mockMix(real, 50);
  assert.deepEqual(Object.values(mix), [4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3]);
  // A topic with only 2 questions gives 2; the others make up the 50.
  const thin = TB.filter(q => !(q.topic === 14 && ['t14q3', 't14q4', 't14q5'].includes(q.id)));
  const m2 = coach.mockMix(thin, 50);
  assert.equal(m2[14], 2);
  assert.equal(Object.values(m2).reduce((a, b) => a + b, 0), 50);
});

test('prediction: a bank too small for 50 scales the pass mark like the app (86%)', () => {
  const small = TB.filter(q => q.topic <= 2);             // 10 questions
  const p = coach.passPrediction(answers(1, 10, 9), [], small);
  assert.equal(p.total, 10);
  assert.equal(p.passMark, 9);                            // ceil(10 x 43/50)
});

test('prediction: typed-in mock scores count; the app\'s own logged mocks are not counted twice', () => {
  const ext = [{ date: '2026-09-20', score: 40, total: 50, pass: false, source: 'external',
    perTopic: { 1: { c: 20, n: 25 }, 2: { c: 20, n: 25 } } }];
  const p = coach.passPrediction([], ext, TB, { mix: { 1: 25, 2: 25 } });
  assert.equal(p.evidence, 50);
  close(p.expected, 40);
  // An app mock whose answers were logged (src 'test', same day): only the answers count.
  const day = new Date(T0).toISOString().slice(0, 10);
  const logged = answers(1, 10, 8).map(a => Object.assign(a, { src: 'test' }));
  const appMock = [{ date: day, score: 8, total: 10, pass: false, source: 'app', perTopic: { 1: { c: 8, n: 10 } } }];
  assert.equal(coach.passPrediction(logged, appMock, TB).evidence, 10);
  // An older app mock with no answers logged that day: its topic scores count instead.
  assert.equal(coach.passPrediction([], appMock, TB).evidence, 10);
});

test('prediction: answers to questions no longer in the bank are ignored', () => {
  const p = coach.passPrediction([{ q: 'gone', t: T0, ok: true }].concat(answers(1, 5, 5)), [], TB);
  assert.equal(p.evidence, 5);
});

// ---------- 2. what to work on ----------

test('what to work on: topics ranked by predicted gain, weakest-with-most-marks first', () => {
  const hist = answers(1, 10, 10).concat(answers(2, 10, 5));
  const imp = coach.improvements(hist, [], TB, { mix: { 1: 25, 2: 25 }, priorAnswers: 0 });
  assert.deepEqual(imp.map(x => x.topic), [2, 1]);
  close(imp[0].gain, 25 * (15 / 20 - 0.5), 'ten more right: 5/10 becomes 15/20');
  close(imp[1].gain, 0, 'already perfect: nothing to gain');
  close(imp[0].lost, 12.5);
});

test('what to work on: the gain is the prediction run again, never a separate figure', () => {
  const hist = answers(1, 10, 10).concat(answers(2, 10, 5));
  const o = { mix: { 1: 25, 2: 25 }, priorAnswers: 0 };
  const before = coach.passPrediction(hist, [], TB, o);
  const after = coach.passPrediction(hist.concat(answers(2, 10, 10)), [], TB, o);
  const imp = coach.improvements(hist, [], TB, o);
  close(imp[0].gain, after.expected - before.expected);
  close(imp[0].probGain, after.probability - before.probability);
});

test('what to work on: the sentence carries the computed numbers and the topic name', () => {
  const hist = answers(1, 10, 10).concat(answers(2, 10, 5));
  const imp = coach.improvements(hist, [], TB, { mix: { 1: 25, 2: 25 }, priorAnswers: 0, topicNames: ['Alertness', 'Attitude'] });
  assert.equal(imp[0].say, 'You lose about 12.5 of the 25 marks on Attitude in a mock — about 10 more right answers here would add ~6.3 to your expected score.');
  assert.match(imp[1].say, /would add less than 0\.1 to your expected score/);
});

test('what to work on: no answers, no suggestions; every topic in the mix otherwise', () => {
  assert.deepEqual(coach.improvements([], [], TB), []);
  const imp = coach.improvements(answers(4, 30, 20), [], TB);
  assert.equal(imp.length, 14);
  imp.forEach(x => assert.ok(x.gain > 0 && x.probGain >= 0, 'topic ' + x.topic));
  for (let i = 1; i < imp.length; i++) assert.ok(imp[i - 1].gain >= imp[i].gain, 'sorted by gain');
});

// ---------- 3. study plan ----------

test('study plan: no date, a date already gone, and test day itself', () => {
  assert.equal(coach.studyPlan(null, '2026-09-24', {}).status, 'no-date');
  assert.equal(coach.studyPlan('next week', '2026-09-24', {}).status, 'no-date');
  assert.equal(coach.studyPlan('2026-02-31', '2026-09-24', {}).status, 'no-date', 'not a real date');
  const gone = coach.studyPlan('2026-09-20', '2026-09-24', {});
  assert.equal(gone.status, 'passed');
  assert.deepEqual(gone.days, []);
  const td = coach.studyPlan('2026-09-24', '2026-09-24', {});
  assert.equal(td.status, 'test-day');
  assert.deepEqual(td.days, []);
});

test('study plan: one day per day until the test, each at her daily goal', () => {
  const p = coach.studyPlan('2026-10-04', '2026-09-24', { goal: 20 });
  assert.equal(p.status, 'ok');
  assert.equal(p.daysLeft, 10);
  assert.equal(p.days.length, 10);
  assert.equal(p.days[0].date, '2026-09-24');
  assert.equal(p.days[0].isToday, true);
  assert.equal(p.days[9].date, '2026-10-03', 'the last practice day is the day before the test');
  p.days.forEach(d => assert.equal(d.target, 20));
  assert.equal(p.total, 200);
});

test('study plan: a missed day is spread over the days that are left', () => {
  const base = { goal: 20, start: '2026-09-20' };
  const kept = coach.studyPlan('2026-09-30', '2026-09-22', Object.assign({ practised: { '2026-09-20': 20, '2026-09-21': 20 } }, base));
  kept.days.forEach(d => assert.equal(d.target, 20));
  assert.deepEqual(kept.missed, []);
  const p = coach.studyPlan('2026-09-30', '2026-09-22', Object.assign({ practised: { '2026-09-20': 20 } }, base));
  assert.deepEqual(p.missed, ['2026-09-21']);
  assert.equal(p.remaining, 180);                       // 200 planned - 20 done
  assert.equal(p.days.length, 8);
  assert.equal(p.days.reduce((a, d) => a + d.target, 0), 180, 'targets add up exactly');
  p.days.forEach(d => assert.ok(d.target === 22 || d.target === 23, d.date + ' ' + d.target));
});

test('study plan: ahead of plan never drops a day under her goal', () => {
  const p = coach.studyPlan('2026-09-30', '2026-09-22', { goal: 20, start: '2026-09-20', practised: { '2026-09-20': 150, '2026-09-21': 40 } });
  p.days.forEach(d => assert.equal(d.target, 20));
});

test('study plan: leaves room to see every unseen question before the test', () => {
  const p = coach.studyPlan('2026-10-04', '2026-09-24', { goal: 20, unseen: 300 });
  assert.equal(p.remaining, 300);
  p.days.forEach(d => assert.equal(d.target, 30));
  const off = coach.studyPlan('2026-10-04', '2026-09-24', { goal: 20, unseen: 300 }, { planCoverAll: false });
  off.days.forEach(d => assert.equal(d.target, 20));
});

test('study plan: focus topics rotate, best first, two a day', () => {
  const p = coach.studyPlan('2026-09-28', '2026-09-24', { topics: [5, 2, 9] });
  assert.deepEqual(p.days.map(d => d.topics), [[5, 2], [9, 5], [2, 9], [5, 2]]);
  assert.deepEqual(coach.studyPlan('2026-09-26', '2026-09-24', {}).days[0].topics, [], 'no topics given: none named');
  assert.deepEqual(coach.studyPlan('2026-09-26', '2026-09-24', { topics: [7] }).days.map(d => d.topics), [[7], [7]]);
});

test('study plan: dates run on through month ends and the clocks going back', () => {
  const p = coach.studyPlan('2026-11-02', '2026-10-24', {});
  assert.deepEqual(p.days.map(d => d.date), ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
    '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(p.days[0].target, coach.coachDefaults.planGoal, 'no goal given: the default');
});

test('study plan: today\'s answers so far are shown against today\'s target', () => {
  const p = coach.studyPlan('2026-09-30', '2026-09-24', { goal: 10, practised: { '2026-09-24': 6 } });
  assert.equal(p.days[0].done, 6);
  assert.equal(p.days[1].done, 0);
});

// ---------- 4. misconceptions ----------
const MB = {
  m1: { id: 'm1', topic: 3, question: 'M one?', options: ['right', 'wrong B', 'wrong C', 'wrong D'], correctIndex: 0 },
  m2: { id: 'm2', topic: 3, question: 'M two?', options: ['wrong A', 'wrong B', 'right', 'wrong D'], correctIndex: 2 },
  m3: { id: 'm3', topic: 7, question: 'M three?', options: ['wrong A', 'right', 'wrong C'], correctIndex: 1 },
};
const pick = (q, p, ok, t) => ({ q, p, ok: !!ok, t: t || T0 });

test('misconceptions: the wrong option she keeps choosing, with count, share and the bank\'s words', () => {
  const hist = [pick('m2', 3, 0, 1), pick('m2', 3, 0, 2), pick('m2', 1, 0, 3), pick('m2', 3, 0, 4), pick('m2', 2, 1, 5)];
  const m = coach.misconceptions(hist, MB);
  assert.equal(m.questions.length, 1);
  assert.deepEqual(m.questions[0], { qid: 'm2', topic: 3, seen: 5, wrong: 4, recorded: 4, pick: 3, count: 3,
    share: 0.75, option: 'wrong D', answer: 'right', lastOk: true });
});

test('misconceptions: a one-off wrong pick is not "keeps choosing", but counts for its topic', () => {
  const m = coach.misconceptions([pick('m1', 2, 0)], MB);
  assert.deepEqual(m.questions, []);
  assert.deepEqual(m.topics, [{ topic: 3, wrongPicks: 1, picks: [{ qid: 'm1', pick: 2, count: 1, option: 'wrong C', answer: 'right' }] }]);
});

test('misconceptions: per topic, the most-chosen distractors first, top three', () => {
  const hist = [pick('m1', 1), pick('m1', 1), pick('m1', 1), pick('m1', 2), pick('m1', 3), pick('m1', 3),
    pick('m2', 0), pick('m2', 0), pick('m2', 1), pick('m3', 2)];
  const m = coach.misconceptions(hist, MB);
  assert.deepEqual(m.topics.map(t => [t.topic, t.wrongPicks]), [[3, 9], [7, 1]]);
  assert.deepEqual(m.topics[0].picks.map(p => [p.qid, p.pick, p.count]), [['m1', 1, 3], ['m1', 3, 2], ['m2', 0, 2]]);
  assert.deepEqual(m.questions.map(q => q.qid), ['m1', 'm2'], 'most repeated first');
});

test('misconceptions: answers with no pick, a pick that is now the right answer, or out of range are skipped', () => {
  const hist = [{ q: 'm1', ok: false, t: T0 }, pick('m1', 0), pick('m1', 9), pick('m1', 1.5), pick('m1', -1), pick('gone', 1)];
  const m = coach.misconceptions(hist, MB);
  assert.deepEqual(m, { questions: [], topics: [] });
  assert.deepEqual(coach.misconceptions([], MB), { questions: [], topics: [] });
  assert.deepEqual(coach.misconceptions(undefined, MB), { questions: [], topics: [] });
});

test('misconceptions: lastOk follows her latest answer by time, not list order', () => {
  const m = coach.misconceptions([pick('m3', 0, 0, 10), pick('m3', 1, 1, 5), pick('m3', 0, 0, 20)], MB);
  assert.equal(m.questions[0].lastOk, false);
  const m2 = coach.misconceptions([pick('m3', 0, 0, 10), pick('m3', 0, 0, 20), pick('m3', 1, 1, 30)], MB);
  assert.equal(m2.questions[0].lastOk, true);
});

// ---------- 5. badge closeness ----------
// The app's own badge list shape (badgeList in Theory Trainer.dc.html).
const appBadges = (at) => [
  { id: 'start', label: 'First go', need: 1, at: at.answered, done: at.answered >= 1 },
  { id: 'ten', label: 'Ten in a row', need: 10, at: at.bestRun, done: at.bestRun >= 10 },
  { id: 'hundred', label: 'Century', need: 100, at: at.answered, done: at.answered >= 100 },
  { id: 'streak7', label: 'Week on the trot', need: 7, at: at.streak, done: at.streak >= 7 },
  { id: 'mock', label: 'Mock passed', need: 1, at: at.passes, done: at.passes >= 1 },
  { id: 'alltopics', label: 'Every topic tried', need: 14, at: at.topics, done: at.topics >= 14 },
];

test('badges: the nearest one, and how many more of what earns it', () => {
  const b = coach.badgeCloseness({ answered: 90, run: 2, streak: 5, passes: 0, topics: 9 },
    appBadges({ answered: 90, bestRun: 8, streak: 5, passes: 0, topics: 9 }));
  assert.equal(b.nearest.id, 'hundred');
  assert.equal(b.nearest.more, 10);
  assert.equal(b.nearest.say, '10 more questions earns Century');
  assert.deepEqual(b.open.map(x => x.id), ['hundred', 'streak7', 'alltopics', 'ten', 'mock']);
  assert.equal(b.earned, 1);
});

test('badges: "in a row" counts from her current run, not her best ever', () => {
  const b = coach.badgeCloseness({ run: 0 }, appBadges({ answered: 5, bestRun: 8, streak: 0, passes: 0, topics: 1 }));
  const ten = b.open.find(x => x.id === 'ten');
  assert.equal(ten.more, 10);
  assert.equal(ten.say, '10 more right answers in a row earns Ten in a row');
  // With no stats value the badge's own `at` is used.
  assert.equal(coach.badgeCloseness({}, appBadges({ answered: 5, bestRun: 8, streak: 0, passes: 0, topics: 1 }))
    .open.find(x => x.id === 'ten').more, 2);
});

test('badges: one-of wording, earned badges stay earned, and all earned means none nearest', () => {
  const b = coach.badgeCloseness({ passes: 0 }, [{ id: 'mock', label: 'Mock passed', need: 1, at: 0 }]);
  assert.equal(b.nearest.say, '1 more mock passed earns Mock passed');
  const all = coach.badgeCloseness({ streak: 0 }, [{ id: 'streak7', label: 'Week on the trot', need: 7, at: 7, done: true }]);
  assert.equal(all.nearest, null);
  assert.equal(all.earned, 1);
  assert.deepEqual(coach.badgeCloseness(null, null), { nearest: null, open: [], earned: 0 });
  const custom = coach.badgeCloseness({ widgets: 1 }, [{ id: 'x', label: 'Widgeteer', stat: 'widgets', need: 4 }]);
  assert.equal(custom.nearest.say, '3 more to earn Widgeteer', 'a number with no wording still says how many');
});

// ---------- 6. streak with freezes ----------
// Consecutive days from a start date: run('2026-09-01', 3) -> ['2026-09-01', '2026-09-02', '2026-09-03'].
const run = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from + 'T00:00:00Z') + i * DAY).toISOString().slice(0, 10));

test('streak: no goal days is a streak of 0', () => {
  assert.deepEqual(coach.streakWithFreeze([], null, '2026-09-24'), { count: 0, freezes: 0, frozen: [], today: false, nextFreezeIn: 7 });
  assert.equal(coach.streakWithFreeze(undefined, undefined, '2026-09-24').count, 0);
});

test('streak: counts days in a row up to today; not practising YET today breaks nothing', () => {
  const s = coach.streakWithFreeze(run('2026-09-20', 5), null, '2026-09-24');
  assert.equal(s.count, 5);
  assert.equal(s.today, true);
  const y = coach.streakWithFreeze(run('2026-09-20', 4), null, '2026-09-24');
  assert.equal(y.count, 4);
  assert.equal(y.today, false);
});

test('streak: a missed day with no freeze starts it again', () => {
  const s = coach.streakWithFreeze(run('2026-09-18', 3).concat(run('2026-09-22', 3)), null, '2026-09-24');
  assert.equal(s.count, 3);
  assert.deepEqual(s.frozen, []);
});

test('streak: seven goal days earn a freeze that saves one missed day', () => {
  const days = run('2026-09-01', 7).concat(run('2026-09-09', 2));   // 8 Sept missed
  const s = coach.streakWithFreeze(days, null, '2026-09-10');
  assert.equal(s.count, 9, 'the frozen day keeps the streak but does not add to it');
  assert.deepEqual(s.frozen, ['2026-09-08']);
  assert.equal(s.freezes, 0);
  assert.equal(s.nextFreezeIn, 5);
});

test('streak: two missed days with one freeze still breaks it', () => {
  const days = run('2026-09-01', 7).concat(run('2026-09-10', 2));   // 8 and 9 Sept missed
  const s = coach.streakWithFreeze(days, null, '2026-09-11');
  assert.equal(s.count, 2);
  assert.deepEqual(s.frozen, []);
});

test('streak: freezes held are capped, and the earning rule is one config object', () => {
  const full = coach.streakWithFreeze(run('2026-09-01', 21), null, '2026-09-21');
  assert.equal(full.freezes, coach.coachDefaults.freeze.max);
  assert.equal(full.nextFreezeIn, null, 'full: no more to earn');
  const every3 = coach.streakWithFreeze(run('2026-09-01', 7), { every: 3 }, '2026-09-07');
  assert.equal(every3.freezes, 2);
  assert.equal(every3.nextFreezeIn, null);
  const none = coach.streakWithFreeze(run('2026-09-01', 3).concat(run('2026-09-05', 1)), { max: 0 }, '2026-09-05');
  assert.equal(none.count, 1, 'max 0: freezes switched off');
});

test('streak: future dates, junk and repeats are ignored', () => {
  const s = coach.streakWithFreeze(['2026-09-23', '2026-09-24', '2026-09-24', '2026-09-30', 'nope', null], null, '2026-09-24');
  assert.equal(s.count, 2);
});

test('dayCounts: answers per local day, for the plan and the streak', () => {
  const t = (d, h) => new Date(2026, 8, d, h).getTime();
  assert.deepEqual(coach.dayCounts([{ t: t(23, 9) }, { t: t(24, 8) }, { t: t(24, 20) }, { q: 'no time' }]),
    { '2026-09-23': 1, '2026-09-24': 2 });
});
