// Checks on the How-to guide (help.html) and the legal drafts (legal/*.html) — no browser
// needed. Run with:  node --test
//
// Three kinds of check:
//   1. help/site.js behaves (theme from tt.theme, figures from config.js).
//   2. The pages are sound: every link, anchor and image resolves; every page carries the
//      DVSA disclaimer and links back to the app; the legal drafts invent no contact details.
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
  const ids = ['start', 'learners', 'home', 'lesson', 'tripping', 'practise', 'mock', 'flagged', 'answers',
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

test('legal pages are marked as drafts and invent no contact details', () => {
  for (const p of LEGAL) {
    const s = html[p], w = words(s);
    assert.match(w, /Draft — not yet in force/, p + ' must say it is a draft');
    assert.match(w, /\[[^\]]*to be filled in by Darren\]/, p + ' must leave business details for Darren');
    assert.match(s, /<meta name="robots" content="noindex">/, p + ': drafts stay out of search engines');
    // Never invent a business name, email, phone number or address.
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(w), p + ' contains an email address — use the placeholder');
    assert.ok(!/(\+44|\b0\d{3})[\s\d]{8,}/.test(w), p + ' contains a phone number — use the placeholder');
    assert.ok(!/\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/.test(w), p + ' contains a postcode — use the placeholder');
  }
});

// ---------------------------------------------------------------- 3. no drift from the app

test('every Settings switch in the app is explained in the guide', () => {
  const block = app.slice(app.indexOf('const toggles = ['), app.indexOf('];', app.indexOf('const toggles = [')));
  const names = [...block.matchAll(/\['\w+','([^']+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 6, 'could not read the toggles list from the app');
  for (const n of names) assert.ok(guide.includes(n), 'help.html #settings does not explain "' + n + '"');
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

test('site.css uses the app\'s own dark colours, in both dark-mode rules', () => {
  const css = read('help/site.css');
  const tokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{3,6})/g)].map(m => [m[1], m[2].toLowerCase()]));
  const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
  const between = (a, b) => css.slice(css.indexOf(a), css.indexOf(b, css.indexOf(a)));
  const darkMedia = tokens(between(':root:not([data-theme="light"]) {', '}'));
  const darkSaved = tokens(between(':root[data-theme="dark"] {', '}'));
  const map = app.slice(app.indexOf('var TT_DARK = {'), app.indexOf('};', app.indexOf('var TT_DARK = {')));
  const TT_DARK = Object.fromEntries([...map.matchAll(/'((?:bg|fg|bd)-[0-9a-f]+)':'(#[0-9a-f]+)'/g)].map(m => [m[1], m[2]]));
  // Which of the app's roles each token plays: borders are bd, text colours fg, the rest bg.
  const FG = ['fg', 'muted', 'faint', 'link', 'link-hover', 'good', 'bad', 'amber'];
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
