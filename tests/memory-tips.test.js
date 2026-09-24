// Tests for tools/write-memory-tips.js — the checks every AI-written tip must pass.
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkTip } = require('../tools/write-memory-tips.js');

const Q = {
  id: 'tread', question: 'What is the minimum legal tyre tread depth for cars?',
  options: ['1.6 mm', '1 mm', '2 mm across the whole tyre', '4 mm'], correctIndex: 0,
  explanation: 'Tyres must have at least 1.6 mm of tread across the central three-quarters.', ruleRef: 'HC Annex 6'
};

test('a short tip using only the question\'s own facts passes', () => {
  assert.deepEqual(checkTip('Think "one point six keeps you on the fix" — 1.6 mm of tread.', Q), []);
});

test('a number the question never mentions is rejected (the AI must not invent facts)', () => {
  assert.match(checkTip('Remember 5 mm is the safe amount.', Q).join(), /number not in the question: 5/);
});

test('numbers from the Highway Code reference count as the question\'s own', () => {
  assert.deepEqual(checkTip('Annex 6 says 1.6 mm.', Q), []);
});

test('a tip that repeats a wrong answer is rejected', () => {
  assert.match(checkTip('Not 2 mm across the whole tyre, but 1.6 mm.', Q).join(), /repeats a wrong answer/);
});

test('empty and over-long tips are rejected', () => {
  assert.deepEqual(checkTip('  ', Q), ['empty']);
  assert.match(checkTip(Array(30).fill('word').join(' '), Q).join(), /too long/);
});

test('numbers written as words count too: "halves" is an invented fact when the question never says it', () => {
  const W = { id: 'w', question: 'Why brake gently in the rain?', options: ['Wheels can lock and skid', 'To save fuel', 'b', 'c'], correctIndex: 0, explanation: 'Wet roads give less grip.' };
  assert.match(checkTip('Rain halves grip, so brake gently.', W).join(), /number not in the question: 0.5/);
  assert.deepEqual(checkTip("Wet road, less grip: brake gently so wheels don't lock.", W), []);
  const D = { id: 'd', question: 'You double your speed. What happens to braking distance?', options: ['About four times longer', 'Twice as long', 'Same', 'Half'], correctIndex: 0, explanation: '' };
  assert.deepEqual(checkTip('Double the speed, four times the braking.', D), []);
});
