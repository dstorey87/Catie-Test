// Theory Trainer — the coach: what a learner needs next, worked out from her own history.
// Pure functions, no screen code: the app reads them as window.TTCoach, and the tests
// (tests/coach.test.js) load the same file in Node. Every question it returns comes
// from the bank it is given — it never writes a question or an answer of its own.
(function (root) {

  // ---------- flags ----------
  // A flag stays until she removes it. Each device keeps
  //   flags:   { questionId: { t: whenFlagged, src: 'learn' | 'test' } }
  //   cleared: { questionId: whenUnflagged }
  // Syncing merges question by question: whichever happened last — flag or un-flag — wins.
  // Before this, the newest whole copy won, so a flag made on the other device was lost.
  function mergeFlags(a, b) {
    a = a || {}; b = b || {};
    var fa = a.flags || {}, fb = b.flags || {}, ca = a.cleared || {}, cb = b.cleared || {};
    var out = { flags: {}, cleared: {} }, ids = {};
    [fa, fb, ca, cb].forEach(function (m) { Object.keys(m).forEach(function (id) { ids[id] = true; }); });
    Object.keys(ids).forEach(function (id) {
      var flag = !fa[id] ? fb[id] : !fb[id] ? fa[id] : ((fb[id].t || 0) > (fa[id].t || 0) ? fb[id] : fa[id]);
      var gone = Math.max(ca[id] || 0, cb[id] || 0);
      if (flag && (flag.t || 0) > gone) out.flags[id] = flag;
      else if (gone) out.cleared[id] = gone;
    });
    return out;
  }

  // ---------- activity (Admin → Activity) ----------
  // Turns the event log (backend.js TTTrack) into what an adult helping her wants to see:
  // totals, each day, the questions she misses most (and the wrong answer she tends to
  // pick), and which topics she is slowest on. `bank` is {id: question} or an array.
  function byId(bank) {
    if (!Array.isArray(bank)) return bank || {};
    var m = {}; bank.forEach(function (q) { m[q.id] = q; }); return m;
  }
  function localDay(iso) {
    var d = new Date(iso), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function activity(events, bank) {
    var Q = byId(bank), days = {}, per = {}, topicMs = {};
    var totals = { answered: 0, right: 0, secs: 0, hints: 0, readAloud: 0, flags: 0, sessions: 0, mocks: 0 };
    (events || []).forEach(function (e) {
      var d = e.data || {}, key = localDay(e.at);
      var day = days[key] || (days[key] = { day: key, answered: 0, right: 0, secs: 0, sessions: 0, mocks: 0, hints: 0 });
      if (e.kind === 'answer') {
        var q = Q[e.qid];
        totals.answered++; day.answered++;
        if (d.ok) { totals.right++; day.right++; }
        if (q) {
          var r = per[e.qid] || (per[e.qid] = { qid: e.qid, topic: q.topic, seen: 0, wrong: 0, picks: {} });
          r.seen++;
          if (!d.ok) { r.wrong++; if (d.p != null) r.picks[d.p] = (r.picks[d.p] || 0) + 1; }
          if (d.ms > 0 && d.ms < 10 * 60000) {           // ignore a question left open for ages
            var t = topicMs[q.topic] || (topicMs[q.topic] = { topic: q.topic, ms: 0, n: 0 });
            t.ms += d.ms; t.n++;
          }
        }
      } else if (e.kind === 'session_end' || e.kind === 'test_end') {
        var s = Number(d.secs) || 0; totals.secs += s; day.secs += s;
        if (e.kind === 'test_end') { totals.mocks++; day.mocks++; } else { totals.sessions++; day.sessions++; }
      } else if (e.kind === 'hint_used') { totals.hints++; day.hints++; }
      else if (e.kind === 'read_aloud') totals.readAloud++;
      else if (e.kind === 'flag') totals.flags++;
    });
    var missed = Object.keys(per).map(function (id) {
      var r = per[id], best = null;
      Object.keys(r.picks).forEach(function (p) { if (best === null || r.picks[p] > r.picks[best]) best = p; });
      return { qid: id, topic: r.topic, seen: r.seen, wrong: r.wrong, usualPick: best === null ? null : Number(best) };
    }).filter(function (r) { return r.wrong > 0; })
      .sort(function (a, b) { return b.wrong - a.wrong || b.wrong / b.seen - a.wrong / a.seen; });
    var topicTime = Object.keys(topicMs).map(function (k) {
      var t = topicMs[k]; return { topic: t.topic, avgSecs: Math.round(t.ms / t.n / 1000), n: t.n };
    }).sort(function (a, b) { return b.avgSecs - a.avgSecs; });
    return {
      totals: totals,
      days: Object.keys(days).sort().reverse().map(function (k) { return days[k]; }),
      missed: missed,
      topicTime: topicTime
    };
  }

  // ---------- Drill me ----------
  // Fixed rules from the learning research the app already follows (spaced retrieval
  // practice, interleaving, re-testing what was missed). No randomness, so the same
  // history always gives the same drill — and every question comes from the bank.
  var DRILL = {
    n: 20,               // questions in a drill (a stuck question's repeat is extra)
    newMax: 4,           // at most this many never-seen questions per drill
    gapDays: [0, 1, 3, 7, 14, 30],   // wait after 0, 1, 2, 3, 4, 5+ right answers in a row
    stuckMisses: 3,      // this many misses in all = stuck …
    stuckDays: 2,        // … or misses on this many different days
    unstuckRun: 2,       // … until she gets it right this many times running
    weakAcc: 0.7,        // a topic under 70% right is weak …
    weakMin: 5,          // … once it has at least 5 answers
    requeueGap: 3,       // a question missed in a drill comes back after 3 others
    requeueMax: 2        // … at most twice in the same drill
  };

  // One line per question: how she's done on it, and whether it's stuck or due.
  // attempts: [{q, t, ok}] oldest first (the app's own list); flags: {id: …}.
  function profile(attempts, flags, bank, now, opts) {
    var o = Object.assign({}, DRILL, opts || {}), Q = byId(bank), per = {}, topic = {};
    now = now || Date.now(); flags = flags || {};
    (attempts || []).forEach(function (a) {
      var q = Q[a.q]; if (!q) return;
      var r = per[a.q] || (per[a.q] = { id: a.q, topic: q.topic, seen: 0, wrong: 0, run: 0, last: 0, missDays: {} });
      r.seen++; r.last = Math.max(r.last, a.t || 0);
      if (a.ok) r.run++; else { r.wrong++; r.run = 0; r.missDays[localDay(a.t)] = true; }
      var tp = topic[q.topic] || (topic[q.topic] = { n: 0, ok: 0 });
      tp.n++; if (a.ok) tp.ok++;
    });
    var out = {};
    Object.keys(Q).forEach(function (id) {
      var q = Q[id], r = per[id], tp = topic[q.topic];
      var weakTopic = !!(tp && tp.n >= o.weakMin && tp.ok / tp.n < o.weakAcc);
      if (!r) { out[id] = { id: id, topic: q.topic, seen: 0, wrong: 0, run: 0, stuck: false, due: false, fresh: true, flagged: !!flags[id], weakTopic: weakTopic }; return; }
      var days = Object.keys(r.missDays).length;
      var stuck = (r.wrong >= o.stuckMisses || days >= o.stuckDays) && r.run < o.unstuckRun;
      var wait = o.gapDays[Math.min(r.run, o.gapDays.length - 1)] * 86400000;
      out[id] = { id: id, topic: q.topic, seen: r.seen, wrong: r.wrong, run: r.run, last: r.last,
        stuck: stuck, due: now - r.last >= wait, fresh: false, flagged: !!flags[id], weakTopic: weakTopic };
    });
    return out;
  }

  // Why each question earns its place, most urgent first.
  function reasonOf(p) {
    if (p.stuck) return 'stuck';
    if (p.flagged) return 'flagged';
    if (p.seen && p.due) return 'due';
    if (p.fresh && p.weakTopic) return 'weak';
    if (p.fresh) return 'fresh';
    return null;
  }
  var RANK = { stuck: 0, flagged: 1, due: 2, weak: 3, fresh: 4 };

  // Reorder so the same topic doesn't come twice in a row when another topic is left.
  function interleave(items) {
    var left = items.slice(), out = [];
    while (left.length) {
      var prev = out.length ? out[out.length - 1].topic : null, k = 0;
      while (k < left.length && left[k].topic === prev) k++;
      if (k === left.length) k = 0;
      out.push(left.splice(k, 1)[0]);
    }
    return out;
  }

  // The drill: {ids, reasons:{stuck, flagged, due, weak, fresh}}.
  function buildDrill(prof, bank, opts) {
    var o = Object.assign({}, DRILL, opts || {}), Q = byId(bank);
    var cands = Object.keys(prof).filter(function (id) { return Q[id]; }).map(function (id) {
      return Object.assign({ why: reasonOf(prof[id]) }, prof[id]);
    }).filter(function (p) { return p.why; });
    cands.sort(function (a, b) {
      return RANK[a.why] - RANK[b.why] || b.wrong - a.wrong || (a.last || 0) - (b.last || 0) || (a.id < b.id ? -1 : 1);
    });
    var picked = [], fresh = 0, reasons = { stuck: 0, flagged: 0, due: 0, weak: 0, fresh: 0 };
    // New questions are capped at newMax only when there's more reviewing than room;
    // with little to review, the drill fills up with new ones instead of coming out short.
    var reviews = cands.filter(function (c) { return c.why !== 'weak' && c.why !== 'fresh'; }).length;
    var newCap = Math.max(o.newMax, o.n - reviews);
    for (var i = 0; i < cands.length && picked.length < o.n; i++) {
      var c = cands[i];
      if ((c.why === 'weak' || c.why === 'fresh') && fresh >= newCap) continue;
      if (c.why === 'weak' || c.why === 'fresh') fresh++;
      picked.push(c); reasons[c.why]++;
    }
    var ids = interleave(picked).map(function (p) { return p.id; });
    // Each stuck question comes round again a few questions later.
    picked.filter(function (p) { return p.why === 'stuck'; }).forEach(function (p) {
      var at = ids.indexOf(p.id);
      ids.splice(Math.min(at + 1 + o.requeueGap, ids.length), 0, p.id);
    });
    return { ids: ids, reasons: reasons };
  }

  // She got ids[i] wrong in a drill: put it back a few questions later (not endlessly).
  function requeue(ids, i, repeats, opts) {
    var o = Object.assign({}, DRILL, opts || {}), id = ids[i], reps = Object.assign({}, repeats);
    if (id == null || (reps[id] || 0) >= o.requeueMax) return { ids: ids, repeats: reps };
    reps[id] = (reps[id] || 0) + 1;
    var next = ids.slice();
    next.splice(Math.min(i + 1 + o.requeueGap, next.length), 0, id);
    return { ids: next, repeats: reps };
  }

  var api = { mergeFlags: mergeFlags, activity: activity, profile: profile, buildDrill: buildDrill, requeue: requeue, drillDefaults: DRILL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TTCoach = api;
})(this);
