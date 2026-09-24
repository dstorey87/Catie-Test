// Browser-check harness — drives the real app in Chromium with a FAKE signed-in Supabase,
// so any screen (including paid ones) can be checked without touching real data.
// Not part of `node --test` (the file name doesn't match *.test.js). Use it from a
// throwaway script:
//
//   const { chromium, open, text, shot, btn } = require('./tests/browser/harness');
//   const b = await chromium.launch();
//   const { page, errors, posted } = await open(b, { width: 390, theme: 'dark', base: 'http://127.0.0.1:8781/' });
//
// Serve the folder first:  python -m http.server <port> --bind 127.0.0.1
// Every agent uses its OWN port (see CLAUDE.md) — 8765 belongs to another app on this PC.
// Playwright is the global install (npm root -g). Screenshots go to BROWSER_OUT or the OS temp folder.
//
// Known trap: a CSS-attribute locator such as  div[style*="font-size:2"]  crashes headless
// Chromium's renderer after repeated use on this page. Find things by role and name instead.
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const REPO = path.join(__dirname, '..', '..');
const OUT = process.env.BROWSER_OUT || os.tmpdir();
const json = (status, body) => r => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// The question bank as the server would return it, built from the repo's own files.
const ROWS = [1, 2, 3, 4, 5].flatMap(n => require(path.join(REPO, 'questions-' + n + '.json'))).map(q => ({
  qid: q.id, topic: q.topic, question: q.question, options: q.options, correct_index: q.correctIndex,
  explanation: q.explanation, rule_ref: q.ruleRef, sign: q.imageHint || '', test_type: 'car', pack: q.pack || 'p1',
  memory_tip: q.memoryTip || null, tip_status: q.tipStatus || null }));
const SESSION = JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_at: 4102444800, user: { id: 'u1', email: 'catie@example.com' } });

// Opens the app signed in as a learner with full access. extraRoutes: [[glob, handler]] added
// AFTER the defaults, so they win (Playwright tries the most recently added route first).
// seed: extra localStorage keys. role: 'user' | 'admin'.
async function open(browser, { width = 390, theme = 'light', base = process.env.BASE, extraRoutes = [], seed = {}, role = 'user' } = {}) {
  if (!base) throw new Error('open(): pass base (e.g. http://127.0.0.1:8781/) or set BASE');
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [], posted = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/rest/v1/**', r => { if (r.request().method() !== 'GET') posted.push({ url: r.request().url(), body: r.request().postData() }); return json(200, [])(r); });
  await page.route('**/rest/v1/entitlements**', json(200, [{ status: 'comp', plan: 'comp' }]));
  await page.route('**/rest/v1/profiles**', json(200, [{ id: 'u1', email: 'catie@example.com', name: 'Catie', role }]));
  await page.route('**/rest/v1/questions**', json(200, ROWS));
  for (const [pat, fn] of extraRoutes) await page.route(pat, fn);
  await page.addInitScript(([t, sess, extra]) => {
    if (sessionStorage.getItem('seeded')) return;           // seed once; reloads keep what the app saved
    localStorage.clear(); localStorage.setItem('tt.theme', t); localStorage.setItem('tt.sb.session', sess);
    Object.keys(extra).forEach(k => localStorage.setItem(k, extra[k]));
    sessionStorage.setItem('seeded', '1');
  }, [theme, SESSION, seed]);
  await page.goto(base + 'Theory%20Trainer.dc.html'); await page.waitForTimeout(2500);
  return { ctx, page, errors, posted };
}
const text = async page => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const shot = (page, name, full) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full });
const btn = (page, name) => page.getByRole('button', { name }).first();

module.exports = { chromium, open, text, shot, btn, json, ROWS, OUT };
