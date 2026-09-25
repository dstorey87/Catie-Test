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

test('#42: every script file runs once — none sits in <helmet>, none is listed twice', () => {
  // Bug found 2026-09-25: config.js and backend.js were <script src> tags inside <helmet>.
  // The browser ran them while reading the page, then support.js re-mounted <helmet> into
  // <head> and they ran AGAIN. Arriving from an email link, the second backend.js replaced
  // window.TTAuth mid-sign-in with a copy that had no user, so the admin was shown the
  // paywall and the age check and sync were skipped until a reload.
  const helmet = app.slice(app.indexOf('\n<helmet>\n'), app.indexOf('\n</helmet>'));
  assert.ok(helmet.length > 0, '<helmet> block not found');
  assert.deepEqual([...helmet.matchAll(/<script[^>]*\bsrc=/g)].map(m => m[0]), [], 'a <script src> in <helmet> runs twice');
  const srcs = [...app.matchAll(/<script src="\.?\/?([^"]+)"/g)].map(m => m[1]);
  for (const s of new Set(srcs)) assert.equal(srcs.filter(x => x === s).length, 1, s + ' is loaded more than once');
  for (const s of ['config.js', 'backend.js']) assert.ok(srcs.includes(s), s + ' is not loaded at all');
  // config.js before backend.js: backend.js reads window.TT_CONFIG when it is called.
  assert.ok(app.indexOf('<script src="./config.js">') < app.indexOf('<script src="./backend.js">'));
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

test('the Settings Voice speed buttons wrap instead of running off a phone at the largest text size', () => {
  // Found 2026-09-24 (issue #9's browser check): at 390px and the largest text size, "Faster"
  // ended 6px past the screen. The row and its buttons may now wrap onto a second line.
  const set = screen('SETTINGS');
  const row = set.slice(set.lastIndexOf('<div', set.indexOf('>Voice speed<')), set.indexOf('{{ speedChoices }}'));
  assert.match(row, /^<div style="display:flex;flex-wrap:wrap;/, 'the Voice speed row must be allowed to wrap');
  assert.match(row, /<div style="display:flex;flex-wrap:wrap;gap:6px"/, 'its buttons must be allowed to wrap');
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
  // On a question screen it is in the page at any width. Since #32 it is one button after every
  // screen (not a copy in each), so it comes after each question screen's Next / End test row.
  assert.match(app, /const notesInline = notesShown && \(onQuestion \|\| /);
  const at = tpl.indexOf('data-tt-notes-btn="1"');
  for (const name of ['LEARN QUESTION', 'TEST RUNNING', 'TEST REVIEW']) {
    const next = name === 'TEST REVIEW' ? '{{ endTest }}' : name === 'TEST RUNNING' ? '{{ nextTQ }}' : '{{ nextQ }}';
    assert.ok(screen(name).includes(next), name + ' has no ' + next + ' row');
    assert.ok(at > tpl.indexOf(next), name + ': the notes button must come after the ' + next + ' row');
  }
  // Floating (a wide screen), each page also leaves room under its last line.
  assert.ok(TS.bottomPad(true) >= TS.NOTES.edge + TS.NOTES.size, 'the padding must clear the floating button');
  assert.ok(TS.bottomPad(false) < TS.bottomPad(true));
  assert.match(app, /<div style="\{\{ pageStyle \}\}">/, 'the page container takes its padding from TTScreen');
  assert.match(app, /pageStyle: [^\n]*TTScreen\.bottomPad\(notesAvail\)/);
  assert.match(app, /const notesFab = [^\n]*N\.size/, 'the floating button takes its size from TTScreen.NOTES');
});

test('#12 D: no {{ value }} inside SVG text, so the readiness number is drawn', () => {
  // Found 2026-09-24: the dial's <text>{{ readyPct }}%</text> became <text><span>38</span>%</text>,
  // and SVG does not draw an HTML <span>: only "%" showed.
  const markup = app.replace(/<!--[\s\S]*?-->/g, '');          // comments may name <text> freely
  const texts = [...markup.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m => m[1]);
  for (const t of texts) assert.doesNotMatch(t, /\{\{/, 'a value inside SVG <text> is never drawn: ' + t);
  // The chart labels ("pass 43") are made by TTScreen.chartMarks since #38: plain words, no {{ }}.
  const label = TS.chartMarks([], 30, 43).find(m => m.tag === 'text');
  assert.equal(label.text, 'pass 43');
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

// ---------- Issue #10: WCAG 2.2 AA. What can be checked from the file itself is checked here;
// the browser audit (axe-core on every screen, a keyboard-only walk) is in changes/. ----------
// The page's markup only (between <x-dc> and </x-dc>), without the head's scripts.
const tpl = app.slice(app.indexOf('<x-dc>'), app.indexOf('</x-dc>'));
// Each opening tag of a kind, with where it starts: [{tag, at}]
const tags = (re) => [...tpl.matchAll(re)].map(m => ({ tag: m[0], at: m.index }));
// The markup from an opening <div ...> to its own closing </div> (divs nest, so count them).
function divBlock(at) {
  let depth = 0, i = at;
  const re = /<div\b|<\/div>/g; re.lastIndex = at;
  for (let m; (m = re.exec(tpl));) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) return tpl.slice(at, m.index); i = m.index; }
  return tpl.slice(at);
}
// WCAG 2 contrast ratio between two #rrggbb (or #rgb) colours (one copy, in tests/contrast.js).
const { contrast } = require('./contrast.js');
// The palette map: a token's light colour is in its name, its dark colour is the value.
const PALETTE = (() => {
  const map = app.slice(app.indexOf('var TT_DARK = {'), app.indexOf('};', app.indexOf('var TT_DARK = {')));
  return Object.fromEntries([...map.matchAll(/'((?:bg|fg|bd)-[0-9a-f]+)':'(#[0-9a-f]+)'/g)].map(m => [m[1], { light: '#' + m[1].split('-')[1], dark: m[2] }]));
})();

test('#10: the page says its language and has a title (WCAG 3.1.1, 2.4.2)', () => {
  assert.match(app, /^<!DOCTYPE html>\n<html lang="en-GB">/);
  assert.match(app.slice(0, app.indexOf('</head>')), /<title>Theory Trainer<\/title>/);
});

test('#10: the browser tab names the screen showing', () => {
  assert.ok(TS, 'no window.TTScreen block in the page head');
  assert.equal(TS.title('Mock test review'), 'Mock test review · Theory Trainer');
  assert.equal(TS.title(''), 'Theory Trainer', 'before a screen draws: the app name');
  assert.equal(TS.title(null), 'Theory Trainer');
  // After every redraw (and the first draw) the title follows the screen's data-screen-label.
  assert.match(app, /componentDidUpdate\(\)\{\n\s*const prev = this\._seen, s = this\.state, now = Date\.now\(\);\n\s*this\._seen = s;\n\s*this\.syncA11y\(prev\);/);
  assert.match(app, /this\.syncA11y\(null\);/);
  assert.match(app, /const title = TTScreen\.title\(screen && screen\.getAttribute\('data-screen-label'\)\);\n\s*if\(document\.title !== title\) document\.title = title;/);
});

test('#10: every screen has one main heading, which the app can move focus to (WCAG 1.3.1, 2.4.3)', () => {
  const markers = [...tpl.matchAll(/<!-- ============ (.+?) ============ -->/g)];
  let screens = 0;
  markers.forEach((m, i) => {
    const block = tpl.slice(m.index, i + 1 < markers.length ? markers[i + 1].index : undefined);
    if (!block.includes('data-screen-label')) return;
    screens++;
    const h1 = block.match(/<h1\b[^>]*>/g) || [];
    assert.equal(h1.length, 1, m[1] + ' has ' + h1.length + ' <h1>, not one');
    assert.match(h1[0], /tabindex="-1"/, m[1] + ': its heading cannot take focus');
  });
  assert.ok(screens >= 25, 'expected every screen, found ' + screens);
  assert.equal((tpl.match(/<main\b/g) || []).length, 1, 'one main landmark');
  // A new screen or question moves focus to that heading, so Tab carries on from the top.
  assert.match(app, /if\(TTScreen\.key\(prev\) !== TTScreen\.key\(s\)\)\{ const h = screen && screen\.querySelector\('h1'\); if\(h\) h\.focus\(\{preventScroll: true\}\); \}/);
});

test('#10: every button has a name: its own words or an aria-label (WCAG 4.1.2)', () => {
  const buttons = [...tpl.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.ok(buttons.length > 100);
  for (const [whole, attrs, inner] of buttons) {
    const label = (attrs.match(/aria-label="([^"]*)"/) || [])[1];
    const words = inner.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
    // A lone symbol (←, ✕, +, ✓) is not a name: a screen reader says "left arrow". Words need a
    // letter, a digit or a {{ value }}; otherwise the button needs an aria-label.
    assert.ok((label && label.trim()) || /[A-Za-z0-9]|\{\{/.test(words), 'a button with nothing to read out: ' + whole.slice(0, 160));
  }
});

test('#10: pictures have text: every <img> an alt, the road sign one named image (WCAG 1.1.1)', () => {
  for (const { tag } of tags(/<img\b[^>]*>/g)) assert.match(tag, /\balt="/, tag);
  const signs = fs.readFileSync(path.join(root, 'signs.js'), 'utf8');
  // The name says what it is, never what the sign means: on a question that is the answer.
  assert.match(signs, /role:'img', 'aria-label':ALT/);
  assert.match(signs, /var ALT = 'Road sign picture';/);
  // The mock-score chart is one image whose name is the scores (TTScreen.chartSay).
  const charts = tpl.match(/<svg viewBox="0 0 340 130"[^>]*>/g) || [];
  assert.equal(charts.length, 2, 'My Progress and the dashboard');
  for (const c of charts) assert.match(c, /role="img" aria-label="\{\{ chartSay \}\}"/);
  assert.equal(TS.chartSay([], 43), 'Mock test scores: none yet');
  assert.equal(TS.chartSay([{ score: 41, total: 50, pass: false }, { score: 45, pass: true }], 43),
    'Mock test scores, oldest first: 41 out of 50, not a pass; 45 out of 50, a pass. The dashed line is the pass mark, 43.');
});

test('#10: every role="button" can be reached and worked from the keyboard (WCAG 2.1.1)', () => {
  const rb = tags(/<[a-z]+\b[^>]*role="button"[^>]*>/g);
  assert.equal(rb.length, 2, 'the practice and mock answer options');
  for (const { tag } of rb) {
    assert.match(tag, /\btabindex="/, 'not reachable by Tab: ' + tag);
    assert.match(tag, /onKeyDown="\{\{ o\.key \}\}"/, 'no key handler: ' + tag);
  }
  // Both key handlers answer on Enter and on Space, only for the option itself.
  assert.equal((app.match(/key: e=>\{ if\(\(e\.key==='Enter'\|\|e\.key===' '\) && e\.target===e\.currentTarget\)\{ e\.preventDefault\(\);/g) || []).length, 2);
  // The two options the 50:50 hint takes away leave the Tab order.
  assert.match(screen('LEARN QUESTION'), /role="button" tabindex="\{\{ o\.tab \}\}"/);
  assert.match(app, /removed: hidden, tab: hidden \? -1 : 0,/);
});

test('#10: nothing clickable is a plain box a keyboard cannot reach (WCAG 2.1.1)', () => {
  // Only real controls take clicks. The one exception is the dimmed page behind the notes sheet:
  // a tap there closes it, and the keyboard has Close and Escape instead (aria-hidden).
  for (const { tag } of tags(/<(?:div|span|li|p|section|img|svg|td|tr)\b[^>]*\bonClick=[^>]*>/g)) {
    assert.ok(/role="button"/.test(tag) || /aria-hidden="true"/.test(tag), 'clickable but not a control: ' + tag.slice(0, 160));
  }
  // Road sign tiles, mock history rows and the editor's question list are buttons now.
  assert.match(screen('SIGNS'), /<button type="button" onClick="\{\{ s\.speak \}\}" aria-label="\{\{ s\.say \}\}"/);
  assert.match(screen('DASHBOARD'), /<button type="button" onClick="\{\{ h\.pick \}\}" aria-expanded="\{\{ h\.expanded \}\}"/);
  assert.match(screen('EDITOR'), /<button type="button" onClick="\{\{ q\.pick \}\}"/);
});

test('#10: no control sits inside another: the read-aloud button is beside its answer (WCAG 4.1.2)', () => {
  for (const { tag, at } of tags(/<div\b[^>]*role="button"[^>]*>/g)) {
    const inner = divBlock(at).slice(tag.length);
    assert.doesNotMatch(inner, /<button\b|<a\s|<input\b|<select\b|<textarea\b|tabindex="0"/, 'a control inside ' + tag.slice(0, 100));
  }
  for (const name of ['LEARN QUESTION', 'TEST RUNNING']) {
    assert.match(screen(name), /<\/div>\n\s*<button onClick="\{\{ o\.speak \}\}" aria-label="\{\{ o\.speakLabel \}\}"/, name + ': read-aloud is not a sibling of the option');
  }
});

test('#10: every form field has a name (WCAG 1.3.1, 4.1.2)', () => {
  const fields = tags(/<(?:input|select|textarea)\b[^>]*>/g);
  assert.ok(fields.length > 20);
  for (const { tag, at } of fields) {
    const named = /aria-label(?:ledby)?="[^"]+"/.test(tag);
    const inLabel = tpl.lastIndexOf('<label', at) > tpl.lastIndexOf('</label>', at);
    assert.ok(named || inLabel, 'a field with no name: ' + tag.slice(0, 160));
  }
  // The password field's label also holds the Show button: its own name keeps it "Password".
  assert.match(tpl, /name="pw" aria-label="Password"/);
});

test('#10: file uploads can be reached by Tab (no display:none file inputs) and show focus', () => {
  const files = tags(/<input type="file"[^>]*>/g);
  assert.equal(files.length, 3, 'question pack, import backup, profile photo');
  for (const { tag, at } of files) {
    assert.doesNotMatch(tag, /display:none/, tag);
    assert.match(tag, /class="tt-sr"/, tag);
    assert.match(tpl.slice(tpl.lastIndexOf('<label', at), at), /^<label class="tt-file"/, 'its label shows no focus ring');
  }
  assert.match(app, /\.tt-file\{position:relative\}\n\.tt-file:focus-within\{outline:3px solid var\(--tt-fg-0e7c6b\);outline-offset:2px\}/);
});

test('#10: switches say on or off, and choices say which one is picked (WCAG 4.1.2)', () => {
  assert.equal(TS.pressed(true), 'true');
  assert.equal(TS.pressed(false), 'false');
  assert.equal(TS.pressed(undefined), 'false');
  // A switch is a button holding a sliding knob.
  const switches = [...tpl.matchAll(/<button\b([^>]*)><span style="\{\{ [\w.]*(?:Knob|knob)[\w.]* \}\}"><\/span><\/button>/g)];
  assert.equal(switches.length, 7, 'settings rows (one row, repeated), timer (x2), packs (x2), subscription, reminder');
  for (const [, attrs] of switches) {
    assert.match(attrs, /role="switch"/, attrs);
    assert.match(attrs, /aria-checked="\{\{ [\w.]+ \}\}"/, attrs);
  }
  // A choice chip: a list item's pick with its own on/off style. Each says aria-pressed, and
  // the list it comes from gives it an `on`.
  const chips = [...tpl.matchAll(/<sc-for list="\{\{ (\w+) \}\}" as="(\w)"[^>]*>\s*<button onClick="\{\{ \2\.pick \}\}"([^>]*)style="\{\{ \2\.style \}\}"/g)];
  assert.ok(chips.length >= 15, 'found ' + chips.length);
  for (const [, list, v, attrs] of chips) {
    assert.match(attrs, new RegExp('aria-pressed="\\{\\{ ' + v + '\\.on \\}\\}"'), list + ' does not say which is picked');
    const at = app.search(new RegExp('\\b(?:const )?' + list + '(?::| =) '));
    assert.ok(at > 0, 'no render code for ' + list);
    assert.match(app.slice(at, at + 900), /\bon:/, list + ' gives its buttons no `on`');
  }
  for (const b of ['learnerChipOn', 'parentChipOn', 'qFlagPressed', 'flagPressed', 'w.flagOn', 'o.marked']) {
    assert.match(tpl, new RegExp('aria-pressed="\\{\\{ ' + b.replace('.', '\\.') + ' \\}\\}"'), b);
  }
  // The three text sizes all show "A": each has its own name.
  assert.match(app, /name: \['Normal text size', 'Bigger text', 'Biggest text'\]\[i\]/);
});

test('#10: a practice answer shows right and wrong with a tick and a cross, and says it (WCAG 1.4.1, 4.1.3)', () => {
  // Before she answers: nothing to mark.
  assert.equal(TS.optionMark(0, 2, -1), null);
  assert.deepEqual(plain(TS.optionMark(2, 2, 2)), { say: 'Your answer, right', glyph: '✓', ok: true });
  assert.deepEqual(plain(TS.optionMark(2, 2, 1)), { say: 'Right answer', glyph: '✓', ok: true });
  assert.deepEqual(plain(TS.optionMark(1, 2, 1)), { say: 'Your answer', glyph: '✗', ok: false });
  assert.equal(TS.optionMark(3, 2, 1), null, 'an option she did not pick and is not right');
  assert.equal(TS.optionLabel('B', 'Brake gently'), 'Answer B: Brake gently');
  assert.equal(TS.optionLabel('B', 'Brake gently', TS.optionMark(1, 1, 1)), 'Answer B: Brake gently. Your answer, right');
  assert.equal(TS.optionLabel('C', 'Speed up', null, true), 'Answer C: Speed up. Taken away by the hint');
  // The words heard are the bank's own option text, passed in, never made up.
  assert.equal(TS.answerSay(true, 'A', 'Check your mirrors'), 'Right. A: Check your mirrors');
  assert.equal(TS.answerSay(false, 'A', 'Check your mirrors'), 'Not quite. The right answer is A: Check your mirrors');
  const learn = screen('LEARN QUESTION');
  assert.match(learn, /<sc-if value="\{\{ o\.hasMark \}\}"[^>]*><span aria-hidden="true" style="\{\{ o\.markStyle \}\}">\{\{ o\.markGlyph \}\}<\/span><\/sc-if>/);
  assert.match(learn, /<div class="tt-sr" role="status">\{\{ answerSay \}\}<\/div>/);
  assert.match(learn, /aria-disabled="\{\{ o\.off \}\}"/);
  assert.match(app, /answerSay: answered \? TTScreen\.answerSay\(picked===vq\.correctIndex, 'ABCD'\[vq\.correctIndex\], vq\.options\[vq\.correctIndex\]\) : '',/);
  assert.match(app, /label: TTScreen\.optionLabel\('ABCD'\[i\], text, mark, hidden\),/);
  // The mock says which option is hers.
  assert.match(screen('TEST RUNNING'), /aria-pressed="\{\{ o\.pressed \}\}"/);
});

test('#10: each mock review square says in words what its colour and border show', () => {
  assert.equal(TS.reviewCellLabel(3, true, false), 'Question 3, answered');
  assert.equal(TS.reviewCellLabel(7, false, true), 'Question 7, not answered, flagged');
  assert.equal(TS.reviewCellLabel(1, true, true), 'Question 1, answered, flagged');
  assert.match(screen('TEST REVIEW'), /<button onClick="\{\{ c\.go \}\}" aria-label="\{\{ c\.label \}\}"/);
  assert.match(app, /label: TTScreen\.reviewCellLabel\(i\+1, done, fl\)/);
});

test('#10: the notes sheet is a dialog: focus in, Tab kept in, Escape out, focus back (WCAG 2.1.2, 2.4.3)', () => {
  assert.match(tpl, /<div role="dialog" aria-modal="true" aria-labelledby="tt-notes-title" data-tt-notes="1" onKeyDown="\{\{ notesKeyDown \}\}"/);
  assert.match(tpl, /<h2 id="tt-notes-title"/);
  assert.match(tpl, /<div onClick="\{\{ toggleNotes \}\}" aria-hidden="true"/);
  assert.match(app, /if\(e\.key==='Escape'\)\{ e\.preventDefault\(\); this\.setState\(\{notesOpen:false\}\); return; \}/);
  assert.match(app, /if\(e\.shiftKey && document\.activeElement===first\)\{ e\.preventDefault\(\); last\.focus\(\); \}/);
  assert.match(app, /else if\(!e\.shiftKey && document\.activeElement===last\)\{ e\.preventDefault\(\); first\.focus\(\); \}/);
  assert.match(app, /if\(!prev\.notesOpen && s\.notesOpen\)\{ const box = document\.querySelector\('\[data-tt-notes\] textarea'\); if\(box\) box\.focus\(\); return; \}/);
  assert.match(app, /const back = \(was && document\.contains\(was\)\) \? was : document\.querySelector\('\[data-tt-notes-btn\]'\);/);
  // Since #32 there is one notes button (in the page or floating), and it can take focus back.
  assert.equal((tpl.match(/<button onClick="\{\{ toggleNotes \}\}" data-tt-notes-btn="1"/g) || []).length, 1, 'the notes button can take focus back');
});

test('#10: focus always shows, and motion stops when the device asks (WCAG 2.4.7, 2.3.3)', () => {
  assert.match(app, /:focus-visible\{outline:3px solid var\(--tt-fg-0e7c6b\);outline-offset:2px\}/);
  // No inline style takes the ring away. (The page CSS drops it only on the tabindex="-1"
  // headings the app moves focus to: they are not controls.)
  assert.doesNotMatch(tpl, /style="[^"]*outline:\s*(?:none|0)/);
  assert.match(app, /\[tabindex="-1"\]:focus\{outline:none\}/);
  assert.match(app, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation-duration:\.01ms!important;animation-iteration-count:1!important;transition-duration:\.01ms!important;scroll-behavior:auto!important\}button:active\{transform:none\}\}/);
});

test('#10 contrast: every text colour set on a background passes 4.5:1, light AND dark (WCAG 1.4.3)', () => {
  // Every quoted style (markup attributes and the script's style strings) that sets both a
  // background and a text colour. Theme tokens are checked in both themes; plain hex is the same
  // in both. Large text would need only 3:1; 4.5:1 is asked of all of it, to keep this simple.
  const colour = (v, theme) => {
    const t = v.match(/^var\(--tt-((?:bg|fg)-[0-9a-f]+)\)$/);
    if (t) { assert.ok(PALETTE[t[1]], t[1] + ' is not in TT_DARK'); return PALETTE[t[1]][theme]; }
    return /^#[0-9a-fA-F]{3,6}$/.test(v) ? v : null;
  };
  let pairs = 0; const bad = [];
  for (const [, seg] of app.matchAll(/["']([^"'\n]*?(?:background|color)[^"'\n]*?)["']/g)) {
    const bg = seg.match(/(?:^|;)\s*background(?:-color)?:\s*(var\(--tt-bg-[0-9a-f]+\)|#[0-9a-fA-F]{3,6})\s*(?:;|$)/);
    const fg = seg.match(/(?:^|;)\s*color:\s*(var\(--tt-fg-[0-9a-f]+\)|#[0-9a-fA-F]{3,6})\s*(?:;|$)/);
    if (!bg || !fg) continue;
    for (const theme of ['light', 'dark']) {
      const b = colour(bg[1], theme), f = colour(fg[1], theme);
      if (!b || !f) continue;
      pairs++;
      const r = contrast(f, b);
      if (r < 4.5) bad.push(theme + ': ' + fg[1] + ' on ' + bg[1] + ' is ' + r.toFixed(2) + ':1 in "' + seg.slice(0, 90) + '"');
    }
  }
  assert.deepEqual(bad, [], 'under 4.5:1');
  assert.ok(pairs > 150, 'expected many pairs, found ' + pairs);
});

test('#10 contrast: every text colour reads on the page and on a card, light AND dark (WCAG 1.4.3)', () => {
  // The faint grey is for decoration only, and only ever on something hidden from screen readers.
  const words = Object.keys(PALETTE).filter(k => k.startsWith('fg-') && k !== 'fg-b5ae9e');
  for (const k of words) for (const theme of ['light', 'dark']) for (const bg of ['bg-fff', 'bg-faf6ef']) {
    const r = contrast(PALETTE[k][theme], PALETTE[bg][theme]);
    assert.ok(r >= 4.5, theme + ': ' + k + ' on ' + bg + ' is ' + r.toFixed(2) + ':1');
  }
  for (const m of app.matchAll(/<[^>]*var\(--tt-fg-b5ae9e\)[^>]*>/g)) assert.match(m[0], /aria-hidden="true"/, 'faint grey used for words: ' + m[0]);
  // Status colours as words go to their darker text colour (TTScreen.textTone), which passes.
  assert.equal(TS.textTone('#f2a93b'), 'var(--tt-fg-8a5a0b)');
  assert.equal(TS.textTone('#0E7C6B'), '#0E7C6B', 'other colours are left alone');
  for (const tone of Object.values(TS.TEXT_TONE)) {
    const k = tone.match(/--tt-(fg-[0-9a-f]+)/)[1];
    for (const theme of ['light', 'dark']) assert.ok(contrast(PALETTE[k][theme], PALETTE['bg-fff'][theme]) >= 4.5, k + ' ' + theme);
  }
  assert.match(app, /readyText: TTScreen\.textTone\(rdyColor\)/);
  assert.match(app, /flex:none;color:'\+TTScreen\.textTone\(col\)/);
});

test('#10 contrast: controls and states can be seen, 3:1 against what is next to them (WCAG 1.4.11)', () => {
  // A switch's track when off, against the card, in both themes (the white knob sits on it).
  for (const theme of ['light', 'dark']) {
    assert.ok(contrast(PALETTE['bg-8c8779'][theme], PALETTE['bg-fff'][theme]) >= 3, 'switch track ' + theme);
    assert.ok(contrast('#ffffff', PALETTE['bg-8c8779'][theme]) >= 3, 'knob on track ' + theme);
  }
  // A flagged mock square's border, and the chart's pass line, against the white square/card.
  assert.match(app, /if\(fl\) sty \+= 'background:var\(--tt-bg-fff\);border:2\.5px solid #C77E14;/);
  assert.ok(contrast('#C77E14', '#ffffff') >= 3);
  const passLine = TS.chartMarks([], 30, 43)[0];                 // drawn by TTScreen.chartMarks (#38)
  assert.deepEqual([passLine.tag, passLine.attrs.stroke, passLine.attrs['stroke-width'], passLine.attrs['stroke-dasharray']], ['line', '#C77E14', 1.5, '5 4']);
  assert.equal((tpl.match(/\{\{ chartMarks \}\}/g) || []).length, 2, 'both charts draw it');
});

test('#10 reflow: rows that ran off a 320px screen now wrap or shrink (WCAG 1.4.10)', () => {
  assert.match(screen('HOME'), /<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">/);
  assert.match(screen('MY PROGRESS (learner)'), /display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:20px">[\s\S]*<div style="flex:1 1 150px;min-width:0">/);
  assert.match(screen('TEST RESULTS'), /<span style="flex:0 1 110px;min-width:48px;height:9px;/);
  assert.match(screen('TEST RUNNING'), /<div style="flex:1;min-width:0;text-align:center;font-size:15px;color:var\(--tt-fg-6e6a5e\)">\{\{ tQNum \}\} of \{\{ tTotal \}\}<\/div>/);
});

// ---------- Adventure mode in the app (window.TTAdv, issue #27) ----------
// adventure.html saves into the learner's own record (theoryTrainer.d.<id>): answers, XP, flags
// and its progress under 'adventure'. The app must keep all of it. TTAdv is a <script> in the page
// head (plain functions), run here in a sandbox; persist() and loadUser() are lifted out of the
// page as they are written and run against a fake localStorage, so these tests check the code the
// app really runs.
const advSrc = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.TTAdv ='));
const ADV = (() => { const ctx = { window: {} }; vm.runInNewContext(advSrc, ctx); return ctx.window.TTAdv; })();
// One method of the app's component, from its name to the next method's name.
function method(start, next) {
  const a = app.indexOf('\n  ' + start), b = app.indexOf('\n  ' + next, a + 1);
  assert.ok(a >= 0 && b > a, 'method not found in the page: ' + start);
  return app.slice(a, b);
}
// A stand-in for the app: its real persist(), loadUser() and mergeSnapshot() (the cloud sync's
// merge, with the real coach.js as TTCoach) over a fake localStorage (store).
function fakeApp(store) {
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const ctx = { window: {}, localStorage, JSON, Date, Object, TTCoach: coach };
  vm.runInNewContext(advSrc, ctx);
  ctx.TTAdv = ctx.window.TTAdv;
  vm.runInNewContext('var me = {' + method('persist(extra){', 'set(patch){') + ',' + method('loadUser(id, keepSession){', 'addLearner(){') +
    ',' + method('mergeSnapshot(b){', 'pullCloud(){') + '};', ctx);
  return Object.assign(ctx.me, {
    BASE: 'theoryTrainer', users: [{ id: 'u1', name: 'Catie' }],
    state: { userId: 'u1', settings: {}, overrides: {}, custom: [], deleted: [], packNames: {}, packLearn: {}, packTest: {}, sub: {} },
    setState(patch, cb) { Object.assign(this.state, patch); if (cb) cb(); },
    forceUpdate() {}
  });
}
// What adventure.html leaves in her record after one stage (the shape adventure.js writes).
const pageSaved = () => ({
  settings: { learnerName: 'Catie' }, xp: 70, updatedAt: 1,
  attempts: [{ q: 'q1', t: 1, ok: true, topic: 1, p: 0, src: 'adventure' }],
  revisionFlags: { q2: { t: 1, src: 'adventure' } }, flagCleared: {},
  adventure: { stages: { w1s1: { best: 1, stars: 3, passed: true, plays: 1, lastAt: 1 } } }
});

test('adventure: the TTAdv block sits in the real head, not <helmet> (the camelCase rewrite would break it)', () => {
  const at = app.indexOf('window.TTAdv =');
  assert.ok(at > 0 && at < app.indexOf('\n</head>') && at < app.indexOf('\n<helmet>\n'));
});

test('adventure: opening the app keeps what the Adventure page saved (answers, XP, flags and progress)', () => {
  // Bug this prevents (issue #27): persist() rebuilt her record from the app's state alone, so
  // the first save after opening the app dropped 'adventure' - all her stages and stars.
  const store = { 'theoryTrainer.d.u1': JSON.stringify(pageSaved()) };
  const me = fakeApp(store);
  me.loadUser('u1');                                   // opening her: reads, then saves
  assert.deepEqual(plain(me.state.attempts), pageSaved().attempts, 'the page\'s answers are loaded');
  assert.equal(me.state.xp, 70, 'the page\'s XP is loaded');
  assert.ok(me.state.revisionFlags.q2, 'the page\'s flag is loaded');
  const saved = JSON.parse(store['theoryTrainer.d.u1']);
  assert.deepEqual(saved.adventure, pageSaved().adventure, 'persist kept the Adventure progress');
  assert.equal(saved.xp, 70);
  assert.equal(saved.attempts.length, 1);
});

test('adventure: persist keeps the page\'s LATEST progress, not the copy the app loaded', () => {
  // The page saves again while the app is open (another tab): the app's next save must carry
  // the new progress over, because the app never changes Adventure progress itself.
  const store = { 'theoryTrainer.d.u1': JSON.stringify(pageSaved()) };
  const me = fakeApp(store);
  me.loadUser('u1');
  const later = JSON.parse(store['theoryTrainer.d.u1']);
  later.adventure.stages.w1s2 = { best: 6 / 7, stars: 1, passed: true, plays: 1, lastAt: 2 };
  store['theoryTrainer.d.u1'] = JSON.stringify(later);
  me.persist();
  assert.ok(JSON.parse(store['theoryTrainer.d.u1']).adventure.stages.w1s2, 'the newer stage survived the app saving');
});

test('adventure: a learner who never played gets no adventure entry, and junk is survived', () => {
  const store = {};
  fakeApp(store).loadUser('u1');
  assert.equal(JSON.parse(store['theoryTrainer.d.u1']).adventure, undefined);
  // TTAdv.keep on its own: only the KEEP parts come across, the inputs are not changed.
  const saved = { adventure: { stages: {} }, attempts: ['old'], other: 1 }, next = { attempts: ['new'] };
  const out = ADV.keep(saved, next);
  assert.deepEqual(plain(out), { attempts: ['new'], adventure: { stages: {} } });
  assert.deepEqual(next, { attempts: ['new'] }, 'next is not changed');
  for (const junk of [null, undefined, 'text', 5]) assert.deepEqual(plain(ADV.keep(junk, next)), { attempts: ['new'] });
});

// ---------- Issue #38 item 1: Adventure progress lost across devices ----------
// mergeSnapshot() is the cloud sync's merge. It took the newer copy of each learner's whole
// record and merged only flags question by question. A device that had never played Adventure
// saved a newer record with no 'adventure', and the sync then replaced the stars on this device.
// These tests run the app's real mergeSnapshot() (lifted out of the page, as above).
// The other device's copy of her record as the server hands it over: newer than this device's
// (whose persist() stamps the time now) unless extra gives an older updatedAt.
const otherDevice = (id, extra) => ({ users: [{ id: 'u1', name: 'Catie' }, { id: 'u2', name: 'Sam' }],
  data: { [id]: Object.assign({ settings: { learnerName: 'Catie' }, xp: 90, updatedAt: Date.now() + 3600000, attempts: [], revisionFlags: {}, flagCleared: {} }, extra) } });

test('#38 item 1: a newer record from a device that never played Adventure keeps her stars', () => {
  const store = { 'theoryTrainer.d.u1': JSON.stringify(pageSaved()) };      // this device: w1s1, 3 stars
  const me = fakeApp(store);
  me.loadUser('u1');
  me.mergeSnapshot(otherDevice('u1'));                                       // newer, with no 'adventure'
  const saved = JSON.parse(store['theoryTrainer.d.u1']);
  assert.deepEqual(saved.adventure, pageSaved().adventure, 'the sync wiped her Adventure progress');
  assert.deepEqual(plain(me.state.adventure), pageSaved().adventure, 'the app shows it after the sync');
  assert.equal(saved.xp, 90, 'the rest of the newer record still wins');
});

test('#38 item 1: stages played on each device are joined stage by stage, whichever record is newer', () => {
  const w1s2 = { best: 6 / 7, stars: 1, passed: true, plays: 1, lastAt: 4 };
  // The other device is newer and played lesson 2; this one played lesson 1.
  let store = { 'theoryTrainer.d.u1': JSON.stringify(pageSaved()) };
  let me = fakeApp(store);
  me.loadUser('u1');
  me.mergeSnapshot(otherDevice('u1', { adventure: { stages: { w1s2 } } }));
  assert.deepEqual(Object.keys(JSON.parse(store['theoryTrainer.d.u1']).adventure.stages).sort(), ['w1s1', 'w1s2']);
  // This device is newer: the other device's lesson 2 still comes in (before, nothing was written).
  store = { 'theoryTrainer.d.u1': JSON.stringify(pageSaved()) };
  me = fakeApp(store);
  me.loadUser('u1');
  me.mergeSnapshot(otherDevice('u1', { updatedAt: 5, adventure: { stages: { w1s2 } } }));
  const saved = JSON.parse(store['theoryTrainer.d.u1']);
  assert.deepEqual(Object.keys(saved.adventure.stages).sort(), ['w1s1', 'w1s2']);
  assert.equal(saved.xp, 70, 'this newer record keeps its own XP');
});

test('#38 item 1: progress the server lacks is sent back; a learner who never played gets no entry', () => {
  // Sam (u2) is not the learner on screen, so nothing reloads: only the merge can ask to send.
  const sams = { settings: { learnerName: 'Sam' }, updatedAt: 1, adventure: { stages: { w1s1: { best: 1, stars: 3, passed: true, plays: 1, lastAt: 1 } } } };
  const store = { 'theoryTrainer.d.u2': JSON.stringify(sams) };
  const me = fakeApp(store);
  me.users.push({ id: 'u2', name: 'Sam' });
  me._dirty = false;
  me.mergeSnapshot(otherDevice('u2'));
  assert.deepEqual(JSON.parse(store['theoryTrainer.d.u2']).adventure, sams.adventure);
  assert.equal(me._dirty, true, 'the server\'s copy has no stars: this device must push its merged copy back');
  // Neither copy has Adventure progress: none is made up.
  const store2 = { 'theoryTrainer.d.u2': JSON.stringify({ updatedAt: 1 }) };
  const me2 = fakeApp(store2);
  me2.mergeSnapshot(otherDevice('u2'));
  assert.equal(JSON.parse(store2['theoryTrainer.d.u2']).adventure, undefined);
  assert.match(method('mergeSnapshot(b){', 'pullCloud(){'), /TTCoach\.mergeAdventure\(loc\.adventure, ?remote\.adventure\)/, 'uses the one coach.js rule');
});

test('adventure: the Home card says the world she is on and her stars, counted from coach.js', () => {
  const route = coach.adventureRoute(bank), max = coach.ADVENTURE.stars.length;
  const all = route.flatMap(w => w.stages), w1 = route[0].stages;
  const card = progress => plain(ADV.card(route, coach.adventureStatus(route, progress), max));
  const passed = (ids, stars) => ({ stages: Object.fromEntries(ids.map(id => [id, { best: 1, stars, passed: true, plays: 1, lastAt: 1 }])) });
  // Brand new: world 1, no stars yet, out of every star on the route.
  let c = card({});
  assert.equal(c.head, 'World 1 · ' + TOPIC_NAMES[0]);
  assert.equal(c.sub, 'Start your road trip through ' + route.length + ' topics');
  assert.equal(c.stars, '0 / ' + all.length * max);
  // One lesson passed with 3 stars: still world 1, one stage along.
  c = card(passed([w1[0].id], 3));
  assert.equal(c.head, 'World 1 · ' + TOPIC_NAMES[0]);
  assert.equal(c.sub, '1 of ' + w1.length + ' stages passed');
  assert.equal(c.stars, '3 / ' + all.length * max);
  // World 1's checkpoint passed: the card moves on to world 2.
  c = card(passed(w1.map(s => s.id), 1));
  assert.equal(c.head, 'World 2 · ' + TOPIC_NAMES[1]);
  assert.equal(c.sub, '0 of ' + route[1].stages.length + ' stages passed');
  assert.match(c.label, /^Adventure: World 2/, 'the button\'s spoken name starts with the word on it');
  // Everything passed: done, with more stars to collect or none left.
  assert.deepEqual([card(passed(all.map(s => s.id), 1)).head, card(passed(all.map(s => s.id), 1)).sub], ['Every world done', 'Replay any stage for more stars']);
  assert.equal(card(passed(all.map(s => s.id), max)).sub, 'Every star earned');
  // With the sign worlds (issue #48) on the route: still "through 14 topics" (they are not topics),
  // and their stars count in the total.
  const signs = [{ id: 'orders', name: 'Signs giving orders', qids: ['sign:a', 'sign:b', 'sign:c', 'sign:d'] }];
  const withSigns = coach.adventureRoute(bank, { signs });
  c = plain(ADV.card(withSigns, coach.adventureStatus(withSigns, {}), max));
  assert.equal(c.sub, 'Start your road trip through ' + route.length + ' topics');
  assert.equal(c.stars, '0 / ' + withSigns.flatMap(w => w.stages).length * max);
  // No questions loaded yet: says what Adventure is, with no numbers.
  c = plain(ADV.card([], coach.adventureStatus([], {}), max));
  assert.equal(c.stars, '');
  assert.doesNotMatch(c.head + c.sub, /\d/);
});

test('adventure: Home has the card under Today\'s lesson, opening adventure.html in this tab', () => {
  const home = screen('HOME');
  const lesson = home.indexOf('{{ startDailyLesson }}'), card = home.indexOf('{{ goAdventure }}');
  assert.ok(lesson > 0 && card > lesson && card < home.indexOf('{{ workShow }}'), 'the card sits right after Today\'s lesson');
  for (const v of ['advHead', 'advSub', 'advStars', 'advLabel']) assert.ok(home.includes('{{ ' + v + ' }}'), 'the card does not show ' + v);
  // A button, not a link: the app is not left open in another tab, where its next save would
  // write over what the page saves.
  assert.match(app, /goAdventure: ?go\b/);
  assert.match(app, /location\.href = 'adventure\.html'/);
  assert.ok(fs.existsSync(path.join(root, 'adventure.html')));
  // Worked out by coach.js from the questions adventure.html uses, and her saved progress.
  const vals = method('adventureVals(view){', 'insightVals(view){');
  // The same route adventure.html plays: the topic worlds, then the sign worlds (issue #48).
  assert.match(vals, /C\.adventureRoute\(this\.bankQuestions\(\), \{signs: window\.TTSigns \? TTSigns\.worlds\(\) : \[\]\}\)/);
  assert.match(vals, /C\.adventureStatus\(route, this\.state\.adventure/);
  assert.match(vals, /C\.ADVENTURE\.stars\.length/);
  assert.match(app, /adventure: saved\.adventure/, 'the first load reads her Adventure progress');
  assert.match(method('loadUser(id, keepSession){', 'addLearner(){'), /adventure: ?blob\.adventure/, 'switching learner reads it');
});

test('adventure: back from another page with the browser\'s Back button, the app re-reads her data', () => {
  // A page restored from the back/forward cache still holds the state from before the Adventure
  // page saved: without this, its next save would write over those answers, XP and flags.
  assert.match(method('componentDidMount(){', 'componentWillUnmount(){'),
    /addEventListener\('pageshow', ?e ?=> ?\{ ?if\(e\.persisted && this\.state\.userId\) this\.loadUser\(this\.state\.userId, true\)/);
});

test('adventure: the How-to guide explains it with the numbers coach.js really uses', () => {
  const guide = fs.readFileSync(path.join(root, 'help.html'), 'utf8');
  const sec = guide.slice(guide.indexOf('<section id="adventure"'), guide.indexOf('</section>', guide.indexOf('<section id="adventure"')));
  const A = coach.ADVENTURE, pct = x => Math.round(x * 100) + '%';
  for (const e of [
    'one world for each of the ' + coach.TOPIC_NAMES.length + ' theory test topics',
    'starting with ' + coach.TOPIC_NAMES[0],
    'lessons of ' + A.lessonSize + ' questions',
    'checkpoint: ' + A.checkpointSize + ' questions',
    pct(A.passPct) + ' or more right to pass',
    '1 star at ' + pct(A.stars[0]) + ', 2 at ' + pct(A.stars[1]) + ' and 3 at ' + pct(A.stars[2])
  ]) assert.ok(sec.includes(e), 'coach.js changed: help.html #adventure should say "' + e + '"');
  assert.ok(guide.includes('<a href="#adventure">Adventure mode</a>'), 'the contents has no Adventure mode link');
});

// ---------- Issue #32: the v12 live browser check (388 checks at 390/1280, light and dark).
// Every test below failed on v12. Items 1 and 2 were already fixed on develop by #10 (checked in
// the browser again for #32); their tests pin the fix. The rest failed on develop before #32. ----------

test('#32 item 1: the explanation\'s read-aloud button is a solid circle in theme colours, its icon 3:1 in both themes', () => {
  // v12: background:rgba(255,255,255,.7), see-through white that stayed white in dark mode, under
  // the dark theme's light icon: 1.47:1 (WCAG 1.4.11 asks 3:1 of an icon).
  const tag = screen('LEARN QUESTION').match(/<button onClick="\{\{ speakExp \}\}"[^>]*>/);
  assert.ok(tag, 'no read-aloud button on the explanation');
  const bg = tag[0].match(/background:var\(--tt-(bg-[0-9a-f]+)\)/), fg = tag[0].match(/;color:var\(--tt-(fg-[0-9a-f]+)\)/);
  assert.ok(bg && fg, 'its background and icon must both be theme colours (a fixed white does not change with the theme)');
  for (const theme of ['light', 'dark']) {
    const r = contrast(PALETTE[fg[1]][theme], PALETTE[bg[1]][theme]);
    assert.ok(r >= 3, theme + ': icon on its circle is ' + r.toFixed(2) + ':1');
  }
});

test('#32 item 2: Settings\' Voice list and "My theory test date" have names a screen reader says', () => {
  // v12: both had none (the same date field in Study plan and the quick setup did).
  const set = screen('SETTINGS');
  assert.match(set, /<select value="\{\{ voiceSel \}\}"[^>]*aria-label="Voice"/);
  assert.match(set, /<input type="date" value="\{\{ examDate \}\}"[^>]*aria-label="My theory test date"/);
});

test('#32 item 3: the notes button floats only where it fits beside the page; anywhere narrower it is in the page', () => {
  // v12 at 390px: floating over the bottom-right of every screen, it covered Reduce motion as
  // Settings opened, Start the test, a Practise topic, a My answers row and Home's cards. The #12
  // padding only let the LAST line scroll clear of it; whatever sat under it was still covered.
  assert.ok(TS && TS.PAGE && typeof TS.floatMin === 'function', 'TTScreen.PAGE and TTScreen.floatMin');
  const N = TS.NOTES, P = TS.PAGE;
  // The text size setting zooms the whole page (the column AND the button) by 1, 1.12 or 1.25.
  const zooms = [...app.match(/const zoom = \[([\d., ]+)\]\[st\.textSize\]/)[1].split(',').map(Number)];
  assert.deepEqual(zooms, [1, 1.12, 1.25]);
  for (const z of zooms) {
    // At the narrowest window where it floats, it sits wholly right of the centred page column.
    const W = TS.floatMin(z), columnRight = (W + z * (P.max + 2 * P.side)) / 2;
    assert.ok(W - z * (N.edge + N.size) >= columnRight, 'text zoom ' + z + ': at ' + W + 'px the button overlaps the page column');
    assert.ok(W > 430, 'every phone (430px wide at most) gets the button in the page');
  }
  assert.ok(TS.floatMin(1.25) > TS.floatMin(1), 'bigger text needs a wider window');
  // The page column takes its width and side padding from TTScreen.PAGE: one number for both.
  assert.match(app, /pageStyle: 'max-width:' \+ TTScreen\.PAGE\.max \+ 'px;margin:0 auto;padding:20px ' \+ TTScreen\.PAGE\.side \+ 'px calc\(' \+ TTScreen\.bottomPad\(notesAvail\)/);
  // In the page on a question screen (#12 C) and whenever the window is narrower than floatMin
  // at her text size. The browser answers (matchMedia) for that size's width.
  assert.match(app, /const notesInline = notesShown && \(onQuestion \|\| !this\.wideScreen\(zoom\)\);/);
  assert.match(app, /wideScreen\(zoom\)\{[\s\S]{0,300}?const q = '\(min-width: ' \+ TTScreen\.floatMin\(zoom\) \+ 'px\)';/);
  // Turning a tablet, resizing a window or changing the text size across that width moves the
  // button straight away: a change of the browser's answer redraws.
  assert.match(app, /this\._wideMq\.addEventListener\('change', this\._wideRedraw\)/);
  assert.match(app, /this\._wideRedraw = \(\)=>this\.forceUpdate\(\)/);
  // One notes button for every screen, after the last screen in the page, so in the page it is
  // always below everything else: after Next, Start the test, the last setting and the last row.
  const btns = tpl.match(/<button onClick="\{\{ toggleNotes \}\}" data-tt-notes-btn="1"/g) || [];
  assert.equal(btns.length, 1, 'one notes button, not a copy per screen');
  const at = tpl.indexOf('data-tt-notes-btn="1"'), printArea = tpl.indexOf('<!-- ============ PRINT AREA');
  assert.ok(at > tpl.lastIndexOf('data-screen-label', printArea) && at < printArea, 'the notes button must come after every screen in the page');
  // Its look follows where it is: a card-style button in the page, the round dark one floating.
  assert.match(app, /notesBtnStyle: notesAvail \? notesFab : notesInPage,/);
  assert.match(app, /notesWordClass: notesAvail \? 'tt-sr' : '',/, 'floating, the words are for screen readers only');
});

test('#32 item 4: My Progress says "1 more right answer", counts from the mock she sat, and speaks to her as "your"', () => {
  assert.ok(TS && typeof TS.passMark === 'function' && typeof TS.lastMockSay === 'function', 'TTScreen.passMark and TTScreen.lastMockSay');
  // One pass-mark rule: 43 of 50, and the same 86% of a shorter mock (Build your own, My answers).
  assert.equal(TS.passMark(50), 43);
  assert.equal(TS.passMark(20), 18);
  assert.equal(TS.passMark(10), 9);
  assert.match(app, /const total = t\.ids\.length, passMark = TTScreen\.passMark\(total\);/, 'endTest uses the same rule');
  // v12: "so 1 more right answers gets you there".
  assert.equal(TS.lastMockSay(42, 50, false), 'Last mock: 42/50. The pass mark is 43, so 1 more right answer gets you there.');
  assert.equal(TS.lastMockSay(40, 50, false), 'Last mock: 40/50. The pass mark is 43, so 3 more right answers get you there.');
  // v12 also said "/50" and "43" after a 20-question mock: "12/50 … so 31 more right answers".
  assert.equal(TS.lastMockSay(12, 20, false), 'Last mock: 12/20. The pass mark is 18, so 6 more right answers get you there.');
  assert.equal(TS.lastMockSay(45, 50, true), 'Last mock: 45/50 — a PASS. One more pass in a row and it is time to book the real thing.');
  assert.equal(TS.lastMockSay(19, 20, true), 'Last mock: 19/20 — a PASS. One more pass in a row and it is time to book the real thing.');
  assert.match(app, /out\.push\(TTScreen\.lastMockSay\(last\.score, last\.total \|\| 50, last\.pass\)\);/);
  // v12: the dial said "Based on her mocks…" on her own screen. The same slip in two more places.
  assert.match(app, /readySub: s\.tests\.length \? 'Based on your mocks, practice answers and memory boxes\.'/);
  assert.match(app, /sub:'shaped by your mock results \\u2014 weak topics come up more'/);
  assert.doesNotMatch(app, /Based on her mocks|shaped by her mock results|On her iPad/);
});

test('#32 item 5: the mock chart starts a little under her lowest score and says its scale', () => {
  // v12: always 0 to 50, so real scores (mostly 35-50) were squeezed into the top fifth.
  assert.ok(TS && typeof TS.chartFloor === 'function', 'TTScreen.chartFloor');
  assert.equal(TS.chartFloor([{ score: 38 }, { score: 46 }], 43), 30, 'lowest 38: a margin under it, down to a round 10');
  assert.equal(TS.chartFloor([{ score: 48 }, { score: 49 }], 43), 30, 'the pass line always shows');
  assert.equal(TS.chartFloor([{ score: 12 }], 43), 0, 'never below 0');
  assert.equal(TS.chartFloor([{ score: 9, total: 20 }], 43), 10, 'a short mock is drawn out of 50, like the chart line (9/20 is 22.5)');
  assert.equal(TS.chartScale(30), 'The chart runs from 30 to 50.');
  assert.match(app, /const lo = TTScreen\.chartFloor\(tests, chartPass\);/);
  // The drawing (TTScreen.chartMarks since #38) puts a score of lo at the bottom and 50 at the top.
  const dots = TS.chartMarks([{ score: 30, pass: false }, { score: 50, pass: true }], 30, 43).filter(m => m.tag === 'circle');
  assert.deepEqual(plain(dots.map(d => d.attrs.cy)), [TS.CHART.BOX.y + TS.CHART.BOX.h, TS.CHART.BOX.y]);
  assert.match(app, /chartScale: TTScreen\.chartScale\(lo\),/);
  // Both charts (My Progress and the dashboard) say their scale under the drawing.
  const charts = [...tpl.matchAll(/<svg viewBox="0 0 340 130"[\s\S]*?<\/svg>\s*(?:<!--[\s\S]*?-->\s*)?<div[^>]*>\{\{ chartScale \}\}<\/div>/g)];
  assert.equal(charts.length, 2, 'both charts need their scale in words');
});

test('#32 item 5: a brand-new learner\'s Today\'s lesson says "Your first 20 questions", not "Built from your answers: 20 new"', () => {
  assert.ok(TS && typeof TS.lessonDesc === 'function', 'TTScreen.lessonDesc');
  assert.equal(TS.lessonDesc({ stuck: 0, flagged: 0, due: 0, weak: 0, fresh: 20 }, false), 'Your first 20 questions, to get you started');
  assert.equal(TS.lessonDesc({ stuck: 3, flagged: 4, due: 13, weak: 0, fresh: 0 }, true), 'Built from your answers: 3 you keep missing · 4 flagged · 13 due again');
  assert.equal(TS.lessonDesc({ due: 7, weak: 1, fresh: 3 }, true), 'Built from your answers: 7 due again · 4 new');
  assert.equal(TS.lessonDesc({}, true), 'Built from your answers as you go');
  assert.equal(TS.lessonDesc({}, false), 'Built from your answers as you go', 'no bank yet: nothing to count');
  assert.match(app, /dailyDesc: view!=='home' \? '' : TTScreen\.lessonDesc\(this\.drillPlan\(\)\.reasons, s\.attempts\.length > 0\),/);
});

test('#32 item 5: the memory tip and plain-words boxes use the card\'s full width, not the column beside the read-aloud button', () => {
  // v12 at 390px: they sat in the text column next to the 48px speaker button, a narrow strip.
  const learn = screen('LEARN QUESTION');
  const speak = learn.indexOf('onClick="{{ speakExp }}"');
  assert.ok(speak > 0);
  for (const v of ['{{ tipText }}', '{{ plainBtnLabel }}', '{{ plainText }}']) {
    assert.ok(learn.indexOf(v) > speak, v + ' must come after the read-aloud button, below the text column');
    assert.ok(learn.indexOf(v) < learn.indexOf('{{ nextQ }}'), v + ' must stay in the answer card, before Next');
  }
});

// ---------- Issue #38 item 5: console errors on every app load ----------
test('#38 item 5: no {{ value }} in an SVG attribute the browser reads as a number or length', () => {
  // v13: every load logged 12 console errors, such as <line> attribute y1: Expected length,
  // "{{ passLineY }}" (both mock charts: y1, y2, y, points, cx and cy). The browser reads the page
  // before the app fills its values in, so it parsed the raw template text as numbers.
  const GEOMETRY = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'd', 'transform', 'viewbox', 'dx', 'dy'];
  const markup = tpl.replace(/<!--[\s\S]*?-->/g, '');
  const svgs = [...markup.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(m => m[0]);
  assert.ok(svgs.length >= 2, 'expected the mock charts');
  for (const s of svgs) for (const [tag] of s.matchAll(/<[a-z][^>]*>/gi)) {
    for (const [, name, value] of tag.matchAll(/\s([a-zA-Z0-9-]+)="([^"]*)"/g)) {
      assert.ok(!(GEOMETRY.includes(name.toLowerCase()) && value.includes('{{')), 'a template value in an SVG ' + name + ': ' + tag);
    }
  }
  // Both charts draw their moving parts from TTScreen.chartMarks, as elements the app makes.
  const charts = [...markup.matchAll(/<svg viewBox="0 0 340 130"[^>]*>([\s\S]*?)<\/svg>/g)].map(m => m[1].trim());
  assert.deepEqual(charts, ['{{ chartMarks }}', '{{ chartMarks }}']);
  assert.match(app, /chartMarks: TTScreen\.chartMarks\(tests, lo, chartPass\)\.map\(\(m, ?i\)=>React\.createElement\(m\.tag, Object\.assign\(\{key:i\}, m\.attrs\), m\.text\)\)/);
});

test('#38 item 5: the mock chart draws the pass line, her scores and a dot for each mock, as before', () => {
  assert.ok(TS && typeof TS.chartMarks === 'function', 'TTScreen.chartMarks');
  const tests = [{ score: 38, total: 50, pass: false }, { score: 44, total: 50, pass: true }, { score: 18, total: 20, pass: true }];
  const lo = TS.chartFloor(tests, 43);
  assert.equal(lo, 30);
  const marks = plain(TS.chartMarks(tests, lo, 43));
  const y = v => 10 + (1 - (v - lo) / (50 - lo)) * 110;       // the chart's box: 110 high from y=10
  // The dashed pass line across the chart, and its label just above its right end.
  assert.deepEqual(marks[0], { tag: 'line', attrs: { x1: 12, y1: y(43), x2: 328, y2: y(43), stroke: '#C77E14', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' } });
  assert.deepEqual(marks[1], { tag: 'text', attrs: { x: 328, y: y(43) - 5, 'text-anchor': 'end', 'font-size': 9, 'font-family': 'sans-serif', style: { fill: 'var(--tt-fg-8a5a0b)' } }, text: 'pass 43' });
  // Her scores left to right across the 316-wide box from x=12, a 20-question mock drawn out of 50.
  assert.deepEqual(marks[2], { tag: 'polyline', attrs: { points: '12,' + y(38) + ' 170,' + y(44) + ' 328,' + y(45), fill: 'none', stroke: '#0E7C6B', 'stroke-width': 2.5, 'stroke-linejoin': 'round' } });
  assert.deepEqual(marks.slice(3).map(m => [m.tag, m.attrs.cx, m.attrs.cy, m.attrs.r, m.attrs.fill]),
    [['circle', 12, y(38), 4, '#D14B45'], ['circle', 170, y(44), 4, '#2E9E5B'], ['circle', 328, y(45), 4, '#2E9E5B']]);
  // One mock sits in the middle; no mocks draws only the pass line and its label.
  assert.equal(plain(TS.chartMarks([{ score: 40, pass: false }], 30, 43))[3].attrs.cx, 170);
  assert.deepEqual(plain(TS.chartMarks([], 30, 43)).map(m => m.tag), ['line', 'text', 'polyline']);
});

// ---------- issue #42: no payment buttons that can only fail; the admin's Accounts list ----------
test('#42: the lock screen offers Subscribe, Manage subscription and "I\'ve paid" only when payments are on', () => {
  const pay = screen('PAYWALL');
  // Each Stripe button sits inside an <sc-if> whose value is payOn (or paySubVisible, which needs payOn).
  const inside = (html, needle, flag) => {
    const at = html.indexOf(needle); assert.ok(at > 0, needle + ' not found');
    const open = html.lastIndexOf('<sc-if value="{{ ' + flag + ' }}"', at);
    return open >= 0 && html.indexOf('</sc-if>', open) > at;
  };
  assert.ok(inside(pay, '{{ buyMonthly }}', 'paySubVisible'));
  assert.ok(inside(pay, '{{ manageSub }}', 'payOn'));
  assert.ok(inside(pay, 'Payment is handled by Stripe', 'payOn'));
  assert.match(app, /paySubVisible: !hardLock && payOn,/);
  // With payments off the one button re-reads access, and says so; it never claims to ask Stripe.
  assert.ok(!app.includes('Checking with Stripe'), 'nothing may say it is checking with Stripe: it reads the access row');
  assert.match(app, /'Check my access again'/);
});

test('#42: the admin\'s Account card shows no subscription buttons, and Accounts loads on the dashboard', () => {
  const dash = screen('DASHBOARD');
  const manage = dash.indexOf('{{ manageSub }}');
  assert.ok(dash.lastIndexOf('<sc-if value="{{ acctPayVisible }}"', manage) > dash.lastIndexOf('</sc-if>', manage), 'Manage subscription is not inside acctPayVisible');
  assert.match(app, /acctPayVisible: payOn && !s\.isAdminAccount,/);
  assert.ok(dash.includes('<sc-if value="{{ acctsVisible }}"') && dash.includes('{{ reloadAccounts }}') && dash.includes('{{ a.giveFree }}'));
  assert.match(app, /if\(s\.view==='dash' && s\.isAdminAccount && \(prev\.view!=='dash' \|\| !prev\.isAdminAccount\)\) this\.loadAccounts\(\);/);
});
