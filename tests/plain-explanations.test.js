// Tests for tools/write-plain-explanations.js — "Explain it differently" drafts from the local AI.
// Covers the checks every draft must pass and what the prompt may (and may not) show the model.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SETTINGS, checkExplanation, prompt } = require('../tools/write-plain-explanations.js');

// A question in the bank's shape (this one is t01q01 from questions-1.json).
const Q = {
  id: 't01q01', question: 'You want to change lanes. What should you do first?',
  options: ['Check your mirrors', 'Sound your horn', 'Speed up', 'Brake gently'], correctIndex: 0,
  explanation: 'Check your mirrors first so you know what is behind and beside you.', ruleRef: 'HC Rule 161'
};
const words = n => Array(n).fill('word').join(' ');

test('a plain draft using only the question\'s own facts passes', () => {
  assert.deepEqual(checkExplanation('Before changing lanes, check your mirrors, like looking both ways before crossing at school. Rule 161 says know what is behind and beside you.', Q), []);
});

test('the limit is 45 words: 45 passes, 46 is rejected', () => {
  assert.equal(SETTINGS.maxWords, 45);
  assert.deepEqual(checkExplanation(words(45), Q), []);
  assert.match(checkExplanation(words(46), Q).join(), /too long \(46 words, max 45\)/);
});

test('the prompt asks for fewer words than the limit, so a slightly wordy answer still fits', () => {
  assert.ok(SETTINGS.askWords < SETTINGS.maxWords);
  assert.match(prompt(Q, null), new RegExp('At most ' + SETTINGS.askWords + ' words'));
});

test('an invented number is rejected — including the learner\'s age from the prompt and "two" as a word', () => {
  assert.match(checkExplanation('At 17 you check your mirrors first.', Q).join(), /number not in the question: 17/);
  assert.match(checkExplanation('Check your mirrors two times.', Q).join(), /number not in the question: 2/);
  assert.deepEqual(checkExplanation('Highway Code rule 161: mirrors first.', Q), [], 'the rule number is the question\'s own');
});

test('a draft that repeats a wrong answer is rejected', () => {
  assert.match(checkExplanation('Never sound your horn, check your mirrors.', Q).join(), /repeats a wrong answer: "Sound your horn"/);
});

test('a draft that just copies the existing explanation is rejected (it would teach nothing new)', () => {
  assert.deepEqual(checkExplanation(Q.explanation, Q), ['same as the existing explanation']);
  assert.deepEqual(checkExplanation('  CHECK your mirrors first, so you know what is behind and beside you!  ', Q), ['same as the existing explanation']);
});

test('an empty draft is rejected as empty, and nothing else', () => {
  assert.deepEqual(checkExplanation('', Q), ['empty']);
  assert.deepEqual(checkExplanation('   ', Q), ['empty']);
});

test('the prompt holds only the question, right answer, explanation and Highway Code reference — never a wrong answer', () => {
  const p = prompt(Q, null);
  for (const part of [Q.question, 'Right answer: Check your mirrors', 'Why: ' + Q.explanation, 'Highway Code: HC Rule 161']) assert.ok(p.includes(part), part);
  for (const wrong of ['Sound your horn', 'Speed up', 'Brake gently']) assert.ok(!p.includes(wrong), wrong);
});

test('the prompt asks for a 17-year-old\'s level with one everyday analogy, in British English', () => {
  const p = prompt(Q, null);
  assert.match(p, /17-year-old/);
  assert.match(p, /everyday analogy/);
  assert.match(p, /British English/);
  assert.match(p, /do not add any rule, fact or\s+number/);
});

test('a retry prompt says why the last draft was rejected; the first prompt does not', () => {
  assert.ok(!/rejected/.test(prompt(Q, null)));
  assert.match(prompt(Q, ['too long (50 words, max 45)', 'number not in the question: 17']),
    /Your last answer was rejected because: too long \(50 words, max 45\); number not in the question: 17\. Try again\./);
});

test('a question with no Highway Code reference leaves that line out', () => {
  assert.ok(!/Highway Code:/.test(prompt(Object.assign({}, Q, { ruleRef: '' }), null)));
});

test('drafts are saved as plainExplanation in tools/out/plain-explanations.json, which git ignores', () => {
  assert.equal(SETTINGS.field, 'plainExplanation');
  assert.equal(path.relative(path.join(__dirname, '..'), SETTINGS.outFile).split(path.sep).join('/'), 'tools/out/plain-explanations.json');
  const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(ignore, /^tools\/out\/$/m, 'the bank is paid content and the repo is public: drafts must never be committed');
});
