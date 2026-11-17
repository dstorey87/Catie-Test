// tools/keep-awake.js and its daily workflow (issue #69) — no network: fetch is faked.
// Run with:  node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readConfig, ping } = require('../tools/keep-awake.js');

const root = path.join(__dirname, '..');
const CFG = { url: 'https://abcdefghij.supabase.co/', anonKey: 'PUBLIC_KEY' };
// A fake fetch that remembers what it was asked and answers with `status`, or throws `fail`.
const fakeFetch = ({ status = 200, fail } = {}) => {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); if (fail) throw fail; return { ok: status >= 200 && status < 300, status }; };
  return { fn, calls };
};

test('#69 keep-awake reads the live URL and publishable key from config.js, the one place they live', () => {
  const c = readConfig(root);
  assert.match(c.url, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.ok(c.anonKey.length > 20, 'config.js anonKey looks empty');
});

test('#69 keep-awake makes one real database read: the entitlements table, with the publishable key', async () => {
  const f = fakeFetch();
  const r = await ping(CFG, f.fn);
  assert.equal(r.ok, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://abcdefghij.supabase.co/rest/v1/entitlements?select=status&limit=1');
  assert.equal(f.calls[0].opts.headers.apikey, 'PUBLIC_KEY');
  assert.ok(f.calls[0].opts.signal, 'the read has a timeout, so a hung server fails the run instead of hanging it');
});

test('#69 a project that does not answer fails the run, naming it and how to resume it', async () => {
  for (const f of [fakeFetch({ fail: new TypeError('fetch failed') }), fakeFetch({ status: 503 })]) {
    const r = await ping(CFG, f.fn);
    assert.equal(r.ok, false);
    assert.match(r.message, /https:\/\/abcdefghij\.supabase\.co/, 'says which project');
    assert.match(r.message, /supabase\.com\/dashboard\/project\/abcdefghij/, 'links straight to it');
    assert.match(r.message, /Resume project/, 'says what to press');
  }
});

test('#69 a project that refuses the read (4xx) fails the run and points at config.js, not at a pause', async () => {
  const r = await ping(CFG, fakeFetch({ status: 401 }).fn);
  assert.equal(r.ok, false);
  assert.match(r.message, /config\.js url and anonKey/);
  assert.doesNotMatch(r.message, /paused/);
});

test('#69 the keep-awake workflow runs every day, can be run by hand, and runs tools/keep-awake.js', () => {
  const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'keep-server-awake.yml'), 'utf8');
  // Daily: minute and hour fixed, every day of the month, month and week (Supabase pauses after a quiet week).
  assert.match(wf, /schedule:\s*\n\s*- cron: '\d{1,2} \d{1,2} \* \* \*'/);
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /run: node tools\/keep-awake\.js/);
});
