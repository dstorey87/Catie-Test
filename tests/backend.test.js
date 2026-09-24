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

// ---------- TTTrack: every event queued on the device, sent in batches ----------
const SIGNED_IN = { 'tt.sb.session': JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_at: 4102444800, user: { id: 'u1' } }) };
function tracker(answer, seed) {
  const b = browser(PAGE, answer);
  Object.entries(seed || {}).forEach(([k, v]) => b.win.localStorage.setItem(k, v));
  vm.runInNewContext(SOURCE, b.win);            // reload so it picks up the seeded session
  b.win.navigator = { onLine: true };
  return b;
}

test('events queue on the device and keep their order while signed out', async () => {
  const { win, calls } = tracker(() => ({ status: 201, body: null }));
  win.TTTrack.track('answer', 'q1', { ok: false }, { id: 'l1', name: 'Catie' });
  win.TTTrack.track('screen', null, { view: 'home' }, { id: 'l1', name: 'Catie' });
  assert.equal(await win.TTTrack.flush(), 0, 'nothing is sent without a signed-in account');
  assert.equal(calls.length, 0);
  const q = win.TTTrack.pending();
  assert.deepEqual(q.map(e => e.kind), ['answer', 'screen']);
  assert.equal(q[0].qid, 'q1'); assert.equal(q[0].learner, 'Catie');
  assert.ok(q[0].client_id && q[0].client_id !== q[1].client_id);
});

test('a flush sends the queue as one batch, idempotently, and empties it', async () => {
  const { win, calls } = tracker(() => ({ status: 201, body: null }), SIGNED_IN);
  for (let i = 0; i < 3; i++) win.TTTrack.track('answer', 'q' + i, {}, { id: 'l1', name: 'Catie' });
  assert.equal(await win.TTTrack.flush(), 3);
  assert.equal(calls.length, 1);
  const sent = new URL(calls[0].url);
  assert.equal(sent.pathname, '/rest/v1/events');
  assert.equal(sent.searchParams.get('on_conflict'), 'user_id,client_id');
  assert.match(calls[0].opts.headers.Prefer, /ignore-duplicates/);
  const rows = JSON.parse(calls[0].opts.body);
  assert.equal(rows.length, 3); assert.equal(rows[0].user_id, 'u1');
  assert.equal(win.TTTrack.pending().length, 0);
});

test('a failed send keeps every event for the next try', async () => {
  const { win } = tracker(() => ({ status: 503, body: { message: 'down' } }), SIGNED_IN);
  win.TTTrack.track('answer', 'q1', {}, { id: 'l1' });
  assert.equal(await win.TTTrack.flush(), 0);
  assert.equal(win.TTTrack.pending().length, 1);
});

test('the queue is capped so a long offline spell cannot fill the phone', async () => {
  const { win } = tracker(() => null);
  const cap = win.TTTrack.limits.queueMax;
  for (let i = 0; i < cap + 5; i++) win.TTTrack.track('screen', null, { i }, { id: 'l1' });
  const q = win.TTTrack.pending();
  assert.equal(q.length, cap);
  assert.equal(q[q.length - 1].data.i, cap + 4, 'the newest are kept');
});

// ---------- memory tips ----------
test('a memory tip reaches the app only once the admin has approved it', async () => {
  const rows = [
    { qid: 'a', topic: 1, question: 'A?', options: ['x', 'y'], correct_index: 0, memory_tip: 'Approved tip', tip_status: 'approved' },
    { qid: 'b', topic: 1, question: 'B?', options: ['x', 'y'], correct_index: 0, memory_tip: 'Draft tip', tip_status: 'draft' },
    { qid: 'c', topic: 1, question: 'C?', options: ['x', 'y'], correct_index: 0, memory_tip: 'Rejected tip', tip_status: 'rejected' },
  ];
  const { win } = tracker(() => ({ status: 200, body: rows }), SIGNED_IN);
  const got = await win.TTBank.load();
  assert.equal(got.source, 'server');
  assert.deepEqual(got.questions.map(q => q.memoryTip), ['Approved tip', undefined, undefined]);
});

test('saving a tip sends the text and status for that one question', async () => {
  const { win, calls } = tracker(() => ({ status: 204, body: null }), SIGNED_IN);
  await win.TTBank.saveTip('t01q02', 'Stop and rest.', 'approved');
  const u = new URL(calls[0].url);
  assert.equal(calls[0].opts.method, 'PATCH');
  assert.equal(u.searchParams.get('qid'), 'eq.t01q02');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { memory_tip: 'Stop and rest.', tip_status: 'approved' });
});
