// Theory Trainer — Adventure mode (adventure.html, issue #27).
//
// What this file does, in order:
//   1. The few numbers that are NOT the adventure's own (they copy the app so both agree).
//   2. Pure helpers: reading the learner, saving answers / flags / stage results into her
//      data, the order questions come in, and the map's geometry. No screen code, so the
//      tests (tests/adventure-page.test.js) load this same file in Node.
//   3. The page itself: map -> play -> results, drawn into adventure.html.
//
// Where the rules live: every adventure number (lesson size, pass mark, stars) is in
// coach.js (TTCoach.ADVENTURE) and the route, unlocking, scoring and stars come from
// TTCoach too. This page only draws them and saves what she does.
// Only questions and answers from the bank: every question, option, explanation and memory
// tip shown here is read from the bank TTBank.load() returns. Nothing is written here.
(function (root) {
  'use strict';

  // ---------- 1. numbers shared with the app (not the adventure's own) ----------
  // The app keeps these inline in Theory Trainer.dc.html. If one changes there, change it here.
  var APP = {
    base: 'theoryTrainer',   // the app's localStorage prefix: .users, .active, .d.<learnerId>, .content
    xpPerRight: 10,          // app award(): xp + correctCount * 10
    attemptsKeep: 3000,      // app answerLearn(): attempts.concat(...).slice(-3000)
    src: 'adventure'         // where an answer or flag came from (the app uses 'learn' / 'test')
  };

  // World colours: the app's own palette (its main teal, blue, orange, green, red, deep teal),
  // used in turn. Colours for drawing only; nothing here decides a score.
  var WORLD_COLOURS = ['#0E7C6B', '#2F6EA8', '#C77E14', '#2E9E5B', '#D14B45', '#0A5D50'];

  // The map drawing, in the SVG's own units (it scales to the screen). Geometry only.
  var MAP = { width: 300, gap: 118, top: 78, bottom: 96, swing: 80,
    // how far left/right each stage sits, in turn: a gentle S-bend like a country road
    bends: [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7] };

  // ---------- 2. pure helpers ----------

  // The app saves 'light', 'dark' or 'auto'. Returns the data-theme value for <html>,
  // or null for "follow the device" (the CSS handles that with prefers-color-scheme).
  function themeFor(saved) { return saved === 'light' || saved === 'dark' ? saved : null; }

  // localStorage can be blocked (private browsing) or hold junk: never let that crash the page.
  function readJSON(storage, key) {
    try { var v = storage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  // The learner chosen in the app: theoryTrainer.active, else the first in theoryTrainer.users
  // (exactly how the app picks). Returns {id, name} or null when the app has never been opened.
  function learnerFrom(storage) {
    var users = readJSON(storage, APP.base + '.users');
    if (!Array.isArray(users) || !users.length) return null;
    var active = null;
    try { active = storage.getItem(APP.base + '.active'); } catch (e) { active = null; }
    var id = active || users[0].id;
    var u = users.filter(function (x) { return x && x.id === id; })[0] || users[0];
    return { id: id, name: (u && u.name) || 'Learner' };
  }
  function blobKey(id) { return APP.base + '.d.' + id; }

  // The admin's edits in the app (theoryTrainer.content): a deleted question is left out and a
  // corrected one shows its corrected text, the same as the app's questions(). Added (custom)
  // questions are not on the adventure route: the route is the bank's own questions.
  function withContent(bank, content) {
    var c = content || {}, gone = {}, ov = c.overrides || {};
    (c.deleted || []).forEach(function (id) { gone[id] = true; });
    return (bank || []).filter(function (q) { return q && !gone[q.id]; })
      .map(function (q) { return ov[q.id] ? Object.assign({}, q, ov[q.id]) : q; });
  }

  // One answer into her data (a NEW object; the old one is not changed): the attempt the coach,
  // My answers and Activity read, and the app's XP for a right answer.
  //   a: {q, ok, topic, p}   p = the option she picked, as its index in the question's own order
  function withAnswer(blob, a, now) {
    var b = Object.assign({}, blob || {});
    b.attempts = ((b.attempts || []).concat([{ q: a.q, t: now, ok: !!a.ok, topic: a.topic, p: a.p, src: APP.src }]))
      .slice(-APP.attemptsKeep);
    b.xp = (b.xp || 0) + (a.ok ? APP.xpPerRight : 0);
    b.updatedAt = now;
    return b;
  }

  // Flag or un-flag a question, in the same shape as the app's setRevFlag(), so the app's
  // Flagged screen shows it and syncing merges it question by question.
  function withFlag(blob, qid, on, now) {
    var b = Object.assign({}, blob || {});
    var rf = Object.assign({}, b.revisionFlags || {}), fc = Object.assign({}, b.flagCleared || {});
    if (on) { rf[qid] = { t: now, src: APP.src }; delete fc[qid]; }
    else { delete rf[qid]; fc[qid] = now; }
    b.revisionFlags = rf; b.flagCleared = fc; b.updatedAt = now;
    return b;
  }

  // A finished stage into her adventure progress. coach.adventureRecord keeps the best score,
  // the most stars and a pass once earned; this only puts the result in the right place.
  function withStage(blob, coach, stageId, result, now) {
    var b = Object.assign({}, blob || {});
    b.adventure = coach.adventureRecord(b.adventure || {}, stageId, result, now);
    b.updatedAt = now;
    return b;
  }

  // A shuffled copy (Fisher-Yates). rnd is Math.random in the page; tests pass their own.
  function shuffle(list, rnd) {
    var a = (list || []).slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- a stage being played ----------
  // queue: the questions in the order she sees them (shuffled each play). A question she
  // gets wrong the first time goes on the end of the queue ONCE, so it comes back before the
  // stage ends. The score counts first tries only.
  function newPlay(stage, rnd) {
    return { stage: stage.id, kind: stage.kind, qids: stage.qids.slice(), queue: shuffle(stage.qids, rnd),
      i: 0, first: {}, back: {}, combo: 0, bestCombo: 0, xp: 0 };
  }
  // True when the question at position i is a missed one coming back.
  function isComeback(play, i) { return (i === undefined ? play.i : i) >= play.qids.length; }
  // Records an answer to the current question; returns a NEW play (the queue may grow by one).
  function answerStep(play, qid, ok) {
    var p = Object.assign({}, play, { first: Object.assign({}, play.first), back: Object.assign({}, play.back), queue: play.queue.slice() });
    if (!(qid in p.first)) p.first[qid] = !!ok;
    if (!ok && !p.back[qid] && !isComeback(play)) { p.back[qid] = true; p.queue.push(qid); }
    p.combo = ok ? p.combo + 1 : 0;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    p.xp = p.xp + (ok ? APP.xpPerRight : 0);
    return p;
  }
  // The stage's result for TTCoach: first tries right, out of the stage's questions.
  function tally(play) {
    var correct = play.qids.filter(function (id) { return play.first[id] === true; }).length;
    return { correct: correct, total: play.qids.length };
  }
  // How many right answers a pass needs, from the pass mark in TTCoach.ADVENTURE.
  function passNeed(total, passPct) { return Math.ceil(total * passPct - 1e-9); }

  // ---------- the map ----------
  // Where each stage sits on the map, in SVG units: down the page, bending left and right.
  function nodeLayout(count, m) {
    m = m || MAP;
    var pts = [];
    for (var i = 0; i < count; i++) pts.push({ x: m.width / 2 + m.swing * m.bends[i % m.bends.length], y: m.top + i * m.gap });
    return { points: pts, width: m.width, height: m.top + Math.max(0, count - 1) * m.gap + m.bottom };
  }
  // The road through those points: smooth curves (each bend leaves and arrives vertically).
  function roadPath(layout) {
    var p = layout.points; if (!p.length) return '';
    var r = function (n) { return Math.round(n * 10) / 10; };
    var d = 'M' + r(layout.width / 2) + ' 0 C' + r(layout.width / 2) + ' ' + r(p[0].y / 2) + ' ' + r(p[0].x) + ' ' + r(p[0].y / 2) + ' ' + r(p[0].x) + ' ' + r(p[0].y);
    for (var i = 1; i < p.length; i++) {
      var mid = (p[i].y - p[i - 1].y) / 2;
      d += ' C' + r(p[i - 1].x) + ' ' + r(p[i - 1].y + mid) + ' ' + r(p[i].x) + ' ' + r(p[i].y - mid) + ' ' + r(p[i].x) + ' ' + r(p[i].y);
    }
    var last = p[p.length - 1];
    return d + ' L' + r(last.x) + ' ' + r(layout.height);
  }

  // Stars earned and stars there are, over the whole route (or one world).
  function starsSummary(worlds, status, maxStars) {
    var earned = 0, available = 0;
    (worlds || []).forEach(function (w) {
      w.stages.forEach(function (s) { available += maxStars; earned += ((status.stages[s.id] || {}).stars || 0); });
    });
    return { earned: earned, available: available };
  }
  // A world at a glance: stages passed, whether it is open yet, and whether it is finished.
  function worldSummary(world, status) {
    var passed = world.stages.filter(function (s) { return (status.stages[s.id] || {}).passed; }).length;
    var first = status.stages[world.stages[0].id] || {};
    return { passed: passed, total: world.stages.length, open: !!first.unlocked, done: passed === world.stages.length };
  }
  // "Lesson 2" or "Checkpoint", from the stage's place in its world.
  function stageName(world, stage) {
    if (stage.kind === 'checkpoint') return 'Checkpoint';
    var n = world.stages.filter(function (s) { return s.kind === 'lesson'; }).indexOf(stage) + 1;
    return 'Lesson ' + n;
  }
  // The stage just before this one on the route (null for the very first) and its world.
  function previousStage(route, stageId) {
    var flat = [];
    route.forEach(function (w) { w.stages.forEach(function (s) { flat.push({ world: w, stage: s }); }); });
    for (var i = 0; i < flat.length; i++) if (flat[i].stage.id === stageId) return i ? flat[i - 1] : null;
    return null;
  }
  // The stage after this one (null at the very end of the route).
  function nextStage(route, stageId) {
    var flat = [];
    route.forEach(function (w) { w.stages.forEach(function (s) { flat.push({ world: w, stage: s }); }); });
    for (var i = 0; i < flat.length; i++) if (flat[i].stage.id === stageId) return flat[i + 1] || null;
    return null;
  }
  // Which world holds a stage (index into the route), or -1.
  function worldIndexOf(route, stageId) {
    for (var i = 0; i < route.length; i++) if (route[i].stages.some(function (s) { return s.id === stageId; })) return i;
    return -1;
  }

  var api = { APP: APP, WORLD_COLOURS: WORLD_COLOURS, MAP: MAP, themeFor: themeFor, readJSON: readJSON, writeJSON: writeJSON,
    learnerFrom: learnerFrom, blobKey: blobKey, withContent: withContent, withAnswer: withAnswer, withFlag: withFlag,
    withStage: withStage, shuffle: shuffle, newPlay: newPlay, isComeback: isComeback, answerStep: answerStep, tally: tally,
    passNeed: passNeed, nodeLayout: nodeLayout, roadPath: roadPath, starsSummary: starsSummary, worldSummary: worldSummary,
    stageName: stageName, previousStage: previousStage, nextStage: nextStage, worldIndexOf: worldIndexOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.TTAdventure = api;

  // ======================================================================================
  // 3. The page. Everything below runs only in a browser.
  // ======================================================================================
  var doc = root.document, store = null;
  try { store = root.localStorage; } catch (e) { store = null; }
  // A stand-in when storage is blocked: the page still plays, it just cannot save.
  var mem = {};
  var storage = store || { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); } };

  // Light or dark, before anything draws: the choice saved in the app, or the device's.
  (function () {
    var saved = null; try { saved = storage.getItem('tt.theme'); } catch (e) { saved = null; }
    var t = themeFor(saved);
    if (t) doc.documentElement.setAttribute('data-theme', t); else doc.documentElement.removeAttribute('data-theme');
  })();

  // ---------- small drawing helpers ----------
  // Escape bank text before it goes into HTML (questions can contain < > & and quotes).
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return doc.getElementById(id); }
  // Icons, drawn inline so they take the colour of the text around them.
  var ICON = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/></svg>',
    wheel: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 14v6.5M10 11.4L4 9.6M14 11.4l6-1.8"/></g></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10M12 13v4M8 21h8M9.5 17h5v4h-5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5.5 2 1.5 3 3 3 0-3-1-5.5 0-8.5z" fill="currentColor"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>'
  };
  // The little car that sits on the stage she is up to (side view, in the world's colour).
  var CAR = '<svg class="car" viewBox="0 0 64 40" aria-hidden="true"><path d="M6 26c0-5 3-7 8-8l7-8c1.5-1.6 3-2 5-2h13c2.4 0 4 .8 5.6 2.6L51 18c6 .6 9 3 9 8v4c0 1.2-.8 2-2 2H8c-1.2 0-2-.8-2-2z" fill="var(--wc)" stroke="var(--car-edge)" stroke-width="2.4" stroke-linejoin="round"/><path d="M22 18l5-6h8v6zM38 12h5l4.6 6H38z" fill="var(--car-glass)"/><circle cx="18" cy="32" r="5.5" fill="var(--car-tyre)"/><circle cx="18" cy="32" r="2.2" fill="var(--car-hub)"/><circle cx="48" cy="32" r="5.5" fill="var(--car-tyre)"/><circle cx="48" cy="32" r="2.2" fill="var(--car-hub)"/></svg>';

  // A road-sign drawing from the app's signs.js, for a question about a sign. signs.js hands
  // back a React element; this page has no React, so a two-line stand-in reads the SVG out.
  function signSvg(hint) {
    try {
      if (!hint || typeof root.SignImage !== 'function') return '';
      if (!root.React) root.React = { createElement: function (tag, props) { return props || {}; } };
      var el = root.SignImage({ hint: hint, size: 110 });
      return (el && el.dangerouslySetInnerHTML && el.dangerouslySetInnerHTML.__html) || '';
    } catch (e) { return ''; }
  }

  // ---------- state ----------
  // learner {id,name} · route/status from TTCoach · source: 'server' | 'cache' | 'free' · world: which
  // world the map shows · play: the stage being played (newPlay) · q/order/picked: the question on
  // screen, its option order and her pick · feedback: the feedback sheet's HTML · sheet: open stage card
  var S = { learner: null, route: [], status: null, source: '', world: 0, play: null, q: null, order: null,
    picked: -1, shownAt: 0, last: null, sheet: null, reduced: false, praise: 0, feedback: '' };
  var C = null, A = null;   // TTCoach and its ADVENTURE numbers, once the scripts have loaded
  var byId = {};            // the bank, by question id

  function blob() { return readJSON(storage, blobKey(S.learner.id)) || {}; }
  function save(b) {
    if (!writeJSON(storage, blobKey(S.learner.id), b)) say('Could not save on this device (storage is full or blocked). Your answers this session will not be kept.');
  }
  // Events for the admin's Activity screen, the same queue the app uses. Never breaks the page.
  function track(kind, qid, data) {
    try { if (root.TTTrack) root.TTTrack.track(kind, qid || null, data || {}, { id: S.learner.id, name: S.learner.name }); } catch (e) { /* tracking must never break learning */ }
  }
  // Short messages for screen readers.
  function say(text) { var a = $('announce'); if (a) { a.textContent = ''; setTimeout(function () { a.textContent = text; }, 30); } }
  function colourOf(worldNo) { return WORLD_COLOURS[(worldNo - 1) % WORLD_COLOURS.length]; }
  function starsHtml(n, max, cls) {
    var out = '';
    for (var i = 0; i < max; i++) out += '<span class="' + (cls || 'st') + (i < n ? ' on' : '') + '">' + ICON.star + '</span>';
    return out;
  }
  // Shows one view and hides the others.
  function show(name) {
    ['loading', 'message', 'map', 'play', 'results'].forEach(function (v) { $('view-' + v).hidden = v !== name; });
    doc.body.setAttribute('data-view', name);
  }
  function refresh() { S.status = C.adventureStatus(S.route, blob().adventure || {}); }

  // A full-page message (no learner yet, no questions, something failed) with a way forward.
  function message(title, text, actions) {
    $('view-message').innerHTML = '<div class="msg"><div class="msg-art" aria-hidden="true">' + CAR + '</div><h1>' + esc(title) + '</h1><p>' + text + '</p>' +
      '<div class="actions">' + (actions || '<a class="btn primary" href="Theory%20Trainer.dc.html">Open Theory Trainer</a>') + '</div></div>';
    show('message');
    var h = $('view-message').querySelector('h1'); if (h) { h.tabIndex = -1; h.focus(); }
  }

  // ---------- start ----------
  async function start() {
    try {
      S.reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
      // 1. Who is learning: the learner chosen in the app.
      S.learner = learnerFrom(storage);
      if (!S.learner) {
        message('Open the app first', 'Adventure mode plays as the learner chosen in Theory Trainer. Open the app, choose who is learning, then come back here.');
        return;
      }
      var settings = (blob().settings || {});
      if (settings.reducedMotion) S.reduced = true;          // her Settings -> Reduce motion choice
      doc.documentElement.classList.toggle('calm', S.reduced);
      $('who').hidden = false;
      $('who-name').textContent = S.learner.name;
      $('who-initial').textContent = (S.learner.name || '?').trim().charAt(0).toUpperCase();

      // 2. The rules: coach.js must be new enough to know the adventure route.
      C = root.TTCoach;
      if (!C || typeof C.adventureRoute !== 'function' || !C.ADVENTURE) {
        message('Adventure needs an update', 'This copy of the app is older than Adventure mode. Reload the page; if this stays, open Theory Trainer once so it can update itself.',
          '<button class="btn primary" type="button" data-act="reload">Reload</button>');
        return;
      }
      A = C.ADVENTURE;

      // 3. The questions: the same bank (and offline copy) the app uses.
      if (!root.TTBank) throw new Error('backend.js did not load');
      var got = await root.TTBank.load();
      var bank = withContent((got && got.questions) || [], readJSON(storage, APP.base + '.content'));
      bank.forEach(function (q) { byId[q.id] = q; });
      S.source = (got && got.source) || '';
      S.route = C.adventureRoute(bank);
      if (!S.route.length) {
        message('No questions yet', 'There are no questions to play on this device yet. Open Theory Trainer while you are online so it can fetch them, then come back.');
        return;
      }
      // 4. Open on the world she is up to.
      refresh();
      var wi = S.status.current ? worldIndexOf(S.route, S.status.current) : S.route.length - 1;
      S.world = Math.max(0, wi);
      renderMap(true);
    } catch (e) {
      message('The adventure did not load', 'Something went wrong while loading (' + esc(e && e.message || e) + '). Check your connection, then try again. If it keeps happening, open Theory Trainer and use it from there.',
        '<button class="btn primary" type="button" data-act="reload">Try again</button><a class="btn" href="Theory%20Trainer.dc.html">Open Theory Trainer</a>');
    }
  }

  // ---------- the map ----------
  function renderMap(scrollToCurrent) {
    S.sheet = null;
    var w = S.route[S.world], st = S.status, max = A.stars.length;
    var colour = colourOf(w.world), ws = worldSummary(w, st), all = starsSummary(S.route, st, max), mine = starsSummary([w], st, max);
    // top bar: stars over the whole route
    var tot = $('stars-total');
    tot.hidden = false;
    tot.innerHTML = '<span class="st on">' + ICON.star + '</span><span><b>' + all.earned + '</b> / ' + all.available + '</span>';
    tot.setAttribute('aria-label', all.earned + ' of ' + all.available + ' stars earned');

    // world tabs: every world, with how far she is through it
    var tabs = S.route.map(function (x, i) {
      var s = worldSummary(x, st), cur = i === S.world;
      var label = 'World ' + x.world + ', ' + x.name + ': ' + (s.done ? 'complete' : s.open ? s.passed + ' of ' + s.total + ' stages passed' : 'locked');
      return '<button type="button" class="wtab' + (s.done ? ' done' : '') + (s.open ? '' : ' shut') + '" style="--wc:' + colourOf(x.world) + '" data-act="world" data-i="' + i + '"' +
        (cur ? ' aria-current="true"' : '') + ' aria-label="' + esc(label) + '">' + (s.open ? (s.done ? ICON.check : x.world) : ICON.lock) + '</button>';
    }).join('');

    // the road and the stages on it
    var lay = nodeLayout(w.stages.length);
    var deco = '';
    lay.points.forEach(function (p, i) {
      // a tree or two on the far side of the road from each stage, for a bit of scenery
      var side = p.x >= lay.width / 2 ? -1 : 1, tx = Math.max(24, Math.min(lay.width - 24, p.x + side * 104)), ty = p.y + (i % 2 ? 26 : -18);
      deco += '<g class="tree" transform="translate(' + tx + ' ' + ty + ')"><rect x="-2.5" y="6" width="5" height="12" rx="2"/><circle r="15"/><circle class="t2" cx="7" cy="-5" r="8"/></g>';
      if (i % 2 === 0) deco += '<g class="bush" transform="translate(' + Math.max(16, Math.min(lay.width - 16, tx - side * 28)) + ' ' + (ty + 30) + ')"><circle r="7"/><circle cx="9" cy="2" r="6"/></g>';
    });
    var road = roadPath(lay);
    var svg = '<svg class="road" viewBox="0 0 ' + lay.width + ' ' + lay.height + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' +
      deco + '<path class="edge" d="' + road + '"/><path class="tar" d="' + road + '"/><path class="line" d="' + road + '"/></svg>';
    var nodes = w.stages.map(function (s, i) {
      var p = lay.points[i], ss = st.stages[s.id] || {}, cur = st.current === s.id;
      var state = ss.passed ? 'passed' : (ss.unlocked ? 'current' : 'locked');
      var name = stageName(w, s);
      var label = name + ': ' + (state === 'passed' ? 'passed, ' + (ss.stars || 0) + ' of ' + max + ' stars, best ' + Math.round((ss.best || 0) * 100) + '%' :
        state === 'current' ? 'ready to play, ' + s.qids.length + ' questions' : 'locked');
      var icon = state === 'locked' ? ICON.lock : s.kind === 'checkpoint' ? (state === 'passed' ? ICON.trophy : ICON.flag) : (state === 'passed' ? ICON.check : ICON.wheel);
      return '<button type="button" class="node ' + s.kind + ' ' + state + (cur ? ' here' : '') + '" data-act="node" data-stage="' + s.id + '" ' +
        'style="left:' + (p.x / lay.width * 100) + '%;top:' + (p.y / lay.height * 100) + '%" aria-label="' + esc(label) + '">' +
        (cur ? '<span class="bubble">' + (ss.plays ? 'Try again' : 'Start') + '</span>' + CAR : '') +
        '<span class="disc">' + icon + '</span>' +
        (state === 'passed' ? '<span class="nstars">' + starsHtml(ss.stars || 0, max) + '</span>' : '') + '</button>';
    }).join('');

    // after the map: the way on to the next world once this one is done
    var next = S.route[S.world + 1], after = '';
    if (ws.done && next) after = '<div class="after"><p><b>World ' + w.world + ' complete!</b> Next up: ' + esc(next.name) + '.</p><button type="button" class="btn primary" data-act="world" data-i="' + (S.world + 1) + '">Go to world ' + next.world + '</button></div>';
    else if (ws.done && !next) after = '<div class="after"><p><b>Every world complete.</b> Replay any stage to push its stars higher.</p></div>';
    else if (!ws.open) {
      var prev = previousStage(S.route, w.stages[0].id);
      after = '<div class="after quiet"><p>' + ICON.lock + ' This world opens when you pass ' + (prev ? 'the checkpoint of world ' + prev.world.world : 'the stage before it') + '.</p></div>';
    }
    var free = S.source === 'free' ? '<div class="free"><b>Free sample.</b> These worlds hold only the free questions. <a href="Theory%20Trainer.dc.html">Sign in to the app to unlock every world</a>.</div>' : '';

    $('view-map').innerHTML =
      '<div class="world-head" style="--wc:' + colour + '">' +
        '<button type="button" class="arrow" data-act="world" data-i="' + (S.world - 1) + '"' + (S.world ? '' : ' disabled') + ' aria-label="Previous world">' + ICON.left + '</button>' +
        '<div class="wh-text"><p class="kicker">World ' + w.world + '</p><h1 id="world-title" tabindex="-1">' + esc(w.name) + '</h1>' +
          '<p class="sub">' + ws.passed + ' of ' + ws.total + ' stages passed <span class="dot">·</span> <span class="st on">' + ICON.star + '</span> ' + mine.earned + ' / ' + mine.available + '</p></div>' +
        '<button type="button" class="arrow" data-act="world" data-i="' + (S.world + 1) + '"' + (S.world < S.route.length - 1 ? '' : ' disabled') + ' aria-label="Next world">' + ICON.right + '</button>' +
      '</div>' +
      '<nav class="worlds" aria-label="Worlds">' + tabs + '</nav>' + free +
      '<div class="map" style="--wc:' + colour + ';aspect-ratio:' + lay.width + ' / ' + lay.height + '">' + svg + nodes + '</div>' + after +
      '<div id="sheet-slot"></div>';
    show('map');
    if (scrollToCurrent) {
      var here = $('view-map').querySelector('.node.here');
      if (here && here.scrollIntoView) here.scrollIntoView({ block: 'center', behavior: S.reduced ? 'auto' : 'smooth' });
    }
  }

  // The card that opens when a stage is tapped: what it is, her best, and Start (or why it's locked).
  function openSheet(stageId) {
    var wi = worldIndexOf(S.route, stageId); if (wi < 0) return;
    var w = S.route[wi], s = w.stages.filter(function (x) { return x.id === stageId; })[0];
    var ss = S.status.stages[stageId] || {}, max = A.stars.length, name = stageName(w, s);
    var body;
    if (!ss.unlocked) {
      var prev = previousStage(S.route, stageId);
      var why = prev ? (prev.world === w ? stageName(w, prev.stage) : 'the checkpoint of world ' + prev.world.world) : 'the stage before it';
      body = '<p class="lockline">' + ICON.lock + ' Locked. Pass ' + esc(why) + ' first to open this one.</p>' +
        '<div class="actions"><button type="button" class="btn" data-act="sheet-close">OK</button></div>';
      say(name + ' is locked. Pass ' + why + ' first.');
    } else {
      var info = s.qids.length + ' questions';
      if (s.kind === 'checkpoint') info += ' from the whole world';
      if (ss.plays) info += ' · best ' + Math.round((ss.best || 0) * 100) + '% · played ' + ss.plays + (ss.plays === 1 ? ' time' : ' times');
      body = (ss.passed ? '<p class="sheet-stars" aria-label="' + (ss.stars || 0) + ' of ' + max + ' stars">' + starsHtml(ss.stars || 0, max) + '</p>' : '') +
        '<p class="info">' + info + '</p>' +
        '<p class="hint">Pass with ' + Math.round(A.passPct * 100) + '% or more. Stars at ' + A.stars.map(function (x) { return Math.round(x * 100) + '%'; }).join(', ') + '.</p>' +
        '<div class="actions"><button type="button" class="btn primary big" data-act="play" data-stage="' + s.id + '">' + (ss.passed ? 'Play again' : 'Start') + '</button>' +
        '<button type="button" class="btn" data-act="sheet-close">Not now</button></div>';
    }
    S.sheet = stageId;
    $('sheet-slot').innerHTML = '<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" style="--wc:' + colourOf(w.world) + '">' +
      '<p class="kicker">World ' + w.world + ' · ' + esc(w.name) + '</p><h2 id="sheet-title">' + esc(name) + '</h2>' + body + '</div>';
    var first = $('sheet-slot').querySelector('.btn.primary') || $('sheet-slot').querySelector('.btn');
    if (first) first.focus();
  }
  function closeSheet() {
    var id = S.sheet; S.sheet = null;
    var slot = $('sheet-slot'); if (slot) slot.innerHTML = '';
    var node = id && $('view-map').querySelector('[data-stage="' + id + '"].node'); if (node) node.focus();
  }

  // ---------- playing a stage ----------
  function startStage(stageId) {
    var wi = worldIndexOf(S.route, stageId); if (wi < 0) return;
    var w = S.route[wi], s = w.stages.filter(function (x) { return x.id === stageId; })[0];
    if (!(S.status.stages[stageId] || {}).unlocked) { openSheet(stageId); return; }
    S.world = wi;
    S.play = newPlay(s, Math.random);
    S.play.world = w.world; S.play.name = stageName(w, s); S.play.worldName = w.name;
    S.praise = 0;
    track('adventure_stage_start', null, { stage: s.id, world: w.world, kind: s.kind, n: s.qids.length });
    renderQuestion();
  }

  function renderQuestion() {
    var p = S.play, qid = p.queue[p.i], q = byId[qid];
    if (!q) { p.i++; if (p.i >= p.queue.length) return finishStage(); return renderQuestion(); }   // a question gone from the bank: skip it
    S.q = q; S.picked = -1; S.shownAt = Date.now();
    // options in a new order each play; order[i] = the option's index in the question's own order
    S.order = shuffle(q.options.map(function (_, i) { return i; }), Math.random);
    var flagged = !!(blob().revisionFlags || {})[qid];
    var sign = signSvg(q.imageHint);
    var opts = S.order.map(function (orig, i) {
      return '<button type="button" class="opt" data-act="answer" data-i="' + i + '" aria-label="Answer ' + 'ABCD'.charAt(i) + ': ' + esc(q.options[orig]) + '">' +
        '<span class="letter" aria-hidden="true">' + 'ABCD'.charAt(i) + '</span><span class="otext">' + esc(q.options[orig]) + '</span></button>';
    }).join('');
    $('view-play').innerHTML =
      '<div class="play" style="--wc:' + colourOf(p.world) + '">' +
        '<div class="play-top">' +
          '<button type="button" class="icon-btn" data-act="quit" aria-label="Quit this stage">' + ICON.cross + '</button>' +
          progressHtml() +
          '<span class="combo" id="combo"' + (p.combo >= 2 ? '' : ' hidden') + '>' + ICON.flame + '<b>' + p.combo + '</b><span class="sr-only"> in a row</span></span>' +
        '</div>' +
        '<div class="qcard">' +
          '<div class="qmeta"><span class="where">World ' + p.world + ' · ' + esc(p.name) + '</span>' +
            (isComeback(p) ? '<span class="again">Second chance</span>' : '') +
            '<button type="button" class="flag' + (flagged ? ' on' : '') + '" data-act="flag" aria-pressed="' + flagged + '">' + ICON.flag + '<span>' + (flagged ? 'Flagged' : 'Flag') + '</span></button></div>' +
          (sign ? '<div class="sign" role="img" aria-label="Road sign picture">' + sign + '</div>' : '') +
          '<h2 id="q-text" tabindex="-1">' + esc(q.question) + '</h2>' +
          '<div class="opts" role="group" aria-labelledby="q-text">' + opts + '</div>' +
        '</div>' +
        '<div id="feedback-slot"></div>' +
      '</div>';
    show('play');
    try { root.scrollTo(0, 0); } catch (e) { /* old browsers */ }
    $('q-text').focus();
  }
  function progressHtml() {
    var p = S.play, done = p.i + (S.picked >= 0 ? 1 : 0), all = p.queue.length;
    return '<div class="bar" role="progressbar" aria-label="Stage progress" aria-valuemin="0" aria-valuemax="' + all + '" aria-valuenow="' + done + '"><span style="width:' + (all ? done / all * 100 : 0) + '%"></span></div>';
  }

  function answer(i) {
    if (!S.play || S.picked >= 0 || !S.q) return;
    var q = S.q, orig = S.order[i], ok = orig === q.correctIndex, now = Date.now();
    var comeback = isComeback(S.play);
    S.picked = i;
    S.play = answerStep(S.play, q.id, ok);
    // save straight away: the attempt, the XP, and the time
    save(withAnswer(blob(), { q: q.id, ok: ok, topic: q.topic, p: orig }, now));
    track('answer', q.id, { ok: ok, p: orig, ms: now - S.shownAt, src: APP.src, stage: S.play.stage, retry: comeback });
    // mark the options: hers, and the right one
    var btns = $('view-play').querySelectorAll('.opt');
    Array.prototype.forEach.call(btns, function (b, bi) {
      b.disabled = true;
      var o = S.order[bi];
      if (o === q.correctIndex) b.classList.add('right');
      else if (bi === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    var bar = $('view-play').querySelector('.bar');
    if (bar) bar.outerHTML = progressHtml();
    var combo = $('combo');
    if (combo) { combo.hidden = S.play.combo < 2; combo.querySelector('b').textContent = S.play.combo; combo.classList.remove('pop'); void combo.offsetWidth; if (ok) combo.classList.add('pop'); }
    // the feedback sheet: right or wrong, the answer, the bank's explanation and approved memory tip
    var words = ['Nice!', 'Great!', 'Spot on!', 'You got it!'];
    var head = ok ? words[(S.praise++) % words.length] : 'Not quite';
    var html = '<div class="feedback ' + (ok ? 'ok' : 'no') + '" role="region" aria-label="Answer feedback">' +
      '<div class="fb-in"><p class="fb-head" role="status"><span class="fb-icon">' + (ok ? ICON.check : ICON.cross) + '</span><b>' + head + '</b>' +
        (ok ? '<span class="xp">+' + APP.xpPerRight + ' XP</span>' : '') + '</p>' +
      (ok ? '' : '<p class="fb-answer">The answer is <b>' + esc(q.options[q.correctIndex]) + '</b></p>') +
      (q.explanation ? '<p class="fb-expl">' + esc(q.explanation) + '</p>' : '') +
      (q.ruleRef ? '<p class="fb-rule">' + esc(q.ruleRef) + '</p>' : '') +
      (q.memoryTip ? '<div class="tip">' + ICON.bulb + '<p><b>Memory tip</b> ' + esc(q.memoryTip) + '</p></div>' : '') +
      (!ok && !comeback ? '<p class="fb-back">This one will come back before the end of the stage.</p>' : '') +
      '<button type="button" class="btn big go" data-act="continue">Continue</button></div></div>';
    S.feedback = html;
    $('feedback-slot').innerHTML = html;
    $('feedback-slot').querySelector('[data-act="continue"]').focus();
  }

  function next() {
    if (!S.play || S.picked < 0) return;
    S.play = Object.assign({}, S.play, { i: S.play.i + 1 });
    if (S.play.i >= S.play.queue.length) finishStage(); else renderQuestion();
  }

  function toggleFlag() {
    if (!S.q) return;
    var b = blob(), on = !(b.revisionFlags || {})[S.q.id], now = Date.now();
    save(withFlag(b, S.q.id, on, now));
    track(on ? 'flag' : 'unflag', S.q.id, { src: APP.src });
    var f = $('view-play').querySelector('.flag');
    if (f) { f.classList.toggle('on', on); f.setAttribute('aria-pressed', String(on)); f.querySelector('span').textContent = on ? 'Flagged' : 'Flag'; }
    say(on ? 'Flagged. It is in your Flagged list in the app.' : 'Flag removed.');
  }

  // Quit: ask once, in the page (answers so far are already saved; the stage does not count).
  function askQuit() {
    var slot = $('feedback-slot'); if (!slot) return;
    slot.innerHTML = '<div class="scrim" data-act="quit-no"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="quit-title">' +
      '<h2 id="quit-title">Leave this stage?</h2><p>Your answers so far are saved, but the stage only counts when you finish it.</p>' +
      '<div class="actions"><button type="button" class="btn primary big" data-act="quit-no">Keep going</button><button type="button" class="btn" data-act="quit-yes">Leave</button></div></div>';
    slot.querySelector('.btn.primary').focus();
  }
  function quit() {
    var p = S.play; if (!p) return;
    track('adventure_stage_end', null, { stage: p.stage, world: p.world, quit: true, answered: p.i + (S.picked >= 0 ? 1 : 0) });
    S.play = null; S.q = null;
    refresh(); renderMap(true);
  }
  // "Keep going": back to exactly where she was - the feedback sheet if she had answered
  // (it is kept in S.feedback, so nothing is saved twice), otherwise the question.
  function unquit() {
    var slot = $('feedback-slot'); if (!slot) return;
    if (S.picked >= 0 && S.feedback) { slot.innerHTML = S.feedback; slot.querySelector('[data-act="continue"]').focus(); }
    else { slot.innerHTML = ''; $('q-text').focus(); }
  }

  // ---------- results ----------
  function finishStage() {
    var p = S.play, r = tally(p), sc = C.adventureScore(r), now = Date.now();
    var before = S.status;
    save(withStage(blob(), C, p.stage, r, now));
    refresh();
    track('adventure_stage_end', null, { stage: p.stage, world: p.world, correct: r.correct, total: r.total, pct: sc.pct, passed: sc.passed, stars: sc.stars, bestCombo: p.bestCombo });
    S.last = { play: p, r: r, sc: sc };
    // did this pass open a new world?
    var nx = nextStage(S.route, p.stage), opened = null;
    if (sc.passed && nx && nx.world.world !== p.world && !(before.stages[nx.stage.id] || {}).unlocked) opened = nx.world;
    var max = A.stars.length, need = passNeed(r.total, A.passPct);
    var title = sc.passed ? (sc.stars >= max ? 'Perfect!' : 'Stage passed!') : 'Not this time';
    var line = sc.passed ? (sc.stars >= max ? 'Every question right first time. Brilliant driving!' : 'Great work. Replay it any time to earn more stars.')
      : 'You need ' + need + ' of ' + r.total + ' to pass. Have another go: you have just seen the answers you missed.';
    var btns = '';
    if (sc.passed && nx) btns += '<button type="button" class="btn primary big" data-act="play" data-stage="' + nx.stage.id + '">Next stage</button>';
    btns += '<button type="button" class="btn' + (sc.passed && nx ? '' : ' primary big') + '" data-act="play" data-stage="' + p.stage + '">Try again</button>';
    btns += '<button type="button" class="btn" data-act="map">Map</button>';
    $('view-results').innerHTML =
      '<div class="results ' + (sc.passed ? 'pass' : 'fail') + '" style="--wc:' + colourOf(p.world) + '">' +
        '<p class="kicker">World ' + p.world + ' · ' + esc(p.name) + '</p>' +
        '<h1 id="res-title" tabindex="-1">' + title + '</h1>' +
        '<div class="big-stars" aria-label="' + sc.stars + ' of ' + max + ' stars">' + starsHtml(sc.stars, max, 'bst') + '</div>' +
        '<p class="score"><b>' + r.correct + ' / ' + r.total + '</b> right first time <span class="dot">·</span> <b>' + Math.round(sc.pct * 100) + '%</b></p>' +
        '<p class="line">' + line + '</p>' +
        '<ul class="chips"><li>+' + p.xp + ' XP</li><li>Best run: ' + p.bestCombo + ' in a row</li><li>Pass mark ' + Math.round(A.passPct * 100) + '%</li></ul>' +
        (opened ? '<p class="opened">' + ICON.trophy + ' World ' + opened.world + ' unlocked: <b>' + esc(opened.name) + '</b></p>' : '') +
        '<div class="actions">' + btns + '</div>' +
      '</div>';
    show('results');
    S.play = null; S.q = null;
    try { root.scrollTo(0, 0); } catch (e) { /* old browsers */ }
    $('res-title').focus();
    say(title + ' ' + r.correct + ' of ' + r.total + ', ' + sc.stars + ' stars.');
    if (sc.passed && !S.reduced) confetti();
  }

  // Confetti: a couple of seconds of paper in the app's colours. Skipped entirely when the
  // learner prefers less movement (device setting or the app's Reduce motion).
  function confetti() {
    var cv = $('confetti'); if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W = cv.width = root.innerWidth, H = cv.height = root.innerHeight;
    var cols = WORLD_COLOURS.concat(['#F2A93B']), bits = [];
    for (var i = 0; i < 140; i++) bits.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, r: 4 + Math.random() * 5,
      vx: -1.5 + Math.random() * 3, vy: 2 + Math.random() * 3.5, a: Math.random() * 6.3, va: -0.2 + Math.random() * 0.4, c: cols[i % cols.length] });
    var t0 = null;
    cv.style.display = 'block';
    function frame(t) {
      if (t0 === null) t0 = t;
      ctx.clearRect(0, 0, W, H);
      bits.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.a += b.va;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore();
      });
      if (t - t0 < 2600) root.requestAnimationFrame(frame); else { ctx.clearRect(0, 0, W, H); cv.style.display = 'none'; }
    }
    root.requestAnimationFrame(frame);
  }

  // ---------- clicks and keys ----------
  doc.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || t.disabled) return;
    var act = t.getAttribute('data-act');
    try {
      if (act === 'reload') root.location.reload();
      else if (act === 'world') { var i = Number(t.getAttribute('data-i')); if (i >= 0 && i < S.route.length) { S.world = i; renderMap(false); var h = $('world-title'); if (h) h.focus(); } }
      else if (act === 'node') openSheet(t.getAttribute('data-stage'));
      else if (act === 'sheet-close') closeSheet();
      else if (act === 'play') startStage(t.getAttribute('data-stage'));
      else if (act === 'answer') answer(Number(t.getAttribute('data-i')));
      else if (act === 'continue') next();
      else if (act === 'flag') toggleFlag();
      else if (act === 'quit') askQuit();
      else if (act === 'quit-yes') quit();
      else if (act === 'quit-no') unquit();
      else if (act === 'map') { refresh(); renderMap(true); }
    } catch (err) {
      // one bad click must not strand her: say what failed and offer the map
      message('Something went wrong', 'That did not work (' + esc(err && err.message || err) + '). Your answers so far are saved. Go back to the map and try again.',
        '<button class="btn primary" type="button" data-act="reload">Back to the map</button>');
    }
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (S.sheet) { closeSheet(); e.preventDefault(); }
      else if (S.play && $('feedback-slot') && $('feedback-slot').querySelector('[data-act="quit-no"]')) { unquit(); e.preventDefault(); }
      return;
    }
    if (!S.play || $('view-play').hidden) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var inQuit = $('feedback-slot') && $('feedback-slot').querySelector('[data-act="quit-no"]');
    if (inQuit) return;
    // 1-4 or A-D answer; Enter moves on once answered (a focused button handles its own Enter)
    var k = e.key.toLowerCase(), n = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
    if (S.picked < 0 && n >= 0 && S.q && n < S.q.options.length && k.length === 1) { answer(n); e.preventDefault(); }
    else if (S.picked >= 0 && e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { next(); e.preventDefault(); }
  });

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(this);
