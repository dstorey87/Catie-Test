// The about page (about.html + about/): its script's behaviour, and checks on its HTML and CSS
// that don't need a browser. Run with:  node --test
// (What it looks like is checked in a real browser at 390px and 1280px, light and dark,
// with tests/browser/harness.js — see STATUS.md, "Pages".)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const about = require('../about/about.js');
const html = read('about.html');
const css = read('about/about.css');
const app = read('Theory Trainer.dc.html');

// config.js as the browser sees it: run it with a stand-in `window` and read TT_CONFIG back.
function loadConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(read('config.js'), sandbox);
  return sandbox.window.TT_CONFIG;
}

// A tiny stand-in for the page, enough for fill(): elements with attributes, text and hidden.
function fakeDoc(els) {
  return {
    querySelectorAll(sel) {
      const attr = sel.slice(1, -1);                 // '[data-fact]' -> 'data-fact'
      return els.filter(e => attr in e.attrs);
    }
  };
}
const el = attrs => ({ attrs, textContent: '', hidden: false, getAttribute(k) { return this.attrs[k]; } });

// ---------- the theme ----------

test('theme: a saved light or dark choice from the app is applied; anything else follows the device', () => {
  assert.equal(about.themeFor('light'), 'light');
  assert.equal(about.themeFor('dark'), 'dark');
  for (const v of ['auto', null, undefined, '', 'DARK', 'purple']) assert.equal(about.themeFor(v), null, String(v));
});

test('theme: applyTheme sets or clears data-theme on <html>, and survives blocked storage', () => {
  const attrs = {};
  const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; } } };
  assert.equal(about.applyTheme(doc, { getItem: () => 'dark' }), 'dark');
  assert.equal(attrs['data-theme'], 'dark');
  assert.equal(about.applyTheme(doc, { getItem: () => 'auto' }), null);
  assert.equal('data-theme' in attrs, false);
  // Private browsing can make storage throw: the page must still load, following the device.
  assert.equal(about.applyTheme(doc, { getItem: () => { throw new Error('SecurityError'); } }), null);
  assert.equal(about.applyTheme(doc, null), null);
});

test('theme: the key read is the one the app saves its Appearance choice under', () => {
  assert.match(app, /localStorage\.setItem\('tt\.theme'/);
  assert.match(read('about/about.js'), /getItem\('tt\.theme'\)/);
});

// ---------- prices ----------

test('prices: come from config.js exactly as written there', () => {
  const cfg = loadConfig();
  const facts = about.priceFacts(cfg);
  assert.deepEqual(facts, { monthly: cfg.priceMonthly.trim(), annual: cfg.priceAnnual.trim(), trial: String(cfg.trialCount) });
});

test('prices: a missing, blank or nonsense value gives null (the page then shows its fallback)', () => {
  const ok = { priceMonthly: 'M', priceAnnual: 'A', trialCount: 20 };
  assert.ok(about.priceFacts(ok));
  assert.equal(about.priceFacts(null), null);
  assert.equal(about.priceFacts(undefined), null);
  for (const bad of [{ priceMonthly: '' }, { priceMonthly: '   ' }, { priceAnnual: undefined }, { priceAnnual: 50 },
    { trialCount: 0 }, { trialCount: -5 }, { trialCount: 2.5 }, { trialCount: 'twenty' }, { trialCount: undefined }]) {
    assert.equal(about.priceFacts(Object.assign({}, ok, bad)), null, JSON.stringify(bad));
  }
});

test('prices: fill() writes each fact into its place and shows the priced lines', () => {
  const t = el({ 'data-fact': 'trial' }), m = el({ 'data-fact': 'monthly' }), a = el({ 'data-fact': 'annual' });
  const priced = el({ 'data-needs-prices': '' }), fallback = el({ 'data-no-prices': '' });
  priced.hidden = true;
  const shown = about.fill(fakeDoc([t, m, a, priced, fallback]), { monthly: 'M', annual: 'A', trial: '7' });
  assert.equal(shown, true);
  assert.deepEqual([t.textContent, m.textContent, a.textContent], ['7', 'M', 'A']);
  assert.equal(priced.hidden, false);
  assert.equal(fallback.hidden, true);
});

test('prices: with no facts, fill() leaves the fallback showing and the priced lines hidden', () => {
  const t = el({ 'data-fact': 'trial' }), priced = el({ 'data-needs-prices': '' }), fallback = el({ 'data-no-prices': '' });
  assert.equal(about.fill(fakeDoc([t, priced, fallback]), null), false);
  assert.equal(t.textContent, '');
  assert.equal(priced.hidden, true);
  assert.equal(fallback.hidden, false);
});

test('prices: fill() only ever sets text, so a value with markup in it is shown as text', () => {
  const s = read('about/about.js').replace(/\/\/.*$/gm, '');   // code only, not the comments
  assert.doesNotMatch(s, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  const m = el({ 'data-fact': 'monthly' });
  about.fill(fakeDoc([m]), { monthly: '<img src=x onerror=alert(1)>', annual: 'A', trial: '1' });
  assert.equal(m.textContent, '<img src=x onerror=alert(1)>');
});

test('prices: the page hard-codes no price or free-sample size — every one is a slot filled from config.js', () => {
  const cfg = loadConfig();
  assert.doesNotMatch(html, /£|\bGBP\b/, 'a £ price is written into about.html');
  assert.equal(html.includes(cfg.priceMonthly), false);
  assert.equal(html.includes(cfg.priceAnnual), false);
  assert.doesNotMatch(html, /\b\d+\s+(free\s+)?questions\s+free\b|\btry\s+\d+\s+free\b/i, 'a free-sample count is written into about.html');
  // Every slot starts empty, and each priced line has a fallback that needs no JavaScript.
  const slots = [...html.matchAll(/<span data-fact="(\w+)">([^<]*)<\/span>/g)];
  assert.ok(slots.length >= 3);
  for (const [, name, inner] of slots) {
    assert.ok(['monthly', 'annual', 'trial'].includes(name), 'unknown slot ' + name);
    assert.equal(inner, '', 'slot ' + name + ' should start empty');
  }
  const priced = (html.match(/data-needs-prices hidden/g) || []).length;
  const fallback = (html.match(/data-no-prices/g) || []).length;
  assert.ok(priced >= 1 && priced === fallback, 'each priced line needs one fallback line');
  assert.doesNotMatch(html, /data-needs-prices(?! hidden)/, 'a priced line must start hidden, so no-JS visitors never see empty slots');
});

test('prices: the page loads config.js and its own script', () => {
  assert.match(html, /<script src="about\/about\.js"><\/script>/);
  assert.match(html, /<script src="config\.js" defer><\/script>/);
});

// ---------- the page: search, sharing, accessibility ----------

const CANONICAL = 'https://dstorey87.github.io/Catie-Test/about.html';
const meta = (attr, name) => (html.match(new RegExp('<meta ' + attr + '="' + name + '" content="([^"]*)"')) || [])[1];

test('page: exactly one H1, a title, and a description of a sensible length', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  assert.ok(title && title.length <= 60, 'title missing or over 60 characters: ' + title);
  const desc = meta('name', 'description');
  assert.ok(desc && desc.length >= 70 && desc.length <= 160, 'description should be 70-160 characters, is ' + (desc || '').length);
});

test('page: canonical URL and Open Graph tags', () => {
  assert.match(html, new RegExp('<link rel="canonical" href="' + CANONICAL + '">'));
  assert.equal(meta('property', 'og:url'), CANONICAL);
  for (const p of ['og:type', 'og:title', 'og:description', 'og:image', 'og:image:alt', 'og:site_name']) assert.ok(meta('property', p), p + ' missing');
  // The shared picture must be a real file in this repo, at the site's address.
  const img = meta('property', 'og:image');
  assert.ok(img.startsWith('https://dstorey87.github.io/Catie-Test/'));
  assert.ok(fs.existsSync(path.join(root, img.replace('https://dstorey87.github.io/Catie-Test/', ''))), img + ' is not in the repo');
});

test('page: every image has alt text; every screenshot has a real description', () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert.ok(imgs.length > 0);
  for (const tag of imgs) {
    assert.match(tag, /\balt="/, 'no alt: ' + tag);
    // The header logo sits beside the name "Theory Trainer", so it is decorative (alt="").
    // Every other picture is a screenshot and must say what it shows.
    if (!/src="icon-/.test(tag)) assert.match(tag, /\balt="[^"]{20,}"/, 'screenshot needs a real description: ' + tag);
  }
});

test('page: every picture exists, and its width and height match the file', () => {
  const size = f => { const b = fs.readFileSync(path.join(root, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    const src = tag.match(/src="([^"]+)"/)[1];
    assert.ok(fs.existsSync(path.join(root, src)), src + ' is missing');
    const w = Number(tag.match(/width="(\d+)"/)[1]), h = Number(tag.match(/height="(\d+)"/)[1]);
    if (src.startsWith('about/')) assert.deepEqual([w, h], size(src), src + ' width/height attributes do not match the picture');
  }
});

test('page: each screenshot comes as a light and a dark pair, and every picture in about/ is used', () => {
  const light = [...html.matchAll(/class="shot-light" src="about\/([\w-]+)-light\.png"/g)].map(m => m[1]);
  const dark = [...html.matchAll(/class="shot-dark" src="about\/([\w-]+)-dark\.png"/g)].map(m => m[1]);
  assert.ok(light.length >= 4);
  assert.deepEqual(dark, light, 'every light screenshot needs its dark twin right after it');
  const used = new Set([...html.matchAll(/src="about\/([\w.-]+\.png)"/g)].map(m => m[1]));
  const files = fs.readdirSync(path.join(root, 'about')).filter(f => f.endsWith('.png'));
  for (const f of files) assert.ok(used.has(f), 'about/' + f + ' is not used by the page (delete it or show it)');
  // Pictures below the first screen load lazily, so the hidden twin is never downloaded.
  // Only the hero's phone (the first pair) loads at once: it is on screen straight away.
  const shots = [...html.matchAll(/<img class="shot-(?:light|dark)"[^>]*>/g)].map(m => m[0]);
  shots.slice(0, 2).forEach(tag => assert.doesNotMatch(tag, /loading="lazy"/, 'the hero picture should not be lazy'));
  shots.slice(2).forEach(tag => assert.match(tag, /loading="lazy"/, 'not lazy: ' + tag));
});

test('page: the screenshots are exactly the ones about/capture.js takes', () => {
  // So re-running the capture script refreshes every picture, and never leaves one stale.
  const cap = read('about/capture.js');
  const taken = new Set([...cap.matchAll(/snap\(page, '([\w-]+)'/g)].map(m => m[1]).concat(
    [...cap.matchAll(/'([\w-]+)-' \+ theme \+ '\.png'/g)].map(m => m[1])));
  const shown = new Set([...html.matchAll(/src="about\/([\w-]+)-(?:light|dark)\.png"/g)].map(m => m[1]));
  assert.deepEqual([...shown].sort(), [...taken].sort());
});

test('page: "Open the app" goes to the app (keeping the %20), and the guide is linked', () => {
  const open = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Open the app<\/a>/g)].map(m => m[1]);
  assert.ok(open.length >= 1);
  for (const h of open) assert.equal(h, 'Theory%20Trainer.dc.html');
  assert.match(html, /<a [^>]*href="help\.html"[^>]*>How to use it<\/a>/);
});

test('page: says plainly that it is not affiliated with the DVSA', () => {
  assert.match(html, /not affiliated with the DVSA/i);
  assert.match(html, /not the DVSA's official revision question bank/);
});

test('page: every local link and file it loads exists (pages still being built by issue #2 are named)', (t) => {
  // help.html and legal/*.html are built by the help-guide section (issue #2) at the same time.
  const PENDING = { 'help.html': '#2', 'legal/privacy.html': '#2', 'legal/terms.html': '#2' };
  const refs = [...html.matchAll(/\b(?:href|src)="([^"#][^"]*)"/g)].map(m => m[1])
    .filter(u => !/^(https?:|mailto:|data:)/.test(u));
  assert.ok(refs.length > 0);
  for (const u of new Set(refs)) {
    const file = path.join(root, decodeURIComponent(u));
    if (fs.existsSync(file)) continue;
    assert.ok(PENDING[u], u + ' is linked from about.html but does not exist');
    t.diagnostic(u + ' is not on this branch yet: it is built by issue ' + PENDING[u]);
  }
});

// ---------- the CSS: the app's colours, in light and dark ----------

// The declarations inside one CSS block, found by the text just before its "{".
function block(opener) {
  const i = css.indexOf(opener);
  assert.ok(i >= 0, 'CSS block not found: ' + opener);
  const start = css.indexOf('{', i) + 1;
  return css.slice(start, css.indexOf('}', start));
}
const tokens = body => Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

test('css: the two dark blocks (device setting, saved choice) are identical', () => {
  const device = tokens(block(':root:not([data-theme="light"])'));
  const saved = tokens(block(':root[data-theme="dark"]'));
  assert.ok(Object.keys(device).length >= 10);
  assert.deepEqual(saved, device);
});

test('css: every colour used is defined, and every token marked "app" matches the app, light and dark', () => {
  const light = tokens(block(':root {'));
  const dark = tokens(block(':root[data-theme="dark"]'));
  for (const [, name] of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(name in light, name + ' is used but not defined in :root');
  for (const name of Object.keys(dark)) assert.ok(name in light, name + ' has a dark value but no light one');
  // The app's colour map: the light colour is in the key's name, the dark one is the value.
  const map = app.slice(app.indexOf('var TT_DARK = {'), app.indexOf('};', app.indexOf('var TT_DARK = {')));
  const TT_DARK = Object.fromEntries([...map.matchAll(/'((?:bg|fg|bd)-[0-9a-f]+)':'(#[0-9a-f]+)'/g)].map(m => [m[1], m[2]]));
  const marked = [...block(':root {').matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]+);[^\n]*\bapp ((?:bg|fg|bd)-[0-9a-f]+)/g)];
  assert.ok(marked.length >= 10, 'expected the tokens to name the app colour they copy');
  for (const [, name, value, key] of marked) {
    assert.ok(TT_DARK[key], key + ' is not in the app\'s TT_DARK map any more');
    const hex = key.split('-')[1];
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    assert.equal(value.toLowerCase(), '#' + full, name + ' light value drifted from the app (' + key + ')');
    if (name in dark) assert.equal(dark[name].toLowerCase(), TT_DARK[key].toLowerCase(), name + ' dark value drifted from the app');
  }
});

test('css: a screenshot shows in one theme only', () => {
  // Bug found in the browser 2026-09-24: a bare ".shot-dark { display: none }" lost to
  // ".phone img { display: block }", so light mode showed both pictures. The hide rule must
  // start with :root to outrank every "<container> img" layout rule.
  assert.match(css, /^:root \.shot-dark \{ display: none; \}/m);
  assert.doesNotMatch(css, /^\.shot-dark \{/m);
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');            // rules only, not the comments
  for (const [, sel] of code.matchAll(/^([^{}\n]*\bimg\b[^{}\n]*)\{[^}]*display:/gm)) {
    assert.doesNotMatch(sel, /\.shot-/, 'a layout rule should not name .shot-* itself: ' + sel);
    assert.ok(sel.trim().split(/\s+/).length <= 2, 'an img layout rule this specific could outrank the theme rules: ' + sel);
  }
  assert.match(block(':root[data-theme="dark"] .shot-dark'), /display: block/);
  assert.match(block(':root[data-theme="dark"] .shot-light'), /display: none/);
});

test('css: nothing that shares an element with .wrap wipes out its 16px side gutter', () => {
  // Bug found in the browser 2026-09-24: ".hero { padding: 20px 0 48px }" on <div class="wrap hero">
  // set the sides to 0, so the text touched the screen edge at 390px. Such rules must use
  // padding-block (top and bottom only), never the "padding:" shorthand.
  assert.match(block('.wrap {'), /padding: 0 16px/);
  const partners = new Set();
  for (const [, tag, cls] of html.matchAll(/<(\w+)[^>]*\bclass="([^"]*\bwrap\b[^"]*)"/g)) {
    partners.add(tag);
    cls.split(/\s+/).filter(c => c && c !== 'wrap').forEach(c => partners.add('.' + c));
  }
  assert.ok(partners.has('.hero') && partners.has('footer'));
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, sel, body] of code.matchAll(/(?:^|\})\s*([^{}@]+?)\s*\{([^{}]*)\}/g)) {
    if (!partners.has(sel.trim())) continue;
    assert.doesNotMatch(body, /(^|[;\s])padding:/, sel.trim() + ' uses the padding shorthand and would remove .wrap\'s side gutter');
  }
});
