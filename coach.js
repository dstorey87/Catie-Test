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

  // =========================================================================================
  // ---------- insights: pass prediction, what to work on, study plan, misconceptions,
  //            badge closeness, streak freeze ----------
  // Every number these use lives in COACH below (like DRILL above), so tuning is one edit
  // and a test can pass its own. The pass mark and test size are the DVSA car theory
  // figures the app already uses everywhere (50 questions, 43 to pass). The rest are tuning
  // choices, not measurements: none has been checked against real test results (not verified).
  var COACH = {
    // --- pass prediction ---
    passMark: 43,          // right answers needed to pass a 50-question mock
    mockSize: 50,          // questions in a full mock
    halfLifeDays: 14,      // an answer 14 days older than her newest one counts half as much
    priorAnswers: 3,       // a topic's rate is blended with her overall rate, as if she had 3 extra
                           // answers there at her overall rate (so one lucky answer isn't "100%")
    minEvidence: 50,       // fewer answers than one mock's worth: the UI says "not enough answers yet"
    // --- what to work on ---
    whatIfRight: 10,       // "about N more right answers here would add …": this is N
    // --- study plan ---
    planGoal: 20,          // questions a day when the profile gives none (the app's default daily goal)
    planTopicsPerDay: 2,   // focus topics named on each day of the plan
    planCoverAll: true,    // leave room to see every unseen bank question before test day
    // --- misconceptions ---
    repeatPicks: 2,        // she "keeps choosing" a wrong option once she has picked it twice
    topDistractors: 3,     // per topic, how many of her most-chosen wrong options to list
    // --- badges: which number each of the app's badges (badgeList) counts … ---
    badgeStat: { start: 'answered', ten: 'run', hundred: 'answered', fivehundred: 'answered',
      streak7: 'streak', streak30: 'streak', mock: 'passes', mock3: 'passes',
      topic: 'mastered', alltopics: 'topics' },
    // … and how to say "N more of what" for each number: [one, many]
    badgeUnits: { answered: ['question', 'questions'], run: ['right answer in a row', 'right answers in a row'],
      streak: ['day in a row', 'days in a row'], passes: ['mock passed', 'mocks passed'],
      mastered: ['topic mastered', 'topics mastered'], topics: ['topic tried', 'topics tried'] },
    // --- streak freeze: how freezes are earned (the one place this lives) ---
    freeze: { every: 7,    // every 7 goal days in a streak earns one freeze …
      max: 2 }             // … and she can hold at most 2 at once
  };
  var DAY = 86400000;

  // ---------- small helpers ----------
  // 'YYYY-MM-DD' -> whole-day number (days since 1970-01-01), or null if it isn't a real date.
  // Worked in UTC so a clock change (BST) can never make a day 23 or 25 hours long.
  function dayNum(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    // Date.UTC quietly rolls 2026-02-31 into March: refuse any date that doesn't round-trip.
    return new Date(t).toISOString().slice(0, 10) === m[0] ? t / DAY : null;
  }
  // Whole-day number -> 'YYYY-MM-DD'.
  function dayStr(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
  // Topic keys come back from Object.keys as text ("3"); hand them back as numbers when they are.
  function asTopic(k) { return isNaN(Number(k)) ? k : Number(k); }
  function byNumber(a, b) { return Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0); }
  // A topic's display name: names is the app's TOPICS array (topic 1 = names[0]) or {topic: name}.
  function topicName(names, t) {
    var n = names && (Array.isArray(names) ? names[Number(t) - 1] : names[t]);
    return n || ('topic ' + t);
  }
  // One decimal place, for sentences ("about 1.4").
  function oneDp(x) { return String(Math.round(x * 10) / 10); }

  // How many questions she answered on each local day: {'YYYY-MM-DD': n}. Feeds the study
  // plan (profile.practised) and the streak (the days where the count reached her goal).
  function dayCounts(attempts) {
    var out = {};
    (attempts || []).forEach(function (a) {
      if (a && +a.t) { var k = localDay(+a.t); out[k] = (out[k] || 0) + 1; }
    });
    return out;
  }

  // ---------- 1. pass prediction ----------
  // The topic mix of a mock, as {topic: questions}. It copies the app's own "Like the real
  // test" builder (startTest, balanced mode): deal one question per topic in turn, topic 1
  // first, until there are 50. With 14 topics that is 4 each for topics 1–8 and 3 each for
  // 9–14; a topic with too few questions in the bank gives what it has, as the builder does.
  function mockMix(bank, size) {
    var Q = byId(bank), have = {}, mix = {}, left = size, added = true;
    Object.keys(Q).forEach(function (id) { var t = Q[id].topic; have[t] = (have[t] || 0) + 1; });
    var topics = Object.keys(have).sort(byNumber);
    while (left > 0 && added) {                       // one round = one question per topic
      added = false;
      for (var i = 0; i < topics.length && left > 0; i++) {
        var t = topics[i];
        if ((mix[t] || 0) < have[t]) { mix[t] = (mix[t] || 0) + 1; left--; added = true; }
      }
    }
    return mix;
  }

  // Her answers, added up per topic, recent ones counting more.
  //   weight = 0.5 ^ (days older than her NEWEST answer / halfLifeDays)
  // Weights are measured from her own newest answer, not today's clock, so the same history
  // always gives the same result (a fortnight off doesn't erase what she knows).
  // Mock scores typed in from elsewhere (tests[].source 'external') count as answers on
  // their date. The app's own mocks are already in `attempts` (src 'test'), so a mock is only
  // added from `tests` when no mock answers were logged that day (records from before that).
  // Returns {by: {topic: {w, wOk, n}}, all: {w, wOk, n}}: w = weighted answers, wOk = weighted
  // right answers, n = plain count (the "evidence" the UI shows).
  function evidence(attempts, tests, Q, o) {
    var items = [], logged = {};
    (attempts || []).forEach(function (a) {
      var q = a && Q[a.q]; if (!q) return;             // a deleted question: skipped
      items.push({ topic: q.topic, ok: a.ok ? 1 : 0, n: 1, t: +a.t || 0 });
      if (a.src === 'test' && +a.t) logged[new Date(+a.t).toISOString().slice(0, 10)] = true;
    });
    (tests || []).forEach(function (r) {
      var d = r && dayNum(r.date); if (d == null || !r.perTopic) return;
      if (r.source !== 'external' && logged[r.date]) return;   // already counted answer by answer
      Object.keys(r.perTopic).forEach(function (k) {
        var p = r.perTopic[k] || {}, n = Math.max(0, Math.floor(+p.n || 0));
        var c = Math.min(n, Math.max(0, Math.floor(+p.c || 0)));
        if (n) items.push({ topic: k, ok: c, n: n, t: d * DAY + DAY / 2 });   // midday that day
      });
    });
    var newest = 0; items.forEach(function (x) { if (x.t > newest) newest = x.t; });
    var by = {}, all = { w: 0, wOk: 0, n: 0 };
    items.forEach(function (x) {
      // An answer with no time is treated as recent (the app always records one).
      var w = x.t ? Math.pow(0.5, (newest - x.t) / (o.halfLifeDays * DAY)) : 1;
      var b = by[x.topic] || (by[x.topic] = { w: 0, wOk: 0, n: 0 });
      b.w += w * x.n; b.wOk += w * x.ok; b.n += x.n;
      all.w += w * x.n; all.wOk += w * x.ok; all.n += x.n;
    });
    return { by: by, all: all };
  }

  // Chance of AT LEAST k right when question i is right with chance ps[i], each independent
  // of the others (the "Poisson-binomial" distribution). Worked out exactly, not sampled:
  // start with "0 right, chance 1", then add one question at a time — each score either stays
  // (question wrong) or moves up one (question right).
  function atLeast(ps, k) {
    var dist = [1];
    ps.forEach(function (p) {
      var next = [];
      for (var j = 0; j <= dist.length; j++) {
        next.push((j < dist.length ? dist[j] * (1 - p) : 0) + (j > 0 ? dist[j - 1] * p : 0));
      }
      dist = next;
    });
    var s = 0;
    for (var j = Math.max(0, k); j < dist.length; j++) s += dist[j];
    return Math.min(1, Math.max(0, s));               // tidy floating-point dust (1.0000000002)
  }

  // The prediction itself, from added-up evidence and a mix. Shared by passPrediction and
  // improvements, so a "what if" is the same sum run again — never a separate guess.
  function predictFrom(ev, mix, o) {
    var total = 0;
    Object.keys(mix).forEach(function (t) { total += Math.max(0, mix[t] || 0); });
    // Pass mark scaled like the app's own shorter tests (43/50 = 86%), when the bank is too
    // small for a full 50.
    var pass = total === o.mockSize ? o.passMark : Math.ceil(total * o.passMark / o.mockSize);
    var out = { enough: ev.all.n >= o.minEvidence, evidence: ev.all.n, total: total, passMark: pass,
      overall: null, expected: null, probability: null, topics: [] };
    if (!ev.all.w || !total) return out;               // no answers yet: nothing to predict from
    var overall = ev.all.wOk / ev.all.w, ps = [], expected = 0;
    Object.keys(mix).sort(byNumber).forEach(function (t) {
      var n = Math.max(0, mix[t] || 0), b = ev.by[t] || { w: 0, wOk: 0, n: 0 };
      // Her weighted rate in this topic, pulled toward her overall rate by priorAnswers.
      // A topic she hasn't tried yet gets her overall rate: the only evidence there is.
      var den = b.w + o.priorAnswers;
      var acc = den > 0 ? (b.wOk + o.priorAnswers * overall) / den : overall;
      for (var i = 0; i < n; i++) ps.push(acc);
      expected += n * acc;
      out.topics.push({ topic: asTopic(t), n: n, acc: acc, answers: b.n, expected: n * acc, lost: n * (1 - acc) });
    });
    out.overall = overall;
    out.expected = expected;                            // expected mock score out of `total`
    out.probability = atLeast(ps, pass);                // chance of `pass` or more
    return out;
  }

  // passPrediction(attempts, tests, bank, opts) -> {
  //   expected     expected score out of 50 (null with no answers)
  //   probability  chance (0–1) of reaching the pass mark (null with no answers)
  //   evidence     how many answers it is based on; enough = evidence >= minEvidence
  //   passMark, total, overall (her weighted rate), topics: [{topic, n, acc, answers, expected, lost}] }
  // Method: per-topic weighted accuracy (above) × how many questions that topic gets in a
  // mock (mockMix, or opts.mix) = expected marks; the chance of passing treats each question
  // as right with its topic's rate. Assumptions, stated: questions are independent, and a
  // rate is a best estimate (thin evidence makes it less certain than it looks — that is what
  // `enough` and each topic's `answers` are for). Same inputs, same answer: no clock, no dice.
  function passPrediction(attempts, tests, bank, opts) {
    var o = Object.assign({}, COACH, opts || {}), Q = byId(bank);
    return predictFrom(evidence(attempts, tests, Q, o), o.mix || mockMix(Q, o.mockSize), o);
  }

  // ---------- 2. what to work on ----------
  // improvements(attempts, tests, bank, opts) -> topics ranked by predicted gain, best first:
  //   [{topic, name, n, acc, answers, lost, gain, probGain, say}]
  // gain = how much her expected score would rise if her next `whatIfRight` answers in that
  // topic were right: the SAME prediction as passPrediction, run again with those answers
  // added as brand-new ones. Her overall rate is held where it is, so the gain is only what
  // the topic itself adds. lost = expected marks she drops there in a mock now.
  // opts.topicNames (the app's TOPICS array) puts real names in `say`.
  function improvements(attempts, tests, bank, opts) {
    var o = Object.assign({}, COACH, opts || {}), Q = byId(bank), N = o.whatIfRight;
    var mix = o.mix || mockMix(Q, o.mockSize), ev = evidence(attempts, tests, Q, o);
    var base = predictFrom(ev, mix, o);
    if (base.expected === null) return [];              // no answers: nothing honest to say
    return base.topics.filter(function (tp) { return tp.n > 0; }).map(function (tp) {
      // The what-if: N more right answers in this topic, each at full (newest) weight.
      var b = ev.by[tp.topic] || { w: 0, wOk: 0, n: 0 }, by2 = Object.assign({}, ev.by);
      by2[tp.topic] = { w: b.w + N, wOk: b.wOk + N, n: b.n + N };
      var after = predictFrom({ by: by2, all: ev.all }, mix, o);
      var gain = after.expected - base.expected, name = topicName(o.topicNames, tp.topic);
      return { topic: tp.topic, name: name, n: tp.n, acc: tp.acc, answers: tp.answers, lost: tp.lost,
        gain: gain, probGain: after.probability - base.probability,
        say: 'You lose about ' + oneDp(tp.lost) + ' of the ' + tp.n + ' marks on ' + name +
          ' in a mock — about ' + N + ' more right answers here would add ' +
          (gain < 0.05 ? 'less than 0.1' : '~' + oneDp(gain)) + ' to your expected score.' };
    }).sort(function (a, b) { return b.gain - a.gain || b.lost - a.lost || byNumber(a.topic, b.topic); });
  }

  // ---------- 3. study plan to the test date ----------
  // studyPlan(testDate, today, profile, opts), dates as 'YYYY-MM-DD' (her local days).
  //   profile.goal       her daily goal (settings.dailyGoal); default planGoal
  //   profile.start      the day the plan began (default: today)
  //   profile.practised  days practised so far: {'YYYY-MM-DD': answers} (dayCounts above)
  //   profile.topics     topics worth practising, best first (e.g. improvements().map(x => x.topic))
  //   profile.unseen     bank questions she has never answered (optional)
  // -> {status: 'ok' | 'no-date' | 'passed' | 'test-day', daysLeft, goal, total, done,
  //     remaining, missed: [dates], days: [{date, target, topics, isToday, done}]}
  // The plan's workload is her own goal × the days from start to the test (never a made-up
  // total), raised if needed so every unseen question fits before test day. Whatever is left
  // is spread over the days that are left, so a missed day's questions move onto the rest
  // (targets never drop below her goal). Rebuilt from scratch each day — that is the adapting.
  // Test day itself has no practice day: the plan runs up to the day before.
  function studyPlan(testDate, today, profile, opts) {
    var o = Object.assign({}, COACH, opts || {}), pr = profile || {};
    var now = dayNum(today); if (now === null) now = dayNum(localDay(Date.now()));
    var test = dayNum(testDate), goal = pr.goal > 0 ? Math.round(pr.goal) : o.planGoal;
    var out = { status: 'ok', testDate: test === null ? null : dayStr(test), today: dayStr(now), daysLeft: 0,
      goal: goal, total: 0, done: 0, remaining: 0, missed: [], days: [] };
    // The three cases with no plan to draw: no date set, a date already gone, or it's today.
    if (test === null) { out.status = 'no-date'; return out; }
    if (test < now) { out.status = 'passed'; return out; }
    if (test === now) { out.status = 'test-day'; return out; }
    var start = dayNum(pr.start); if (start === null || start > now) start = now;
    var practised = pr.practised || {}, left = test - now;
    out.daysLeft = left;
    out.total = goal * (test - start);
    // What she has done since the plan began (before today), and which days she missed.
    for (var d = start; d < now; d++) {
      var n = Math.max(0, +practised[dayStr(d)] || 0);
      out.done += n;
      if (!n) out.missed.push(dayStr(d));
    }
    out.remaining = Math.max(0, out.total - out.done);
    var unseen = Math.max(0, Math.floor(+pr.unseen || 0));
    if (o.planCoverAll && unseen > out.remaining) out.remaining = unseen;
    // Spread `remaining` over the days left in whole questions: the first `extra` days take
    // one more so the targets add up exactly; none goes under her goal.
    var base = Math.floor(out.remaining / left), extra = out.remaining % left;
    var ranked = (pr.topics || []).filter(function (t) { return t != null; });
    var k = Math.min(o.planTopicsPerDay, ranked.length);
    for (var i = 0; i < left; i++) {
      var topics = [];   // rotate through the ranked topics, best first, k a day
      for (var j = 0; j < k; j++) topics.push(ranked[(i * k + j) % ranked.length]);
      out.days.push({ date: dayStr(now + i), target: Math.max(goal, base + (i < extra ? 1 : 0)), topics: topics,
        isToday: i === 0, done: i === 0 ? Math.max(0, +practised[dayStr(now)] || 0) : 0 });
    }
    return out;
  }

  // ---------- 4. misconceptions (distractor analysis) ----------
  // misconceptions(attempts, bank, opts) -> {
  //   questions: [{qid, topic, seen, wrong, recorded, pick, count, share, option, answer, lastOk}]
  //       each question where she has picked the same wrong option `repeatPicks`+ times:
  //       pick = that option's index in the bank, share = count / wrong answers with a pick
  //       recorded, option/answer = the bank's own words, lastOk = her latest answer was right
  //   topics: [{topic, wrongPicks, picks: [{qid, pick, count, option, answer}]}]
  //       per topic, her most-chosen wrong options (topDistractors of them), most first }
  // `p` on an answer is the bank option she chose (the app records it from 2026-09-24).
  // Answers without it, or whose `p` no longer fits the question, are left out of the picks.
  function misconceptions(attempts, bank, opts) {
    var o = Object.assign({}, COACH, opts || {}), Q = byId(bank), per = {};
    (attempts || []).forEach(function (a) {
      var q = a && Q[a.q]; if (!q) return;
      var r = per[a.q] || (per[a.q] = { seen: 0, wrong: 0, picks: {}, lastT: -Infinity, lastOk: false });
      r.seen++;
      if ((+a.t || 0) >= r.lastT) { r.lastT = +a.t || 0; r.lastOk = !!a.ok; }
      if (a.ok) return;
      r.wrong++;
      var p = a.p, n = (q.options || []).length;
      if (typeof p === 'number' && p === Math.floor(p) && p >= 0 && p < n && p !== q.correctIndex) {
        r.picks[p] = (r.picks[p] || 0) + 1;
      }
    });
    var questions = [], topics = {};
    Object.keys(per).sort().forEach(function (id) {
      var r = per[id], q = Q[id], recorded = 0, best = null, opt = q.options, right = opt[q.correctIndex];
      Object.keys(r.picks).forEach(function (p) {
        recorded += r.picks[p];
        if (best === null || r.picks[p] > r.picks[best]) best = p;   // ties: the lower option
        var tp = topics[q.topic] || (topics[q.topic] = { topic: asTopic(q.topic), wrongPicks: 0, picks: [] });
        tp.wrongPicks += r.picks[p];
        tp.picks.push({ qid: id, pick: +p, count: r.picks[p], option: opt[+p], answer: right });
      });
      if (best !== null && r.picks[best] >= o.repeatPicks) {
        questions.push({ qid: id, topic: q.topic, seen: r.seen, wrong: r.wrong, recorded: recorded,
          pick: +best, count: r.picks[best], share: r.picks[best] / recorded,
          option: opt[+best], answer: right, lastOk: r.lastOk });
      }
    });
    questions.sort(function (a, b) { return b.count - a.count || b.share - a.share || (a.qid < b.qid ? -1 : 1); });
    var topicList = Object.keys(topics).sort(byNumber).map(function (k) {
      var t = topics[k];
      t.picks.sort(function (a, b) { return b.count - a.count || (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : a.pick - b.pick); });
      t.picks = t.picks.slice(0, o.topDistractors);
      return t;
    }).sort(function (a, b) { return b.wrongPicks - a.wrongPicks || byNumber(a.topic, b.topic); });
    return { questions: questions, topics: topicList };
  }

  // ---------- 5. badge closeness ----------
  // badgeCloseness(stats, badges, opts) -> {nearest, open: [...], earned}
  //   badges: the app's badgeList() — [{id, label, need, at, done}] — or any [{id, label,
  //           stat, need}]. stats: the numbers now, {answered, run, streak, passes, mastered,
  //           topics}. `run` and `streak` are the CURRENT run/streak: "Ten in a row" needs ten
  //           more from where she is, not from her best ever. A badge without a stats value
  //           falls back to its own `at`.
  //   open: badges not yet earned, nearest first = the biggest share already done, then
  //         the fewest to go. Each: {id, label, stat, have, need, more, progress, say}.
  function badgeCloseness(stats, badges, opts) {
    var o = Object.assign({}, COACH, opts || {}), s = stats || {}, open = [], earned = 0;
    (badges || []).forEach(function (b) {
      if (!b || !(b.need > 0)) return;
      var stat = b.stat || o.badgeStat[b.id];
      var have = stat && s[stat] != null ? Math.max(0, Number(s[stat]) || 0) : Math.max(0, Number(b.at) || 0);
      if (b.done === true || have >= b.need) { earned++; return; }   // earned badges stay earned
      var more = b.need - have, unit = o.badgeUnits[stat];
      open.push({ id: b.id, label: b.label, stat: stat || null, have: have, need: b.need, more: more,
        progress: have / b.need,
        say: unit ? more + ' more ' + unit[more === 1 ? 0 : 1] + ' earns ' + b.label : more + ' more to earn ' + b.label });
    });
    open.sort(function (a, b) {
      return b.progress - a.progress || a.more - b.more || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    return { nearest: open[0] || null, open: open, earned: earned };
  }

  // ---------- 6. streak with freezes ----------
  // streakWithFreeze(days, freezes, today) -> {count, freezes, frozen, today, nextFreezeIn}
  //   days:    the local days her daily goal was met, 'YYYY-MM-DD' (order and repeats don't matter)
  //   freezes: optional override of the earning rules, e.g. {every: 7, max: 2} (COACH.freeze)
  //   today:   'YYYY-MM-DD' (default: this device's today)
  // Walk day by day from her first goal day to today. A goal day adds one to the streak, and
  // every `every` goal days earns a freeze (held up to `max`). A missed day uses a freeze if
  // she has one — the streak survives but doesn't grow — otherwise the streak starts again.
  // Today only counts once she practises: not having practised YET breaks nothing.
  // Freezes are worked out from the days alone, so there is no extra state to store or sync.
  //   count: current streak · freezes: held now · frozen: days a freeze saved in this streak ·
  //   today: goal met today · nextFreezeIn: goal days until the next freeze (null when full)
  function streakWithFreeze(days, freezes, today) {
    var f = Object.assign({}, COACH.freeze, freezes || {});
    var end = dayNum(today); if (end === null) end = dayNum(localDay(Date.now()));
    var goal = {}, first = null;
    (days || []).forEach(function (s) {
      var n = dayNum(s); if (n === null || n > end) return;   // junk or a future date: ignored
      goal[n] = true; if (first === null || n < first) first = n;
    });
    var count = 0, held = 0, toward = 0, frozen = [];
    for (var d = first === null ? end + 1 : first; d <= end; d++) {
      if (goal[d]) {
        count++; toward++;
        if (f.every > 0 && toward >= f.every) { toward = 0; if (held < f.max) held++; }
      } else if (d === end) {
        // today isn't over yet
      } else if (held > 0) { held--; frozen.push(dayStr(d)); }
      else { count = 0; toward = 0; frozen = []; }
    }
    return { count: count, freezes: held, frozen: frozen, today: !!goal[end],
      nextFreezeIn: held >= f.max || !(f.every > 0) ? null : f.every - toward };
  }

  var api = { mergeFlags: mergeFlags, activity: activity, profile: profile, buildDrill: buildDrill, requeue: requeue, drillDefaults: DRILL,
    passPrediction: passPrediction, improvements: improvements, studyPlan: studyPlan, misconceptions: misconceptions,
    badgeCloseness: badgeCloseness, streakWithFreeze: streakWithFreeze, mockMix: mockMix, dayCounts: dayCounts,
    coachDefaults: COACH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TTCoach = api;
})(this);
