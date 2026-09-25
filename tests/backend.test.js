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

// ---------- the signed-in account's own profile ----------
// The admin may read EVERY profile (the Activity screen names each account), so a
// "give me one profile" request must ask for this account's row by id. Without the
// filter the server hands back whichever row it stores first — on the live database
// that became Catie's row as soon as Darren's own row was written, and isAdmin() said no.
test('profile() asks for this account\'s own row, so the admin is still the admin', async () => {
  const everyone = [{ id: 'u2', email: 'catie@example.com', role: 'user' }, { id: 'u1', email: 'admin@example.com', role: 'admin' }];
  // A fake server that honours ?id=eq.<uid> the way PostgREST does, and otherwise
  // returns every row the admin is allowed to read, someone else's first.
  const { win, calls } = tracker((u) => {
    const want = new URL(u).searchParams.get('id');
    const rows = want ? everyone.filter(r => 'eq.' + r.id === want) : everyone;
    return { status: 200, body: rows.slice(0, 1) };
  }, SIGNED_IN);
  const p = await win.TTAuth.profile();
  assert.equal(p.id, 'u1');
  assert.equal(new URL(calls[0].url).searchParams.get('id'), 'eq.u1');
  assert.equal(await win.TTAuth.isAdmin(), true);
});

test('profile() is null when signed out — it never asks the server for "any" row', async () => {
  const { win, calls } = tracker(() => ({ status: 200, body: [{ id: 'u2', role: 'user' }] }));
  assert.equal(await win.TTAuth.profile(), null);
  assert.equal(calls.length, 0);
});

// ---------- "Explain it differently": plain explanations, admin-approved only ----------
test('a plain explanation reaches the app only once the admin has approved it', async () => {
  const rows = [
    { qid: 'a', topic: 1, question: 'A?', options: ['x', 'y'], correct_index: 0, plain_explanation: 'Approved plain', plain_status: 'approved' },
    { qid: 'b', topic: 1, question: 'B?', options: ['x', 'y'], correct_index: 0, plain_explanation: 'Draft plain', plain_status: 'draft' },
    { qid: 'c', topic: 1, question: 'C?', options: ['x', 'y'], correct_index: 0, plain_explanation: 'Rejected plain', plain_status: 'rejected' },
    { qid: 'd', topic: 1, question: 'D?', options: ['x', 'y'], correct_index: 0, plain_explanation: null, plain_status: 'approved' },
  ];
  const { win, calls } = tracker(() => ({ status: 200, body: rows }), SIGNED_IN);
  const got = await win.TTBank.load();
  assert.deepEqual(got.questions.map(q => q.plainExplanation), ['Approved plain', undefined, undefined, undefined]);
  const cols = new URL(calls[0].url).searchParams.get('select').split(',');
  assert.ok(cols.includes('plain_explanation') && cols.includes('plain_status'), 'the bank asks for both columns');
});

test('explanations() lists every drafted plain explanation with its status, for the review screen', async () => {
  const back = [{ qid: 'q1', plain_explanation: 'Simpler words.', plain_status: 'draft' }];
  const { win, calls } = tracker(() => ({ status: 200, body: back }), SIGNED_IN);
  assert.deepEqual(await win.TTBank.explanations(), back);
  const u = new URL(calls[0].url);
  assert.equal(u.pathname, '/rest/v1/questions');
  assert.equal(u.searchParams.get('select'), 'qid,plain_explanation,plain_status');
  assert.equal(u.searchParams.get('plain_explanation'), 'not.is.null');
});

test('saveExplanation sends the text and status for that one question', async () => {
  const { win, calls } = tracker(() => ({ status: 200, body: [{ qid: 't01q02' }] }), SIGNED_IN);
  assert.equal(await win.TTBank.saveExplanation('t01q02', 'Stop, look, then go.', 'approved'), true);
  const u = new URL(calls[0].url);
  assert.equal(calls[0].opts.method, 'PATCH');
  assert.equal(u.searchParams.get('qid'), 'eq.t01q02');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { plain_explanation: 'Stop, look, then go.', plain_status: 'approved' });
});

test('saveExplanation refuses an unknown status before it asks the server', async () => {
  const { win, calls } = tracker(() => ({ status: 200, body: [{}] }), SIGNED_IN);
  await assert.rejects(win.TTBank.saveExplanation('q1', 'x', 'maybe'), /draft, approved or rejected/);
  assert.equal(calls.length, 0);
});

test('saveExplanation says so when the server changed nothing (not the admin, or no such question)', async () => {
  const { win } = tracker(() => ({ status: 200, body: [] }), SIGNED_IN);
  await assert.rejects(win.TTBank.saveExplanation('nope', 'x', 'draft'), /not saved/i);
});

// ---------- TTAccount: data export, account deletion, age ----------
test('exportData returns exactly what the server sent, from the signed-in account\'s own call', async () => {
  const sent = { exported_at: '2026-09-24T18:00:00Z', account_id: 'u1', profile: { id: 'u1', email: 'a@b.co' }, events: [{ kind: 'answer' }] };
  const { win, calls } = tracker(() => ({ status: 200, body: sent }), SIGNED_IN);
  assert.deepEqual(await win.TTAccount.exportData(), sent);
  assert.equal(new URL(calls[0].url).pathname, '/rest/v1/rpc/export_my_data');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer AT');
});

test('deleteAccount checks nothing itself, and shows the server\'s refusal word for word', async () => {
  const refusal = 'This is the admin account, so it cannot delete itself from the app. Make another account the admin first.';
  const { win, calls } = tracker(() => ({ status: 400, body: { code: 'P0001', message: refusal, hint: 'admin_account', details: null } }), SIGNED_IN);
  await assert.rejects(win.TTAccount.deleteAccount(), (e) => {
    assert.equal(e.message, refusal);
    assert.equal(e.hint, 'admin_account', 'the screen can branch on the reason');
    return true;
  });
  assert.equal(calls.length, 1, 'the one and only request is the server call');
  assert.equal(new URL(calls[0].url).pathname, '/rest/v1/rpc/delete_my_account');
  assert.equal(win.TTAuth.signedIn(), true, 'a refused deletion leaves you signed in');
});

test('after a deletion the device forgets the account: session, bank copy and unsent events', async () => {
  const seed = Object.assign({}, SIGNED_IN, {
    'tt.bank.v2': JSON.stringify({ at: 1, rows: [{ id: 'q1' }] }),
    'tt.events.q': JSON.stringify([{ client_id: 'c1', kind: 'answer' }]),
  });
  const { win, calls, store } = tracker(() => ({ status: 204, body: null }), seed);
  assert.equal(await win.TTAccount.deleteAccount(), true);
  assert.equal(win.TTAuth.signedIn(), false);
  ['tt.sb.session', 'tt.bank.v2', 'tt.events.q'].forEach(k => assert.equal(store.has(k), false, k + ' is gone'));
  assert.ok(!calls.some(c => /\/auth\/v1\/logout/.test(c.url)), 'no logout call: the session died with the account');
});

test('the guardian rule comes from config.js and is careful about birthdays not yet reached', () => {
  const { win } = tracker(() => null, SIGNED_IN);
  const now = new Date().getFullYear();
  win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  // Born (now - 16): 16 this year, but maybe still 15 today -> must ask.
  assert.equal(win.TTAccount.needsGuardian(now - 16), true);
  assert.equal(win.TTAccount.needsGuardian(now - 17), false);
  win.TT_CONFIG.age = { guardianUnder: 13, oldest: 120 }; // change the one value: the rule follows
  assert.equal(win.TTAccount.needsGuardian(now - 13), true);
  assert.equal(win.TTAccount.needsGuardian(now - 14), false);
});

test('the shipped config.js holds the age rule', () => {
  const { win } = tracker(() => null);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8'), win);
  const rule = win.TTAccount.ageRule();
  assert.ok(rule.guardianUnder > 0 && rule.oldest > 0);
});

test('a missing age rule is reported with where to fix it, never guessed', async () => {
  const { win, calls } = tracker(() => null, SIGNED_IN);
  delete win.TT_CONFIG.age;
  assert.throws(() => win.TTAccount.needsGuardian(2000), /config\.js/);
  await assert.rejects(win.TTAccount.saveAge(2000, false, ''), /config\.js/);
  assert.equal(calls.length, 0);
});

test('saveAge for an adult stores the year and no guardian details', async () => {
  const { win, calls } = tracker(() => ({ status: 200, body: [{ id: 'u1' }] }), SIGNED_IN);
  win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  const y = new Date().getFullYear() - 30;
  const r = await win.TTAccount.saveAge(y, true, 'someone@example.com');
  assert.equal(r.needsGuardian, false);
  const u = new URL(calls[0].url);
  assert.equal(calls[0].opts.method, 'PATCH');
  assert.equal(u.pathname, '/rest/v1/profiles');
  assert.equal(u.searchParams.get('id'), 'eq.u1', 'only this account\'s own row');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { birth_year: y, guardian_consent: false, guardian_email: null });
});

test('saveAge under the age needs consent and a guardian email that is not the learner\'s own', async () => {
  const seed = { 'tt.sb.session': JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_at: 4102444800, user: { id: 'u1', email: 'catie@example.com' } }) };
  const { win, calls } = tracker(() => ({ status: 200, body: [{ id: 'u1' }] }), seed);
  win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  const y = new Date().getFullYear() - 14;
  await assert.rejects(win.TTAccount.saveAge(y, false, 'mum@example.com'), /parent or guardian/);
  await assert.rejects(win.TTAccount.saveAge(y, true, 'not-an-email'), /email/);
  await assert.rejects(win.TTAccount.saveAge(y, true, 'Catie@Example.com'), /your own email/);
  assert.equal(calls.length, 0, 'nothing is sent until it is complete');
  const r = await win.TTAccount.saveAge(y, true, ' mum@example.com ');
  assert.equal(r.needsGuardian, true);
  assert.deepEqual(JSON.parse(calls[0].opts.body), { birth_year: y, guardian_consent: true, guardian_email: 'mum@example.com' });
});

test('saveAge refuses an impossible year before it asks the server', async () => {
  const { win, calls } = tracker(() => ({ status: 200, body: [{}] }), SIGNED_IN);
  win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  const now = new Date().getFullYear();
  for (const bad of [now + 1, now - 121, 'abc', 2000.5, null]) {
    await assert.rejects(win.TTAccount.saveAge(bad, true, 'mum@example.com'), /year you were born/);
  }
  assert.equal(calls.length, 0);
});

test('saveAge says so when the server saved nothing, and asks to be signed in', async () => {
  const { win } = tracker(() => ({ status: 200, body: [] }), SIGNED_IN);
  win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  await assert.rejects(win.TTAccount.saveAge(new Date().getFullYear() - 30, false, ''), /not saved/i);
  const out = tracker(() => null);
  out.win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  await assert.rejects(out.win.TTAccount.saveAge(2000, false, ''), /sign in/i);
});

test('age() reads this account\'s own row and says whether a guardian is needed', async () => {
  const y = new Date().getFullYear() - 14;
  const { win, calls } = tracker(() => ({ status: 200, body: [{ birth_year: y, guardian_consent: true, guardian_email: 'mum@example.com' }] }), SIGNED_IN);
  win.TT_CONFIG.age = { guardianUnder: 16, oldest: 120 };
  assert.deepEqual({ ...(await win.TTAccount.age()) }, { birthYear: y, guardianConsent: true, guardianEmail: 'mum@example.com', needsGuardian: true });
  assert.equal(new URL(calls[0].url).searchParams.get('id'), 'eq.u1');
});

// ---------- issue #42: payments switch, and the admin giving an account free access ----------
test('payments are off unless config.js switches them on', () => {
  const { win } = tracker(() => null);
  assert.equal(win.TTBill.enabled(), false, 'no payments key: off');
  win.TT_CONFIG.payments = true;
  assert.equal(win.TTBill.enabled(), true);
});

test('Manage subscription and checkout say payments are off instead of calling a missing function', async () => {
  const { win, calls } = tracker(() => ({ status: 404, body: { message: 'Requested function was not found' } }), SIGNED_IN);
  await assert.rejects(win.TTBill.portal(), /not switched on/i);
  await assert.rejects(win.TTBill.checkout('monthly'), /not switched on/i);
  assert.equal(calls.length, 0, 'nothing is sent to a function that does not exist');
});

test('the accounts list comes from admin_accounts, one plain row per account', async () => {
  const { win, calls } = tracker(() => ({ status: 200, body: [
    { id: 'a1', email: 'dad@example.com', name: 'Darren', role: 'admin', status: 'none', free_until: null, paying: false, last_seen: '2026-09-25T19:13:07Z' },
    { id: 'c1', email: 'kid@example.com', name: '', role: 'user', status: 'comp', free_until: '2026-10-02T23:00:00Z', paying: false, last_seen: null }] }), SIGNED_IN);
  const rows = await win.TTAdmin.accounts();
  assert.equal(new URL(calls[0].url).pathname, '/rest/v1/rpc/admin_accounts');
  assert.equal(calls[0].opts.method, 'POST');
  assert.deepEqual(rows.map(r => ({ ...r })), [
    { id: 'a1', email: 'dad@example.com', name: 'Darren', admin: true, status: 'none', freeUntil: '', paying: false, lastSeen: '2026-09-25T19:13:07Z' },
    { id: 'c1', email: 'kid@example.com', name: '', admin: false, status: 'comp', freeUntil: '2026-10-02T23:00:00Z', paying: false, lastSeen: '' }]);
});

test('free access: for good, until the start of the day after the date picked, or taken away', async () => {
  const { win, calls } = tracker(() => ({ status: 204, body: null }), SIGNED_IN);
  await win.TTAdmin.setAccess('c1', true, '');
  await win.TTAdmin.setAccess('c1', true, '2026-10-02');
  await win.TTAdmin.setAccess('c1', false);
  calls.forEach(c => assert.equal(new URL(c.url).pathname, '/rest/v1/rpc/admin_set_access'));
  const sent = calls.map(c => JSON.parse(c.opts.body));
  assert.deepEqual(sent[0], { target: 'c1', free: true, until: null });
  // 2 October is included: access ends at midnight starting 3 October, this device's time
  assert.equal(sent[1].until, new Date(2026, 9, 3).toISOString());
  assert.deepEqual(sent[2], { target: 'c1', free: false, until: null });
});

test('free access refuses a date it cannot read before asking the server', async () => {
  const { win, calls } = tracker(() => ({ status: 204, body: null }), SIGNED_IN);
  await assert.rejects(win.TTAdmin.setAccess('c1', true, '2 Oct'), /date/i);
  assert.equal(calls.length, 0);
});

test('the server\'s refusal reaches the screen as its own sentence', async () => {
  const { win } = tracker(() => ({ status: 400, body: { code: 'P0001', hint: 'paying',
    message: 'This account pays through Stripe, so its access follows the subscription. Cancel the subscription in Stripe first, then give free access.' } }), SIGNED_IN);
  await assert.rejects(win.TTAdmin.setAccess('c1', true, ''), (e) => { assert.match(e.message, /pays through Stripe/); assert.equal(e.hint, 'paying'); return true; });
});
