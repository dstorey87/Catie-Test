// Theory Trainer — Supabase backend adapter. Plain fetch, no SDK, no build step.
// Exposes: TTBackend (config), TTAuth (accounts), TTSync (progress), TTBill
// (subscription), TTBank (question bank). Runs in a browser, a PWA and a
// Capacitor WebView unchanged.
(function () {
  var CFGKEY = 'tt.sb.cfg', SESSKEY = 'tt.sb.session', BANKKEY = 'tt.bank.v2';

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
    if (!r.ok) { var err = new Error(why(r.status, body)); err.status = r.status; throw err; }
    return body;
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
      var d = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password, data: { name: name || '' } }) }, false);
      if (d && d.access_token) { keepSession(d); return { signedIn: true }; }
      return { signedIn: false, confirm: true, email: email };
    },
    signIn: async function (email, password) {
      var d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) }, false);
      keepSession(d);
      return true;
    },
    resetPassword: async function (email) {
      await call('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email: email }) }, false);
      return true;
    },
    signOut: async function () {
      try { await call('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
      sess = null; drop(SESSKEY); drop(BANKKEY);
    },
    profile: async function () {
      var rows = await rest('/profiles?select=id,email,name,role&limit=1');
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

  window.TTBill = {
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
      await fresh();
      var d = await call('/functions/v1/billing-portal', { method: 'POST', body: JSON.stringify({ origin: location.origin + location.pathname }) });
      if (!d || !d.url) throw new Error('Subscription management needs the billing-portal function (SETUP.md §3, route B).');
      return d.url;
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
          var rows = await rest('/questions?select=qid,topic,question,options,correct_index,explanation,rule_ref,sign,test_type,pack&order=qid');
          if (rows && rows.length) {
            out = rows.map(function (r) {
              // topic must be numeric (the app compares q.topic===n) and the
              // sign hint must surface as imageHint (what every screen reads).
              return { id: r.qid, topic: Number(r.topic), question: r.question, options: r.options,
                correctIndex: r.correct_index, explanation: r.explanation, ruleRef: r.rule_ref,
                sign: r.sign || '', imageHint: r.sign || undefined,
                pack: r.pack || 'p1', testType: r.test_type || 'car' };
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
