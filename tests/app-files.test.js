// Checks on the app's own files that don't need a browser — run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'Theory Trainer.dc.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// The block of the page between one "===== NAME =====" marker and the next.
function screen(name) {
  const start = app.indexOf('<!-- ============ ' + name + ' ============ -->');
  assert.ok(start >= 0, 'screen marker not found: ' + name);
  const end = app.indexOf('<!-- ============', start + 10);
  return app.slice(start, end < 0 ? undefined : end);
}

test('a wrong practice answer shows its "Remember" tip once, not twice', () => {
  // Bug found 2026-09-23: two blocks printed the same topic tip one above the other.
  const count = (screen('LEARN QUESTION').match(/<b>Remember:<\/b>/g) || []).length;
  assert.equal(count, 1);
});

test('every script the page loads is precached by the service worker', () => {
  // A script missing from CORE is missing offline — the app would break with no signal.
  const core = sw.match(/const CORE = \[([\s\S]*?)\];/)[1];
  const srcs = [...app.matchAll(/<script src="\.?\/?([^"]+)"/g)].map(m => m[1]);
  assert.ok(srcs.includes('picker.js'));
  for (const s of srcs) assert.ok(core.includes("'./" + s + "'"), s + ' is not in sw.js CORE');
});
