// Checks on the app's own files that don't need a browser — run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'Theory Trainer.dc.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// The block of the page between one "===== NAME =====" marker and the next.
function screen(name) {
  const start = app.indexOf('<!-- ============ ' + name + ' ============ -->');
  assert.ok(start >= 0, 'screen marker not found: ' + name);
  const end = app.indexOf('<!-- ============', start + 10);
  return app.slice(start, end < 0 ? undefined : end);
}

test('a wrong practice answer shows its "Remember" tip once, not twice', () => {
  // Bug found 2026-09-23: two blocks printed the same topic tip one above the other.
  // (The label now reads "Memory tip:" or "Remember:", so the tip text itself is counted.)
  const count = (screen('LEARN QUESTION').match(/\{\{ tipText \}\}/g) || []).length;
  assert.equal(count, 1);
});

test('every script the page loads is precached by the service worker', () => {
  // A script missing from CORE is missing offline — the app would break with no signal.
  const core = sw.match(/const CORE = \[([\s\S]*?)\];/)[1];
  const srcs = [...app.matchAll(/<script src="\.?\/?([^"]+)"/g)].map(m => m[1]);
  assert.ok(srcs.includes('picker.js'));
  for (const s of srcs) assert.ok(core.includes("'./" + s + "'"), s + ' is not in sw.js CORE');
});

// ---------- Quick setup, What's new, help and legal links (window.TTWelcome) ----------
// TTWelcome is a <script> in the page head holding plain data and pure functions. Run
// that exact block in a sandbox, so these tests check the code the app really runs.
const vm = require('node:vm');
const welcomeSrc = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.TTWelcome ='));
const W = (() => { const ctx = { window: {} }; vm.runInNewContext(welcomeSrc, ctx); return ctx.window.TTWelcome; })();
const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
const learner = extra => Object.assign({ settings: {}, attempts: [], tests: [], isParent: false }, extra);

test('the quick setup opens only on a new learner\'s first open, once her saved copy is in', () => {
  assert.equal(W.onboardingDue(learner({ dataReady: true })), true, 'new learner, data in');
  // A fresh device before the pull looks exactly like a new learner — saving her choices
  // then would make the empty copy newer than her real progress on the server.
  assert.equal(W.onboardingDue(learner({ dataReady: false })), false, 'waits for the cloud copy');
  assert.equal(W.onboardingDue(learner({ dataReady: true, settings: { onboardedAt: '2026-09-24' } })), false, 'done or skipped: never again by itself');
  assert.equal(W.onboardingDue(learner({ dataReady: true, attempts: [{ id: 'q1' }] })), false, 'has answered questions');
  assert.equal(W.onboardingDue(learner({ dataReady: true, tests: [{ score: 40 }] })), false, 'has sat a mock');
  assert.equal(W.onboardingDue(learner({ dataReady: true, isParent: true })), false, 'not in the admin view');
});

test('What\'s new shows once per version, only to a learner who was here before it', () => {
  const v = W.NEWS.version, old = learner({ attempts: [{ id: 'q1' }] });
  assert.equal(W.newsDue(Object.assign({ version: v }, old)), true, 'existing learner, never seen a card');
  assert.equal(W.newsDue(Object.assign({ version: v }, old, { settings: { seenVersion: 'v1-older' } })), true, 'saw an older version');
  assert.equal(W.newsDue(Object.assign({ version: v }, old, { settings: { seenVersion: v } })), false, 'dismissed for this version');
  assert.equal(W.newsDue(Object.assign({ version: '' }, old)), false, 'version unknown (offline first load)');
  assert.equal(W.newsDue(Object.assign({ version: 'v999-other' }, old)), false, 'notes describe another version: say nothing stale');
  assert.equal(W.newsDue(Object.assign({ version: v }, learner())), false, 'brand-new learner: it is all new');
  assert.equal(W.newsDue(Object.assign({ version: v }, old, { isParent: true })), false, 'admin view');
});

test('the app version is read from sw.js — from its text, or from the offline cache name', () => {
  assert.equal(W.versionFromSw(sw), swVersion);
  assert.equal(W.versionFromSw('no version here'), '');
  assert.equal(W.versionFromSw(undefined), '');
  // sw.js must still name its cache CACHE_PREFIX + VERSION, or the offline path reads nothing.
  const prefix = (sw.match(/const C = '([^']+)' \+ VERSION/) || [])[1];
  assert.equal(prefix, W.CACHE_PREFIX, 'sw.js cache name no longer matches TTWelcome.CACHE_PREFIX');
  assert.equal(W.versionFromCacheKeys([W.CACHE_PREFIX + 'v7-x', 'other-cache']), 'v7-x');
  assert.equal(W.versionFromCacheKeys([W.CACHE_PREFIX + 'v7-x', W.CACHE_PREFIX + 'v8-y']), '', 'two app caches mid-update: unknowable');
  assert.equal(W.versionFromCacheKeys([]), '');
});

test('What\'s new describes the version sw.js ships, in a few plain lines', () => {
  // Fails on purpose when a promotion bumps sw.js VERSION: rewrite TTWelcome.NEWS (top of
  // Theory Trainer.dc.html) for the new version, in plain words to the learner.
  assert.equal(W.NEWS.version, swVersion,
    'sw.js VERSION is ' + swVersion + ' but the What\'s new notes are for ' + W.NEWS.version +
    ' — rewrite TTWelcome.NEWS in Theory Trainer.dc.html (version and items) for ' + swVersion);
  assert.ok(W.NEWS.items.length >= 1 && W.NEWS.items.length <= 6, 'one to six lines');
  for (const line of W.NEWS.items) {
    assert.ok(line.split(/\s+/).length <= 30, 'too long for a card (30 words max): ' + line);
    assert.doesNotMatch(line, /[*`<>#]/, 'plain words only, no markdown or HTML: ' + line);
  }
});

test('Help, Privacy and Terms are on the sign-in screens and Settings; Help on Home; About from sign-in', () => {
  const ids = W.LINKS.map(l => l.id);
  for (const id of ['help', 'about', 'privacy', 'terms']) assert.ok(ids.includes(id), 'TTWelcome.LINKS has no ' + id);
  for (const name of ['LOGIN', 'ACCOUNT: SIGN IN / CREATE', 'SETTINGS']) {
    assert.match(screen(name), /\{\{ infoLinks \}\}/, name + ' has no help and legal links');
  }
  assert.match(screen('HOME'), /href="\{\{ helpHref \}\}"/, 'Home has no Help link');
  assert.equal(W.LINKS.find(l => l.id === 'help').href, 'help.html');
});

test('the "not affiliated with the DVSA" line is in Settings and on both sign-in screens', () => {
  assert.match(W.DVSA, /not affiliated with/i);
  assert.match(W.DVSA, /DVSA/);
  for (const name of ['LOGIN', 'ACCOUNT: SIGN IN / CREATE', 'SETTINGS']) {
    assert.match(screen(name), /\{\{ dvsaLine \}\}/, name + ' has no DVSA line');
  }
});

test('the quick setup changes the learner\'s own settings, not copies', () => {
  // Same test-date field and handler as Settings; goal and reminder choices from one list.
  const onb = screen('ONBOARDING');
  assert.match(onb, /value="\{\{ examDate \}\}" onChange="\{\{ examDateChange \}\}"/);
  assert.match(app, /goalChoices: TW\.GOALS\.map/);
  assert.match(app, /onbGoals: TW\.GOALS\.map/);
  assert.match(app, /remindHourChoices: TW\.REMIND_TIMES\.map/);
  assert.match(app, /onbTimes: TW\.REMIND_TIMES\.map/);
  assert.match(screen('SETTINGS'), /\{\{ redoOnboarding \}\}/, 'Settings cannot run the quick setup again');
});

test('every link in the page opens in its own tab without handing it the app window', () => {
  const anchors = [...app.matchAll(/<a\s[^>]*>/g)].map(m => m[0]);
  assert.ok(anchors.length >= 4, 'expected the help and legal links');
  for (const a of anchors) {
    assert.match(a, /target="_blank"/, 'opens in place, losing her screen: ' + a);
    assert.match(a, /rel="noopener"/, 'missing rel="noopener": ' + a);
  }
});

// Every help and legal page the app links to is a real file (help.html and legal/*.html
// from issue #2, about.html from #3 have all landed, so nothing is waiting any more).
for (const l of W.LINKS) {
  test('the ' + l.label + ' link points at a file that exists (' + l.href + ')', () => {
    assert.ok(fs.existsSync(path.join(root, l.href)), l.href + ' is linked from the app but does not exist');
  });
}

test('the notes button stays off the sign-in screens, where it covered the DVSA line', () => {
  // Found 2026-09-24 in the browser check: at 390px the floating notes button sat on top of
  // the Sign in screen's DVSA line. The sign-in views are login, auth and setup.
  const line = app.match(/const notesShown = ([^\n]+)/)[1];
  for (const v of ['login', 'auth', 'setup']) assert.match(line, new RegExp("view!=='" + v + "'"), 'notes button shows on ' + v);
});

test('the Settings Voice list can shrink to fit its card on a phone', () => {
  // Found 2026-09-24: a long voice name ("Microsoft George - English (United Kingdom)")
  // pushed the list 13px past its card at 390px. A flex item needs min-width:0 to shrink.
  const select = screen('SETTINGS').match(/<select value="\{\{ voiceSel \}\}"[^>]*>/)[0];
  assert.match(select, /min-width:0/);
});

test('every theme colour the page uses has a dark version, and every dark version is used', () => {
  // A var(--tt-…) with no TT_DARK entry renders as no colour at all (transparent text or
  // background) — in BOTH themes. An unused entry is dead weight in the one colour map.
  const map = app.slice(app.indexOf('var TT_DARK = {'), app.indexOf('};', app.indexOf('var TT_DARK = {')));
  const keys = new Set([...map.matchAll(/'((?:bg|fg|bd)-[0-9a-f]+)'/g)].map(m => m[1]));
  const used = new Set([...app.matchAll(/var\(--tt-((?:bg|fg|bd)-[0-9a-f]+)\)/g)].map(m => m[1]));
  for (const u of used) assert.ok(keys.has(u), '--tt-' + u + ' is used but has no TT_DARK entry');
  for (const k of keys) assert.ok(used.has(k), 'TT_DARK has ' + k + ' but the page never uses it');
});

// ---------- Coach insights on screen (window.TTInsights, issue #8) ----------
// TTInsights is a <script> in the page head: the words and rows for the pass prediction, what to
// work on, the study plan, the wrong answer she keeps choosing, the badge nudge, streak freezes
// and the family board. The numbers come from coach.js, so these tests feed the page's own
// block with the REAL coach.js results.
const coach = require('../coach.js');
const insightsSrc = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.TTInsights ='));
const I = (() => { const ctx = { window: {} }; vm.runInNewContext(insightsSrc, ctx); return ctx.window.TTInsights; })();
const bank = [1, 2, 3, 4, 5].flatMap(n => require('../questions-' + n + '.json'));
const TOPIC_NAMES = JSON.parse(app.match(/this\.TOPICS = (\[[^\]]+\]);/)[1]);
const DAYMS = 86400000;
// Objects made inside the vm sandbox have that sandbox's prototypes: compare plain copies.
const plain = v => JSON.parse(JSON.stringify(v));
// n answers over the bank's questions in order, the k-th at t0 + k minutes; ok(q, k) says which
// are right. A wrong answer picks the first wrong option.
function answers(n, ok, t0) {
  return Array.from({ length: n }, (_, k) => {
    const q = bank[k % bank.length], right = ok(q, k);
    return { q: q.id, t: (t0 || Date.UTC(2026, 8, 1, 12)) + k * 60000, ok: right, topic: q.topic, p: right ? q.correctIndex : (q.correctIndex === 0 ? 1 : 0) };
  });
}

test('insights: the block sits in the real head, not <helmet> (the camelCase rewrite would break it)', () => {
  const at = app.indexOf('window.TTInsights =');
  assert.ok(at > 0 && at < app.indexOf('\n<helmet>\n'));
});

test('insights: dates are her local days, weeks start on Monday, day names read the same everywhere', () => {
  assert.equal(I.localDay(new Date(2026, 8, 24, 0, 30).getTime()), '2026-09-24', 'just after midnight is still today');
  assert.equal(I.localDay(new Date(2026, 8, 24, 23, 59).getTime()), '2026-09-24');
  assert.equal(I.fmtDay('2026-09-24'), 'Thu 24 Sep');
  assert.equal(I.fmtDay('not a date'), 'not a date');
  assert.equal(I.weekStart('2026-09-24'), '2026-09-21', 'Thursday -> that Monday');
  assert.equal(I.weekStart('2026-09-21'), '2026-09-21', 'Monday is its own week start');
  assert.equal(I.weekStart('2026-09-27'), '2026-09-21', 'Sunday ends the week');
  assert.equal(I.weekStart('2026-09-24', 0), '2026-09-20', 'a Sunday start, when configured');
  assert.equal(I.CFG.weekStartsOn, 1);
});

test('insights: a goal day is recorded once she reaches her goal, and raising the goal never takes it back', () => {
  const none = [];
  assert.equal(I.recordGoalDay(none, '2026-09-24', 9, 10), none, 'short of the goal: list untouched');
  const one = I.recordGoalDay(none, '2026-09-24', 10, 10);
  assert.deepEqual(plain(one), ['2026-09-24']);
  assert.equal(I.recordGoalDay(one, '2026-09-24', 30, 10), one, 'already recorded: untouched');
  assert.deepEqual(plain(I.recordGoalDay(['2026-09-25'], '2026-09-24', 10, 10)), ['2026-09-24', '2026-09-25'], 'kept sorted');
  const long = Array.from({ length: I.CFG.goalDaysKept }, (_, i) => new Date(Date.UTC(2025, 0, 1) + i * DAYMS).toISOString().slice(0, 10));
  const kept = I.recordGoalDay(long, '2027-06-01', 10, 10);
  assert.equal(kept.length, I.CFG.goalDaysKept, 'only the newest are kept');
  assert.equal(kept[kept.length - 1], '2027-06-01');
  // Recorded days count whatever the goal is now; unrecorded history counts when it meets today's goal.
  assert.deepEqual(plain(I.goalDays(['2026-09-20'], { '2026-09-20': 12, '2026-09-21': 25, '2026-09-22': 5 }, 20)), ['2026-09-20', '2026-09-21']);
  // Her 3-day streak at a goal of 10 survives her raising the goal to 30.
  const days = ['2026-09-21', '2026-09-22', '2026-09-23'];
  const counts = { '2026-09-21': 10, '2026-09-22': 10, '2026-09-23': 10 };
  assert.equal(coach.streakWithFreeze(I.goalDays(days, counts, 30), null, '2026-09-24').count, 3);
  assert.equal(coach.streakWithFreeze(I.goalDays([], counts, 30), null, '2026-09-24').count, 0, 'without the record, the raise would have wiped it');
});

test('insights: the streak tile shows the freezes she holds and how to earn one, from coach.js rules', () => {
  const rules = coach.coachDefaults.freeze;
  const run = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, from) + i * DAYMS).toISOString().slice(0, 10));
  // 9 goal days up to yesterday: one freeze earned on day 7, 5 more goal days to the next.
  const held = I.streakTile(coach.streakWithFreeze(run(15, 9), null, '2026-09-24'), rules);
  assert.equal(held.count, '9');
  assert.equal(held.freezeLine, '1 freeze');
  assert.equal(held.held, 'you have 1');
  assert.equal(held.next, '5 more goal days earn the next one.');
  assert.match(held.howTo, new RegExp('Every ' + rules.every + ' days you reach your daily goal'));
  assert.match(held.howTo, new RegExp('hold ' + rules.max));
  assert.equal(held.saved, '');
  // 7 goal days, a missed day (22 Sep), then a goal day: the freeze kept the streak going (22 Sep 2026 is a Tuesday).
  const saved = I.streakTile(coach.streakWithFreeze(run(15, 7).concat(['2026-09-23']), null, '2026-09-24'), rules);
  assert.equal(saved.count, '8');
  assert.equal(saved.freezeLine, 'no freezes');
  assert.equal(saved.saved, 'A freeze saved your streak on Tue 22 Sep.');
  // Holding the most she can.
  const full = I.streakTile(coach.streakWithFreeze(run(1, 20), null, '2026-09-21'), rules);
  assert.equal(full.freezeLine, rules.max + ' freezes');
  assert.equal(full.next, 'You are holding the most you can (' + rules.max + ').');
  // The words follow the rules they are given, not copies of them.
  assert.match(I.streakTile({ count: 1, freezes: 0, nextFreezeIn: 1 }, { every: 5, max: 3 }).howTo, /Every 5 days.*hold 3/);
  assert.equal(I.streakTile({ count: 1, freezes: 0, nextFreezeIn: 1 }, rules).next, '1 more goal day earns the next one.');
});

test('insights: a pass chance is a percentage, never "0%" or "100%"', () => {
  assert.equal(I.pct(0.5), '50%');
  assert.equal(I.pct(0.384), '38%');
  assert.equal(I.pct(0), 'under 1%');
  assert.equal(I.pct(0.004), 'under 1%');
  assert.equal(I.pct(1), 'over 99%');
  assert.equal(I.pct(0.996), 'over 99%');
  assert.equal(I.pct(null), '—');
});

test('insights: pass prediction shows its numbers once there are enough answers, "not enough answers yet" before', () => {
  const minEv = coach.coachDefaults.minEvidence;
  const few = answers(minEv - 20, () => true);
  const thin = I.prediction(coach.passPrediction(few, [], bank), null, minEv);
  assert.equal(thin.enough, false);
  assert.equal(thin.score, '', 'no score shown on thin evidence');
  assert.equal(thin.need, 'The prediction needs ' + minEv + ' answers. You have ' + (minEv - 20) + ', so 20 more to go.');
  assert.equal(thin.needBar, Math.round(100 * (minEv - 20) / minEv));
  const none = I.prediction(coach.passPrediction([], [], bank), null, minEv);
  assert.equal(none.enough, false, 'no answers at all');
  assert.equal(none.needBar, 0);
  // Enough answers: right on every topic but Safety margins (4).
  const many = answers(200, q => q.topic !== 4);
  const p = coach.passPrediction(many, [], bank), list = coach.improvements(many, [], bank, { topicNames: TOPIC_NAMES });
  const shown = I.prediction(p, list[0], minEv);
  assert.equal(shown.enough, true);
  assert.equal(shown.score, String(Math.round(p.expected)));
  assert.equal(shown.total, '50');
  assert.equal(shown.passMark, '43');
  assert.equal(shown.chance, I.pct(p.probability));
  assert.equal(shown.raise, list[0].say, 'what would raise it is the coach\'s own top sentence');
  assert.match(shown.raise, /Safety margins/);
  assert.match(shown.basis, /Based on your 200 answers/);
  assert.match(shown.basis, /not a promise/);
});

test('insights: what to work on names the top topic and the next, with an early-days note under the minimum', () => {
  const minEv = coach.coachDefaults.minEvidence;
  assert.equal(I.workOn([], null, minEv).show, false, 'no answers: no card');
  const many = answers(200, q => q.topic !== 4 && q.topic !== 8);
  const list = coach.improvements(many, [], bank, { topicNames: TOPIC_NAMES });
  const w = I.workOn(list, coach.passPrediction(many, [], bank), minEv);
  assert.equal(w.show, true);
  assert.equal(w.topic, list[0].topic);
  assert.equal(w.say, list[0].say);
  assert.deepEqual([w.name, w.next.name].sort(), ['Safety margins', 'Vehicle handling']);
  assert.equal(w.early, '');
  const few = answers(12, q => q.topic !== 4);
  const early = I.workOn(coach.improvements(few, [], bank, { topicNames: TOPIC_NAMES }), coach.passPrediction(few, [], bank), minEv);
  assert.equal(early.early, 'Early days: this firms up once you have answered ' + minEv + ' (you have 12).');
});

test('insights: the study plan says what today needs, spreads missed days, and handles no date, a past date and test day', () => {
  assert.equal(I.plan(coach.studyPlan('', '2026-09-24', {}), TOPIC_NAMES).ok, false);
  assert.match(I.plan(coach.studyPlan('', '2026-09-24', {}), TOPIC_NAMES).headline, /Set your theory test date/);
  assert.match(I.plan(coach.studyPlan('2026-09-20', '2026-09-24', {}), TOPIC_NAMES).headline, /Sun 20 Sep\) has passed/);
  assert.match(I.plan(coach.studyPlan('2026-09-24', '2026-09-24', {}), TOPIC_NAMES).headline, /test day/);
  // Plan began 21 Sep, goal 20; she practised on 22 Sep only (21st and 23rd missed); test 14 Oct.
  const plan = coach.studyPlan('2026-10-14', '2026-09-24', { goal: 20, start: '2026-09-21',
    practised: { '2026-09-22': 20, '2026-09-24': 5 }, topics: [4, 8, 1] });
  const v = I.plan(plan, TOPIC_NAMES);
  assert.equal(v.ok, true);
  assert.equal(v.headline, 'Test on Wed 14 Oct · 20 days to go');
  assert.equal(v.missed, 'You missed 2 days (Mon 21 Sep, Wed 23 Sep). Those questions are spread over the days left, so each day asks a little more.');
  assert.equal(v.today.target, plan.days[0].target);
  assert.ok(v.today.target > 20, 'the missed days lift today above her goal of 20');
  assert.equal(v.today.done, 5);
  assert.equal(v.today.line, '5 done so far · ' + (v.today.target - 5) + ' to go');
  assert.equal(v.today.topics, 'Safety margins & Vehicle handling');
  assert.equal(v.rows.length, I.CFG.planDaysShown, 'lists the next ' + I.CFG.planDaysShown + ' days');
  assert.equal(v.rows[0].date, 'Today');
  assert.equal(v.rows[1].date, 'Fri 25 Sep');
  assert.equal(v.more, 'and ' + (20 - I.CFG.planDaysShown) + ' more days to test day');
  assert.match(v.workload, /Your goal is 20 a day\.$/);
  // Every unseen question has to fit before test day: the workload line says why it is higher.
  const cover = I.plan(coach.studyPlan('2026-09-29', '2026-09-24', { goal: 10, unseen: 300 }), TOPIC_NAMES);
  assert.equal(cover.today.target, 60);
  assert.match(cover.workload, /every question you haven’t seen yet comes up before test day/);
  assert.equal(cover.today.topics, 'a bit of everything', 'no ranked topics given');
  // Today's target met.
  const done = I.plan(coach.studyPlan('2026-09-29', '2026-09-24', { goal: 10, practised: { '2026-09-24': 12 } }), TOPIC_NAMES);
  assert.equal(done.today.left, 0);
  assert.equal(done.today.line, 'Done for today — anything more is a bonus.');
  assert.equal(done.today.bar, 100);
});

test('insights: misconception lines say which wrong answer she keeps choosing and how often, in the bank\'s words', () => {
  const q = bank.find(x => x.id === 't04q01'), wrong = [0, 1, 2, 3].filter(i => i !== q.correctIndex);
  const a = (p, ok, k) => ({ q: q.id, t: Date.UTC(2026, 8, 1 + k), ok, topic: q.topic, p });
  const line = at => I.missLine(I.missByQid(coach.misconceptions(at, bank))[q.id]);
  assert.equal(line([a(wrong[0], false, 0), a(wrong[0], false, 1), a(wrong[0], false, 2)]),
    'You keep choosing “' + q.options[wrong[0]] + '” — every time you got it wrong (3 times).');
  assert.equal(line([a(wrong[0], false, 0), a(wrong[1], false, 1), a(wrong[0], false, 2), a(wrong[0], false, 3)]),
    'You keep choosing “' + q.options[wrong[0]] + '” — 3 of your 4 wrong answers.');
  assert.match(line([a(wrong[0], false, 0), a(wrong[0], false, 1), a(q.correctIndex, true, 2)]), /^Right last time\. Before that you chose/);
  assert.equal(line([a(wrong[0], false, 0), a(wrong[1], false, 1)]), '', 'different wrong answers: nothing to say');
  assert.equal(I.missLine(null), '');
});

test('insights: "close to a badge" shows only once she is most of the way to one', () => {
  const badges = [{ id: 'ten', label: 'Ten in a row', need: 10, at: 0, done: false }, { id: 'hundred', label: 'Century', need: 100, at: 0, done: false }];
  assert.deepEqual(plain(I.badgeNudge(coach.badgeCloseness({ run: 8, answered: 40 }, badges))), { show: true, text: '2 more right answers in a row earns Ten in a row' });
  assert.equal(I.badgeNudge(coach.badgeCloseness({ run: 3, answered: 40 }, badges)).show, false, '30% and 40% of the way: not close');
  assert.equal(I.badgeNudge(coach.badgeCloseness({ run: 3, answered: 75 }, badges)).text, '25 more questions earns Century');
  assert.equal(I.badgeNudge(null).show, false);
  assert.equal(I.CFG.nudgeMinProgress, 0.7);
});

test('insights: the family board shows only learners who switched it on, this week\'s questions and streak, busiest first', () => {
  const fam = I.family([
    { id: 'u1', name: 'Catie', on: true, counts: { '2026-09-20': 50, '2026-09-21': 10, '2026-09-24': 5 }, streak: 4 },
    { id: 'u2', name: 'Sam', on: true, counts: { '2026-09-22': 30 }, streak: 1 },
    { id: 'u3', name: 'Jo', on: false, counts: { '2026-09-23': 99 }, streak: 9 }
  ], 'u1', '2026-09-21');
  assert.deepEqual(plain(fam.rows.map(r => r.name)), ['Sam', 'Catie (you)'], 'Jo did not opt in; last week\'s 50 do not count');
  assert.equal(fam.rows[0].week, '30 questions this week');
  assert.equal(fam.rows[1].week, '15 questions this week');
  assert.equal(fam.rows[1].streak, '4-day streak');
  assert.equal(fam.rows[1].me, true);
  assert.equal(fam.alone, false);
  assert.equal(I.family([{ id: 'u1', name: 'Catie', on: true, counts: {}, streak: 0 }], 'u1', '2026-09-21').alone, true);
  assert.equal(I.family([{ id: 'u1', name: 'Catie', on: true, counts: { '2026-09-21': 1 }, streak: 1 }], 'u1', '2026-09-21').rows[0].week, '1 question this week');
});

test('insights: each screen carries its piece, wired to the coach', () => {
  const home = screen('HOME'), prog = screen('MY PROGRESS (learner)'), plan = screen('STUDY PLAN'), ans = screen('MY ANSWERS');
  // Home: streak tile with freezes and its explainer; badge nudge; plan line; what to work on; family board.
  assert.match(home, /onClick="\{\{ freezeToggle \}\}" aria-expanded="\{\{ freezeExpanded \}\}" aria-controls="tt-freeze-info"/);
  assert.match(home, /\{\{ freezeLine \}\}/);
  assert.match(home, /id="tt-freeze-info"[\s\S]*\{\{ freezeHowTo \}\}[\s\S]*\{\{ freezeNext \}\}/);
  assert.match(home, /Close to a badge: \{\{ nudgeText \}\}/);
  assert.match(home, /onClick="\{\{ goPlan \}\}"[\s\S]*\{\{ planHomeLine \}\}/);
  assert.match(home, /aria-label="What to work on"[\s\S]*\{\{ workSay \}\}[\s\S]*onClick="\{\{ workDrill \}\}"/);
  assert.match(home, /aria-label="Family board"[\s\S]*\{\{ famRows \}\}/);
  // My Progress: the prediction straight after the readiness dial, and the plan.
  assert.ok(prog.indexOf('aria-label="Pass prediction"') > prog.indexOf('{{ readySub }}'), 'prediction comes straight after the readiness dial');
  assert.match(prog, /\{\{ predEnough \}\}[\s\S]*\{\{ predScore \}\}[\s\S]*\{\{ predChance \}\}/);
  assert.match(prog, /\{\{ predShort \}\}[\s\S]*Not enough answers yet/);
  assert.match(prog, /onClick="\{\{ goPlan \}\}"/);
  // Study plan: today, missed days, day by day, and the same date setting as Settings.
  assert.match(plan, /\{\{ planTodayTarget \}\}[\s\S]*onClick="\{\{ planGo \}\}"[\s\S]*\{\{ planMissed \}\}[\s\S]*\{\{ planRows \}\}/);
  assert.match(plan, /value="\{\{ examDate \}\}" onChange="\{\{ examDateChange \}\}"/);
  // The wrong answer she keeps choosing: both "Keeps tripping you up" cards and every My answers row.
  assert.equal((app.match(/\{\{ t\.miss \}\}/g) || []).length, 2);
  assert.doesNotMatch(app, /You tend to pick/);
  assert.match(ans, /\{\{ r\.miss \}\}/);
  assert.match(app, /s\.ansFilter==='same' \? !!missOf\[r\.id\]/, 'My answers can filter to the same wrong answer again');
  // Notes and the admin's Activity list know the new screen by name.
  assert.match(app, /plan:'Study plan'/);
  assert.match(app, /plan:'the study plan'/);
});

test('insights: the family board is a Settings switch, off unless she turns it on', () => {
  assert.match(app, /\['familyBoard','Family board',/);
  for (const m of app.matchAll(/Object\.assign\(\{textSize:1[^}]*\}/g)) assert.doesNotMatch(m[0], /familyBoard/, 'default settings must not switch it on');
  assert.match(app, /if\(view==='home' && st\.familyBoard\)/, 'the board is only worked out once she has switched it on');
});

test('insights: the numbers on screen come from coach.js, not copies', () => {
  assert.match(app, /I\.streakTile\(info, C\.coachDefaults\.freeze\)/, 'freeze rules');
  assert.match(app, /const minEv = C\.coachDefaults\.minEvidence/, '"not enough answers" threshold');
  assert.match(app, /nWork = C\.coachDefaults\.whatIfRight/, 'the what-to-work-on drill is the what-if\'s size');
  assert.match(app, /C\.mockMix\(this\.questionsFor\('test'\), C\.coachDefaults\.mockSize\)/, 'the mock mix');
  // A new test date restarts the plan; a goal met today is recorded for the streak.
  assert.match(app, /examDateChange: e=>this\.set\(\{settings: Object\.assign\(\{\}, st, \{examDate: e\.target\.value, planStart:/);
  assert.match(app, /stk\.goalDays = I\.recordGoalDay\(stk\.goalDays, localToday, doneToday, goal\)/);
  // The streak tile, badges and family board share one streak (streakFor).
  assert.match(app, /streak: this\.streakFor\(s\)\.count/);
  assert.match(app, /streak: this\.streakFor\(d\)\.count/);
});

// ---------- Issue #12: screens open mid-scroll, rows wider than a phone, notes button over
// Next, readiness number not drawn. Each test below failed before its fix. ----------
// TTScreen is a <script> in the page head (plain data and pure functions), run here in node.
const screenSrc = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.TTScreen ='));
// Missing block: TS stays null and each #12 test fails on its own (not the whole file).
const TS = screenSrc ? (() => { const ctx = { window: {} }; vm.runInNewContext(screenSrc, ctx); return ctx.window.TTScreen; })() : null;

test('#12: the screen helpers live in the real head, not <helmet>', () => {
  assert.ok(TS, 'no window.TTScreen block in the page head');
  const at = app.indexOf('window.TTScreen =');
  assert.ok(at > 0 && at < app.indexOf('\n<helmet>\n'), 'the camelCase rewrite in <helmet> would break it');
});

test('#12 A: a different screen or question gets a new screen key; answering in place does not', () => {
  assert.ok(TS, 'no window.TTScreen block in the page head');
  // Found 2026-09-24: tapping Road Signs low on Home opened Road Signs at scrollY 1398.
  const base = { view: 'home', testView: 'run', printPreview: false, session: { startedAt: 5, i: 0, picked: -1 }, test: { startedAt: 7, i: 0, answers: {} } };
  const key = patch => TS.key(Object.assign({}, base, patch));
  const k0 = key({});
  assert.notEqual(key({ view: 'signs' }), k0, 'another screen');
  assert.notEqual(key({ testView: 'review' }), k0, 'mock test: run -> review');
  assert.notEqual(key({ printPreview: true }), k0, 'print preview');
  assert.notEqual(key({ session: { startedAt: 5, i: 1, picked: -1 } }), k0, 'next practice question');
  assert.notEqual(key({ session: { startedAt: 9, i: 0, picked: -1 } }), k0, 'a new practice session');
  assert.notEqual(key({ test: { startedAt: 7, i: 1, answers: {} } }), k0, 'next mock question');
  assert.equal(key({ session: { startedAt: 5, i: 0, picked: 2 } }), k0, 'answering a question keeps her place');
  assert.equal(key({ test: { startedAt: 7, i: 0, answers: { 0: 1 } } }), k0, 'picking a mock answer keeps her place');
  assert.equal(TS.key(null), TS.key({}), 'no state yet');
});

test('#12 A: the page scrolls to the top when the screen key changes', () => {
  const upd = app.slice(app.indexOf('  componentDidUpdate(){'), app.indexOf('\n  }\n', app.indexOf('  componentDidUpdate(){')));
  assert.match(upd, /TTScreen\.key\(prev\) !== TTScreen\.key\(s\)[^\n]*window\.scrollTo\(0, 0\)/);
  // It must come before the early return for a change of learner, or switching learner skips it.
  assert.ok(upd.indexOf('window.scrollTo(0, 0)') < upd.indexOf("this.track('learner_opened'"), 'scroll before the learner early return');
});

test('#12 B: topic rows on My Progress and the admin dashboard wrap on a phone instead of squeezing', () => {
  // Found 2026-09-24: the admin dashboard's "Topics — weakest first" was 421px wide at 390px, and
  // after #22 My Progress's topic names had 18px left at the default text size, one or two
  // letters a line. Now the row wraps: the name keeps a sensible width, and the bar and its
  // figure move under it when the screen is narrow.
  const rows = [
    screen('MY PROGRESS (learner)').match(/<sc-for list="\{\{ progTopics \}\}"[\s\S]*?<\/sc-for>/)[0],
    screen('DASHBOARD').match(/<sc-for list="\{\{ topicBars \}\}"[\s\S]*?<\/sc-for>/)[0]
  ];
  for (const row of rows) {
    assert.match(row, /display:flex;flex-wrap:wrap/, 'the row must be allowed to wrap');
    const name = row.match(/<span style="([^"]*)">\{\{ t\.name \}\}/)[1];
    assert.match(name, /flex:1 1 \d+px/, 'the name keeps a basis, so it is never squeezed to a sliver');
    assert.match(name, /min-width:0/, 'the name can still shrink below its longest word on a tiny screen');
    assert.doesNotMatch(row, /width:150px/, 'no fixed 150px bar: it made the dashboard wider than a phone');
  }
  // "20 hardest questions": its one-line figure was 5px too wide at the largest text size.
  const hard = screen('DASHBOARD').match(/<sc-for list="\{\{ hardRows \}\}"[\s\S]*?<\/sc-for>/)[0];
  assert.match(hard, /display:flex;flex-wrap:wrap/);
  assert.doesNotMatch(hard, /white-space:nowrap/, 'the figure must be allowed to wrap');
});

test('#12 C: on question screens the notes button sits in the page, never floating over Next', () => {
  // Found 2026-09-24: at 390x844 the floating notes button covered "Next →" on a long mock question.
  assert.ok(TS, 'no window.TTScreen block in the page head');
  assert.deepEqual(plain(TS.INLINE_NOTES).sort(), ['learnQ', 'test']);
  const line = app.match(/const notesAvail = ([^\n]+)/)[1];
  assert.match(line, /!notesInline/, 'the floating button must not show where the in-page one does');
  for (const name of ['LEARN QUESTION', 'TEST RUNNING', 'TEST REVIEW']) {
    const s = screen(name);
    assert.match(s, /<sc-if value="\{\{ notesInline \}\}"[^>]*>\s*<div[^>]*><button onClick="\{\{ toggleNotes \}\}"/, name + ' has no in-page notes button');
    const next = name === 'TEST REVIEW' ? '{{ endTest }}' : name === 'TEST RUNNING' ? '{{ nextTQ }}' : '{{ nextQ }}';
    assert.ok(s.indexOf('{{ notesInline }}') > s.indexOf(next), name + ': the notes button must come after the ' + next + ' row');
  }
  // Every other page leaves room under its last line, so it can be scrolled clear of the button.
  assert.ok(TS.bottomPad(true) >= TS.NOTES.edge + TS.NOTES.size, 'the padding must clear the floating button');
  assert.ok(TS.bottomPad(false) < TS.bottomPad(true));
  assert.match(app, /<div style="\{\{ pageStyle \}\}">/, 'the page container takes its padding from TTScreen');
  assert.match(app, /pageStyle: [^\n]*TTScreen\.bottomPad\(notesAvail\)/);
  assert.match(app, /notesFabStyle: [^\n]*N\.size/, 'the floating button takes its size from TTScreen.NOTES');
});

test('#12 D: no {{ value }} inside SVG text, so the readiness number is drawn', () => {
  // Found 2026-09-24: the dial's <text>{{ readyPct }}%</text> became <text><span>38</span>%</text>,
  // and SVG does not draw an HTML <span>: only "%" showed.
  const markup = app.replace(/<!--[\s\S]*?-->/g, '');          // comments may name <text> freely
  const texts = [...markup.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m => m[1]);
  assert.ok(texts.length >= 2, 'expected the chart labels');
  for (const t of texts) assert.doesNotMatch(t, /\{\{/, 'a value inside SVG <text> is never drawn: ' + t);
  const dial = screen('MY PROGRESS (learner)').match(/<div data-tt-dial[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(dial, 'My Progress has no HTML readiness label over the dial');
  assert.match(dial[0], /\{\{ readyPct \}\}%/);
  // The How-to guide said the number was missing; that line goes with the fix.
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'help.html'), 'utf8'), /number in the middle of the dial doesn't show/);
});

test('insights: drill buttons do not promise a session length the drill does not keep', () => {
  // Found 2026-09-24 in the browser check: "Drill Safety margins · 10 questions" started 15,
  // because a question she is stuck on comes round again on top of the 10.
  assert.match(app, /workBtn: work\.show \? 'Drill ' \+ work\.name \+ ' now'/);
  assert.doesNotMatch(app, /' questions' : ''/);
  assert.match(app, /planGoLabel: [^\n]*left today\)'/);
});

test('insights: the How-to guide explains them with the numbers the app really uses', () => {
  // help.html (issue #2's guide) describes these screens; when coach.js or TTInsights.CFG changes,
  // this says which sentence of the guide to update.
  const guideText = fs.readFileSync(path.join(root, 'help.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const C = coach.coachDefaults;
  const expect = [
    'an answer ' + C.halfLifeDays + ' days older than your newest counts half as much',
    'Chance of ' + C.passMark + ' or more',
    'The prediction needs ' + C.minEvidence + ' answers',
    'Until you\'ve answered ' + C.minEvidence + ' questions',
    'Every ' + C.freeze.every + ' days you reach it earns a streak freeze , and you can hold ' + C.freeze.max,
    'about ' + C.whatIfRight + ' more right answers here',
    'the next ' + I.CFG.planDaysShown + ' days',
    'questions this week (since ' + ['Sunday', 'Monday'][I.CFG.weekStartsOn] + ')'
  ];
  for (const e of expect) assert.ok(guideText.includes(e), 'help.html should say: "' + e + '"');
  for (const id of ['freezes', 'workon', 'prediction', 'plan', 'family']) assert.match(fs.readFileSync(path.join(root, 'help.html'), 'utf8'), new RegExp('id="' + id + '"'), 'help.html has no #' + id);
  assert.doesNotMatch(guideText, /You tend to pick|Miss a day and it starts again from 1/, 'help.html still describes the old wording');
});

// ---------- Issue #9: your data, your age, explain it differently ----------
// TTPrivacy is a <script> in the page head (the words and small rules for Settings → Your data
// and the age question), run here in node. The age rule itself is backend.js
// TTAccount.needsGuardian reading config.js, loaded for real below, never a copy.
const privacySrc = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.TTPrivacy ='));
const PV = privacySrc ? (() => { const ctx = { window: {} }; vm.runInNewContext(privacySrc, ctx); return ctx.window.TTPrivacy; })() : null;
// backend.js in a bare fake browser, with the real config.js: only TTAccount's pure rules are used.
const ACCOUNT = (() => {
  const cfg = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), cfg);
  const store = new Map();
  const win = { TT_CONFIG: cfg.window.TT_CONFIG,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { protocol: 'https:', origin: 'https://example.org', pathname: '/', search: '', hash: '' }, history: { replaceState() {} },
    fetch: async () => ({ ok: true, status: 200, text: async () => '[]' }) };
  win.window = win;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'backend.js'), 'utf8'), win);
  return { account: win.TTAccount, rule: cfg.window.TT_CONFIG.age };
})();
const NOW = new Date().getFullYear();

test('#9: the privacy words live in the real head, not <helmet>', () => {
  assert.ok(PV, 'no window.TTPrivacy block in the page head');
  const at = app.indexOf('window.TTPrivacy =');
  assert.ok(at > 0 && at < app.indexOf('\n<helmet>\n'));
});

test('#9 delete: the typed word must be DELETE (any case, spaces trimmed)', () => {
  for (const ok of ['DELETE', 'delete', '  Delete ']) assert.equal(PV.confirmOk(ok), true, ok);
  for (const no of ['', 'DELET', 'DELETE ME', null, undefined]) assert.equal(PV.confirmOk(no), false, String(no));
  assert.equal(PV.CONFIRM_WORD, 'DELETE');
});

test('#9 delete: the explanation names every table the server deletes with the account', () => {
  // The server deletes the account; every table that references it "on delete cascade" goes too.
  const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8') + fs.readFileSync(path.join(root, 'supabase/schema-notifications.sql'), 'utf8');
  // A table runs to its own closing line; comments inside may hold a ";" (events does).
  const owned = [...sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)]
    .filter(m => /references auth\.users on delete cascade/.test(m[2])).map(m => m[1]);
  assert.ok(owned.length >= 6, 'could not read the account-owned tables from the schema');
  assert.deepEqual(plain(PV.DELETED.map(d => d.table)).sort(), owned.slice().sort(), 'TTPrivacy.DELETED must list exactly the tables that go with the account');
  for (const d of PV.DELETED) assert.ok(d.say.length > 10, d.table + ' needs a plain description');
  assert.match(PV.DEVICE, /signed out/);
  assert.match(PV.BEFORE, /Download my data first/);
  assert.match(PV.ADMIN, /admin account/);
});

test('#9 download: the file is named with the day it was made', () => {
  assert.equal(PV.exportName('2026-09-24'), 'theory-trainer-my-data-2026-09-24.json');
});

test('#9 age: the question opens by itself only on a known "no answer yet", and "Not now" puts it off', () => {
  const due = o => PV.ageDue(Object.assign({ signedIn: true, checked: true, info: { birthYear: null }, later: false }, o));
  assert.equal(due({}), true, 'signed in, the server says no answer yet');
  assert.equal(due({ info: { birthYear: 2008 } }), false, 'already answered');
  assert.equal(due({ checked: false }), false, 'the server has not answered (offline): do not guess');
  assert.equal(due({ info: null }), false, 'no profile row: nothing to save to');
  assert.equal(due({ signedIn: false }), false, 'signed out');
  assert.equal(due({ later: true }), false, '"Not now" until the app is next opened');
  assert.equal(PV.ageDue(null), false);
});

test('#9 age: a parent or guardian is asked for exactly when the backend.js rule says so', () => {
  // The rule is config.js TT_CONFIG.age.guardianUnder, applied by TTAccount.needsGuardian to the
  // YOUNGER possible age (only a year is stored). Years relative to now, so this never goes stale.
  const needs = ACCOUNT.account.needsGuardian, u = ACCOUNT.rule.guardianUnder;
  assert.equal(PV.askGuardian(String(NOW - u), needs), true, 'turns ' + u + ' this year: may still be ' + (u - 1));
  assert.equal(PV.askGuardian(String(NOW - u - 1), needs), false, 'at least ' + u);
  assert.equal(PV.askGuardian(String(NOW - 12), needs), true);
  assert.equal(PV.askGuardian(String(NOW - 40), needs), false);
  for (const partial of ['', '20', '201', 'abcd', null]) assert.equal(PV.askGuardian(partial, needs), false, 'not a full year yet: ' + partial);
});

test('#9 age: Settings says what is saved, in plain words', () => {
  assert.match(PV.ageLine(null), /Not given yet/);
  assert.match(PV.ageLine({ birthYear: null }), /Not given yet/);
  assert.equal(PV.ageLine({ birthYear: 1990, guardianConsent: false }), 'Born in 1990');
  assert.equal(PV.ageLine({ birthYear: 2012, guardianConsent: true, guardianEmail: 'p@example.com' }), 'Born in 2012 · a parent or guardian agreed (p@example.com)');
});

test('#9 age: the screen asks for the year, and under the age a consent tick and an email', () => {
  const age = screen('YOUR AGE');
  assert.match(age, /<sc-if value="\{\{ vAge \}\}"/);
  assert.match(age, /<input value="\{\{ ageYear \}\}" name="year" onChange="\{\{ ageChange \}\}" inputMode="numeric"/);
  assert.match(age, /\{\{ ageNeedsGuardian \}\}[\s\S]*type="checkbox" checked="\{\{ ageConsent \}\}" onChange="\{\{ ageConsentChange \}\}"[\s\S]*value="\{\{ ageEmail \}\}"/);
  assert.match(age, /role="alert"[^>]*>\{\{ ageErr \}\}/, 'the saveAge sentence is shown as it is');
  assert.match(age, /onClick="\{\{ ageSave \}\}"/);
  assert.match(age, /onClick="\{\{ ageLater \}\}"[^>]*>Not now</);
  // It saves through backend.js (which checks everything first), and the age is never typed in.
  assert.match(app, /TTAccount\.saveAge\(String\(s\.ageYear\|\|''\)\.trim\(\)/);
  assert.match(app, /ageRule\.guardianUnder/);
  assert.doesNotMatch(app, /'[^'\n]*under 16[^'\n]*'/, 'the age must come from config.js, not be written into the app');
  // It opens by itself after sign-in (refreshAccess asks the server) and comes first.
  assert.match(app, /refreshAccess\(\)\{[^]*?this\.checkAge\(\);/);
  assert.match(app, /const ageAuto = \(view==='login' \|\| view==='home'\) && TTPrivacy\.ageDue\(/);
  assert.match(app, /vLogin: view==='login' && !ageAuto/);
  // The browser harness account has answered, so other browser checks don't land on it.
  const harness = fs.readFileSync(path.join(root, 'tests/browser/harness.js'), 'utf8');
  assert.match(harness, /birthYear = 2000/);
  assert.match(harness, /birth_year: birthYear/);
});

test('#9 your data: Settings offers the download, the age and deleting the account', () => {
  const set = screen('SETTINGS');
  const sec = set.slice(set.indexOf('aria-label="Your data"'));
  assert.ok(set.includes('aria-label="Your data"'), 'Settings has no Your data section');
  assert.match(sec, /onClick="\{\{ privDownload \}\}"/);
  assert.match(sec, /\{\{ privAgeLine \}\}[\s\S]*onClick="\{\{ privAgeOpen \}\}"/);
  // Delete: what goes is listed, a word must be typed, and the button stays off until it is.
  assert.match(sec, /onClick="\{\{ privDelToggle \}\}" aria-expanded="\{\{ privDelExpanded \}\}" aria-controls="tt-delete"/);
  assert.match(sec, /id="tt-delete"[\s\S]*\{\{ privDeleted \}\}[\s\S]*\{\{ privDevice \}\}[\s\S]*Type \{\{ privWord \}\} to confirm<input value="\{\{ privTyped \}\}"/);
  assert.match(sec, /<button onClick="\{\{ privDelete \}\}" disabled="\{\{ privDeleteOff \}\}"/);
  assert.match(app, /privDeleteOff: !delReady/);
  assert.match(app, /const delReady = P\.confirmOk\(s\.delTyped\) && !s\.delBusy/);
  assert.match(sec, /role="alert"[^>]*>\{\{ privDelErr \}\}/);
  // The admin account gets the reason instead of the button.
  assert.match(sec, /<sc-if value="\{\{ privIsAdmin \}\}"[\s\S]*\{\{ privAdminNote \}\}/);
  assert.match(app, /privIsAdmin: !!s\.isAdminAccount, privCanDelete: !s\.isAdminAccount/);
  assert.match(sec, /href="legal\/privacy\.html#your-data"/);
});

test('#9 your data: the server does the work, its refusals are shown word for word, and the device forgets', () => {
  assert.match(app, /TTAccount\.exportData\(\)\s*\.then\(d=>\{ this\.download\(name, d\)/);
  assert.match(app, /TTAccount\.deleteAccount\(\)\s*\.then\(\(\)=>\{ this\.forgetThisDevice\(\); location\.replace\(location\.pathname \+ '\?deleted=1'\); \}\)/);
  assert.match(app, /delErr: e\.hint \? String\(e\.message\)/, 'a refusal from the server (admin, renewing subscription) is its own sentence');
  // After a deletion, the learners' progress on this device goes, or the next account signed in
  // here would be sent it; the reload lands on the sign-in screen saying so.
  const forget = app.slice(app.indexOf('  forgetThisDevice(){'), app.indexOf('\n  }\n', app.indexOf('  forgetThisDevice(){')));
  for (const k of ["'users', 'active', 'content'", "this.BASE + '.d.' + u.id", 'this.KEY']) assert.ok(forget.includes(k), 'forgetThisDevice does not remove ' + k);
  assert.match(app, /if\(\/\[\?&\]deleted=1\/\.test\(location\.search\)\)\{\s*this\.setState\(\{view:'auth'[^\n]*authMsg: TTPrivacy\.DONE\}\)/);
});

test('#9 explain it differently: after a wrong answer only, and only an approved one', () => {
  const learn = screen('LEARN QUESTION');
  assert.match(learn, /<sc-if value="\{\{ plainShow \}\}"[^>]*>\s*<button onClick="\{\{ plainToggle \}\}" aria-expanded="\{\{ plainExpanded \}\}" aria-controls="tt-plain"/);
  assert.match(learn, /id="tt-plain"[^>]*><b>In other words:<\/b> \{\{ plainText \}\}/);
  assert.match(app, /plainShow: answered && !ok && !!q\.plainExplanation,/);
  // backend.js hands the app a plain explanation only once the admin approved it.
  assert.match(fs.readFileSync(path.join(root, 'backend.js'), 'utf8'), /plainExplanation: r\.plain_status === 'approved' && r\.plain_explanation \? r\.plain_explanation : undefined/);
  // The admin's Activity list says it in words.
  assert.match(app, /case 'plain_shown': return 'Asked for it explained differently:' \+ qt;/);
});

test('#9 review: plain explanations reuse the memory-tips review screen, one entry per kind', () => {
  const tips = screen('MEMORY TIPS (admin)');
  assert.match(tips, /\{\{ tipsKinds \}\}[\s\S]*aria-pressed="\{\{ k\.on \}\}"/);
  assert.match(tips, /aria-label="\{\{ t\.aria \}\}"/);
  assert.match(tips, /\{\{ t\.originalShow \}\}[\s\S]*In the bank: \{\{ t\.original \}\}/);
  // Both kinds are rows of one map; the screen and the save code read from it, not from copies.
  const review = app.slice(app.indexOf('  REVIEW = {'), app.indexOf('\n  };', app.indexOf('  REVIEW = {')));
  assert.match(review, /tip: \{[^]*load: \(\)=>TTBank\.tips\(\), save: \(qid, text, status\)=>TTBank\.saveTip\(qid, text, status\)/);
  assert.match(review, /plain: \{[^]*load: \(\)=>TTBank\.explanations\(\), save: \(qid, text, status\)=>TTBank\.saveExplanation\(qid, text, status\)/);
  assert.match(review, /text:'plain_explanation', status:'plain_status'/);
  assert.match(app, /R\.save\(it\.qid, it\.tip, status\)/);
  assert.equal((app.match(/TTBank\.saveTip\(/g) || []).length, 1, 'one call site: the REVIEW map');
  assert.match(screen('DASHBOARD'), /Memory tips and plain explanations/);
});
