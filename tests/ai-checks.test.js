// Tests for tools/ai-checks.js — the shared checks every AI draft must pass (memory tips and
// plain explanations both use these, so one set of tests covers both tools' safety rules).
const test = require('node:test');
const assert = require('node:assert/strict');
const { numbers, colours, comparisons, sourceText, checkDraft } = require('../tools/ai-checks.js');

// A made-up question in the bank's shape, used by most tests below.
const Q = {
  id: 'tread', question: 'What is the minimum legal tyre tread depth for cars?',
  options: ['1.6 mm', '1 mm', '2 mm across the whole tyre', '4 mm'], correctIndex: 0,
  explanation: 'Tyres must have at least 1.6 mm of tread across the central three-quarters.', ruleRef: 'HC Annex 6'
};

test('numbers() finds digits, decimals and number words', () => {
  assert.deepEqual(numbers('1.6 mm at 70 mph, HC Rule 161'), [1.6, 70, 161]);
  assert.deepEqual(numbers('Rain halves grip; twice the distance; four times longer'), [0.5, 2, 4]);
});

test('"two" counts as a number (it did not before this change, so "two car lengths" slipped through)', () => {
  assert.deepEqual(numbers('Leave two car lengths'), [2]);
  // An invented "two" is caught…
  assert.match(checkDraft('Leave two car lengths behind the tyre.', Q, 45).join(), /number not in the question: 2/);
  // …and a question that says "two" allows the digit 2 (and the word) in a draft.
  const T = { id: 't', question: 'Stopping distance is made of two parts. What are they?',
    options: ['Thinking distance and braking distance', 'Speed and weight', 'Tyres and brakes', 'Road and weather'], correctIndex: 0,
    explanation: 'You travel while you think, then more while you brake.', ruleRef: 'HC Rule 126' };
  assert.deepEqual(checkDraft('2 parts: the thinking bit, then the braking bit.', T, 45), []);
  assert.deepEqual(checkDraft('Two parts: the thinking bit, then the braking bit.', T, 45), []);
});

test('everyday words that only look like numbers are not counted ("the right one", "single carriageway")', () => {
  assert.deepEqual(numbers('Pick the right one once, on a single carriageway, with third-party cover, both hands'), []);
});

test('sourceText() is the question, the right answer, the explanation and the rule reference — never a wrong answer', () => {
  const s = sourceText(Q);
  for (const part of [Q.question, '1.6 mm', Q.explanation, 'HC Annex 6']) assert.ok(s.includes(part), part);
  for (const wrong of ['1 mm', '2 mm across the whole tyre', '4 mm']) assert.ok(!s.includes(wrong), wrong);
});

test('checkDraft() uses the word limit it is given', () => {
  const ten = Array(10).fill('word').join(' ');
  assert.deepEqual(checkDraft(ten, Q, 10), []);
  assert.match(checkDraft(ten, Q, 9).join(), /too long \(10 words, max 9\)/);
});

test('checkDraft() lists every problem at once, so the retry prompt can name them all', () => {
  const p = checkDraft('Not 2 mm across the whole tyre, remember 5 mm.', Q, 3);
  assert.equal(p.length, 3);
  assert.match(p[0], /too long/);
  assert.match(p[1], /number not in the question: 2, 5/);
  assert.match(p[2], /repeats a wrong answer/);
});

test('a colour the question never mentions is rejected; the question\'s own colours are allowed', () => {
  const L = { id: 'l', question: 'What does a steady red traffic light mean?', options: ['Stop', 'Go', 'Get ready', 'Give way'], correctIndex: 0,
    explanation: 'Red means stop and wait behind the white stop line.', ruleRef: 'HC Rule 175' };
  assert.match(checkDraft('Amber and green come later: for now, stop.', L, 45).join(), /colour not in the question: amber, green/);
  assert.deepEqual(checkDraft('Red is like a closed door: stop at the white line and wait.', L, 45), []);
  // Whole words only: a "whiteboard" is not the colour white, and each colour is named once.
  assert.deepEqual(colours('the whiteboard, then blue, blue sky'), ['blue', 'blue']);
  assert.match(checkDraft('Blue sky, blue car: stop.', L, 45).join(), /colour not in the question: blue$/);
});

test('comparing a measurement with something the question never mentions is rejected ("length of a football pitch")', () => {
  const D = { id: 'd', question: 'What is the typical stopping distance at 30 mph?', options: ['23 metres', '12 metres', '36 metres', '53 metres'], correctIndex: 0,
    explanation: 'At 30 mph you need about 23 metres to think and brake to a stop.', ruleRef: 'HC Rule 126' };
  assert.match(checkDraft('23 metres is the length of a football pitch.', D, 45).join(), /compares a measurement with something not in the question: "length of a"/);
  assert.match(checkDraft('That is as far as a bus stop.', D, 45).join(), /"as far as a"/);
  // "as long as you…" means "provided that", and "the stopping distance of a car" is a plain
  // statement — neither is a comparison, so both pass.
  assert.deepEqual(checkDraft('You can stop in 23 metres at 30 mph, as long as you are paying attention.', D, 45), []);
  assert.deepEqual(checkDraft('The stopping distance of a car at 30 mph is about 23 metres.', D, 45), []);
  // A phrase the question itself uses is the question's own fact, so it is allowed.
  const own = Object.assign({}, D, { explanation: D.explanation + ' That is about the length of a tennis court.' });
  assert.deepEqual(comparisons(own.explanation), ['length of a']);
  assert.deepEqual(checkDraft('23 metres: about the length of a tennis court.', own, 45), []);
});

test('short wrong answers (under 3 words) are not treated as copied — they are too common to check', () => {
  const S = { id: 's', question: 'You want to change lanes. What should you do first?',
    options: ['Check your mirrors', 'Sound your horn', 'Speed up', 'Brake gently'], correctIndex: 0,
    explanation: 'Check your mirrors first so you know what is behind and beside you.', ruleRef: 'HC Rule 161' };
  assert.deepEqual(checkDraft('Look before you move: no need to speed up, just check your mirrors.', S, 45), []);
  assert.match(checkDraft('Do not sound your horn; check your mirrors.', S, 45).join(), /repeats a wrong answer: "Sound your horn"/);
});
