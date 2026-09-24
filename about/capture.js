// Re-takes the screenshots that about.html shows, from the REAL app, in light and dark.
//
// Why a script: the screenshots must match the app as it is today. When a screen changes,
// run this again instead of editing pictures by hand.
//
//   1. Serve the repo:   python -m http.server <your port> --bind 127.0.0.1
//   2. Run:              BASE=http://127.0.0.1:<your port>/ node about/capture.js
//
// It drives the app through tests/browser/harness.js (a fake signed-in server, so no real
// account or data is touched), with two deliberate changes for a PUBLIC page:
//   - only the public 20-question free sample (questions-free.json) is served, so no
//     paid question from the bank ever appears in a picture;
//   - the learner is a neutral demo name, never a real person's.
// Everything on screen is produced by the app itself: a demo learner really answers a
// practice session, and the Progress / My answers screens show what that session recorded.
const path = require('path');
const H = require('../tests/browser/harness');
const FREE = require('../questions-free.json');

// ---------- settings (all in one place) ----------
const BASE = process.env.BASE;                  // where the app is served; required
const OUT = __dirname;                          // pictures land next to this script, in about/
const LEARNER = 'Sam';                          // neutral demo name shown on the screens
const WIDTH = 390;                              // phone width, the size most visitors use
const CLIP = { x: 0, y: 0, width: WIDTH, height: 760 }; // crop: one phone screen, above the floating notes button
const THEMES = ['light', 'dark'];
const WRONG_EVERY = 4;                          // the demo learner gets every 4th answer wrong
const PAUSE = 900;                              // ms to let a screen settle after a tap
// The app's back arrow: named by its text on some screens, by aria-label on others.
const BACK = /^(←|Back to home)$/;

// The free sample in the row shape the server returns (same mapping as the harness's ROWS).
const FREE_ROWS = FREE.map(q => ({ qid: q.id, topic: q.topic, question: q.question, options: q.options,
  correct_index: q.correctIndex, explanation: q.explanation, rule_ref: q.ruleRef, sign: q.imageHint || '',
  test_type: 'car', pack: q.pack || 'p1', memory_tip: null, tip_status: null }));

// Taps a button found by its accessible name (a regular expression), then waits for the screen.
async function tap(page, name) {
  await H.btn(page, name).click();
  await page.waitForTimeout(PAUSE);
}

// Saves one picture as about/<name>-<theme>.png.
async function snap(page, name, theme) {
  const file = path.join(OUT, name + '-' + theme + '.png');
  // The app scrolls the whole window, and a new screen keeps the last one's scroll position.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(PAUSE / 3);
  await page.screenshot({ path: file, clip: CLIP });
  console.log('saved', path.relative(process.cwd(), file));
}

// Answers the question on screen: the right answer, or a wrong one when `wrong` is true.
// The right option is looked up in the free sample by the question's own text.
async function answer(page, wrong) {
  const body = await H.text(page);
  const q = FREE.find(x => body.includes(x.question));
  if (!q) throw new Error('answer(): the question on screen is not in questions-free.json — is the free sample being served?');
  const right = q.options[q.correctIndex];
  const pick = wrong ? q.options.find((o, i) => i !== q.correctIndex) : right;
  // Answer options are div role="button" named "Answer A: <text>" (see CLAUDE.md gotchas).
  const escaped = pick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await tap(page, new RegExp('^Answer [A-D]: ' + escaped));
}

async function captureTheme(browser, theme) {
  const { ctx, page, errors } = await H.open(browser, { width: WIDTH, theme, base: BASE,
    seed: { 'theoryTrainer.users': JSON.stringify([{ id: 'u1', name: LEARNER }]) },
    extraRoutes: [
      ['**/rest/v1/questions**', H.json(200, FREE_ROWS)],
      ['**/rest/v1/profiles**', H.json(200, [{ id: 'u1', email: 'learner@example.com', name: LEARNER, role: 'user' }])]
    ] });
  await tap(page, new RegExp('^' + LEARNER[0] + ' ' + LEARNER));

  // 1. A practice session: all 20 free questions, "A bit of everything".
  await tap(page, /^Practise/);
  await tap(page, /^A bit of everything/);
  await tap(page, new RegExp('^' + FREE.length + '$'));
  await tap(page, /^Start$/);
  for (let n = 1; n <= FREE.length; n++) {
    await answer(page, n % WRONG_EVERY === 0);
    if (n === 1) await snap(page, 'practise', theme);  // feedback, explanation, rule reference
    const next = page.getByRole('button', { name: /^(Next question|Finish)/ }).first();
    if (await next.count()) { await next.click(); await page.waitForTimeout(PAUSE); }
  }
  await snap(page, 'results', theme);                  // the end-of-session summary

  // 2. Home after that session: streak, daily goal, XP, level and every way in.
  await tap(page, /^Home$/);
  await snap(page, 'home', theme);

  // 3. The coach on My Progress. Only the "Your coach says" card is kept: the readiness
  //    dial above it has a display bug (issue #12, item D) and is left out until it is fixed.
  await tap(page, /^My Progress/);
  await page.evaluate(() => window.scrollTo(0, 0));
  const coach = page.getByText('Your coach says').locator('xpath=..');
  await coach.screenshot({ path: path.join(OUT, 'coach-' + theme + '.png') });
  console.log('saved', path.join('about', 'coach-' + theme + '.png'));

  // 4. My answers: every answer so far, ready to tick and turn into a test.
  await tap(page, BACK);
  await tap(page, /^My answers/);
  await snap(page, 'answers', theme);

  // 5. The mock test's opening screen: the real test's format, stated by the app.
  await tap(page, BACK);
  await tap(page, /^Mock Test/);
  await snap(page, 'mock', theme);

  if (errors.length) throw new Error(theme + ': the app threw while capturing: ' + errors.join(' | '));
  await ctx.close();
}

(async () => {
  if (!BASE) throw new Error('Set BASE to where the repo is served, e.g. BASE=http://127.0.0.1:8782/');
  const browser = await H.chromium.launch();
  try { for (const t of THEMES) await captureTheme(browser, t); }
  finally { await browser.close(); }
})().catch(e => {
  // Say what failed and what to do next, then exit non-zero so a script calling this notices.
  console.error('about/capture.js failed: ' + e.message +
    '\nNext step: check the server is running at BASE and that the app opens there in a browser.');
  process.exit(1);
});
