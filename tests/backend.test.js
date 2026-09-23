// Tests for backend.js — run with:  node --test tests/
// backend.js is a plain browser script, so each test loads it into a fresh fake
// "browser" (window, localStorage, location, history) with a fake fetch that
// records every request and answers like Supabase's auth server would.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'backend.js'), 'utf8');
const PAGE = 'https://dstorey87.github.io/Catie-Test/Theory%20Trainer.dc.html';

// Build a fake browser at `href`. `answer(url, opts)` returns {status, body} for each fetch.
function browser(href, answer) {
  const url = new URL(href);
  const store = new Map();
  const calls = [];
  const location = {
    protocol: url.protocol, origin: url.origin, pathname: url.pathname,
    search: url.search, hash: url.hash,
  };
  const win = {
    TT_CONFIG: { url: 'https://example.supabase.co', anonKey: 'sb_publishable_test_key_123' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    location,
    history: { replaceState: (_s, _t, to) => { location.hash = ''; location.replaced = to; } },
    fetch: async (u, opts) => {
      calls.push({ url: u, opts });
      const a = answer(u, opts) || { status: 200, body: {} };
      return { ok: a.status < 400, status: a.status, text: async () => JSON.stringify(a.body) };
    },
  };
  win.window = win;
  vm.runInNewContext(SOURCE, win);
  return { win, calls, store };
}

test('an unconfirmed email says what to do and carries a code the screen can act on', async () => {
  const { win } = browser(PAGE, () => ({ status: 400, body: { error_code: 'email_not_confirmed', msg: 'Email not confirmed' } }));
  await assert.rejects(win.TTAuth.signIn('a@b.co', 'secret1'), (e) => {
    assert.strictEqual(e.code, 'email_not_confirmed');
    assert.match(e.message, /not confirmed yet/);
    assert.match(e.message, /send a new one/);
    return true;
  });
});

test('sign-up asks for the email link to come back to this page, %20 and all', async () => {
  const { win, calls } = browser(PAGE, () => ({ status: 200, body: { id: 'u1' } }));
  const r = await win.TTAuth.signUp('a@b.co', 'secret1', 'Ann');
  assert.strictEqual(r.confirm, true);
  const sent = new URL(calls[0].url);
  assert.strictEqual(sent.pathname, '/auth/v1/signup');
  assert.strictEqual(sent.searchParams.get('redirect_to'), PAGE);
});

test('password reset and resend also point their links back here', async () => {
  const { win, calls } = browser(PAGE, () => ({ status: 200, body: {} }));
  await win.TTAuth.resetPassword('a@b.co');
  await win.TTAuth.resendConfirmation('a@b.co');
  assert.strictEqual(new URL(calls[0].url).searchParams.get('redirect_to'), PAGE);
  const resend = calls[1];
  assert.strictEqual(new URL(resend.url).pathname, '/auth/v1/resend');
  assert.deepStrictEqual(JSON.parse(resend.opts.body), { type: 'signup', email: 'a@b.co' });
});

test('inside the native app (capacitor://) no redirect is sent — an email cannot open that', async () => {
  const { win, calls } = browser('capacitor://localhost/index.html', () => ({ status: 200, body: {} }));
  await win.TTAuth.resetPassword('a@b.co');
  assert.strictEqual(new URL(calls[0].url).search, '');
});

test('a password-reset link signs in, cleans the address bar, and reports "recovery"', async () => {
  const hash = '#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer&type=recovery';
  const { win, calls } = browser(PAGE + hash, (u) =>
    (u.endsWith('/auth/v1/user') ? { status: 200, body: { id: 'u1', email: 'a@b.co' } } : null));
  const r = await win.TTAuth.fromEmailLink();
  assert.deepStrictEqual({ ...r }, { type: 'recovery' });
  assert.strictEqual(win.TTAuth.signedIn(), true);
  assert.strictEqual(win.TTAuth.email(), 'a@b.co');
  assert.strictEqual(win.location.hash, '', 'tokens must not stay in the address bar');
  assert.strictEqual(calls[0].opts.headers.Authorization, 'Bearer AT');
});

test('an expired link comes back as an error the screen can show, not a sign-in', async () => {
  const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  const { win, calls } = browser(PAGE + hash, () => null);
  const r = await win.TTAuth.fromEmailLink();
  assert.strictEqual(r.code, 'otp_expired');
  assert.match(r.error, /invalid or has expired/);
  assert.strictEqual(win.TTAuth.signedIn(), false);
  assert.strictEqual(calls.length, 0);
});

test('no link in the URL does nothing', async () => {
  const { win, calls } = browser(PAGE, () => null);
  assert.strictEqual(await win.TTAuth.fromEmailLink(), null);
  assert.strictEqual(calls.length, 0);
});

test('setting a new password sends it to the signed-in user endpoint', async () => {
  const hash = '#access_token=AT&refresh_token=RT&expires_in=3600&type=recovery';
  const { win, calls } = browser(PAGE + hash, () => ({ status: 200, body: { id: 'u1', email: 'a@b.co' } }));
  await win.TTAuth.fromEmailLink();
  await win.TTAuth.setPassword('new-secret');
  const put = calls[calls.length - 1];
  assert.strictEqual(put.opts.method, 'PUT');
  assert.strictEqual(new URL(put.url).pathname, '/auth/v1/user');
  assert.deepStrictEqual(JSON.parse(put.opts.body), { password: 'new-secret' });
});
