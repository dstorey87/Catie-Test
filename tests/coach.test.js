// Tests for coach.js — run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const coach = require('../coach.js');

// ---------- flags: kept until she un-flags, merged question by question ----------

test('a flag on either device survives a sync', () => {
  const phone = { flags: { q1: { t: 100, src: 'learn' } }, cleared: {} };
  const ipad = { flags: { q2: { t: 200, src: 'test' } }, cleared: {} };
  const m = coach.mergeFlags(phone, ipad);
  assert.deepEqual(Object.keys(m.flags).sort(), ['q1', 'q2']);
});

test('an un-flag made after the flag wins, on whichever device it happened', () => {
  const phone = { flags: { q1: { t: 100, src: 'learn' } }, cleared: {} };
  const ipad = { flags: {}, cleared: { q1: 150 } };
  assert.deepEqual(coach.mergeFlags(phone, ipad).flags, {});
  assert.deepEqual(coach.mergeFlags(ipad, phone).flags, {});
  assert.equal(coach.mergeFlags(phone, ipad).cleared.q1, 150);
});

test('flagging again after an un-flag brings it back', () => {
  const phone = { flags: { q1: { t: 300, src: 'learn' } }, cleared: {} };
  const ipad = { flags: {}, cleared: { q1: 150 } };
  const m = coach.mergeFlags(phone, ipad);
  assert.deepEqual(m.flags.q1, { t: 300, src: 'learn' });
  assert.equal(m.cleared.q1, undefined);
});

test('missing or old-format data is treated as empty, never as an error', () => {
  assert.deepEqual(coach.mergeFlags(undefined, null), { flags: {}, cleared: {} });
  const m = coach.mergeFlags({ flags: { q1: { t: 5 } } }, {});
  assert.deepEqual(Object.keys(m.flags), ['q1']);
});
