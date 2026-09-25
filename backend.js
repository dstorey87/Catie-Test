// Theory Trainer — Supabase backend adapter. Plain fetch, no SDK, no build step.
// Exposes: TTBackend (config), TTAuth (accounts), TTSync (progress), TTBill
// (subscription), TTBank (question bank). Runs in a browser, a PWA and a
// Capacitor WebView unchanged.
(function () {
  var CFGKEY = 'tt.sb.cfg', SESSKEY = 'tt.sb.session', BANKKEY = 'tt.bank.v2';
  // Review statuses for admin-approved text (plain explanations). Mirrors the server's
  // questions_plain_status_check constraint in supabase/schema.sql.
  var PLAIN_STATUSES = ['draft', 'approved', 'rejected'];

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }
  drop('tt.bank.v1'); // pre-v2 bank cache: the paid bank must not outlive its key

  var override = readJSON(CFGKEY);
  function cfg() {
    var base = window.TT_CONFIG || {};
    var c = (override && override.url) ? override : base;
    return (c && c.url && c.anonKey) ? c : null;
  }
  function money() { var b = window.TT_CONFIG || {}; return {
    monthly: (override && override.priceMonthly) || b.priceMonthly || '£4.99 a month',
    annual: (override && override.priceAnnual) || b.priceAnnual || '£50 a year',
    trial: (override && override.trialCount) || b.trialCount || 20 }; }
  function payLink(plan) {
    var b = window.TT_CONFIG || {}, o = override || {};
    var v = plan === 'annual' ? (o.payLinkAnnual || b.payLinkAnnual) : (o.payLinkMonthly || b.payLinkMonthly);
    return (v && /^https?:\/\//.test(v)) ? v : '';
  }

  var sess = readJSON(SESSKEY);

  function why(status, body) {
    var m = body && (body.msg || body.message || body.error_description || body.error);
    var code = (body && body.error_code) || '';
    // The account exists but its confirmation link was never opened. Say what to do,
    // and the sign-in screen offers a "resend" button off the same code.
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(m || ''))
      return 'This email is not confirmed yet. Open the link in the email we sent (check spam too), or send a new one below.';
    if (status === 429 || code === 'over_email_send_rate_limit')
      return 'Too many emails sent just now. Wait a few minutes and try again.';
    if (status === 400 && /invalid login/i.test(m || '')) return 'That email and password do not match an account.';
    if (status === 400 && /already registered/i.test(m || '')) return 'That email already has an account — sign in instead.';
    if (status === 422 && /password/i.test(m || '')) return 'Password needs to be at least 6 characters.';
    if (status === 401) return 'Session expired — sign in again.';
    if (status === 403) return 'That account is not allowed to do this.';
    if (m) return String(m);
    return 'Server error ' + status;
  }

  async function call(path, opts, auth) {
    var c = cfg();
    if (!c) throw new Error('The app is not connected to its server yet (setup screen).');
    opts = opts || {};
    // The project key always travels in the apikey header. Only a signed-in user's
    // token goes in Authorization — the newer sb_publishable_ keys are rejected there.
    var h = Object.assign({ apikey: c.anonKey, 'Content-Type': 'application/json' }, opts.headers || {});
    if (auth !== false && sess && sess.access_token) h.Authorization = 'Bearer ' + sess.access_token;
    var r = await fetch(c.url.replace(/\/+$/, '') + path, Object.assign({}, opts, { headers: h, cache: 'no-store' }));
    var text = await r.text();
    var body = null; try { body = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) {
      var err = new Error(why(r.status, body)); err.status = r.status;
      err.code = (body && body.error_code) || ''; // e.g. email_not_confirmed — the UI branches on it
      // A database refusal (raise exception ... hint = 'admin_account') carries a short
      // reason in "hint"; the message itself is already the sentence to show.
      err.hint = (body && typeof body.hint === 'string') ? body.hint : '';
      throw err;
    }
    return body;
  }

  // Where links in our emails (confirm, password reset) should land: this page.
  // Supabase only honours it if the address is in the project's redirect allow list;
  // otherwise it falls back to the project's Site URL. Only http(s) pages qualify —
  // a Capacitor WebView's capacitor:// address can't be opened from an email.
  function linkBack() {
    try {
      if (!/^https?:$/.test(location.protocol)) return '';
      return '?redirect_to=' + encodeURIComponent(location.origin + location.pathname);
    } catch (e) { return ''; }
  }

  // An email link lands here with the session in the URL fragment:
  //   #access_token=…&refresh_token=…&expires_in=3600&type=signup|recovery
  // or, when the link was stale:  #error=access_denied&error_code=otp_expired&error_description=…
  function readLink(hash) {
    var p = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
    });
    if (p.error || p.error_description) return { error: p.error_description || p.error, code: p.error_code || '' };
    if (p.access_token) return { access_token: p.access_token, refresh_token: p.refresh_token || '', expires_in: Number(p.expires_in) || 3600, type: p.type || '' };
    return null;
  }

  function keepSession(d) {
    if (!d || !d.access_token) return null;
    sess = { access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600) - 60,
      user: d.user || (sess && sess.user) || null };
    writeJSON(SESSKEY, sess);
    return sess;
  }

  var refreshing = null;
  async function fresh() {
    if (!sess) return null;
    if (sess.expires_at && sess.expires_at > Math.floor(Date.now() / 1000)) return sess;
    if (!sess.refresh_token) return sess;
    if (!refreshing) refreshing = call('/auth/v1/token?grant_type=refresh_token',
      { method: 'POST', body: JSON.stringify({ refresh_token: sess.refresh_token }) }, false)
      .then(keepSession)
      .catch(function (e) { if (e.status === 400 || e.status === 401) { sess = null; drop(SESSKEY); } return sess; })
      .then(function (s) { refreshing = null; return s; });
    return refreshing;
  }

  async function rest(path, opts) { await fresh(); return call('/rest/v1' + path, opts); }

  window.TTBackend = {
    configured: function () { return !!cfg(); },
    config: cfg,
    prices: money,
    setConfig: function (url, anonKey) {
      override = Object.assign({}, window.TT_CONFIG || {}, { url: String(url || '').trim().replace(/\/+$/, ''), anonKey: String(anonKey || '').trim() });
      writeJSON(CFGKEY, override);
    },
    test: async function () { await call('/auth/v1/settings', {}, false); return true; }
  };

  window.TTAuth = {
    signedIn: function () { return !!(sess && sess.access_token); },
    user: function () { return (sess && sess.user) || null; },
    email: function () { return (sess && sess.user && sess.user.email) || ''; },
    token: function () { return (sess && sess.access_token) || ''; },
    signUp: async function (email, password, name) {
      var d = await call('/auth/v1/signup' + linkBack(), { method: 'POST', body: JSON.stringify({ email: email, password: password, data: { name: name || '' } }) }, false);
      if (d && d.access_token) { keepSession(d); return { signedIn: true }; }
      return { signedIn: false, confirm: true, email: email };
    },
    resendConfirmation: async function (email) {
      await call('/auth/v1/resend' + linkBack(), { method: 'POST', body: JSON.stringify({ type: 'signup', email: email }) }, false);
      return true;
    },
    // Call once on page load. Signs in from an email link if the URL carries one, then
    // strips the tokens from the address bar so they aren't bookmarked or shared.
    // Returns null (no link), {type:'signup'|'recovery'|…} (signed in), or {error}.
    fromEmailLink: async function () {
      var got = readLink(location.hash);
      if (!got) return null;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      if (got.error) return { error: got.error + ' — ask for a new email below.', code: got.code };
      keepSession(got);
      try { sess.user = await call('/auth/v1/user', {}); writeJSON(SESSKEY, sess); }
      catch (e) { return { error: 'That link could not sign you in (' + e.message + '). Sign in with your password, or ask for a new link.' }; }
      return { type: got.type };
    },
    // Signed-in only: after a password-reset link, or from settings.
    setPassword: async function (password) {
      await fresh();
      await call('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: password }) });
      return true;
    },
    signIn: async function (email, password) {
      var d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) }, false);
      keepSession(d);
      return true;
    },
    resetPassword: async function (email) {
      await call('/auth/v1/recover' + linkBack(), { method: 'POST', body: JSON.stringify({ email: email }) }, false);
      return true;
    },
    signOut: async function () {
      try { await call('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
      sess = null; drop(SESSKEY); drop(BANKKEY);
    },
    // This account's own profile row. It must be asked for BY ID: the admin may read
    // every profile (Activity screen), and an unfiltered "limit=1" returns whichever row
    // the database stores first — someone else's, once the admin's own row is written.
    profile: async function () {
      var uid = sess && sess.user && sess.user.id;
      if (!uid) return null; // signed out: there is no "own" row to ask for
      var rows = await rest('/profiles?select=id,email,name,role&id=eq.' + encodeURIComponent(uid) + '&limit=1');
      return (rows && rows[0]) || null;
    },
    isAdmin: async function () {
      try { var p = await window.TTAuth.profile(); return !!(p && p.role === 'admin'); } catch (e) { return false; }
    }
  };

  // Progress: one JSON snapshot row per account. Same API the app used before,
  // so pull/merge/push behaviour is unchanged.
  window.TTSync = {
    configured: function () { return !!(cfg() && sess && sess.access_token); },
    config: function () { return { email: window.TTAuth.email() }; },
    signOut: function () { return window.TTAuth.signOut(); },
    pull: async function () {
      var uid = sess && sess.user && sess.user.id; if (!uid) return null;
      var rows = await rest('/snapshots?select=blob,updated_at&limit=1');
      if (!rows || !rows.length || !rows[0].blob) return null;
      return { blob: rows[0].blob, updatedAt: rows[0].updated_at };
    },
    push: async function (blob) {
      var uid = sess && sess.user && sess.user.id; if (!uid) throw new Error('Not signed in.');
      await rest('/snapshots', { method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: uid, blob: blob, updated_at: new Date().toISOString() }) });
      return true;
    }
  };

  // Activity: everything a learner does, as small events. They queue on the device
  // (so nothing is lost offline or signed out) and go to the events table in batches.
  // Tracking must never get in the way of learning: every failure is swallowed here
  // and the events simply wait for the next try.
  var EVKEY = 'tt.events.q';
  var LIMITS = { queueMax: 5000, batch: 200, delayMs: 5000 };
  var evTimer = null, evSending = null;
  function evQueue() { var q = readJSON(EVKEY); return Array.isArray(q) ? q : []; }
  function newId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function soon() {
    if (evTimer || !window.setTimeout) return;
    evTimer = window.setTimeout(function () { evTimer = null; window.TTTrack.flush(); }, LIMITS.delayMs);
  }

  window.TTTrack = {
    limits: LIMITS,
    pending: evQueue,
    // kind: 'answer', 'screen', ...   who: {id, name} of the learner on this device
    track: function (kind, qid, data, who) {
      var q = evQueue();
      q.push({ client_id: newId(), at: new Date().toISOString(), kind: String(kind), qid: qid || null,
        learner_id: (who && who.id) || null, learner: (who && who.name) || null, data: data || {} });
      if (q.length > LIMITS.queueMax) q = q.slice(q.length - LIMITS.queueMax);
      writeJSON(EVKEY, q);
      soon();
    },
    // Sends what's queued. Returns how many were sent (0 when signed out, offline or refused).
    flush: async function () {
      if (evSending) return evSending;
      var uid = sess && sess.user && sess.user.id;
      var online = !window.navigator || window.navigator.onLine !== false;
      if (!cfg() || !uid || !online) return 0;
      evSending = (async function () {
        var sent = 0;
        try {
          while (true) {
            var q = evQueue(); if (!q.length) break;
            var batch = q.slice(0, LIMITS.batch);
            await rest('/events?on_conflict=user_id,client_id', { method: 'POST',
              headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
              body: JSON.stringify(batch.map(function (e) { return Object.assign({ user_id: uid }, e); })) });
            // Drop exactly what was sent — events added meanwhile stay queued.
            var ids = {}; batch.forEach(function (e) { ids[e.client_id] = true; });
            writeJSON(EVKEY, evQueue().filter(function (e) { return !ids[e.client_id]; }));
            sent += batch.length;
          }
        } catch (e) { /* keep the rest queued; the next flush retries */ }
        return sent;
      })();
      try { return await evSending; } finally { evSending = null; }
    },
    // Admin Activity screen and the coach: newest first. Admin sees every account.
    read: async function (sinceIso, limit) {
      var q = '/events?select=user_id,learner,at,kind,qid,data&order=at.desc&limit=' + (limit || 5000);
      if (sinceIso) q += '&at=gte.' + encodeURIComponent(sinceIso);
      return (await rest(q)) || [];
    },
    accounts: async function () { return (await rest('/profiles?select=id,email,name,role')) || []; }
  };
  try {
    window.addEventListener('online', function () { window.TTTrack.flush(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) window.TTTrack.flush(); });
  } catch (e) {}

  // Account privacy: download my data, delete my account, and age / guardian consent.
  // The server does the deciding (supabase/schema.sql: export_my_data, delete_my_account);
  // this is the thin layer the Settings screens call.

  // The age rule lives in ONE place: config.js, TT_CONFIG.age. Nothing here guesses it —
  // if it is missing, every age call stops and says where to put it back.
  function ageRule() {
    var a = (window.TT_CONFIG || {}).age;
    if (!a || !(Number(a.guardianUnder) > 0) || !(Number(a.oldest) > 0))
      throw new Error('The age rule is missing from config.js (TT_CONFIG.age: guardianUnder and oldest). Put it back, then reload the app.');
    return { guardianUnder: Number(a.guardianUnder), oldest: Number(a.oldest) };
  }
  // Only a birth YEAR is stored, so today's age is one of two numbers. Take the younger
  // one: someone born (this year - N) may not have had their Nth birthday yet.
  function needsGuardian(year) {
    var youngest = new Date().getFullYear() - Number(year) - 1;
    return youngest < ageRule().guardianUnder;
  }

  window.TTAccount = {
    ageRule: ageRule,
    needsGuardian: needsGuardian,

    // Everything the server holds about this account, as one JSON object, exactly as
    // the server sent it (profile, entitlement, snapshot, reminders, push devices, events).
    exportData: async function () {
      return rest('/rpc/export_my_data', { method: 'POST', body: '{}' });
    },

    // Deletes this account and everything it owns on the server. No checks here on
    // purpose: the server refuses the admin account and a subscription that would
    // still bill, and its sentence (err.message) and reason (err.hint) reach the screen
    // unchanged. Once deleted, this device forgets the account too — the session, the
    // offline question bank and any activity not yet sent (it would otherwise be sent
    // under whoever signs in next). No logout call: the session died with the account.
    deleteAccount: async function () {
      await rest('/rpc/delete_my_account', { method: 'POST', body: '{}' });
      sess = null; drop(SESSKEY); drop(BANKKEY); drop(EVKEY);
      return true;
    },

    // This account's saved age answers, or null when signed out / not found.
    age: async function () {
      var uid = sess && sess.user && sess.user.id;
      if (!uid) return null;
      var rows = await rest('/profiles?select=birth_year,guardian_consent,guardian_email&id=eq.' + encodeURIComponent(uid) + '&limit=1');
      var r = rows && rows[0];
      if (!r) return null;
      return { birthYear: r.birth_year, guardianConsent: !!r.guardian_consent, guardianEmail: r.guardian_email || '',
        needsGuardian: r.birth_year ? needsGuardian(r.birth_year) : null };
    },

    // Saves the birth year and, when the learner may be under the age in config.js, a
    // parent's or guardian's consent and email. Everything is checked BEFORE anything
    // is sent. An adult's row keeps no guardian email (no need to hold a third
    // person's address). Returns what was saved.
    saveAge: async function (year, consent, guardianEmail) {
      var rule = ageRule();
      var uid = sess && sess.user && sess.user.id;
      if (!uid) throw new Error('Sign in first: your age is saved to your account.');
      var y = Number(year), now = new Date().getFullYear();
      if (year === null || year === '' || !Number.isInteger(y) || y > now || y < now - rule.oldest)
        throw new Error('Enter the year you were born as four digits, for example ' + (now - 17) + '.');
      var needs = needsGuardian(y);
      var email = String(guardianEmail || '').trim();
      if (needs) {
        if (consent !== true)
          throw new Error('You may still be under ' + rule.guardianUnder + ', so a parent or guardian needs to agree. Ask them to tick the box and add their email.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw new Error('Add your parent or guardian’s email address, for example name@example.com.');
        if (email.toLowerCase() === String(window.TTAuth.email() || '').toLowerCase())
          throw new Error('That is your own email. Add your parent or guardian’s email instead.');
      }
      var row = { birth_year: y, guardian_consent: needs, guardian_email: needs ? email : null };
      var saved = await rest('/profiles?id=eq.' + encodeURIComponent(uid), { method: 'PATCH',
        headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      if (!saved || !saved.length)
        throw new Error('Your age was not saved: this account’s profile was not found. Sign out, sign back in, then try again.');
      return { birthYear: y, needsGuardian: needs, guardianConsent: needs, guardianEmail: row.guardian_email };
    }
  };

  // Payments are OFF until config.js says `payments: true`, which is only right once Stripe is
  // set up (SETUP.md §3: the webhook that switches access on, plus a Payment Link or the
  // create-checkout and billing-portal functions). Off, the app offers no Subscribe, Manage
  // subscription or "I've paid" buttons, which could only fail (issue #42).
  function paymentsOn() { var b = window.TT_CONFIG || {}, o = override || {}; return !!(b.payments || o.payments); }
  var PAYMENTS_OFF = 'Payments are not switched on in this app yet. Ask the admin for free access.';

  window.TTBill = {
    enabled: paymentsOn,
    status: async function () {
      var rows = await rest('/entitlements?select=status,plan,current_period_end,cancel_at_period_end&limit=1');
      var e = (rows && rows[0]) || null;
      if (!e) return { active: false, status: 'none' };
      var live = (e.status === 'active' || e.status === 'trialing' || e.status === 'comp');
      var ends = e.current_period_end ? new Date(e.current_period_end).getTime() : 0;
      if (live && ends && ends < Date.now()) live = false;
      return { active: live, status: e.status, plan: e.plan || '', endsAt: e.current_period_end || '', cancelling: !!e.cancel_at_period_end };
    },
    // Route A: a Stripe Payment Link straight from config, tagged with the
    // account id so the webhook knows whose access to switch on.
    // Route B: the create-checkout Edge Function (needed for plan switching).
    checkout: async function (plan) {
      if (!paymentsOn()) throw new Error(PAYMENTS_OFF);
      await fresh();
      var uid = (sess && sess.user && sess.user.id) || '';
      var link = payLink(plan === 'annual' ? 'annual' : 'monthly');
      if (link) {
        var u = link + (link.indexOf('?') > -1 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(uid);
        var em = window.TTAuth.email();
        if (em) u += '&prefilled_email=' + encodeURIComponent(em);
        return u;
      }
      var d = await call('/functions/v1/create-checkout', { method: 'POST',
        body: JSON.stringify({ plan: plan === 'annual' ? 'annual' : 'monthly', origin: location.origin + location.pathname }) });
      if (!d || !d.url) throw new Error('Checkout is not set up yet — add a payment link or deploy create-checkout (SETUP.md §3).');
      return d.url;
    },
    portal: async function () {
      if (!paymentsOn()) throw new Error(PAYMENTS_OFF);
      await fresh();
      var d = await call('/functions/v1/billing-portal', { method: 'POST', body: JSON.stringify({ origin: location.origin + location.pathname }) });
      if (!d || !d.url) throw new Error('Subscription management needs the billing-portal function (SETUP.md §3, route B).');
      return d.url;
    }
  };

  // The admin giving an account free access (issue #42): Admin → Progress dashboard →
  // Accounts. The server decides everything and refuses anyone but the admin, a date
  // already gone, and an account paying through Stripe (supabase/schema.sql,
  // admin_accounts and admin_set_access); its refusal is a sentence this passes on.
  window.TTAdmin = {
    // Every account: {id, email, name, admin, status, freeUntil, paying, lastSeen}.
    // status is the server's: 'comp' = free access, 'active'/'trialing' = paying, 'none'.
    accounts: async function () {
      var rows = (await rest('/rpc/admin_accounts', { method: 'POST', body: '{}' })) || [];
      return rows.map(function (r) {
        return { id: r.id, email: r.email || '', name: r.name || '', admin: r.role === 'admin',
          status: r.status || 'none', freeUntil: r.free_until || '', paying: !!r.paying, lastSeen: r.last_seen || '' };
      });
    },
    // free: true gives free access, false takes it away. untilDay: '' for good, or the
    // last day included as 'YYYY-MM-DD' (a date input's value). Access ends when the
    // NEXT day starts on this device, so the admin's own time zone decides "the day".
    setAccess: async function (id, free, untilDay) {
      var until = null;
      if (free && untilDay) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(untilDay));
        var day = m && new Date(+m[1], +m[2] - 1, +m[3]);
        if (!day || day.getMonth() !== +m[2] - 1) throw new Error('That date could not be read. Pick it again from the calendar.');
        until = new Date(+m[1], +m[2] - 1, +m[3] + 1).toISOString();
      }
      await rest('/rpc/admin_set_access', { method: 'POST', body: JSON.stringify({ target: id, free: !!free, until: until }) });
      return true;
    }
  };

  // Question bank: server-held and row-level-secured, so an unpaid account
  // simply receives nothing. Cached locally for offline use; the cache is
  // dropped as soon as the server stops returning rows.
  window.TTBank = {
    cached: function () { var c = readJSON(BANKKEY); return (c && c.rows && c.rows.length) ? c.rows : null; },
    load: async function () {
      var out = null;
      if (cfg() && sess && navigator.onLine) {
        try {
          var rows = await rest('/questions?select=qid,topic,question,options,correct_index,explanation,rule_ref,sign,test_type,pack,memory_tip,tip_status,plain_explanation,plain_status&order=qid');
          if (rows && rows.length) {
            out = rows.map(function (r) {
              // topic must be numeric (the app compares q.topic===n) and the
              // sign hint must surface as imageHint (what every screen reads).
              return { id: r.qid, topic: Number(r.topic), question: r.question, options: r.options,
                correctIndex: r.correct_index, explanation: r.explanation, ruleRef: r.rule_ref,
                sign: r.sign || '', imageHint: r.sign || undefined,
                pack: r.pack || 'p1', testType: r.test_type || 'car',
                // an AI-drafted tip reaches a learner only after the admin approves it
                memoryTip: r.tip_status === 'approved' && r.memory_tip ? r.memory_tip : undefined,
                // "Explain it differently": same rule — only an approved plain re-wording
                plainExplanation: r.plain_status === 'approved' && r.plain_explanation ? r.plain_explanation : undefined };
            });
            writeJSON(BANKKEY, { at: Date.now(), rows: out });
            return { questions: out, source: 'server' };
          }
          drop(BANKKEY); // access ended — the offline copy goes with it
        } catch (e) { if (e.status === 401 || e.status === 403) drop(BANKKEY); }
      }
      out = window.TTBank.cached();
      if (out) return { questions: out, source: 'cache' };
      var free = await fetch('./questions-free.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
      return { questions: free, source: 'free' };
    },
    // Admin → Memory tips: every drafted tip with its status, and saving one.
    tips: async function () {
      return (await rest('/questions?select=qid,memory_tip,tip_status&memory_tip=not.is.null&order=qid')) || [];
    },
    saveTip: async function (qid, tip, status) {
      await rest('/questions?qid=eq.' + encodeURIComponent(qid), { method: 'PATCH',
        headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ memory_tip: tip, tip_status: status }) });
      return true;
    },
    // Admin → "Explain it differently" review: every drafted plain explanation with its
    // status, and saving one. The server holds the same three statuses as a check
    // constraint (questions_plain_status_check); checking here first gives a clear
    // message instead of a database error.
    explanations: async function () {
      return (await rest('/questions?select=qid,plain_explanation,plain_status&plain_explanation=not.is.null&order=qid')) || [];
    },
    saveExplanation: async function (qid, text, status) {
      if (PLAIN_STATUSES.indexOf(status) < 0)
        throw new Error('Not saved: the status must be draft, approved or rejected (got "' + status + '").');
      var saved = await rest('/questions?qid=eq.' + encodeURIComponent(qid), { method: 'PATCH',
        headers: { Prefer: 'return=representation' }, body: JSON.stringify({ plain_explanation: text, plain_status: status }) });
      // Row-level security turns a non-admin's write into "0 rows changed", not an error.
      if (!saved || !saved.length)
        throw new Error('Not saved: question ' + qid + ' was not changed. Only the admin account can edit explanations; check you are signed in as the admin and the question still exists.');
      return true;
    },
    // Admin only: fills the server bank from a local pack (used once, by you).
    upload: async function (list) {
      var chunk = 100, n = 0;
      for (var i = 0; i < list.length; i += chunk) {
        var rows = list.slice(i, i + chunk).map(function (q) {
          return { qid: q.id, topic: Number(q.topic), question: q.question, options: q.options,
            correct_index: q.correctIndex, explanation: q.explanation || '', rule_ref: q.ruleRef || '',
            sign: q.imageHint || q.sign || '', pack: q.pack || 'p1', test_type: q.testType || 'car' };
        });
        await rest('/questions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
        n += rows.length;
      }
      return n;
    }
  };

  // Reminders: a daily nudge at the learner's chosen hour, sent by the server only
  // when they haven't practised that day. Falls back to in-app prompts where the
  // browser can't do push (Safari without the app added to the home screen).
  window.TTPush = {
    supported: function () {
      return !!(('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window));
    },
    permission: function () { return (window.Notification && Notification.permission) || 'default'; },
    canServerPush: function () {
      var c = cfg() || {}, b = window.TT_CONFIG || {};
      return !!(window.TTPush.supported() && (c.pushPublicKey || b.pushPublicKey));
    },
    today: function () { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
    prefs: async function () {
      if (!(cfg() && sess)) return null;
      var rows = await rest('/reminders?select=enabled,hour,streak_guard&limit=1');
      return (rows && rows[0]) || null;
    },
    save: async function (patch) {
      var uid = sess && sess.user && sess.user.id;
      if (!uid) return false;
      var row = Object.assign({ user_id: uid, tz_offset: new Date().getTimezoneOffset(), updated_at: new Date().toISOString() }, patch);
      await rest('/reminders', { method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
      return true;
    },
    markActive: function () {
      if (!(cfg() && sess && navigator.onLine)) return Promise.resolve(false);
      return window.TTPush.save({ last_active_day: window.TTPush.today() }).catch(function () { return false; });
    },
    enable: async function (hour) {
      if (!window.TTPush.supported()) throw new Error('This browser can\u2019t show reminders. On iPhone, add the app to your home screen first.');
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Notifications are blocked for this app in your device settings.');
      var key = (cfg() || {}).pushPublicKey || (window.TT_CONFIG || {}).pushPublicKey || '';
      if (key && navigator.serviceWorker) {
        var reg = await navigator.serviceWorker.ready;
        var raw = atob(String(key).replace(/-/g, '+').replace(/_/g, '/'));
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
        var j = sub.toJSON();
        if (sess) await rest('/push_subs', { method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ endpoint: j.endpoint, user_id: sess.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) }) });
      }
      if (sess) await window.TTPush.save({ enabled: true, hour: hour });
      return true;
    },
    disable: async function () {
      try {
        if (navigator.serviceWorker) {
          var reg = await navigator.serviceWorker.ready;
          var sub = await reg.pushManager.getSubscription();
          if (sub) {
            if (sess) await rest('/push_subs?endpoint=eq.' + encodeURIComponent(sub.endpoint), { method: 'DELETE' }).catch(function () {});
            await sub.unsubscribe();
          }
        }
      } catch (e) {}
      if (sess) await window.TTPush.save({ enabled: false });
      return true;
    },
    // Used when the server can't reach the device (no keys, or iOS in a tab).
    showLocal: function (title, body) {
      try {
        if (window.Notification && Notification.permission === 'granted') {
          new Notification(title, { body: body, icon: './icon-192.png', badge: './icon-192.png' });
          return true;
        }
      } catch (e) {}
      return false;
    }
  };
})();
