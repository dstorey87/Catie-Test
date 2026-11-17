// Keeps the live Supabase project awake, and says loudly when it is not (issue #69).
//
// Why: Supabase pauses a Free-plan project that shows low database activity over 7 days, and
// "a few user requests to the database each day over the previous week is enough to keep the
// project from being paused" (https://supabase.com/docs/guides/platform/free-project-pausing).
// While it was paused the app could reach nothing and looped its 20-question free sample.
// .github/workflows/keep-server-awake.yml runs this once a day; a failed run is GitHub's email.
//
// What: one read of the entitlements table, using the URL and publishable key from config.js
// (the one place they live; the key is public by design, because row-level security lets a
// signed-out request read nothing). Signed out, the read returns [] but is still a real
// database query, which is the activity Supabase counts. Not the questions table: its read
// policy calls has_access(), which a signed-out request may not run, so it answers 401.
//
//   node tools/keep-awake.js     exit 0 = the project answered; exit 1 = it did not, and why
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// readConfig(root) -> window.TT_CONFIG from root/config.js, run the way the browser runs it.
function readConfig(root) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), ctx);
  const c = ctx.window.TT_CONFIG || {};
  if (!c.url || !c.anonKey) {
    throw new Error('config.js has no url or anonKey, so there is no server to keep awake. ' +
      'Fill them in (SETUP.md) or delete .github/workflows/keep-server-awake.yml.');
  }
  return c;
}

// ping(cfg, fetchFn, timeoutMs) -> {ok, message}. Never throws: every failure becomes a sentence
// naming what failed, where, and what to do next.
async function ping(cfg, fetchFn = fetch, timeoutMs = 20000) {
  const base = String(cfg.url).replace(/\/+$/, '');
  const ref = (base.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/) || [])[1] || '<project>';
  const where = 'The Supabase project at ' + base;
  const resume = 'It is probably paused: open https://supabase.com/dashboard/project/' + ref +
    ' and press Resume project, then re-run this workflow from the Actions tab.';
  try {
    const r = await fetchFn(base + '/rest/v1/entitlements?select=status&limit=1',
      { headers: { apikey: cfg.anonKey }, signal: AbortSignal.timeout(timeoutMs) });
    if (r.ok) return { ok: true, message: where + ' answered (HTTP ' + r.status + ').' };
    if (r.status >= 500) return { ok: false, message: where + ' answered HTTP ' + r.status + ' to a read of the entitlements table. ' + resume };
    return { ok: false, message: where + ' refused a read of the entitlements table (HTTP ' + r.status + '). ' +
      'Check that config.js url and anonKey belong to this project (Supabase: Settings, API Keys) and that the entitlements table still lets a signed-out read return [] (supabase/schema.sql).' };
  } catch (e) {
    return { ok: false, message: where + ' did not answer (' + ((e && e.message) || e) + '). ' + resume };
  }
}

module.exports = { readConfig, ping };

if (require.main === module) {
  (async () => {
    let cfg;
    try { cfg = readConfig(path.join(__dirname, '..')); }
    catch (e) { console.error('keep-awake: ' + e.message); process.exit(1); }
    const r = await ping(cfg);
    (r.ok ? console.log : console.error)('keep-awake: ' + r.message);
    process.exit(r.ok ? 0 : 1);
  })();
}
