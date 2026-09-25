// Road-sign pictures (issue #44) — the one map in signs.js, the files it names, the bank's
// sign values, the offline list in sw.js, the signs quiz and the credit the licence asks for.
// No browser needed. Run with:  node --test
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

test('#44: every question\'s sign value is a picture the map can show', () => {
  // Found 2026-09-25: a sign value with no drawing showed nothing, silently.
  const bad = bank.filter(q => q.imageHint && !TS.has(q.imageHint)).map(q => q.id + ' (' + q.file + '): ' + q.imageHint);
  assert.deepEqual(bad, [], 'these questions name a sign signs.js cannot show');
});

test('#44: every picture in the map is a real file, and every file in signs/ is in the map', () => {
  const keys = TS.list.map(s => s.key), files = TS.list.map(s => s.file);
  assert.equal(new Set(keys).size, keys.length, 'two entries share a key');
  assert.equal(new Set(files).size, files.length, 'two entries share a file');
  for (const f of files) assert.ok(fs.existsSync(path.join(root, 'signs', f)), 'signs/' + f + ' is missing');
  // Nothing unused in the folder: every byte in signs/ is downloaded by every install.
  for (const f of fs.readdirSync(path.join(root, 'signs'))) assert.ok(files.includes(f), 'signs/' + f + ' is not in the map — delete it');
  // Small enough to cache offline: at most 400 px on the long side (JPEG size read from the file).
  for (const f of files) {
    const b = fs.readFileSync(path.join(root, 'signs', f));
    let i = 2, w = 0, h = 0;
    while (i < b.length) {
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xC0 && marker <= 0xC3) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + len;
    }
    assert.ok(w > 0 && h > 0, f + ': could not read its size');
    assert.ok(Math.max(w, h) <= 400, f + ' is ' + w + 'x' + h + ': scale it to 400 px or less');
  }
});

test('#44: every entry says where it came from, what it means officially, and what it looks like', () => {
  for (const s of TS.list) {
    for (const f of ['key', 'file', 'source', 'url', 'page', 'name', 'meaning', 'alt']) {
      assert.ok(typeof s[f] === 'string' && s[f].trim(), s.key + ' has no ' + f);
    }
    assert.ok(s.source in TS.sources, s.key + ': unknown source ' + s.source);
    assert.match(s.url, /^https:\/\/assets\.(publishing\.service|digital\.cabinet-office)\.gov\.uk\//, s.key + ': not copied from GOV.UK');
    assert.match(s.page, /^https:\/\/www\.gov\.uk\/guidance\//, s.key + ': no GOV.UK page to check it against');
    // A DfT sign carries its diagram number; a Highway Code picture has none.
    if (s.source === 'dft') assert.match(s.diagram || '', /^\d+(\.\d+)?$/, s.key + ': no DfT diagram number');
    else assert.equal(s.diagram, undefined, s.key + ': a Highway Code picture has no diagram number');
  }
});

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

test('#44: every picture works offline — in sw.js EXTRAS (best effort), never in CORE', () => {
  const sw = read('sw.js');
  const extras = sw.match(/const EXTRAS = \[([\s\S]*?)\];/)[1];
  const core = sw.match(/const CORE = \[([\s\S]*?)\];/)[1];
  const listed = [...extras.matchAll(/'\.\/signs\/([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(listed.slice().sort(), plain(TS.list.map(s => s.file)).sort(), 'sw.js EXTRAS and signs.js disagree');
  assert.ok(!core.includes('signs/'), 'a picture in CORE would fail the whole install if it did not arrive');
});

test('#44: SignImage shows the official picture on a white card, named without the answer', () => {
  const el = SignImage({ hint: 'ford', size: 128 });
  assert.equal(el.type, 'div');
  assert.equal(el.props.role, 'img');
  assert.equal(el.props['aria-label'], 'Road sign picture');
  assert.equal(el.props.style.width, 128);
  const html = el.props.dangerouslySetInnerHTML.__html;
  assert.match(html, /^<img src="signs\/554\.jpg" alt="Red-bordered triangle with the word Ford"/);
  assert.match(html, /background:#fff/, 'a white card, so it reads on the dark theme');
  assert.equal(SignImage({ hint: 'noSuchSign' }), null, 'an unknown key draws nothing');
  assert.equal(SignImage({ hint: '' }), null);
  assert.equal(TS.get('toString'), null, 'an object\'s own names are not signs');
});

test('#44: the signs quiz is bank questions with a picture, shuffled, at most 20', () => {
  // A fixed "random" so the order is the same every run.
  let n = 0; const rnd = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const qs = bank.filter(q => q.file !== 'questions-free.json');
  const ids = TS.quizIds(qs, rnd);
  assert.equal(ids.length, Math.min(TS.quizSize, qs.filter(q => TS.has(q.imageHint)).length));
  assert.equal(TS.quizSize, 20);
  for (const id of ids) assert.ok(TS.has(byId[id].imageHint), id + ' has no picture');
  assert.equal(new Set(ids).size, ids.length, 'a question twice');
  // Fewer than 20 with a picture: all of them, nothing made up to fill the gap.
  const few = [{ id: 'a', imageHint: 'stop' }, { id: 'b' }, { id: 'c', imageHint: 'ford' }, { id: 'd', imageHint: 'nope' }];
  assert.deepEqual(plain(TS.quizIds(few, rnd)).sort(), ['a', 'c']);
  assert.deepEqual(plain(TS.quizIds([], rnd)), []);
});

test('#44: the app builds Road Signs, the quiz and the editor list from the map, not from code', () => {
  const app = read('Theory Trainer.dc.html');
  assert.ok(!app.includes('SIGNMETA'), 'the hand-written sign list is back');
  assert.ok(!app.includes('What does this sign mean?'), 'questions made up in code are back');
  assert.ok(!/signBank\(/.test(app), 'the made-up sign bank is back');
  assert.match(app, /signTiles: \(window\.TTSigns \? TTSigns\.list : \[\]\)/);
  assert.match(app, /startSignPractice: \(\)=>\{ if\(window\.TTSigns\) this\.buildSession\(TTSigns\.quizIds\(this\.questions\(\)\), 'Road signs'\); \}/);
  assert.match(app, /signOpts: \[\{v:'', label:'none'\}\]\.concat\(\(window\.TTSigns \? TTSigns\.list : \[\]\)/);
  // signs.js loads from the real head (TTSigns is needed before any picture is drawn), once.
  const head = app.slice(0, app.indexOf('</head>'));
  assert.ok(head.includes('<script src="./signs.js"></script>'), 'signs.js is not loaded from the page head');
  assert.ok(!app.includes('from="./signs.js"'), 'an x-import would load signs.js a second time');
});

test('#44: the credit the Open Government Licence asks for is on Road Signs, about and help', () => {
  const credits = plain(TS.credits());
  assert.deepEqual(credits, [
    'Road sign images: Crown copyright, Department for Transport. Contains public sector information licensed under the Open Government Licence v3.0.',
    'Road marking and light signal images: Crown copyright, The Highway Code. Contains public sector information licensed under the Open Government Licence v3.0.']);
  const app = read('Theory Trainer.dc.html');
  const signs = app.slice(app.indexOf('<!-- ============ SIGNS ============ -->'), app.indexOf('<!-- ============ TEST INTRO ============ -->'));
  assert.match(signs, /<sc-for list="\{\{ signCredits \}\}" as="c"[^>]*><p[^>]*>\{\{ c\.text \}\}<\/p><\/sc-for>/);
  assert.match(signs, /<a href="\{\{ signLicenceUrl \}\}"/);
  for (const page of ['about.html', 'help.html']) {
    const html = read(page);
    for (const c of credits) assert.ok(html.includes(c), page + ' does not carry: ' + c);
    assert.ok(html.includes('href="' + TS.licenceUrl + '"'), page + ' does not link the licence');
  }
});
