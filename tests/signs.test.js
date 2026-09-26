// Road-sign pictures (issues #44 and #48) — the one map in signs.js, the files it names, the bank's
// sign values, the offline rule in sw.js, the sign questions and quizzes, the Adventure sign worlds'
// questions, and the credit the licence asks for. No browser needed. Run with:  node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// Run signs.js exactly as the browser does, in a sandbox with a stand-in React that hands back
// what it was asked to draw, so the tests check the real code.
const sandbox = { window: {}, React: { createElement: (type, props) => ({ type, props }) } };
vm.runInNewContext(read('signs.js'), sandbox);
const TS = sandbox.window.TTSigns;
const SignImage = sandbox.window.SignImage;
// Arrays made inside the sandbox have the sandbox's own Array, which assert's strict deepEqual
// treats as different from ours: copy them into plain values before comparing.
const plain = x => JSON.parse(JSON.stringify(x));

// The bank as the app loads it: the five files, and the free sample.
const BANK_FILES = ['questions-free.json', 'questions-1.json', 'questions-2.json', 'questions-3.json', 'questions-4.json', 'questions-5.json'];
const bank = BANK_FILES.flatMap(f => JSON.parse(read(f)).map(q => Object.assign({ file: f }, q)));
const byId = Object.fromEntries(bank.map(q => [q.id, q]));

// The Highway Code catalogue researched for #48 (tests/data): every picture on the six GOV.UK pages,
// in page order, with its caption exactly as published, and why each left-out one is left out.
const CAT = JSON.parse(read('tests/data/highway-code-catalogue.json'));
const byHc = Object.fromEntries(TS.list.filter(s => s.hc).map(s => [s.hc, s]));
const noStars = s => s.replace(/\*\*/g, '');          // the one change allowed: markdown bold marks
// A fixed "random" so the order is the same every run.
const seeded = () => { let n = 0; return () => ((n = (n * 9301 + 49297) % 233280) / 233280); };

// The 37 keys signs.js had after #44. Bank questions (and anything the admin set in the editor)
// store these, so every one must keep working.
const OLD_KEYS = ['stop', 'giveWay', 'noEntry', 'noOvertaking', 'speed20', 'speed30', 'speed50', 'natLimit', 'minSpeed',
  'turnLeft', 'cyclesOnly', 'clearway', 'bendLeft', 'roadNarrows', 'trafficLights', 'zebra', 'schoolAhead', 'ford',
  'slippery', 'levelCrossing', 'oneWay', 'speedCamera', 'motorway', 'tourist', 'roadWorks', 'lightRed', 'lightRedAmber',
  'lightGreen', 'lightAmber', 'levelCrossingLights', 'redX', 'motorwayAdvised', 'motorwayLimit', 'centreLine',
  'doubleWhite', 'doubleYellow', 'boxJunction'];
// The seven with no Highway Code twin kept in #48 (different pictures, or their twin is left out).
const DFT_ONLY = ['speed20', 'speed30', 'speed50', 'schoolAhead', 'ford', 'speedCamera', 'tourist'];

// ---------- the bank's pictures (#44) ----------

test('#44: every question\'s sign value is a picture the map can show', () => {
  // Found 2026-09-25: a sign value with no drawing showed nothing, silently.
  const bad = bank.filter(q => q.imageHint && !TS.has(q.imageHint)).map(q => q.id + ' (' + q.file + '): ' + q.imageHint);
  assert.deepEqual(bad, [], 'these questions name a sign signs.js cannot show');
});

test('#48: every key from before #48 still works, and the same sign is never in the map twice', () => {
  for (const k of OLD_KEYS) assert.ok(TS.has(k), k + ' has gone: a question that uses it would lose its picture');
  // 30 old keys are the same sign as a Highway Code entry (same DfT diagram and picture, or the same
  // GOV.UK file): one entry each, carrying the Highway Code caption.
  const merged = OLD_KEYS.filter(k => TS.get(k).hc);
  assert.equal(merged.length, 30, 'merged with an existing key: ' + merged.length);
  assert.deepEqual(OLD_KEYS.filter(k => !TS.get(k).hc), DFT_ONLY);
  const hcs = TS.list.filter(s => s.hc).map(s => s.hc);
  assert.equal(new Set(hcs).size, hcs.length, 'two entries are the same Highway Code picture');
  assert.equal(TS.list.length, 205 + DFT_ONLY.length);
});

test('#44: every picture in the map is a real JPEG file, small, and every file in signs/ is in the map', () => {
  const keys = TS.list.map(s => s.key), files = TS.list.map(s => s.file);
  assert.equal(new Set(keys).size, keys.length, 'two entries share a key');
  assert.equal(new Set(files).size, files.length, 'two entries share a file');
  for (const f of files) assert.ok(fs.existsSync(path.join(root, 'signs', f)), 'signs/' + f + ' is missing');
  // Nothing unused in the folder.
  for (const f of fs.readdirSync(path.join(root, 'signs'))) assert.ok(files.includes(f), 'signs/' + f + ' is not in the map — delete it');
  let bytes = 0;
  for (const s of TS.list) {
    const b = fs.readFileSync(path.join(root, 'signs', s.file));
    bytes += b.length;
    // A real JPEG starts FF D8 FF (one GOV.UK "jpg" was PNG data; #48 converts every picture).
    assert.ok(b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF, s.file + ' is not JPEG data');
    let i = 2, w = 0, h = 0;
    while (i < b.length) {
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xC0 && marker <= 0xC3) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + len;
    }
    assert.ok(w > 0 && h > 0, s.file + ': could not read its size');
    // #44's pictures are at most 400 px on the long side; #48's new ones at most 360.
    const most = s.hc && s.key === s.hc ? 360 : 400;
    assert.ok(Math.max(w, h) <= most, s.file + ' is ' + w + 'x' + h + ': scale it to ' + most + ' px or less');
  }
  // Every picture is cached on the phone once seen: keep the whole set small.
  assert.ok(bytes < 5 * 1024 * 1024, 'signs/ is ' + bytes + ' bytes: aim well under 5 MB');
});

test('#44: every entry says where it came from, and what it means in official words', () => {
  for (const s of TS.list) {
    for (const f of ['key', 'file', 'source', 'url', 'page', 'meaning']) {
      assert.ok(typeof s[f] === 'string' && s[f].trim(), s.key + ' has no ' + f);
    }
    assert.ok(s.alt === undefined || (typeof s.alt === 'string' && s.alt.trim()), s.key + ': an empty alt');
    assert.ok(s.source in TS.sources, s.key + ': unknown source ' + s.source);
    assert.match(s.url, /^https:\/\/assets\.(publishing\.service|digital\.cabinet-office)\.gov\.uk\//, s.key + ': not copied from GOV.UK');
    assert.match(s.page, /^https:\/\/www\.gov\.uk\/guidance\//, s.key + ': no GOV.UK page to check it against');
    // A DfT sign carries its diagram number; a Highway Code picture has none.
    if (s.source === 'dft') assert.match(s.diagram || '', /^\d+(\.\d+)?$/, s.key + ': no DfT diagram number');
    else assert.equal(s.diagram, undefined, s.key + ': a Highway Code picture has no diagram number');
  }
});

// ---------- every Highway Code picture (#48) ----------

test('#48: every Highway Code picture is in the map with its caption word for word, or left out with a reason', () => {
  let kept = 0;
  for (const e of CAT.entries) {
    const s = byHc[e.id], out = CAT.leftOut[e.id];
    assert.ok(!!s !== !!out, '#' + e.n + ' ' + e.id + (s ? ' is in the map AND left out' : ' is neither in the map nor left out with a reason'));
    if (out) { assert.equal(out.n, e.n); assert.ok(out.reason.length > 20, '#' + e.n + ': say why it is left out'); continue; }
    kept++;
    assert.equal(s.meaning, noStars(e.caption), '#' + e.n + ' ' + s.key + ': not the official caption word for word');
    // A picture copied in #48 is the Highway Code's own file, from its own page.
    if (s.key === e.id) { assert.equal(s.url, e.imageUrl, s.key + ': copied from somewhere else'); assert.equal(s.file, e.id + '.jpg'); }
    if (s.source === 'hc') assert.equal(s.page, e.pageUrl, s.key + ': checked against the wrong page');
  }
  assert.equal(kept, 205);
  // The lead's decisions (issue #48): the wrong picture, a caption that disagrees with its picture,
  // two logos the licence doesn't cover, and every photograph of people.
  const out = n => CAT.leftOut[CAT.entries[n].id];
  for (const n of [27, 78, 133, 164]) assert.ok(out(n), '#' + n + ' must be left out');
  for (const e of CAT.entries.filter(x => /^Signals (to other road users|by authorised persons)$/.test(x.page))) assert.ok(out(e.n), '#' + e.n + ' is a photograph of people');
  // ... and every caption that is not a meaning (the research's "not usable" list, #62, #99, #223, #224 ...).
  for (const n of [62, 99, 102, 103, 107, 108, 110, 111, 114, 115, 116, 180, 184, 186, 188, 190, 192, 194, 196, 198, 203, 204, 222, 223, 224, 83]) assert.ok(out(n), '#' + n + ' must be left out');
  assert.equal(Object.keys(CAT.leftOut).length, 56);
  // Markdown stars were taken out, and nothing else.
  assert.equal(byHc['obstruction-final'].meaning, 'You MUST NOT enter or proceed in the left lane, temporary mandatory maximum speed limit and information message');
});

test('#48: the map is in the Highway Code\'s page order, under the pages\' own headings', () => {
  assert.deepEqual(plain(TS.categories.map(c => c.name)), ['Signs giving orders', 'Warning signs', 'Direction signs', 'Information signs',
    'Road work signs', 'Road markings', 'Light signals controlling traffic', 'Vehicle markings']);
  const catOf = Object.fromEntries(TS.categories.map(c => [c.id, c]));
  let last = -1;
  for (const s of TS.list.filter(x => x.hc)) {
    const e = CAT.entries.find(x => x.id === s.hc);
    assert.ok(e.n > last, s.key + ' is out of page order'); last = e.n;
    const c = catOf[s.cat];
    assert.ok(c, s.key + ': no category');
    // Traffic signs: its headings are the categories. Each other page is one category, and its
    // headings are the sub-categories (road markings have a third level, sub2).
    if (e.page === 'Traffic signs') {
      assert.deepEqual([c.name, s.sub, s.sub2], [e.category, e.subcategory, undefined], s.key);
    } else {
      assert.deepEqual([c.name, s.sub, s.sub2], [e.page, e.category, e.subcategory || undefined], s.key);
    }
    assert.equal(TS.pages[c.page].title, e.page, s.key + ': wrong page');
  }
  // The pictures with no Highway Code twin have no category: they are shown in their own group.
  for (const k of DFT_ONLY) assert.equal(TS.get(k).cat, undefined, k);
});

test('#48: the Road Signs screen\'s sections: each category in order, its sub-headings, then the DfT-only group', () => {
  const secs = plain(TS.sections());
  assert.deepEqual(secs.map(s => s.id), plain(TS.categories.map(c => c.id)).concat(['dft']));
  assert.deepEqual(secs.map(s => s.count), [47, 50, 21, 24, 11, 28, 14, 10, 7]);
  assert.deepEqual(secs.map(s => s.quiz), [true, true, true, true, true, true, true, true, false], 'the DfT-only group has no quiz');
  // Every entry once, in map order.
  assert.deepEqual(secs.flatMap(s => s.groups.flatMap(g => g.keys)), plain(TS.list.map(s => s.key)).filter(k => !DFT_ONLY.includes(k)).concat(DFT_ONLY));
  const marks = secs.find(s => s.id === 'markings');
  assert.deepEqual(marks.groups.map(g => [g.sub, g.sub2 || null]), [['Across the carriageway', null], ['Along the carriageway', null],
    ['Along the edge of the carriageway', 'Waiting restrictions'], ['Along the edge of the carriageway', 'Red Route stopping controls'],
    ['On the kerb or at the edge of the carriageway', 'Loading restrictions on roads other than Red Routes'], ['Other road markings', null]]);
});

// ---------- sign questions (#48) ----------
// Darren's standing rule is "only questions and answers from the bank". A sign question meets it
// (issue #48, logged): the official picture, its official caption word for word as the right
// answer, and three OTHER official captions from the same category as the wrong ones.

test('#48: a sign question is the official picture, its caption as the answer, three other captions from its category', () => {
  const nouns = { signs: 'sign', markings: 'road marking', lights: 'light signal', vehicles: 'vehicle marking' };
  const catOf = Object.fromEntries(TS.categories.map(c => [c.id, c]));
  const keys = plain(TS.quizKeys());
  // Every Highway Code picture that shows ONE sign is a quiz picture; a picture of several never is.
  assert.deepEqual(keys, plain(TS.list.filter(s => s.cat && !s.multi).map(s => s.key)));
  assert.equal(keys.length, 203);
  assert.ok(TS.list.filter(s => s.multi).length === 2 && TS.list.filter(s => s.multi).every(s => !keys.includes(s.key)));
  for (const k of DFT_ONLY) assert.ok(!keys.includes(k), k + ' has no Highway Code caption: never a quiz picture');
  for (const key of keys) {
    const s = TS.get(key), q = TS.question(TS.QUIZ_PREFIX + key), c = catOf[s.cat];
    assert.equal(q.id, 'sign:' + key);
    assert.equal(q.imageHint, key, 'shows its own picture');
    assert.equal(q.question, 'What does this ' + nouns[c.page] + ' mean?');
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4, key + ': two options are the same words');
    assert.equal(q.options[q.correctIndex], s.meaning, key + ': the right answer is its own caption');
    const wrong = q.options.filter((o, i) => i !== q.correctIndex);
    // From the same category — the sub-category when it has enough — and never one that holds the
    // right answer's words whole (or sits inside them), so no wrong answer is also right.
    const inCat = TS.list.filter(x => x.cat === s.cat), inSub = inCat.filter(x => s.sub && x.sub === s.sub);
    const fits = x => x.meaning !== s.meaning && !x.meaning.toLowerCase().includes(s.meaning.toLowerCase()) && !s.meaning.toLowerCase().includes(x.meaning.toLowerCase());
    const subPool = new Set(inSub.filter(fits).map(x => x.meaning));
    for (const w of wrong) {
      assert.ok(inCat.some(x => x.meaning === w), key + ': "' + w + '" is not a caption from ' + c.name);
      assert.ok(fits({ meaning: w }), key + ': "' + w + '" overlaps the right answer');
      if (subPool.size >= 3) assert.ok(subPool.has(w), key + ': "' + w + '" is not from its sub-category (' + s.sub + ')');
    }
    // The same question every time (the app and Adventure record the option picked by its place).
    assert.deepEqual(plain(TS.question('sign:' + key)), plain(q));
    // Nothing written here: the words all come from the map.
    assert.equal(q.explanation, s.meaning);
    assert.equal(q.ruleRef, 'The Highway Code: ' + c.name);
  }
  assert.equal(TS.question('t01q01'), null, 'a bank id is not a sign question');
  assert.equal(TS.question('sign:noSuchSign'), null);
  assert.equal(TS.question('sign:ford'), null, 'a DfT-only picture has no Highway Code caption');
  assert.equal(TS.isQuizId('sign:stop'), true);
  assert.equal(TS.isQuizId('t01q01'), false);
  assert.equal(TS.isQuizId(undefined), false);
});

test('#48: "Quiz me on all signs" is 20 at random; "Quiz me on this category" is that category only', () => {
  const all = plain(TS.quizIds(null, seeded()));
  assert.equal(all.length, TS.quizSize);
  assert.equal(TS.quizSize, 20);
  assert.equal(new Set(all).size, all.length, 'a sign twice');
  for (const id of all) assert.ok(TS.question(id), id + ' is not a sign question');
  assert.notDeepEqual(all, plain(TS.quizIds(null, () => 0.5)), 'shuffled, not always the same 20');
  for (const c of TS.categories) {
    const ids = plain(TS.quizIds(c.id, seeded())), mine = plain(TS.quizKeys(c.id));
    assert.equal(ids.length, Math.min(20, mine.length), c.id);
    for (const id of ids) assert.ok(mine.includes(id.slice(5)), id + ' is not in ' + c.name);
  }
  assert.deepEqual(plain(TS.quizIds('nope', seeded())), []);
});

test('#48: the Adventure sign worlds: one per category, its quiz pictures in page order', () => {
  const worlds = plain(TS.worlds());
  assert.deepEqual(worlds.map(w => w.id), plain(TS.categories.map(c => c.id)));
  assert.deepEqual(worlds.map(w => w.name), plain(TS.categories.map(c => c.name)));
  for (const w of worlds) assert.deepEqual(w.qids, plain(TS.quizKeys(w.id)).map(k => 'sign:' + k));
  assert.deepEqual(worlds.map(w => w.qids.length), [46, 50, 21, 23, 11, 28, 14, 10]);
});

test('#48: a sign answer counts toward her goal, XP and streak — and the bank\'s coach never sees it', () => {
  const app = read('Theory Trainer.dc.html');
  const method = (start, next) => {
    const a = app.indexOf('\n  ' + start), b = app.indexOf('\n  ' + next, a + 1);
    assert.ok(a >= 0 && b > a, 'method not found in the page: ' + start);
    return app.slice(a, b);
  };
  const block = name => [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.' + name + ' ='));
  const coach = require('../coach.js'), picker = require('../picker.js');
  const ctx = { window: { TTSigns: TS, TTCoach: coach }, Date, Object, Math, JSON, Set, Map };
  vm.runInNewContext(block('TTInsights'), ctx);
  vm.runInNewContext(block('TTAdv'), ctx);                // TTAdv.ATTEMPTS_KEPT: how many answers are kept
  ctx.TTSigns = TS; ctx.TTCoach = coach; ctx.TTInsights = ctx.window.TTInsights; ctx.TTAdv = ctx.window.TTAdv;
  // The app's own methods, each from its name to the next method's name. Joined with a comma on
  // a NEW line: a slice can end in a comment.
  vm.runInNewContext('var me = {' + [['answerLearn(i){', 'nextLearn(){'], ['award(qCount, correctCount, bonus){', 'levelInfo(xp){'], ['levelInfo(xp){', 'badgeStats(){'],
    ['badgeStats(){', 'badgeList(){'], ['streakFor(d){', 'maybeLocalNudge(){'], ['sessionQ(id){', 'isSignQ(id){'], ['isSignQ(id){', 'qById(id){'], ['qById(id){', 'setRevFlag(id, on, src){'],
    ['bankQuestions(){', 'questions(){'], ['questions(){', 'rec(id){'], ['rec(id){', 'seedPerm(id){'], ['seedPerm(id){', 'viewQ(q){'], ['viewQ(q){', 'speak(text){'],
    ['readiness(){', 'advise(){']].map(([a, b]) => method(a, b)).join('\n,') + '};', ctx);
  const qs = bank.filter(q => q.file !== 'questions-free.json');
  const me = Object.assign(ctx.me, {
    state: { bank: qs, deleted: [], overrides: {}, custom: [], leitner: {}, attempts: [], tests: [], xp: 0,
      streak: { count: 0, last: '', todayDate: '', todayN: 0 }, settings: { dailyGoal: 2 }, revisionFlags: {},
      session: { ids: ['sign:stop', 'sign:zebra'], i: 0, correct: 0, picked: -1, log: [], label: 'Road signs', signs: true, startedAt: 1 } },
    setState(patch, cb) { Object.assign(this.state, patch); if (cb) cb(); },
    persist() {}, TIPS: {}, props: {}
  });
  const q = me.sessionQ('sign:stop'), v = me.viewQ(q);
  assert.equal(q.options[q.correctIndex], 'Stop and give way');
  const before = me.readiness();
  me.answerLearn(v.correctIndex);                        // right
  me.state.session = Object.assign({}, me.state.session, { i: 1, picked: -1 });
  const vz = me.viewQ(me.sessionQ('sign:zebra'));
  me.answerLearn((vz.correctIndex + 1) % 4);             // wrong
  const at = me.state.attempts;
  // Counted like any practice answer: both answers, 10 XP for the right one, today's goal (2) met.
  assert.deepEqual(plain(at.map(a => [a.q, a.ok, a.src, 'topic' in a])), [['sign:stop', true, 'signs', false], ['sign:zebra', false, 'signs', false]]);
  assert.equal(me.state.xp, 10);
  assert.equal(coach.dayCounts(at)[coach.localDay(Date.now())], 2, 'Home\'s goal ring counts them');
  assert.ok(me.state.streak.goalDays.includes(coach.localDay(Date.now())), 'today counts toward her streak');
  assert.equal(me.state.session.correct, 1);
  // Kept out of the bank's own records: no Leitner box, no topic, no "keeps getting wrong".
  assert.deepEqual(plain(me.state.leitner), {});
  assert.deepEqual(plain(me.state.session.wrongTopics || []), []);
  const prof = coach.profile(at, {}, qs);
  assert.ok(!Object.keys(prof).some(id => id.startsWith('sign:')), 'Today\'s lesson and stuck detection never see a sign answer');
  assert.deepEqual(plain(coach.buildDrill(prof, qs, { n: 20 })), plain(coach.buildDrill(coach.profile([], {}, qs), qs, { n: 20 })), 'the drill is the same as with no answers');
  assert.deepEqual(plain(coach.misconceptions(at, qs)), { questions: [], topics: [] });
  assert.equal(coach.passPrediction(at, [], qs).evidence, 0, 'the pass prediction counts bank answers only');
  assert.deepEqual(picker.history(at, id => byId[id] || null), [], 'My answers lists bank questions only');
  assert.equal(me.readiness(), before, 'the readiness dial reads bank answers only');
  assert.equal(me.badgeStats().topics, 0, 'a sign answer is no DVSA topic');
  assert.equal(me.badgeStats().answered, 2, 'but it is a question answered');
});

// ---------- offline (#44, #48) ----------

test('#48: the bank\'s pictures are precached; every other picture is cached the first time it is seen', () => {
  const sw = read('sw.js');
  const extras = sw.match(/const EXTRAS = \[([\s\S]*?)\];/)[1];
  const core = sw.match(/const CORE = \[([\s\S]*?)\];/)[1];
  const listed = [...extras.matchAll(/'\.\/signs\/([^']+)'/g)].map(m => m[1]);
  // EXTRAS = exactly the pictures bank questions show, so a question keeps its picture offline
  // from the first install; 200+ pictures are NOT fetched on install.
  const used = [...new Set(bank.filter(q => q.imageHint).map(q => TS.get(q.imageHint).file))].sort();
  assert.deepEqual(listed.slice().sort(), used, 'sw.js EXTRAS must list exactly the bank questions\' pictures');
  assert.ok(!core.includes('signs/'), 'a picture in CORE would fail the whole install if it did not arrive');
});

test('#48: the service worker keeps a same-origin picture the first time it is fetched', async () => {
  // Run sw.js's own fetch handler with a stand-in cache and network.
  const handlers = {}, stored = [];
  const cache = { put: (req, res) => { stored.push(req.url); return Promise.resolve(); } };
  const ctx = {
    self: { addEventListener: (k, fn) => { handlers[k] = fn; }, registration: {}, skipWaiting() {}, clients: {} },
    location: { origin: 'https://example.test' }, URL, Promise, setTimeout,
    caches: { match: () => Promise.resolve(undefined), open: () => Promise.resolve(cache), keys: () => Promise.resolve([]) },
    fetch: () => Promise.resolve({ ok: true, clone() { return this; } }), Request: function (u) { this.url = u; }, Response: function () {}
  };
  vm.runInNewContext(read('sw.js'), ctx);
  let answered = null;
  const req = { url: 'https://example.test/signs/warning-sign-cattle.jpg', method: 'GET', mode: 'no-cors' };
  handlers.fetch({ request: req, respondWith: p => { answered = p; } });
  assert.ok(answered, 'the picture is answered by the service worker');
  const res = await answered;
  assert.equal(res.ok, true);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(stored, [req.url], 'kept in the cache, so it shows offline next time');
});

// ---------- drawing a picture (#44) ----------

test('#44: SignImage shows the official picture on a white card, named without the answer', () => {
  const el = SignImage({ hint: 'ford', size: 128 });
  assert.equal(el.type, 'div');
  assert.equal(el.props.role, 'img');
  assert.equal(el.props['aria-label'], 'Road sign picture');
  assert.equal(el.props.style.width, 128);
  const html = el.props.dangerouslySetInnerHTML.__html;
  assert.match(html, /^<img src="signs\/554\.jpg" alt="Red-bordered triangle with the word Ford"/);
  assert.match(html, /background:#fff/, 'a white card, so it reads on the dark theme');
  // A #48 picture has no written description: its alt names what it is, never what it means.
  assert.match(SignImage({ hint: 'warning-sign-cattle' }).props.dangerouslySetInnerHTML.__html, /^<img src="signs\/warning-sign-cattle\.jpg" alt="Road sign picture"/);
  assert.equal(SignImage({ hint: 'noSuchSign' }), null, 'an unknown key draws nothing');
  assert.equal(SignImage({ hint: '' }), null);
  assert.equal(TS.get('toString'), null, 'an object\'s own names are not signs');
});

// ---------- the bank's questions and their pictures (#44) ----------

test('#44: a picture that would give the answer away is not on its question', () => {
  // Each asks for a sign's shape or colour, or where coloured studs are, or its picture would
  // carry the answer's own words (SCHOOL KEEP CLEAR; the times plate on a single yellow line).
  // Lead review: t11q22's speed-camera sign says the answer and isn't the yellow box it asks
  // about; t11q14's brown "Model village" sign says "tourist"; t11q20 asks about zigzag lines
  // and the zebra sign shows none.
  for (const id of ['t11q03', 't11q12', 't11q13', 't11q21', 't11q24', 't09q18', 't09q05', 't09q06', 't09q07', 't11q27', 't10q22', 't11q22', 't11q14', 't11q20']) {
    assert.ok(byId[id], id + ' is not in the bank');
    assert.equal(byId[id].imageHint, undefined, id + ' must not have a picture: it would show the answer');
  }
});

test('#44: the questions that describe a sign now show it (official DfT or Highway Code picture)', () => {
  const want = { t08q17: 'ford', t09q26: 'speed50', t10q18: 'clearway', t11q18: 'cyclesOnly', t11q23: 'turnLeft',
    t09q13: 'motorwayAdvised', t11q26: 'levelCrossingLights',
    t09q22: 'motorwayLimit', t10q04: 'doubleYellow', t10q10: 'centreLine', t05q26: 'roadWorks',
    t10q27: 'levelCrossing', t10q24: 'zebra', t10q13: 'lightAmber', t11q10: 'lightGreen', t11q11: 'lightRedAmber' };
  for (const [id, key] of Object.entries(want)) assert.equal(byId[id].imageHint, key, id);
  assert.equal(TS.get('ford').diagram, '554');
  assert.equal(TS.get('ford').meaning, 'Ford warning sign', 'the DfT spreadsheet\'s own words');
});

test('#44: the SQL for the live bank sets exactly what the question files say', () => {
  const sql = read('supabase/data/2026-09-25-sign-images.sql');
  const rows = [...sql.matchAll(/^update public\.questions set sign = (null|'(\w+)') where qid = '(t\d\dq\d\d)';/gm)];
  assert.ok(rows.length >= 20, 'expected an update per changed question');
  for (const [, , key, qid] of rows) {
    assert.ok(byId[qid], qid + ' is not in the bank');
    assert.equal(byId[qid].imageHint, key, qid + ': the SQL and questions-*.json disagree');
    if (key) assert.ok(TS.has(key), qid + ': ' + key + ' is not in the map');
  }
});

// ---------- the app reads the map (#44, #48) ----------

test('#48: the app builds Road Signs, its quizzes and the editor list from the map, not from code', () => {
  const app = read('Theory Trainer.dc.html');
  assert.ok(!app.includes('SIGNMETA'), 'the hand-written sign list is back');
  // The sign question's words live in signs.js with the map: the app writes none of its own.
  assert.ok(!app.includes('What does this sign mean?'), 'questions made up in code are back');
  assert.ok(!/signBank\(/.test(app), 'the made-up sign bank is back');
  assert.match(app, /signSections: \(view!=='signs' \|\| !window\.TTSigns\) \? \[\] : TTSigns\.sections\(\)/);
  assert.match(app, /startSignPractice: \(\)=>this\.signQuiz\(null, 'Road signs'\)/);
  assert.match(app, /signQuiz\(cat, label\)\{ if\(window\.TTSigns\) this\.buildSession\(TTSigns\.quizIds\(cat\), label, \{signs:true\}\); \}/);
  assert.match(app, /signOpts: \[\{v:'', label:'none'\}\]\.concat\(\(window\.TTSigns \? TTSigns\.list : \[\]\)/);
  // A sign question comes from signs.js; everything else from the bank.
  assert.match(app, /sessionQ\(id\)\{ return \(window\.TTSigns && TTSigns\.question\(id\)\) \|\| this\.qById\(id\); \}/);
  // signs.js loads from the real head (TTSigns is needed before any picture is drawn), once.
  const head = app.slice(0, app.indexOf('</head>'));
  assert.ok(head.includes('<script src="./signs.js"></script>'), 'signs.js is not loaded from the page head');
  assert.ok(!app.includes('from="./signs.js"'), 'an x-import would load signs.js a second time');
});

test('#48: the flag, "More like this" and the topic tip stay off sign questions', () => {
  // Flags live with the bank's questions (Flagged, Focus Drill, the coach): a sign question has no
  // bank record, so it has no flag. "More like this" finds bank questions, not signs.
  const app = read('Theory Trainer.dc.html');
  const learnQ = app.slice(app.indexOf('<!-- ============ LEARN QUESTION ============ -->'), app.indexOf('<!-- ============ LEARN DONE ============ -->'));
  assert.match(learnQ, /<sc-if value="\{\{ qFlagShow \}\}"[^>]*>\s*<button onClick="\{\{ toggleQFlag \}\}"/);
  assert.match(app, /qFlagShow: !isSign,/);
  assert.match(app, /moreShow: answered && !isSign && sess\.moreFor!==q\.id,/);
  assert.match(app, /doneTipShow: !!\(sess && doneAsked>0 && !sess\.signs\)/);
});

test('#48: one credit for the DfT and Highway Code pictures, on Road Signs, about and help', () => {
  assert.equal(TS.credit, 'Road sign, road marking, light signal and vehicle marking images: Crown copyright, Department for Transport and The Highway Code. Contains public sector information licensed under the Open Government Licence v3.0.');
  const app = read('Theory Trainer.dc.html');
  const signs = app.slice(app.indexOf('<!-- ============ SIGNS ============ -->'), app.indexOf('<!-- ============ TEST INTRO ============ -->'));
  assert.match(signs, /\{\{ signCredit \}\}/);
  assert.match(signs, /<a href="\{\{ signLicenceUrl \}\}"/);
  for (const page of ['about.html', 'help.html']) {
    const html = read(page);
    assert.ok(html.includes(TS.credit), page + ' does not carry the credit');
    assert.ok(html.includes('href="' + TS.licenceUrl + '"'), page + ' does not link the licence');
  }
});

test('#48: the How-to guide names the categories and the sign worlds as the code has them', () => {
  const guide = read('help.html');
  const sec = id => guide.slice(guide.indexOf('<section id="' + id + '"'), guide.indexOf('</section>', guide.indexOf('<section id="' + id + '"')));
  // Road signs: every category, by its page heading, and both quizzes by their button words.
  for (const c of TS.categories) assert.ok(sec('signs').includes(c.name), 'help.html #signs does not name ' + c.name);
  for (const b of ['Quiz me on all signs', 'Quiz me on this category', 'asks 20 signs', 'up to ' + TS.quizSize]) assert.ok(sec('signs').includes(b), 'help.html #signs should say "' + b + '"');
  // Adventure: the sign worlds' numbers follow the 14 topic worlds, one per category.
  const coach = require('../coach.js'), first = coach.TOPIC_NAMES.length + 1;
  assert.ok(sec('adventure').includes('worlds ' + first + ' to ' + (first + TS.categories.length - 1)), 'help.html #adventure should number the sign worlds');
});
