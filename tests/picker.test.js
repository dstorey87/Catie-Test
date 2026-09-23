// Tests for picker.js — run with:  node --test tests/
// Node's built-in test runner: no packages to install.
const test = require('node:test');
const assert = require('node:assert/strict');
const { history, similar } = require('../picker.js');

// A tiny question bank shaped like the real one (questions-*.json).
const Q = {
  tread1: { id: 'tread1', topic: 3, question: 'What is the minimum legal tyre tread depth for cars?', options: ['1.6 mm', '1 mm', '2 mm', '4 mm'], correctIndex: 0, explanation: 'Tyres must have at least 1.6 mm of tread across the central three-quarters.', ruleRef: 'HC Annex 6' },
  tread2: { id: 'tread2', topic: 3, question: 'Why should you check your tyres regularly?', options: ['To find worn tread and damage', 'To save fuel', 'To pass the MOT only', 'For comfort'], correctIndex: 0, explanation: 'Worn tread and cuts in tyres are dangerous and illegal.', ruleRef: 'HC Annex 6' },
  mirror: { id: 'mirror', topic: 3, question: 'When should you adjust your mirrors?', options: ['Before you move off', 'While driving', 'At junctions', 'Never'], correctIndex: 0, explanation: 'Set mirrors before moving off so you can see behind you.', ruleRef: 'HC Rule 161' },
  stop1: { id: 'stop1', topic: 4, question: 'What is the shortest stopping distance at 70 mph on a dry road?', options: ['96 metres', '53 metres', '73 metres', '36 metres'], correctIndex: 0, explanation: 'The overall stopping distance at 70 mph is 96 metres.', ruleRef: 'HC Rule 126' },
  stop2: { id: 'stop2', topic: 9, question: 'How far should you stay back on a motorway in the wet? Think stopping distance.', options: ['Double the dry stopping distance', 'The same', 'Half', 'One car length'], correctIndex: 0, explanation: 'Stopping distances at least double on wet roads.', ruleRef: 'HC Rule 126' },
  horse: { id: 'horse', topic: 6, question: 'How should you pass a horse rider?', options: ['Slowly, at least 2 metres away', 'Quickly', 'Sound the horn', 'Rev the engine'], correctIndex: 0, explanation: 'Pass horses at no more than 10 mph and give at least 2 metres of space.', ruleRef: 'HC Rule 215' }
};
const bank = Object.values(Q);
const lookup = id => Q[id] || null;

test('history: one row per question, newest first', () => {
  const attempts = [
    { q: 'tread1', t: 1, ok: false, topic: 3 },
    { q: 'horse', t: 2, ok: true, topic: 6 },
    { q: 'tread1', t: 3, ok: true, topic: 3, p: 0 }
  ];
  const rows = history(attempts, lookup);
  assert.deepEqual(rows.map(r => r.id), ['tread1', 'horse']);
});

test('history: counts right and wrong, and reports the most recent answer', () => {
  const attempts = [
    { q: 'tread1', t: 1, ok: false, p: 2 },
    { q: 'tread1', t: 2, ok: false, p: 1 },
    { q: 'tread1', t: 3, ok: true, p: 0, src: 'test' }
  ];
  const [row] = history(attempts, lookup);
  assert.equal(row.right, 1);
  assert.equal(row.wrong, 2);
  assert.equal(row.lastOk, true);
  assert.equal(row.lastPick, 0);
  assert.equal(row.src, 'test');
  assert.equal(row.t, 3);
});

test('history: old answers saved without the picked option still show', () => {
  const [row] = history([{ q: 'horse', t: 5, ok: true }], lookup);
  assert.equal(row.lastPick, -1);
  assert.equal(row.src, 'learn');
});

test('history: questions no longer in the bank are left out, not crashed on', () => {
  const rows = history([{ q: 'deleted', t: 1, ok: true }, { q: 'horse', t: 2, ok: false }, { q: 'deleted', t: 3, ok: false }], lookup);
  assert.deepEqual(rows.map(r => r.id), ['horse']);
});

test('history: empty or missing attempts give an empty list', () => {
  assert.deepEqual(history([], lookup), []);
  assert.deepEqual(history(undefined, lookup), []);
  assert.deepEqual(history([null, { t: 1 }], lookup), []);
});

test('similar: never returns the question you asked about', () => {
  const out = similar([Q.tread1], bank, { count: 10 });
  assert.ok(!out.some(q => q.id === 'tread1'));
});

test('similar: the question on the same idea comes first', () => {
  // tread2 shares "tread"/"tyre" with tread1; mirror is only the same topic.
  const out = similar([Q.tread1], bank, { count: 10 });
  assert.equal(out[0].id, 'tread2');
  assert.ok(out.findIndex(q => q.id === 'tread2') < out.findIndex(q => q.id === 'mirror'));
});

test('similar: finds the same idea in a different topic', () => {
  // stop1 (Safety margins) and stop2 (Motorway rules) are both about stopping distances.
  const out = similar([Q.stop1], bank, { count: 10 });
  assert.equal(out[0].id, 'stop2');
});

test('similar: unrelated questions are not padded in', () => {
  const out = similar([Q.horse], bank, { count: 10, topicBonus: 3 });
  assert.ok(!out.some(q => q.id === 'mirror'));
});

test('similar: returns at most count questions', () => {
  assert.equal(similar([Q.tread1], bank, { count: 1 }).length, 1);
});

test('similar: on a tie, a question still being learned beats a mastered one', () => {
  const twinA = { id: 'a', topic: 1, question: 'Alpha zebra crossing', options: ['x'], correctIndex: 0, explanation: '', ruleRef: '' };
  const twinB = { id: 'b', topic: 1, question: 'Alpha zebra crossing', options: ['x'], correctIndex: 0, explanation: '', ruleRef: '' };
  const target = { id: 't', topic: 1, question: 'Alpha zebra crossing', options: ['x'], correctIndex: 0, explanation: '', ruleRef: '' };
  const boxes = { a: 3, b: 1 };
  const out = similar([target], [twinA, twinB, target], { count: 2, boxOf: id => boxes[id] });
  assert.deepEqual(out.map(q => q.id), ['b', 'a']);
});

test('similar: several ticked questions pull in matches for each of them', () => {
  const out = similar([Q.tread1, Q.stop1], bank, { count: 10 });
  const ids = out.map(q => q.id);
  assert.ok(ids.includes('tread2'));
  assert.ok(ids.includes('stop2'));
  assert.ok(!ids.includes('tread1') && !ids.includes('stop1'));
});

test('similar: plural and singular count as the same word', () => {
  const a = { id: 'a', topic: 1, question: 'Check the tyre', options: ['ok'], correctIndex: 0, explanation: '', ruleRef: '' };
  const b = { id: 'b', topic: 2, question: 'Worn tyres', options: ['no'], correctIndex: 0, explanation: '', ruleRef: '' };
  const c = { id: 'c', topic: 2, question: 'Pedestrian crossing', options: ['no'], correctIndex: 0, explanation: '', ruleRef: '' };
  assert.deepEqual(similar([a], [a, b, c], { count: 5, topicBonus: 0 }).map(q => q.id), ['b']);
});

test('similar: nothing to compare gives an empty list', () => {
  assert.deepEqual(similar([], bank, { count: 5 }), []);
  assert.deepEqual(similar([Q.tread1], [], { count: 5 }), []);
  assert.deepEqual(similar([Q.tread1], [Q.tread1], { count: 5 }), []);
});
