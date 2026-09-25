// The Adventure page (adventure.html + adventure/): its pure helpers, and checks on its HTML
// that don't need a browser. Run with:  node --test
// (The page itself - map, play, results, 390px and 1280px, light and dark - is checked in a
// real browser with tests/browser/harness.js; see STATUS.md, "How to test".)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('#38 item 2: on a wide screen every world tab fits on one row, so none is left alone over the road', () => {
  // v13 at 768px and 1280px: the 14 tabs wrapped 13 + 1, and tab 14 sat on its own above the
  // road like a locked stage. From the wide breakpoint up the page column is its widest, so the
  // row must fit there: tabs, the gaps between them and the row's side padding.
  const worlds = coach.adventureRoute(bank).length;
  const column = Math.min(widePx('main, .top', 'max-width')[0], wideMin) - 2 * widePx('main', 'padding')[1];
  const [tab] = widePx('.wtab', 'width'), [gap] = widePx('.worlds', 'gap'), pad = widePx('.worlds', 'padding')[1];
  const row = worlds * tab + (worlds - 1) * gap + 2 * pad;
  assert.equal(worlds, 14);
  assert.ok(row <= column, worlds + ' tabs need ' + row + 'px, the column has ' + column + 'px: the last tab wraps');
  assert.ok(tab >= 44, 'each tab stays a 44px target');
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
  const right = adv.withAnswer(before, { q: 't01q01', ok: true, topic: 1, p: 2 }, 1000);
  assert.deepEqual(right.attempts[1], { q: 't01q01', t: 1000, ok: true, topic: 1, p: 2, src: 'adventure' });
  assert.equal(right.xp, 30 + adv.APP.xpPerRight);
  assert.equal(right.updatedAt, 1000);
  assert.deepEqual(right.settings, before.settings, 'the rest of her data is kept');
  const wrong = adv.withAnswer(right, { q: 't01q02', ok: false, topic: 1, p: 0 }, 2000);
  assert.equal(wrong.xp, right.xp);
  assert.equal(before.attempts.length, 1, 'the old copy is untouched');
  assert.equal(adv.withAnswer({}, { q: 'a', ok: true, topic: 1, p: 0 }, 5).xp, adv.APP.xpPerRight, 'a brand-new learner works too');
});

test('answer: attempts are capped like the app, keeping the newest', () => {
  const many = { attempts: Array.from({ length: adv.APP.attemptsKeep }, (_, i) => ({ q: 'q' + i, t: i, ok: true, topic: 1, p: 0 })) };
  const out = adv.withAnswer(many, { q: 'new', ok: true, topic: 1, p: 0 }, 99999);
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
