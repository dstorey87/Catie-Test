// Theory Trainer — choosing questions from what a learner has already answered.
// Pure functions, no screen code: the app reads them as window.TTPicker, and the
// tests (tests/picker.test.js) load the same file in Node. Used by the
// "My answers" screen and by every "More like this" button.
(function (root) {
  // Tuning lives here. config.js may override any of it with  moreLike: { count: 20 }
  // — but the publish page regenerates config.js, so the defaults stay in this file.
  var DEFAULTS = {
    count: 10,        // how many questions one "More like this" tap brings in
    topicBonus: 2,    // same DVSA topic counts about as much as one uncommon shared word
    signBonus: 3,     // same road sign counts a little more
    commonShare: 0.25 // a word in more than a quarter of the bank says nothing
  };

  // Little words that never say what a question is about.
  var STOP = {};
  ('the and for you your what when which why how should must are was can not with this that from ' +
   'have has been will would could may its into than then them they their there these those any all ' +
   'some more most only also just very being does did who where while about').split(' ')
    .forEach(function (w) { STOP[w] = true; });

  // The distinct words in a piece of text: lower case, letters and digits only,
  // 3+ characters, and a plural "s" dropped so "tyres" and "tyre" match.
  function words(text) {
    var out = Object.create(null);
    var parts = String(text || '').toLowerCase().split(/[^a-z0-9]+/);
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (w.length < 3 || STOP[w]) continue;
      if (w.length > 4 && w.charAt(w.length - 1) === 's' && w.charAt(w.length - 2) !== 's') w = w.slice(0, -1);
      out[w] = true;
    }
    return out;
  }

  // What a question is about: its wording, its right answer, its explanation and
  // its Highway Code rule (two questions citing "Rule 126" are usually cousins).
  function about(q) {
    var right = (q.options && q.options[q.correctIndex]) || '';
    return words([q.question, right, q.explanation, q.ruleRef].join(' '));
  }

  // Every question the learner has answered, one row each, most recent first.
  //   attempts: the app's answer log, oldest first: {q: id, t: time, ok, p?: option, src?}
  //   lookup:   id -> question, or null if it has since been deleted (row skipped)
  // Each row: {id, q, t, lastOk, lastPick (-1 if not recorded), src, right, wrong}
  function history(attempts, lookup) {
    var rows = [], byId = Object.create(null);
    var list = attempts || [];
    for (var i = list.length - 1; i >= 0; i--) {
      var a = list[i];
      if (!a || a.q == null) continue;
      if (!(a.q in byId)) {
        var q = lookup(a.q);
        byId[a.q] = q ? { id: a.q, q: q, t: a.t || 0, lastOk: !!a.ok,
          lastPick: typeof a.p === 'number' ? a.p : -1, src: a.src || 'learn', right: 0, wrong: 0 } : null;
        if (byId[a.q]) rows.push(byId[a.q]);
      }
      var r = byId[a.q];
      if (r) { if (a.ok) r.right++; else r.wrong++; }
    }
    return rows;
  }

  // The questions in `pool` most like any of `targets`, best first.
  // Score = sum over shared words of how rare the word is in the pool
  // (inverse document frequency), plus a bonus for the same topic or sign.
  // Ties go to the question the learner knows least (lowest Leitner box).
  //   opts: {count, topicBonus, signBonus, commonShare, boxOf: id -> 1..3}
  function similar(targets, pool, opts) {
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var k2 in (opts || {})) if (opts[k2] != null) o[k2] = opts[k2];
    targets = (targets || []).filter(Boolean);
    pool = pool || [];
    if (!targets.length || !pool.length || !(o.count > 0)) return [];

    var skip = Object.create(null);
    targets.forEach(function (t) { skip[t.id] = true; });

    // How many questions each word appears in.
    var bags = pool.map(about), df = Object.create(null);
    bags.forEach(function (b) { for (var w in b) df[w] = (df[w] || 0) + 1; });
    var n = pool.length, common = Math.max(3, n * o.commonShare);
    function weight(w) { var d = df[w] || 0; return d > common ? 0 : Math.log((n + 1) / (d + 1)); }

    var tBags = targets.map(about), scored = [];
    pool.forEach(function (q, i) {
      if (skip[q.id]) return;
      var best = 0;
      for (var t = 0; t < targets.length; t++) {
        var s = 0;
        for (var w in bags[i]) if (tBags[t][w]) s += weight(w);
        if (q.topic === targets[t].topic) s += o.topicBonus;
        if (q.imageHint && q.imageHint === targets[t].imageHint) s += o.signBonus;
        if (s > best) best = s;
      }
      if (best > 0) scored.push({ q: q, s: best, box: o.boxOf ? (o.boxOf(q.id) || 1) : 1 });
    });
    scored.sort(function (a, b) {
      return (b.s - a.s) || (a.box - b.box) || (a.q.id < b.q.id ? -1 : a.q.id > b.q.id ? 1 : 0);
    });
    return scored.slice(0, o.count).map(function (x) { return x.q; });
  }

  var api = { history: history, similar: similar, defaults: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TTPicker = api;
})(this);
