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

  var api = { mergeFlags: mergeFlags, activity: activity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TTCoach = api;
})(this);
