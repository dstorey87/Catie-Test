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

  var api = { mergeFlags: mergeFlags };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TTCoach = api;
})(this);
