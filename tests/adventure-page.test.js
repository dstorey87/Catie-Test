// The Adventure page (adventure.html + adventure/): its pure helpers, and checks on its HTML
// that don't need a browser. Run with:  node --test
// (The page itself - map, play, results, 390px and 1280px, light and dark - is checked in a
// real browser with tests/browser/harness.js; see STATUS.md, "How to test".)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const adv = require('../adventure/adventure.js');
const coach = require('../coach.js');
const html = read('adventure.html');
const js = read('adventure/adventure.js');
const app = read('Theory Trainer.dc.html');
// The same bank the page plays in the tests: the repo's question files.
const bank = [1, 2, 3, 4, 5].flatMap(n => require('../questions-' + n + '.json'));

// A pretend localStorage, so storage code can be tested without a browser.
function fakeStorage(init) {
  const m = Object.assign({}, init);
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m };
}
// A repeatable "random" for shuffles: the same seed gives the same order every run.
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

// ---------- the page's HTML ----------

test('page: loads config.js, backend.js and coach.js (in that order) and its own script', () => {
  const src = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  for (const f of ['config.js', 'backend.js', 'coach.js', 'adventure/adventure.js']) assert.ok(src.includes(f), f + ' is loaded');
  assert.ok(src.indexOf('config.js') < src.indexOf('backend.js') && src.indexOf('backend.js') < src.indexOf('coach.js'), 'config before backend before coach');
  assert.ok(!src.includes('support.js'), 'no React runtime: it is a plain page');
});

test('v13 offline: the page and every script and stylesheet it loads from this site are in sw.js CORE', () => {
  // CORE is installed all-or-nothing, so the page can't be cached without its script. A file
  // missing from CORE would open offline as a page that does nothing, with no message.
  const core = read('sw.js').match(/const CORE = \[([\s\S]*?)\];/)[1];
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
  // Only this site's own files: the Google Fonts stylesheet is another site, never cached.
  const own = ['adventure.html', ...scripts, ...styles].filter(f => !/^https?:/.test(f));
  assert.ok(own.includes('adventure/adventure.js') && own.includes('adventure/adventure.css'), 'the page\'s own files were found');
  for (const f of own) assert.ok(core.includes("'./" + f + "'"), f + ' is not in sw.js CORE');
});

test('#32 page: the car on the "Open the app first" message stays on the screen (no sideways scroll)', () => {
  // Found by the #10 accessibility audit: the message reuses the map's car picture, and the map
  // places that car 46px outside its stop (.car: position absolute, right -46px). On the message
  // it ran 46px off the right edge, so the page scrolled sideways at 390px and 1280px (WCAG 1.4.10).
  const css = read('adventure/adventure.css');
  assert.match(js, /<div class="msg-art" aria-hidden="true">' \+ CAR \+ '/, 'the message still shows the car');
  const rule = css.match(/\.msg-art \.car \{([^}]*)\}/);
  assert.ok(rule, 'no .msg-art .car rule: the map\'s placement applies to the message\'s car');
  assert.match(rule[1], /position: static;/);
  assert.match(rule[1], /width: 100%;/, 'as wide as its 120px box, no wider');
});

// ---------- the page's CSS, read as numbers ----------
const css = read('adventure/adventure.css');
// The wide-screen block: from "@media (min-width: Npx) {" to its closing "}" at the start of a line.
const wideAt = css.indexOf('@media (min-width: ');
const wideMin = +css.slice(wideAt).match(/^@media \(min-width: (\d+)px\)/)[1];
const wideCss = css.slice(wideAt, css.indexOf('\n}', wideAt));
// The declarations of the last rule for a selector in some CSS (a later rule overrides an earlier).
function cssRule(src, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...src.matchAll(new RegExp('(?:^|[\\n}])\\s*' + esc + '\\s*\\{([^}]*)\\}', 'g'))];
  return all.length ? all[all.length - 1][1] : '';
}
// A property's pixel numbers ("padding: 16px 8px 10px" -> [16, 8, 10]): the wide block's own
// value if it sets one, otherwise the page's base value.
function widePx(sel, prop) {
  const re = new RegExp('(?:^|;)\\s*' + prop + ':\\s*([^;]+)');
  const m = cssRule(wideCss, sel).match(re) || cssRule(css.slice(0, wideAt), sel).match(re);
  assert.ok(m, sel + ' has no ' + prop);
  return m[1].trim().split(/\s+/).map(v => parseFloat(v));
}

test('#38 item 2 / #48: on a wide screen each row of world tabs fits on one line, so none is left alone over the road', () => {
  // v13 at 768px and 1280px: the 14 tabs wrapped 13 + 1, and tab 14 sat on its own above the
  // road like a locked stage. From the wide breakpoint up the page column is its widest, so each
  // row must fit there: tabs, the gaps between them and the row's side padding. #48 added 8 sign
  // worlds: they are a second row (22 tabs in one row would wrap), led by its "Signs" label.
  const signsJs = { window: {}, React: {} };
  vm.runInNewContext(read('signs.js'), signsJs);
  const route = coach.adventureRoute(bank, { signs: signsJs.window.TTSigns.worlds() });
  const topics = route.filter(w => !w.track).length, signs = route.filter(w => w.track === 'signs').length;
  const column = Math.min(widePx('main, .top', 'max-width')[0], wideMin) - 2 * widePx('main', 'padding')[1];
  const [tab] = widePx('.wtab', 'width'), [gap] = widePx('.worlds', 'gap'), pad = widePx('.worlds', 'padding')[1];
  const [label] = widePx('.wlabel', 'width');
  const row = n => n * tab + (n - 1) * gap + 2 * pad;
  assert.deepEqual([topics, signs], [14, 8]);
  assert.ok(row(topics) <= column, topics + ' tabs need ' + row(topics) + 'px, the column has ' + column + 'px: the last tab wraps');
  assert.ok(label + gap + row(signs) <= column, 'the sign row wraps');
  assert.ok(tab >= 44, 'each tab stays a 44px target');
  // The two rows, each a labelled group; the sign worlds' tabs in the second.
  assert.match(js, /'<div class="worlds" role="group" aria-label="Topic worlds">' \+ topicTabs \+ '<\/div>'/);
  assert.match(js, /'<div class="worlds" role="group" aria-label="Road sign worlds"><span class="wlabel" aria-hidden="true">Signs<\/span>' \+ signTabs \+ '<\/div>'/);
});

test('#48: the page plays the app\'s route: the topic worlds, then one sign world per Highway Code category', () => {
  // The same call as the app's Home card (tests/app-files.test.js), so both count the same stars.
  assert.match(js, /S\.route = C\.adventureRoute\(bank, \{signs: root\.TTSigns \? root\.TTSigns\.worlds\(\) : \[\]\}\);/);
  // A sign question comes from signs.js (the official picture and captions); every other one
  // from the bank.
  assert.match(js, /function questionFor\(qid\) \{ return byId\[qid\] \|\| \(root\.TTSigns && root\.TTSigns\.question\(qid\)\) \|\| null; \}/);
  assert.match(js, /var p = S\.play, qid = p\.queue\[p\.i\], q = questionFor\(qid\);/);
  // No flag on a sign question: flags belong to the bank's questions (the app's Flagged screen).
  assert.match(js, /var canFlag = !\(root\.TTSigns && root\.TTSigns\.isQuizId\(qid\)\);/);
  assert.match(js, /\(canFlag \? '<button type="button" class="flag/);
  // After a wrong answer the answer is said once: an explanation that is only the answer's own
  // words (a sign question's) is not printed again under it.
  assert.match(js, /var why = q\.explanation && \(ok \|\| q\.explanation !== q\.options\[q\.correctIndex\]\);/);
});

test('#38 item 3: the top bar keeps "Theory Trainer" on one line and makes room for her name on a phone', () => {
  // v13 at 390px with double-digit stars: "Theory Trainer" wrapped onto two lines; at 360px her
  // name was cut to "Cat…". (Checked in a real browser before and after: see changes/.)
  const back = cssRule(css, '.back');
  assert.match(back, /white-space: nowrap;/, 'the back link\'s words must not wrap');
  assert.match(back, /flex: none;/, 'the back link keeps its width; the name gives way last');
  // On a phone the star pill shows only the stars she has; "/ 210" is still there for screen readers.
  assert.match(js, /'<\/b><span class="of"> \/ ' \+ all\.available \+ '<\/span>/, 'the total is its own part of the pill');
  const phone = css.match(/@media \(max-width: (\d+)px\) \{([\s\S]*?)\n\}/);
  assert.ok(phone && +phone[1] >= 430, 'a phone-width block covering every phone (430px wide at most)');
  const of = cssRule(phone[2], '.stat .of');
  for (const d of ['position: absolute;', 'width: 1px;', 'height: 1px;', 'overflow: hidden;', 'clip: rect(0 0 0 0);'])
    assert.ok(of.includes(d), 'on a phone the total is hidden from sight only (screen readers still say it): ' + d);
});

test('#38 item 3: the world header has no "·" left dangling at the end of a line', () => {
  // v13 at 390px: "3 of 7 stages passed ·" then the stars on the next line. The two parts now sit
  // side by side, or one under the other, with a gap and no separator character.
  assert.doesNotMatch(js, /stages passed<\/span> <span class="dot">/);
  const sub = cssRule(css, '.world-head .sub');
  assert.match(sub, /display: flex;/);
  assert.match(sub, /flex-wrap: wrap;/);
  assert.match(sub, /justify-content: center;/);
});

test('page: links back to the app with the load-bearing %20 in its name', () => {
  assert.match(html, /href="Theory%20Trainer\.dc\.html"/);
  assert.match(js, /href="Theory%20Trainer\.dc\.html"/);   // the messages' "Open Theory Trainer" buttons too
});

test('page: one <main>, a skip link, a live region, lang and a viewport for phones', () => {
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.match(html, /class="skip" href="#main"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<html lang="en-GB">/);
  assert.match(html, /name="viewport"/);
});

test('page: no adventure number is typed in - pass mark, stars and sizes all come from TTCoach.ADVENTURE', () => {
  // SVG drawing data (icon paths, viewBoxes) is geometry, not a rule: left out of the search.
  const noSvg = s => s.replace(/\s(d|viewBox|points|transform)="[^"]*"/g, '');
  for (const [name, raw] of [['adventure.html', html], ['adventure/adventure.js', js]]) {
    const src = noSvg(raw);
    assert.doesNotMatch(src, /(^|[^\d.])0?\.[89]\b/, name + ' has no 0.8 / 0.9');
    assert.doesNotMatch(src, /\b[89]0 ?%/, name + ' has no 80% / 90%');
    assert.doesNotMatch(src, /(lessonSize|checkpointSize|minLesson|passPct)\s*[:=]\s*\d/, name + ' sets no ADVENTURE size');
  }
  // ...and the page does read them from there
  assert.match(js, /A\.passPct/);
  assert.match(js, /A\.stars/);
  assert.match(js, /C\.ADVENTURE/);
});

test('page: the XP and attempts numbers match the app (Theory Trainer.dc.html)', () => {
  assert.ok(app.includes('correctCount*' + adv.APP.xpPerRight), 'app award() gives ' + adv.APP.xpPerRight + ' XP a right answer');
  assert.ok(app.includes('.slice(-' + adv.APP.attemptsKeep + ')'), 'app keeps the last ' + adv.APP.attemptsKeep + ' attempts');
  assert.ok(app.includes("this.BASE = '" + adv.APP.base + "'"), 'same storage prefix as the app');
});

test('page: every world colour is one the app already uses', () => {
  // In the app a colour is either a plain hex (#0E7C6B) or a theme key named after its hex (fg-2f6ea8).
  const low = app.toLowerCase();
  for (const c of adv.WORLD_COLOURS) assert.ok(low.includes(c.slice(1).toLowerCase()), c + ' is in the app');
});

// ---------- theme ----------

test('theme: the app\'s saved light or dark choice applies; anything else follows the device', () => {
  assert.equal(adv.themeFor('light'), 'light');
  assert.equal(adv.themeFor('dark'), 'dark');
  assert.equal(adv.themeFor('auto'), null);
  assert.equal(adv.themeFor(null), null);
});

// ---------- the learner ----------

test('learner: the one chosen in the app (theoryTrainer.active), with her name', () => {
  const st = fakeStorage({ 'theoryTrainer.users': JSON.stringify([{ id: 'u1', name: 'Catie' }, { id: 'u2', name: 'Sam' }]), 'theoryTrainer.active': 'u2' });
  assert.deepEqual(adv.learnerFrom(st), { id: 'u2', name: 'Sam' });
});

test('learner: no active choice means the first learner, like the app', () => {
  const st = fakeStorage({ 'theoryTrainer.users': JSON.stringify([{ id: 'u1', name: 'Catie' }]) });
  assert.deepEqual(adv.learnerFrom(st), { id: 'u1', name: 'Catie' });
});

test('learner: none when the app has never been opened, or storage is blocked or junk', () => {
  assert.equal(adv.learnerFrom(fakeStorage({})), null);
  assert.equal(adv.learnerFrom(fakeStorage({ 'theoryTrainer.users': 'not json' })), null);
  assert.equal(adv.learnerFrom({ getItem() { throw new Error('blocked'); } }), null);
  assert.equal(adv.blobKey('u1'), 'theoryTrainer.d.u1');
});

// ---------- saving into her data ----------

test('answer: appended to attempts in the app\'s shape (src adventure), XP only for a right one, nothing mutated', () => {
  const before = { xp: 30, attempts: [{ q: 'x', t: 1, ok: true, topic: 1, p: 0 }], settings: { learnerName: 'Catie' } };
  const right = adv.withAnswer(before, { q: 't01q01', ok: true, topic: 1, p: 2 }, 1000, coach);
  assert.deepEqual(right.attempts[1], { q: 't01q01', t: 1000, ok: true, topic: 1, p: 2, src: 'adventure' });
  assert.equal(right.xp, 30 + adv.APP.xpPerRight);
  assert.equal(right.updatedAt, 1000);
  assert.deepEqual(right.settings, before.settings, 'the rest of her data is kept');
  const wrong = adv.withAnswer(right, { q: 't01q02', ok: false, topic: 1, p: 0 }, 2000, coach);
  assert.equal(wrong.xp, right.xp);
  assert.equal(before.attempts.length, 1, 'the old copy is untouched');
  assert.equal(adv.withAnswer({}, { q: 'a', ok: true, topic: 1, p: 0 }, 5, coach).xp, adv.APP.xpPerRight, 'a brand-new learner works too');
});

test('answer: attempts are capped like the app, keeping the newest', () => {
  const many = { attempts: Array.from({ length: adv.APP.attemptsKeep }, (_, i) => ({ q: 'q' + i, t: i, ok: true, topic: 1, p: 0 })) };
  const out = adv.withAnswer(many, { q: 'new', ok: true, topic: 1, p: 0 }, 99999, coach);
  assert.equal(out.attempts.length, adv.APP.attemptsKeep);
  assert.equal(out.attempts[out.attempts.length - 1].q, 'new');
  assert.equal(out.attempts[0].q, 'q1');
});

test('flag: same shape as the app (revisionFlags[qid] = {t, src}; un-flag records flagCleared)', () => {
  const on = adv.withFlag({ flagCleared: { t01q01: 5 } }, 't01q01', true, 100);
  assert.deepEqual(on.revisionFlags.t01q01, { t: 100, src: 'adventure' });
  assert.equal('t01q01' in on.flagCleared, false, 'flagging again clears the old un-flag');
  const off = adv.withFlag(on, 't01q01', false, 200);
  assert.equal('t01q01' in off.revisionFlags, false);
  assert.equal(off.flagCleared.t01q01, 200);
  // the app's sync merge understands it: the later un-flag wins over the earlier flag
  const m = coach.mergeFlags({ flags: on.revisionFlags, cleared: on.flagCleared }, { flags: off.revisionFlags, cleared: off.flagCleared });
  assert.deepEqual(m.flags, {});
});

test('stage: progress saved under "adventure" by TTCoach, keeping the best result', () => {
  const b1 = adv.withStage({ xp: 5 }, coach, 'w1s1', { correct: 7, total: 7 }, 10);
  assert.equal(b1.adventure.stages.w1s1.passed, true);
  assert.equal(b1.adventure.stages.w1s1.stars, coach.ADVENTURE.stars.length);
  assert.equal(b1.xp, 5);
  const b2 = adv.withStage(b1, coach, 'w1s1', { correct: 0, total: 7 }, 20);
  assert.equal(b2.adventure.stages.w1s1.passed, true, 'a worse replay does not undo a pass');
  assert.equal(b2.adventure.stages.w1s1.plays, 2);
  assert.equal(b2.updatedAt, 20);
});

// ---------- playing a stage ----------

test('play: every question once, in a shuffled order that differs between plays', () => {
  const stage = { id: 'w1s1', kind: 'lesson', qids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
  const p1 = adv.newPlay(stage, seeded(1)), p2 = adv.newPlay(stage, seeded(7));
  assert.deepEqual(p1.queue.slice().sort(), stage.qids);
  assert.notDeepEqual(p1.queue, p2.queue);
});

test('play: a missed question comes back once at the end; the score counts first tries only', () => {
  let p = adv.newPlay({ id: 's', kind: 'lesson', qids: ['a', 'b', 'c'] }, () => 0.5);
  const order = p.queue.slice();
  p = adv.answerStep(p, order[0], false); p.i++;         // miss the first
  assert.deepEqual(p.queue, order.concat([order[0]]));
  p = adv.answerStep(p, order[1], true); p.i++;
  p = adv.answerStep(p, order[2], true); p.i++;
  assert.equal(adv.isComeback(p), true, 'the 4th question is the comeback');
  p = adv.answerStep(p, order[0], false); p.i++;         // miss it again: it does NOT come back twice
  assert.equal(p.queue.length, 4);
  assert.deepEqual(adv.tally(p), { correct: 2, total: 3 });
  let q = adv.newPlay({ id: 's', kind: 'lesson', qids: ['a'] }, () => 0.5);
  q = adv.answerStep(q, 'a', false); q.i++; q = adv.answerStep(q, 'a', true);
  assert.deepEqual(adv.tally(q), { correct: 0, total: 1 }, 'right on the comeback is still a miss for the score');
});

test('play: combo counts right answers in a row; XP adds up like the app', () => {
  let p = adv.newPlay({ id: 's', kind: 'lesson', qids: ['a', 'b', 'c', 'd'] }, () => 0.5);
  [true, true, false, true].forEach((ok, i) => { p = adv.answerStep(p, p.queue[i], ok); p.i++; });
  assert.equal(p.combo, 1);
  assert.equal(p.bestCombo, 2);
  assert.equal(p.xp, 3 * adv.APP.xpPerRight);
});

test('#38 item 6: the best run counts first tries only, so it never beats "right first time"', () => {
  // v13: a stage missed first time and answered right on every second chance showed
  // "0 / 7 right first time" next to "Best run: 7 in a row" (the run counted second chances).
  const qids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  let p = adv.newPlay({ id: 's', kind: 'lesson', qids }, () => 0.5);
  qids.forEach(() => { p = adv.answerStep(p, p.queue[p.i], false); p.i++; });        // every first try wrong
  while (p.i < p.queue.length) { p = adv.answerStep(p, p.queue[p.i], true); p.i++; }  // every second chance right
  assert.deepEqual(adv.tally(p), { correct: 0, total: 7 });
  assert.equal(p.bestCombo, 0, 'second chances are not part of the run');
  assert.equal(p.combo, 0, 'nor of the counter on screen');
  assert.equal(p.xp, 7 * adv.APP.xpPerRight, 'a right second chance still earns its XP, as in the app');
  // Any mix of answers: the best run is never more than the first tries she got right.
  const rnd = seeded(38);
  for (let n = 0; n < 300; n++) {
    let q = adv.newPlay({ id: 's', kind: 'lesson', qids }, rnd);
    while (q.i < q.queue.length) { q = adv.answerStep(q, q.queue[q.i], rnd() < 0.6); q.i++; }
    assert.ok(q.bestCombo <= adv.tally(q).correct, 'best run ' + q.bestCombo + ' but only ' + adv.tally(q).correct + ' right first time');
  }
  // The results name a run only when there is one: 2 or more, as the counter shows.
  assert.match(js, /\(p\.bestCombo >= 2 \? '<li>Best run: ' \+ p\.bestCombo \+ ' in a row<\/li>' : ''\)/);
});

test('play: right answers needed to pass come from the pass mark', () => {
  const pct = coach.ADVENTURE.passPct;
  for (const total of [1, 5, 7, 10]) {
    const need = adv.passNeed(total, pct);
    assert.equal(coach.adventureScore({ correct: need, total }).passed, true, need + ' of ' + total + ' passes');
    assert.equal(coach.adventureScore({ correct: need - 1, total }).passed, false, (need - 1) + ' of ' + total + ' does not');
  }
});

// ---------- the map ----------

test('map: stages go down the page, stay on the drawing, and the road joins them all', () => {
  const lay = adv.nodeLayout(5);
  assert.equal(lay.points.length, 5);
  lay.points.forEach((p, i) => {
    assert.ok(p.x > 0 && p.x < lay.width, 'stage ' + i + ' is inside the width');
    if (i) assert.ok(p.y > lay.points[i - 1].y, 'each stage is below the last');
  });
  assert.ok(lay.height > lay.points[4].y);
  const d = adv.roadPath(lay);
  assert.match(d, /^M/);
  assert.equal((d.match(/C/g) || []).length, 5, 'one curve into each stage');
  assert.equal(adv.roadPath(adv.nodeLayout(0)), '');
});

test('map: stars over the whole bank, stage names, and the stage before/after across worlds', () => {
  const route = coach.adventureRoute(bank);
  const status = coach.adventureStatus(route, {});
  const max = coach.ADVENTURE.stars.length;
  const stages = route.reduce((n, w) => n + w.stages.length, 0);
  assert.deepEqual(adv.starsSummary(route, status, max), { earned: 0, available: stages * max });
  const w1 = route[0];
  assert.equal(adv.stageName(w1, w1.stages[0]), 'Lesson 1');
  assert.equal(adv.stageName(w1, w1.stages[w1.stages.length - 1]), 'Checkpoint');
  assert.equal(adv.previousStage(route, w1.stages[0].id), null, 'the very first stage has none');
  const w2first = route[1].stages[0].id;
  assert.equal(adv.previousStage(route, w2first).stage.kind, 'checkpoint', "world 2 opens after world 1's checkpoint");
  assert.equal(adv.nextStage(route, w1.stages[w1.stages.length - 1].id).stage.id, w2first);
  assert.equal(adv.worldIndexOf(route, w2first), 1);
  const ws = adv.worldSummary(w1, status);
  assert.deepEqual(ws, { passed: 0, total: w1.stages.length, open: true, done: false });
  assert.equal(adv.worldSummary(route[1], status).open, false);
});

test("bank: the admin's deletions are left out and corrections shown, like the app", () => {
  const out = adv.withContent([{ id: 'a', question: 'old' }, { id: 'b', question: 'b' }], { deleted: ['b'], overrides: { a: { question: 'new' } } });
  assert.deepEqual(out, [{ id: 'a', question: 'new' }]);
  assert.equal(adv.withContent(bank, null).length, bank.length);
});

// =========================================================================================
// ---------- issue #47: goal and streak, reading settings, read-aloud, two tabs ----------

// The app's own code, run here in node, so each shared rule in coach.js can be checked against
// what the app does today. When the app switches to the coach.js copies, these checks go.
// methodSrc('award') -> "award(qCount, correctCount, bonus){ ... }", found by matching braces.
function methodSrc(name) {
  const at = app.indexOf('\n  ' + name + '(');
  assert.ok(at > 0, 'the app has no ' + name + '() method any more');
  let i = app.indexOf('{', at), depth = 0;
  for (; i < app.length; i++) {
    if (app[i] === '{') depth++;
    else if (app[i] === '}' && --depth === 0) break;
  }
  return app.slice(at + 3, i + 1);
}
// The app's TTInsights block (its goal-day list), run the way tests/app-files.test.js runs it.
const insightsSrc = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.TTInsights ='));
const I = (() => { const ctx = { window: {} }; vm.runInNewContext(insightsSrc, ctx); return ctx.window.TTInsights; })();
// A time on a given local day: noon, so no time zone can move it to another day.
const noon = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };

// The streak the app's award() leaves after n answers at time `now`, for a learner's state.
function appAward(state, n, now) {
  class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  const ctx = { window: { TTCoach: coach, TTInsights: I }, TTCoach: coach, Date: FixedDate };
  const award = vm.runInNewContext('({' + methodSrc('award') + '})', ctx).award;
  return award.call({ state, levelInfo: () => ({ level: 1 }) }, n, 0).streak;
}

test('#47 goal and streak: coach.streakAward leaves the same streak record as the app\'s award()', () => {
  const now = noon('2026-09-25'), utc = d => new Date(d).toISOString().slice(0, 10);
  const today = k => Array.from({ length: k }, (_, i) => ({ q: 'q' + i, t: now - (i + 1) * 60000, ok: true, topic: 1 }));
  const cases = [
    { streak: { count: 0, last: '', todayDate: '', todayN: 0 }, attempts: [], settings: {} },
    { streak: { count: 0, last: '', todayDate: utc(now), todayN: 19 }, attempts: today(19), settings: {} },
    { streak: { count: 4, last: utc(now - 86400000), todayDate: utc(now - 86400000), todayN: 22 }, attempts: today(9), settings: { dailyGoal: 10 } },
    { streak: { count: 2, last: '2026-01-01', todayDate: '2026-01-01', todayN: 3, goalDays: ['2026-09-20', '2026-09-24'] }, attempts: today(29), settings: { dailyGoal: 30 } },
    { streak: { count: 1, last: utc(now), todayDate: utc(now), todayN: 40 }, attempts: today(40), settings: { dailyGoal: 20 } }
  ];
  for (const c of cases) {
    for (const n of [1, 3]) {
      const want = appAward(JSON.parse(JSON.stringify(c)), n, now);
      const got = coach.streakAward(c.streak, c.attempts, n, coach.dailyGoal(c.settings), now);
      assert.deepEqual(JSON.parse(JSON.stringify(got)), JSON.parse(JSON.stringify(want)), JSON.stringify(c.settings) + ' + ' + n);
    }
  }
});

test('#47 goal days: coach.recordGoalDay and its limit match the app\'s TTInsights', () => {
  assert.equal(coach.coachDefaults.goalDaysKept, I.CFG.goalDaysKept);
  const cases = [[[], '2026-09-25', 20, 20], [['2026-09-25'], '2026-09-25', 40, 20], [['2026-09-26'], '2026-09-25', 20, 20],
    [[], '2026-09-25', 19, 20], [null, 'junk', 50, 20], [[], '2026-09-25', 5, 0]];
  for (const c of cases) assert.deepEqual(JSON.parse(JSON.stringify(coach.recordGoalDay(...c))), JSON.parse(JSON.stringify(I.recordGoalDay(...c))), JSON.stringify(c));
});

test('#47 reading settings: coach.readingStyle is what the app puts on its page for every choice', () => {
  // The app's lines, from "const zoom" to the high-contrast one, run for each mix of settings.
  const from = app.indexOf('const zoom = ['), to = app.indexOf('\n', app.indexOf('if(st.highContrast) dyn.filter'));
  assert.ok(from > 0 && to > from, 'the app\'s reading-style lines were not found');
  const appDyn = new Function('st', app.slice(from, to) + '\nreturn dyn;');
  for (const textSize of [0, 1, 2, undefined]) for (const dyslexiaFont of [false, true]) for (const highContrast of [false, true]) {
    const st = { textSize, dyslexiaFont, highContrast };
    assert.deepEqual(coach.readingStyle(st), appDyn(st), JSON.stringify(st));
  }
  // The read-aloud speed when she has not chosen one: the app's default setting and its fallback.
  assert.ok(app.includes('voiceRate:' + coach.READING.voiceRate + ','), 'app default voiceRate');
  assert.ok(app.includes('this.props.speechRate || ' + coach.READING.voiceRate + ';'), 'app speak() fallback');
});

test('#47 read aloud: coach.pickVoice picks the voice the app\'s bestVoice() picks', () => {
  const v = (name, lang) => ({ name, lang });
  const lists = [
    [v('Alex', 'en-US'), v('Google UK English Female', 'en-GB'), v('Thomas', 'fr-FR'), v('Samantha (Enhanced)', 'en-US')],
    [v('Daniel', 'en-GB'), v('Karen (Compact)', 'en-AU'), v('Microsoft Sonia Online (Natural)', 'en-GB')],
    [v('Thomas', 'fr-FR')], []];
  for (const voices of lists) for (const voiceName of ['', 'Alex', 'Daniel', 'Thomas']) {
    const fake = { getVoices: () => voices };
    const ctx = { window: { speechSynthesis: fake }, speechSynthesis: fake };
    const appSide = vm.runInNewContext('({' + ['voices', 'scoreVoice', 'bestVoice'].map(methodSrc).join(',\n') + '})', ctx);
    appSide.state = { settings: { voiceName } };
    const want = appSide.bestVoice(), got = coach.pickVoice(voices, voiceName);
    assert.equal(got ? got.name : null, want ? want.name : null, JSON.stringify(voices.map(x => x.name)) + ' / ' + voiceName);
  }
});

test('#47 read aloud: the words read out are the app\'s own (question, result, explanation)', () => {
  const q = { question: 'What must you do?', options: ['Stop', 'Give way', 'Speed up', 'Sound your horn'], correctIndex: 1,
    explanation: 'Give way to traffic.', ruleRef: 'Highway Code rule 1', plainExplanation: 'Let them go first.' };
  // the question and its options: the app's speakQFull
  let said = '';
  const appQ = vm.runInNewContext('({' + methodSrc('speakQFull') + '})', {});
  appQ.speakQFull.call({ viewQ: x => ({ options: x.options }), speak: t => { said = t; } }, q);
  assert.equal(coach.sayQuestion(q.question, q.options), said);
  // the result after answering, when "read aloud automatically" is on: the app's answerLearn
  const res = app.match(/if\(this\.state\.settings\.autoRead\) this\.speak\((\(ok\?[^\n]*?q\.explanation)\);/);
  assert.ok(res, 'the app\'s spoken result was not found');
  const appRes = new Function('ok', 'vq', 'q', 'return ' + res[1]);
  for (const ok of [true, false]) assert.equal(coach.sayAnswer(ok, 'B', q.options[1], q.explanation), appRes(ok, q, q));
  // the explanation button: the app's speakExp (with and without the plain re-wording open)
  const exp = app.match(/speakExp: \(\)=>this\.speak\(([^\n]*?)\),\r?\n/);
  assert.ok(exp, 'the app\'s explanation read-out was not found');
  const appExp = new Function('q', 'plainOpen', 'return ' + exp[1]);
  assert.equal(coach.sayExplanation(q.explanation, q.ruleRef), appExp(q, false));
  assert.equal(coach.sayExplanation(q.explanation, q.ruleRef, q.plainExplanation), appExp(q, true));
});

test('#47 goal and streak: an Adventure answer records the streak as a practice answer does', () => {
  const now = noon('2026-09-25');
  const earlier = Array.from({ length: 9 }, (_, i) => ({ q: 'p' + i, t: now - (i + 1) * 60000, ok: true, topic: 1 }));
  const b = adv.withAnswer({ settings: { dailyGoal: 10 }, attempts: earlier, streak: { goalDays: ['2026-09-24'] } },
    { q: 't01q01', ok: false, topic: 1, p: 0 }, now, coach);
  assert.equal(b.attempts.length, 10, 'one attempt for one answer, as practice records');
  assert.deepEqual(b.streak.goalDays, ['2026-09-24', '2026-09-25'], 'the 10th answer today met her goal: today is a goal day');
  assert.equal(coach.dayCounts(b.attempts)['2026-09-25'], 10, 'Home\'s goal ring counts it (coach.dayCounts, as the app)');
  assert.deepEqual(b.streak, coach.streakAward({ goalDays: ['2026-09-24'] }, earlier, 1, 10, now), 'exactly the practice rule');
  // A second chance at a missed question is one more answer, as a drill repeat is in practice.
  const again = adv.withAnswer(b, { q: 't01q01', ok: true, topic: 1, p: 1 }, now + 1000, coach);
  assert.equal(again.attempts.length, 11);
});

// ---------- two tabs: the app open in another tab saves an older copy over Adventure's answers ----------
// mine: what this Adventure page saved while open ({attempts, flags: {qid: {on, t}}}).
const T0 = noon('2026-09-25');
const appOld = () => ({ settings: { dailyGoal: 3 }, xp: 10, updatedAt: T0 + 9000,
  attempts: [{ q: 'a1', t: T0 - 5000, ok: true, topic: 1, p: 0 }, { q: 'a2', t: T0 + 8000, ok: true, topic: 2, p: 1 }],
  revisionFlags: {}, flagCleared: {}, streak: { goalDays: [] }, adventure: { stages: { w1s1: { passed: true } } } });
const mine = () => ({
  attempts: [{ q: 'v1', t: T0 + 1000, ok: true, topic: 3, p: 2, src: 'adventure' }, { q: 'v2', t: T0 + 2000, ok: false, topic: 3, p: 0, src: 'adventure' }],
  flags: { v2: { on: true, t: T0 + 2500 } } });

test('#47 two tabs: answers, XP and flags an app tab saved over are put back, in time order', () => {
  const out = adv.healRecord(appOld(), mine(), coach, T0 + 10000);
  assert.deepEqual(out.attempts.map(a => a.q), ['a1', 'v1', 'v2', 'a2'], 'Adventure\'s answers back, in the order she gave them');
  assert.equal(out.xp, 10 + adv.APP.xpPerRight, 'the XP of the one right answer is back');
  assert.deepEqual(out.revisionFlags.v2, { t: T0 + 2500, src: 'adventure' }, 'the flag is back');
  assert.deepEqual(out.streak.goalDays, ['2026-09-25'], '4 answers today reach her goal of 3: today is a goal day');
  assert.equal(out.updatedAt, T0 + 10000);
  assert.deepEqual(out.adventure, appOld().adventure, 'everything else in her record is kept');
  assert.deepEqual(out.settings, appOld().settings);
});

test('#47 two tabs: nothing lost means nothing written; nothing is ever counted twice', () => {
  const healed = adv.healRecord(appOld(), mine(), coach, T0 + 10000);
  assert.equal(adv.healRecord(healed, mine(), coach, T0 + 11000), null, 'all there: no save');
  // Adventure's own saves (mine already in the record) are not added again.
  const withMine = Object.assign(appOld(), { attempts: appOld().attempts.concat(mine().attempts), revisionFlags: { v2: { t: T0 + 2500, src: 'adventure' } } });
  assert.equal(adv.healRecord(withMine, mine(), coach, T0 + 11000), null);
  assert.equal(adv.healRecord(appOld(), { attempts: [], flags: {} }, coach, T0), null, 'nothing saved here yet');
});

test('#47 two tabs: a later choice in the app wins, and a wiped history stays wiped', () => {
  // She un-flagged it in the app after flagging it here: the un-flag stands.
  const unflagged = Object.assign(appOld(), { flagCleared: { v2: T0 + 3000 } });
  const out = adv.healRecord(unflagged, mine(), coach, T0 + 10000);
  assert.equal('v2' in out.revisionFlags, false);
  assert.equal(out.flagCleared.v2, T0 + 3000);
  // "Reset progress" in the app empties her answers: Adventure never brings them back.
  const reset = Object.assign(appOld(), { attempts: [] });
  const r = adv.healRecord(reset, { attempts: mine().attempts, flags: {} }, coach, T0 + 10000);
  assert.equal(r, null, 'no answers restored after a wipe');
  // An un-flag made here is put back over the app's older flag.
  const flagged = Object.assign(appOld(), { revisionFlags: { v3: { t: T0 - 100, src: 'learn' } } });
  const u = adv.healRecord(flagged, { attempts: [], flags: { v3: { on: false, t: T0 + 100 } } }, coach, T0 + 10000);
  assert.equal('v3' in u.revisionFlags, false);
  assert.equal(u.flagCleared.v3, T0 + 100);
});

test('#47 two tabs: only the flags this page changed are touched; every other flag is left exactly as saved', () => {
  // A flag saved without a time (or with junk) would be dropped by a whole-list time merge.
  const other = { old1: { src: 'learn' }, old2: { t: 0, src: 'test' } };
  const stored = Object.assign(appOld(), { revisionFlags: Object.assign({}, other), flagCleared: { gone: 7 } });
  const out = adv.healRecord(stored, mine(), coach, T0 + 10000);
  assert.deepEqual(out.revisionFlags.old1, other.old1);
  assert.deepEqual(out.revisionFlags.old2, other.old2);
  assert.equal(out.flagCleared.gone, 7);
  assert.deepEqual(out.revisionFlags.v2, { t: T0 + 2500, src: 'adventure' }, 'and this page\'s flag is back');
  // nothing of this page's missing: no save, even with such flags in her record
  assert.equal(adv.healRecord(out, mine(), coach, T0 + 11000), null);
});

test('#47 two tabs: restored answers keep the app\'s limit on how many are kept', () => {
  const full = Object.assign(appOld(), { attempts: Array.from({ length: adv.APP.attemptsKeep }, (_, i) => ({ q: 'o' + i, t: T0 - 1e6 + i, ok: true, topic: 1 })) });
  const out = adv.healRecord(full, mine(), coach, T0 + 10000);
  assert.equal(out.attempts.length, adv.APP.attemptsKeep);
  assert.deepEqual(out.attempts.slice(-2).map(a => a.q), ['v1', 'v2'], 'the newest are kept');
});

test('#47 page: follows her reading settings, reads aloud and listens for the app\'s saves', () => {
  // the easy-reading font the app uses is loaded here too
  assert.match(html, /family=Lexend:wght@400;600;700/);
  // the rules come from coach.js (one copy), not from this page
  for (const fn of ['readingStyle', 'pickVoice', 'sayQuestion', 'sayAnswer', 'sayExplanation'])
    assert.match(js, new RegExp('C\\.' + fn + '\\('), 'the page uses TTCoach.' + fn);
  for (const fn of ['streakAward', 'dailyGoal', 'mergeFlags'])
    assert.match(js, new RegExp('coach\\.' + fn + '\\('), 'the saving helpers use TTCoach.' + fn);
  assert.match(js, /withAnswer\(blob\(\), \{[^}]*\}, now, C\)/, 'each answer records the streak through coach.js');
  assert.match(js, /TTPush\.markActive\(\)/, 'she counts as active today for reminders, as after a practice answer');
  assert.match(js, /addEventListener\('storage'/, 'the page hears another tab saving');
  // older coach.js (cached) without the new rules: the page says so instead of breaking
  assert.match(js, /typeof C\.streakAward !== 'function'/);
});

test('#47 two tabs: after "Reset progress" in the app, this page forgets the answers it saved', () => {
  const m = mine();
  assert.equal(adv.forgetWiped(m, appOld()).attempts.length, 2, 'answers still in her record: remembered');
  assert.deepEqual(adv.forgetWiped(m, { attempts: [] }).attempts, [], 'wiped: forgotten, so a later save cannot bring them back');
  assert.deepEqual(m.flags, mine().flags, 'flags are joined by time, so they are kept');
});

test('#47 page: the read-aloud button\'s colours are readable in light and dark (WCAG 1.4.11, 3:1)', () => {
  const { contrast } = require('./contrast.js');
  const light = css.match(/--say-bg: (#[0-9A-Fa-f]{6}); --say-ink: (#[0-9A-Fa-f]{6});/);
  const darks = [...css.matchAll(/--say-bg: (#[0-9A-Fa-f]{6}); --say-ink: (#[0-9A-Fa-f]{6});/g)].slice(1);
  assert.ok(light && darks.length === 2, 'the button colours are set for light and for both dark blocks');
  for (const m of [light, ...darks]) assert.ok(contrast(m[1], m[2]) >= 3, m[2] + ' on ' + m[1] + ' is ' + contrast(m[1], m[2]).toFixed(2) + ':1');
  // the app's own pair, so it looks the same as the app's speaker buttons
  assert.equal(light[1].toLowerCase(), '#e4f2ef');
  assert.ok(app.includes("'bg-e4f2ef':'" + darks[0][1].toLowerCase() + "'") && app.includes("'fg-0a5d50':'" + darks[0][2].toLowerCase() + "'"), 'dark values are the app\'s TT_DARK ones');
});
