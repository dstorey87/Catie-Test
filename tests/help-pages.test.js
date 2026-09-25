// Checks on the How-to guide (help.html) and the legal drafts (legal/*.html) — no browser
// needed. Run with:  node --test
//
// Three kinds of check:
//   1. help/site.js behaves (theme from tt.theme, figures from config.js).
//   2. The pages are sound: every link, anchor and image resolves; every page carries the
//      DVSA disclaimer and links back to the app; the legal pages carry a sample-policy banner
//      and only obviously-mock business details (example.com, zeros, "(mock)").
//   3. The pages can't drift from the app: settings, prices, coach rules, database tables,
//      storage keys, outside websites and dark-mode colours are read from the app's own
//      files and must match what the pages say. When one fails, the message says which
//      page to update.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const site = require(path.join(root, 'help', 'site.js'));

const PAGES = ['help.html', 'legal/privacy.html', 'legal/terms.html', 'legal/cookies.html', 'legal/refunds.html'];
const LEGAL = PAGES.filter(p => p.startsWith('legal/'));
const html = Object.fromEntries(PAGES.map(p => [p, read(p)]));
const app = read('Theory Trainer.dc.html');

// Visible words of a page: tags removed, entities for quotes/ampersands turned back.
const words = s => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const guide = words(html['help.html']);

// A stand-in for document.documentElement: just enough for applyTheme.
function fakeRoot() {
  const attrs = {};
  return { attrs, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; } };
}
const store = v => ({ getItem: k => (k === 'tt.theme' ? v : null) });

// ---------------------------------------------------------------- 1. site.js

test('site.js: the app\'s saved theme choice is applied to the page', () => {
  for (const [saved, attr] of [['dark', 'dark'], ['light', 'light'], ['auto', undefined], [null, undefined], ['purple', undefined]]) {
    const el = fakeRoot();
    el.attrs['data-theme'] = 'left-over';                     // a stale value must not survive
    site.applyTheme(el, store(saved));
    assert.equal(el.attrs['data-theme'], attr, 'tt.theme=' + saved);
  }
  assert.equal(site.THEME_KEY, 'tt.theme', 'must read the same key the app writes (ttApplyTheme)');
  assert.ok(app.includes("localStorage.setItem('tt.theme'"), 'the app no longer saves tt.theme — update help/site.js');
});

test('site.js: blocked or missing storage falls back to following the device', () => {
  const el = fakeRoot();
  const throwing = { getItem() { throw new Error('SecurityError'); } };
  assert.equal(site.applyTheme(el, throwing), 'auto');
  assert.equal(el.attrs['data-theme'], undefined);
  assert.equal(site.savedTheme(null), 'auto');
});

test('site.js: figures are copied from config into [data-config] elements, as text only', () => {
  const els = ['priceMonthly', 'priceAnnual', 'trialCount', 'missing', 'blank', 'object']
    .map(k => ({ key: k, textContent: 'fallback', getAttribute: () => k }));
  const doc = { querySelectorAll: sel => (sel === '[data-config]' ? els : []) };
  const n = site.fillConfig(doc, { priceMonthly: '£9 a month', priceAnnual: '<b>x</b>', trialCount: 20, blank: '  ', object: { a: 1 } });
  assert.equal(n, 3);
  assert.deepEqual(els.map(e => e.textContent), ['£9 a month', '<b>x</b>', '20', 'fallback', 'fallback', 'fallback']);
  assert.equal(site.fillConfig(null, {}), 0);
  assert.equal(site.fillConfig(doc, undefined), 0);
  // Nested settings, such as the age rule: TT_CONFIG.age.guardianUnder.
  const age = [{ textContent: '16', getAttribute: () => 'age.guardianUnder' }, { textContent: 'x', getAttribute: () => 'age.nope.deeper' }];
  site.fillConfig({ querySelectorAll: () => age }, { age: { guardianUnder: 18 } });
  assert.deepEqual(age.map(e => e.textContent), ['18', 'x']);
  assert.equal(site.configValue({ a: { b: 0 } }, 'a.b'), 0);
  assert.equal(site.configValue({ a: 1 }, 'a.b'), undefined);
  assert.equal(site.configValue({}, 'toString'), undefined, 'must not read inherited properties');
});

test('site.js: the contents open beside the page on wide screens and start closed on phones', () => {
  const d = [{ open: true }, { open: false }];
  const doc = { querySelectorAll: sel => (sel === 'details[data-open-wide]' ? d : []) };
  assert.equal(site.openWide(doc, true), 2);
  assert.deepEqual(d.map(x => x.open), [true, true]);
  site.openWide(doc, false);
  assert.deepEqual(d.map(x => x.open), [false, false]);
  assert.equal(site.openWide(null, true), 0);
  // The width where the contents open must be the width where site.css puts them beside the page.
  const css = read('help/site.css');
  const media = css.slice(css.lastIndexOf('@media', css.indexOf('.toc { position: sticky')), css.indexOf('.toc { position: sticky'));
  assert.ok(media.includes('@media ' + site.WIDE), 'site.js WIDE ' + site.WIDE + ' ≠ the site.css media rule for the sticky contents');
  assert.ok(html['help.html'].includes('<details data-open-wide'), 'help.html contents should use data-open-wide');
});

// ---------------------------------------------------------------- 2. the pages are sound

test('every page: English, titled, phone-ready, app colours, theme set before drawing', () => {
  for (const [p, s] of Object.entries(html)) {
    const up = p.startsWith('legal/') ? '../' : '';
    assert.match(s, /<html lang="en-GB">/, p);
    assert.match(s, /<title>[^<]{5,}<\/title>/, p + ' has no title');
    assert.match(s, /<meta name="viewport" content="width=device-width, initial-scale=1/, p);
    assert.match(s, /<meta name="theme-color" content="#0E7C6B">/, p);
    const head = s.slice(0, s.indexOf('</head>'));
    const css = head.indexOf('href="' + up + 'help/site.css"');
    const cfg = head.indexOf('<script src="' + up + 'config.js"></script>');
    const js = head.indexOf('<script src="' + up + 'help/site.js"></script>');
    assert.ok(css > 0 && cfg > 0 && js > 0, p + ' must load site.css, config.js and site.js in <head>');
    assert.ok(cfg < js, p + ': config.js must load before site.js (site.js reads TT_CONFIG)');
  }
});

test('every page links back to the app, keeping the %20 in its address', () => {
  // The %20 is load-bearing (CLAUDE.md): the server allowlists origin + pathname with it.
  for (const [p, s] of Object.entries(html)) {
    const up = p.startsWith('legal/') ? '../' : '';
    assert.ok(s.includes('href="' + up + 'Theory%20Trainer.dc.html"'), p + ' has no link back to the app');
    assert.ok(!/href="[^"]*Theory Trainer\.dc\.html"/.test(s), p + ' links to the app with a raw space');
  }
});

test('every page says it is not affiliated with the DVSA', () => {
  for (const [p, s] of Object.entries(html)) assert.match(words(s), /Not affiliated with the DVSA/i, p);
});

test('every local link, image and #anchor points at something that exists', () => {
  for (const [p, s] of Object.entries(html)) {
    const dir = path.dirname(path.join(root, p));
    for (const [, attr] of s.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(attr)) continue;
      const [file, hash] = attr.split('#');
      const target = file ? path.join(dir, decodeURIComponent(file)) : path.join(root, p);
      assert.ok(fs.existsSync(target), p + ': ' + attr + ' does not exist');
      if (hash) {
        const other = fs.readFileSync(target, 'utf8');
        assert.ok(other.includes('id="' + hash + '"'), p + ': #' + hash + ' is not an id in ' + (file || p));
      }
    }
  }
});

test('every screenshot has alt text, its true size, and every file in help/img is used', () => {
  const used = new Set();
  for (const [p, s] of Object.entries(html)) {
    for (const [tag] of s.matchAll(/<img\b[^>]*>/g)) {
      const src = (tag.match(/src="([^"]+)"/) || [])[1];
      const alt = (tag.match(/alt="([^"]*)"/) || [])[1];
      assert.ok(alt && alt.trim().length > 15, p + ': ' + src + ' needs a real alt text');
      const file = path.join(path.dirname(path.join(root, p)), src);
      const png = fs.readFileSync(file);
      // A PNG's width and height sit at bytes 16-23 of its header.
      const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
      assert.ok(tag.includes('width="' + w + '"') && tag.includes('height="' + h + '"'),
        p + ': ' + src + ' is ' + w + '×' + h + ' — set width/height to match so the page doesn\'t jump');
      used.add(path.basename(file));
    }
  }
  const files = fs.readdirSync(path.join(root, 'help', 'img'));
  for (const f of files) assert.ok(used.has(f), 'help/img/' + f + ' is not used by any page — delete it');
});

test('the guide has a section for every feature in the spec, each in the contents', () => {
  // Issue #2's feature list, as section ids. A feature without its section fails here.
  const ids = ['start', 'learners', 'setup', 'home', 'lesson', 'tripping', 'practise', 'mock', 'flagged', 'answers',
    'signs', 'progress', 'print', 'settings', 'reminders', 'notes', 'offline', 'install', 'paying',
    'admin', 'activity', 'tips', 'editor', 'access', 'faq', 'about'];
  const s = html['help.html'];
  for (const id of ids) {
    assert.ok(s.includes('<section id="' + id + '"'), 'help.html has no section id="' + id + '"');
    assert.ok(s.includes('<a href="#' + id + '">'), 'the contents has no link to #' + id);
  }
  const faqs = (s.match(/<details>\s*<summary>/g) || []).length;
  assert.ok(faqs >= 10, 'the FAQ should answer at least 10 questions, has ' + faqs);
});

// The legal pages carry MOCK business details (issue #21: "I don't have a business, put in
// mock values for now"). While they do, a banner says so at the top of every page. The two
// go together: the banner comes off only when every "(mock)" value has been replaced with a
// real one, and then these checks stop demanding mock values.
const BANNER = /<div class="draft" role="note">([\s\S]*?)<\/div>/;
const MOCK_EMAIL_HOST = 'example.com';          // reserved for examples (RFC 2606): reaches no one

test('legal pages: no "to be filled in" placeholder is left', () => {
  for (const p of LEGAL) {
    const w = words(html[p]);
    assert.ok(!/\[[^\]]*(Darren|to be (?:\w+ and )?(?:filled|checked|decided))[^\]]*\]/i.test(w),
      p + ' still has a placeholder: ' + (w.match(/\[[^\]]*\]/) || [''])[0]);
    assert.match(html[p], /<meta name="robots" content="noindex">/, p + ': sample policies stay out of search engines');
  }
});

test('legal pages: the same sample-policy banner sits at the top of every page (or of none)', () => {
  // None = real details are in and the banner has come off everywhere; the next test makes
  // sure no "(mock)" value is left behind when it does.
  const up = LEGAL.filter(p => BANNER.test(html[p]));
  if (up.length === 0) return;
  assert.deepEqual(up, LEGAL, 'the banner is on ' + up.join(', ') + ' only — put it on every legal page, or on none');
  const banners = LEGAL.map(p => {
    const s = html[p], m = s.match(BANNER);
    assert.ok(m, p + ' has no <div class="draft" role="note"> banner');
    const main = s.indexOf('<main'), first = s.indexOf('<section', main);
    assert.ok(main > 0 && s.indexOf(m[0]) > main && s.indexOf(m[0]) < first, p + ': the banner must come before the first section');
    const w = words(m[1]);
    for (const must of ['Sample policy with mock details', 'family project, not a registered business', 'before charging anyone', '(mock)'])
      assert.ok(w.includes(must), p + ': the banner must say "' + must + '"');
    return m[1].trim();
  });
  for (let i = 1; i < banners.length; i++) assert.equal(banners[i], banners[0], LEGAL[i] + ': banner differs from ' + LEGAL[0] + ' — keep them identical');
});

test('legal pages: while the banner is up, every business detail is an obvious mock', () => {
  for (const p of LEGAL) {
    const s = html[p], w = words(s), hasBanner = BANNER.test(s), hasMock = /\(mock\b/.test(w);
    assert.equal(hasBanner, hasMock, p + (hasBanner ? ': banner says mock details, but none is marked (mock)' : ': a "(mock)" value is left but the banner has gone'));
    if (!hasMock) continue;
    // Emails: only the reserved example domain, each marked (mock).
    for (const [addr, host] of w.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)) {
      assert.equal(host.toLowerCase(), MOCK_EMAIL_HOST, p + ': ' + addr + ' is not a reserved example address');
    }
    // Every highlighted value is labelled as mock, so nothing on the page passes for real.
    for (const [, inner] of s.matchAll(/<span class="fill">([\s\S]*?)<\/span>/g))
      assert.match(words(inner), /\(mock\b/, p + ': highlighted value "' + words(inner).trim() + '" is not labelled (mock)');
    // Registration numbers are all zeros.
    for (const [n] of w.matchAll(/\b\d{8}\b/g)) assert.equal(n, '00000000', p + ': ' + n + ' looks like a real company number');
    for (const [n] of w.matchAll(/\bZ[A-Z]\d{6}\b/g)) assert.equal(n, 'ZA000000', p + ': ' + n + ' looks like a real ICO registration');
    // Nothing that could reach a real person or place.
    assert.ok(!/(\+44|\b0\d{3})[\s\d]{8,}/.test(w), p + ' contains a phone number');
    assert.ok(!/\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/.test(w), p + ' contains a postcode');
  }
  // The pages that name the operator give the whole mock set (the privacy notice also the ICO number).
  const OPERATOR = ['Theory Trainer (mock operator — not a registered business)', 'support@' + MOCK_EMAIL_HOST, '00000000 (mock)'];
  for (const [p, extra] of [['legal/privacy.html', ['ZA000000 (mock)']], ['legal/terms.html', []]]) {
    const w = words(html[p]);
    if (!/\(mock\b/.test(w)) continue;
    for (const must of OPERATOR.concat(extra)) assert.ok(w.includes(must), p + ' should name "' + must + '"');
  }
});

test('legal pages: the guardian-consent age is read from config.js, never typed', () => {
  // config.js → TT_CONFIG.age.guardianUnder is the one place the age lives.
  const box = { window: {} };
  vm.runInNewContext(read('config.js'), box);
  const age = box.window.TT_CONFIG.age.guardianUnder;
  const typed = new RegExp('(?:under|younger than|aged?) ' + age + '\\b', 'i');
  for (const p of ['legal/privacy.html', 'legal/terms.html']) {
    const s = html[p];
    assert.ok(s.includes('data-config="age.guardianUnder"'), p + ' must show the age with data-config="age.guardianUnder"');
    assert.ok(!typed.test(s), p + ' types the age ' + age + ' instead of reading it from config.js');
  }
});

test('the privacy notice\'s "deleted with the account" is true of every table that holds personal data', () => {
  const sql = read('supabase/schema.sql') + read('supabase/schema-notifications.sql');
  const blocks = [...sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)];
  assert.ok(blocks.length >= 6, 'could not read the tables from the schema');
  for (const [, t, body] of blocks) {
    if (t === 'questions') continue;                            // the question bank: not personal data
    assert.match(body, /references auth\.users on delete cascade/, t + ' is not deleted with its account — legal/privacy.html "How long it is kept" is wrong');
  }
  assert.match(words(html['legal/privacy.html']), /kept for as long as the account exists/, 'legal/privacy.html should state the retention rule');
});

// ---------------------------------------------------------------- 3. no drift from the app

test('every Settings switch in the app is explained in the guide', () => {
  const block = app.slice(app.indexOf('const toggles = ['), app.indexOf('];', app.indexOf('const toggles = [')));
  const names = [...block.matchAll(/\['\w+','([^']+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 6, 'could not read the toggles list from the app');
  for (const n of names) assert.ok(guide.includes(n), 'help.html #settings does not explain "' + n + '"');
});

test('the quick setup section names every daily goal and reminder time the app offers', () => {
  // One list in the app (TTWelcome) feeds both the quick setup and Settings.
  const goals = (app.match(/W\.GOALS = \[([^\]]+)\]/) || [])[1];
  const times = [...((app.match(/W\.REMIND_TIMES = \[([^\]]+)\]/) || [])[1] || '').matchAll(/label:'([^']+)'/g)].map(m => m[1]);
  assert.ok(goals && times.length, 'could not read TTWelcome.GOALS / REMIND_TIMES from the app');
  const s = html['help.html'], setup = words(s.slice(s.indexOf('<section id="setup"'), s.indexOf('</section>', s.indexOf('<section id="setup"'))));
  const g = goals.split(',').map(x => x.trim());
  assert.ok(setup.includes(g.slice(0, -1).join(', ') + ' or ' + g[g.length - 1]), 'help.html #setup should list the goals ' + g.join(', '));
  for (const t of times) assert.ok(setup.includes(t), 'help.html #setup does not name the reminder time ' + t);
});

test('prices and the free-sample size on the pages match config.js', () => {
  const box = { window: {} };
  vm.runInNewContext(read('config.js'), box);
  const cfg = box.window.TT_CONFIG;
  let seen = 0;
  for (const [p, s] of Object.entries(html)) {
    for (const [, key, text] of s.matchAll(/data-config="([\w.]+)">([^<]*)</g)) {
      const v = site.configValue(cfg, key);
      assert.ok(v !== undefined, p + ': data-config="' + key + '" is not a config.js setting');
      assert.equal(text, String(v), p + ': the fallback for ' + key + ' is out of date with config.js');
      seen++;
    }
  }
  assert.ok(seen >= 6, 'expected the prices on several pages, found ' + seen);
});

test('the guide\'s Today\'s lesson rules match coach.js', () => {
  const D = require(path.join(root, 'coach.js')).drillDefaults;
  const times = { 1: 'once', 2: 'twice', 3: 'three times' };
  const expect = [
    'wrong ' + D.stuckMisses + ' or more times',
    'on ' + D.stuckDays + ' different days',
    'right ' + times[D.unstuckRun] + ' running',
    'at most ' + D.newMax + ' questions you haven\'t seen',
    'comes back ' + D.requeueGap + ' questions later (at most ' + times[D.requeueMax] + ')',
    D.gapDays[1] + ' day later; then ' + D.gapDays.slice(2, -1).join(' days, ') + ' days and ' + D.gapDays[D.gapDays.length - 1] + ' days'
  ];
  for (const e of expect) assert.ok(guide.includes(e), 'coach.js changed — help.html #lesson should say: "' + e + '"');
});

test('the privacy notice names every table in the database', () => {
  const sql = read('supabase/schema.sql') + read('supabase/schema-notifications.sql');
  const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map(m => m[1]);
  assert.ok(tables.includes('events'));
  for (const t of tables) assert.ok(html['legal/privacy.html'].includes('<code>' + t + '</code>'), 'legal/privacy.html does not describe the ' + t + ' table');
});

test('the cookies page lists every key the app saves in the browser', () => {
  const code = app + read('backend.js') + read('support.js');
  const keys = new Set([...code.matchAll(/'((?:tt|theoryTrainer)\.[\w.]*\w)'/g)].map(m => m[1]));
  // Keys the app builds from a prefix: theoryTrainer + '.users' / '.active' / '.content' / '.d.' + id
  for (const k of ['users', 'active', 'content']) if (app.includes("this.BASE+'." + k + "'")) keys.add('theoryTrainer.' + k);
  const page = html['legal/cookies.html'];
  assert.ok(keys.size >= 10, 'could not read the storage keys from the app');
  for (const k of keys) assert.ok(page.includes('<code>' + k + '</code>'), 'legal/cookies.html does not list ' + k);
  assert.ok(page.includes('<code>theoryTrainer.d.</code>'), 'legal/cookies.html does not list the per-learner key');
});

test('the cookies and privacy pages name every outside website the app loads from', () => {
  const code = app + read('support.js');
  // Hosts in real script/style addresses (not the example hosts in comments).
  const hosts = new Set([...code.matchAll(/(?:src=|href=|_URL = )"https:\/\/([\w.-]+)\//g)].map(m => m[1]));
  hosts.add('supabase.co');                                   // backend.js talks to the project in config.js
  assert.ok(hosts.has('unpkg.com') && hosts.has('fonts.googleapis.com'), 'could not read the app\'s outside hosts');
  for (const h of hosts) {
    const domain = h.split('.').slice(-2).join('.');
    assert.ok(html['legal/cookies.html'].includes(domain), 'legal/cookies.html does not name ' + domain);
    assert.ok(html['legal/privacy.html'].includes(domain), 'legal/privacy.html does not name ' + domain);
  }
});

// site.css's colour tokens, as {name: '#hex'}, in each of its three blocks: light, dark by the
// device's setting, and dark by the app's saved choice.
const CSS = read('help/site.css');
const cssTokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{3,6})/g)].map(m => [m[1], m[2].toLowerCase()]));
const cssBetween = (a, b) => CSS.slice(CSS.indexOf(a), CSS.indexOf(b, CSS.indexOf(a)));
const THEME = {
  light: cssTokens(CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {')))),
  darkMedia: cssTokens(cssBetween(':root:not([data-theme="light"]) {', '}')),
  darkSaved: cssTokens(cssBetween(':root[data-theme="dark"] {', '}'))
};
// The body of the first rule written exactly "<selector> {" in site.css.
function cssRule(sel) {
  const at = CSS.indexOf('\n' + sel + ' {');
  assert.ok(at >= 0, 'site.css has no rule "' + sel + ' {"');
  return CSS.slice(at, CSS.indexOf('}', at));
}

test('site.css uses the app\'s own dark colours, in both dark-mode rules', () => {
  const { light, darkMedia, darkSaved } = THEME;
  const map = app.slice(app.indexOf('var TT_DARK = {'), app.indexOf('};', app.indexOf('var TT_DARK = {')));
  const TT_DARK = Object.fromEntries([...map.matchAll(/'((?:bg|fg|bd)-[0-9a-f]+)':'(#[0-9a-f]+)'/g)].map(m => [m[1], m[2]]));
  // Which of the app's roles each token plays: borders are bd, text colours fg, the rest bg.
  const FG = ['fg', 'muted', 'faint', 'link', 'link-hover', 'on-tint', 'good', 'bad', 'amber'];
  const role = t => (t.startsWith('border') ? 'bd' : FG.includes(t) ? 'fg' : 'bg');
  let checked = 0;
  for (const [t, hex] of Object.entries(light)) {
    if (t === 'brand') continue;                               // solid green buttons: same in both themes
    const key = role(t) + '-' + hex.slice(1).replace(/^fff(fff)?$/, 'fff');
    assert.ok(TT_DARK[key], '--' + t + ' ' + hex + ' is not one of the app\'s colours (no TT_DARK ' + key + ')');
    assert.equal(darkMedia[t], TT_DARK[key], '--' + t + ': the device-dark value must be the app\'s ' + TT_DARK[key]);
    assert.equal(darkSaved[t], TT_DARK[key], '--' + t + ': the saved-dark value must be the app\'s ' + TT_DARK[key]);
    checked++;
  }
  assert.ok(checked >= 15, 'only ' + checked + ' colours checked');
});

// ---------- Issue #32: the findings the #10 accessibility audit handed to the Pages lane (axe-core
// on every page at 390px and 1280px, light and dark). Each test failed before its fix. ----------
const { contrast } = require('./contrast.js');

test('#32 pages: words on the teal panels, the contents group labels and code chips reach 4.5:1, light and dark', () => {
  // Found by axe: "Tip:" (and every panel's first bold words) teal on the pale teal panel 4.44:1;
  // "GETTING STARTED" and the other contents labels in --faint 2.2:1 light, 4.0:1 dark; a <code>
  // chip inside grey text on the cookies page took the grey, 4.47:1 on the chip colour.
  // [selector, the background it sits on]. Each must set its own colour: an inherited one
  // changes with whatever the chip or label happens to be put in.
  // (A link in a teal panel, 4.43:1, showed up once the first ones were fixed.)
  const PAIRS = [['.note strong:first-child', 'tint'], ['.note a', 'tint'], ['.num', 'tint'], ['.toc .toc-group', 'card'], ['code', 'chip'], ['.path', 'chip']];
  for (const [sel, bg] of PAIRS) {
    const fg = (cssRule(sel).match(/[{;\s]color:\s*var\(--([\w-]+)\)/) || [])[1];
    assert.ok(fg, sel + ' sets no colour of its own, so it takes the colour of whatever it sits in');
    for (const [theme, t] of Object.entries(THEME)) {
      const r = contrast(t[fg], t[bg]);
      assert.ok(r >= 4.5, theme + ': ' + sel + ' (--' + fg + ' on --' + bg + ') is ' + r.toFixed(2) + ':1, under 4.5:1');
    }
  }
});

test('#32 pages: each page\'s title and introduction are inside <main>, so nothing sits outside a landmark', () => {
  // Found by axe on help.html: the .hero block (the page's <h1> and introduction) came between the
  // header and <main>, in no landmark, and the skip link jumped past the page's own title.
  for (const [p, s] of Object.entries(html)) {
    assert.equal((s.match(/<main\b/g) || []).length, 1, p + ': one <main>');
    const main = s.indexOf('<main'), end = s.indexOf('</main>'), hero = s.indexOf('class="hero"'), h1 = s.indexOf('<h1');
    assert.ok(hero > main && hero < end, p + ': .hero is outside <main>');
    assert.ok(h1 > main && h1 < end, p + ': the <h1> is outside <main>');
    assert.match(s, /<a class="skip" href="#main">/, p + ': the skip link goes to <main>');
  }
});

test('#32 pages: the legal pages are one centred reading column, not a narrow column with a wide empty right side', () => {
  // v12 at 1280px: the notice was 760px wide at the left of a 1120px frame, 424px empty on its right.
  // Now the frame of a legal page (header, notice and footer) is the notice's width plus the
  // frame's own side gutters, centred, so both sides get the same margin.
  const legal = +(cssRule('.legal').match(/max-width:\s*(\d+)px/) || [])[1];
  const reading = +(cssRule('.wrap.reading').match(/max-width:\s*(\d+)px/) || [])[1];
  const gutter = +(cssRule('.wrap').match(/padding:\s*0 (\d+)px/) || [])[1];
  assert.ok(legal > 0 && gutter > 0, 'expected .legal max-width and .wrap side padding');
  assert.equal(reading, legal + 2 * gutter, '.wrap.reading must be the .legal column plus both gutters');
  for (const p of LEGAL) assert.match(html[p], /<div class="wrap reading">/, p + ' does not use the reading frame');
});

test('#32 guide: the Notes section says where the notes button is on a phone and on a wide screen', () => {
  // After #32 it is in the page (at the bottom of each screen) on a phone and on question screens,
  // and floats in the bottom-right corner, beside the page, only on a wide screen. The guide said
  // "the round dark button in the bottom-right corner (on every screen…)".
  const sec = words(html['help.html'].slice(html['help.html'].indexOf('<section id="notes"'), html['help.html'].indexOf('</section>', html['help.html'].indexOf('<section id="notes"'))));
  assert.doesNotMatch(sec, /in the bottom-right corner \(on every screen/);
  assert.match(sec, /My notes/);
  assert.match(sec, /bottom of the screen/);
  assert.match(sec, /wide screen/);
});
