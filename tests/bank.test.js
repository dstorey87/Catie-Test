// Checks on the question bank itself (questions-1..5.json and the free sample) — no browser
// needed. Run with:  node --test
//
// Two kinds of check:
//   1. Shape: every question is well formed (4 different options, a valid correctIndex, an
//      explanation and a rule reference), ids are unique and match their topic, and the free
//      sample (questions-free.json) is an exact copy of its bank questions.
//   2. UK-rules corrections (issue #20): one check per corrected question, so a later edit
//      cannot quietly put a wrong fact back. Each names the source that proved the fix; the
//      full list with links: CHANGELOG.md v12, or `git show 8834baa:changes/section-bank-uk.md`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

// The bank as the app and the AI tools load it: the five files, in order.
const BANK_FILES = [1, 2, 3, 4, 5].map(n => 'questions-' + n + '.json');
const bank = BANK_FILES.flatMap(readJson);
const byId = Object.fromEntries(bank.map(q => [q.id, q]));
const free = readJson('questions-free.json');

// ---------- 1. Shape ----------

test('bank: every question has 4 different, non-empty options and a valid correctIndex', () => {
  for (const q of bank) {
    assert.ok(Array.isArray(q.options) && q.options.length === 4, q.id + ' must have exactly 4 options');
    q.options.forEach((o, i) => assert.ok(typeof o === 'string' && o.trim(), q.id + ' option ' + i + ' is empty'));
    // Different even ignoring case and spacing: two options that read the same make a question unfair.
    const norm = q.options.map(o => o.trim().toLowerCase().replace(/\s+/g, ' '));
    assert.equal(new Set(norm).size, 4, q.id + ' has two options that read the same');
    assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4,
      q.id + ' correctIndex must be 0, 1, 2 or 3');
  }
});

test('bank: every question has a question, an explanation and a rule reference', () => {
  for (const q of bank) {
    for (const f of ['question', 'explanation', 'ruleRef']) {
      assert.ok(typeof q[f] === 'string' && q[f].trim(), q.id + ' has no ' + f);
    }
  }
});

test('bank: ids are unique and match their topic (tNNqMM is topic NN)', () => {
  const ids = bank.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate question ids');
  for (const q of bank) {
    assert.match(q.id, /^t\d{2}q\d{2}$/, q.id + ' is not in the tNNqMM form');
    assert.equal(Number(q.id.slice(1, 3)), q.topic, q.id + ' sits in topic ' + q.topic);
  }
});

test('bank: 14 topics with the same number of questions each (nothing dropped by an edit)', () => {
  const per = {};
  bank.forEach(q => { per[q.topic] = (per[q.topic] || 0) + 1; });
  assert.deepEqual(Object.keys(per).map(Number), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(new Set(Object.values(per)).size, 1, 'topics have different sizes: ' + JSON.stringify(per));
});

test('bank: no rule reference is a vague pointer ("area", "note"): each names its real source', () => {
  for (const q of bank) assert.doesNotMatch(q.ruleRef, /\b(area|note)\b/i, q.id + ': ' + q.ruleRef);
});

test('free sample: every question is an exact copy of the same question in the bank', () => {
  assert.ok(free.length > 0, 'questions-free.json is empty');
  assert.equal(new Set(free.map(q => q.id)).size, free.length, 'duplicate ids in the free sample');
  for (const q of free) {
    assert.ok(byId[q.id], q.id + ' is in the free sample but not in the bank');
    assert.deepEqual(q, byId[q.id], q.id + ' in questions-free.json differs from the bank: copy the bank version');
  }
});

// ---------- 2. UK-rules corrections (issue #20) ----------
// One entry per corrected question: [id, what must now be true, the check]. HC = the
// Highway Code on gov.uk; RVLR = Road Vehicles Lighting Regulations 1989.
const CORRECTIONS = [
  ['t02q15', 'a doctor\'s car shows a GREEN light, not blue (RVLR regs 11 and 27, HC Rule 219)', q =>
    /green/i.test(q.question) && !/blue/i.test(q.question) && /green/i.test(q.explanation)],
  ['t02q05', 'the horn ban names its hours, 11.30 pm to 7 am, not "at night" (HC Rule 112)', q =>
    q.question.includes('11.30 pm') && q.question.includes('7 am') && !/at night/i.test(q.question)],
  ['t01q03', 'the phone ban has narrow exceptions, not "at all times" (HC Rule 149)', q =>
    !/at all times/i.test(q.explanation) && q.explanation.includes('999 or 112')],
  ['t01q27', 'no unverified "most crashes" claim; alertness is lowest midnight to 6 am (HC Rule 91)', q =>
    !/\bmost\b/i.test(q.explanation) && q.explanation.includes('midnight and 6 am')],
  ['t01q09', 'slowing at a junction you cannot see is HC Rule 146', q => q.ruleRef === 'HC Rule 146'],
  ['t02q26', 'car doors opening on residential streets is HC Rule 152', q => q.ruleRef === 'HC Rule 152'],
  ['t05q21', 'asks the safest amount, not "the legal limit"; the legal limit is not zero (HC Rule 95)', q =>
    !/legal alcohol limit/i.test(q.question) && /safest amount/i.test(q.question) && /Scotland/.test(q.explanation)],
  ['t05q08', 'no unverified "as dangerous as drink driving" claim (HC Rule 96)', q =>
    !/drink driving/i.test(q.explanation) && /pharmacist/.test(q.explanation)],
  ['t06q07', 'a cyclist looking over their shoulder is HC Rule 212', q => q.ruleRef === 'HC Rule 212'],
  ['t06q14', 'not overtaking just before turning left is HC Rule 182', q => q.ruleRef === 'HC Rule 182'],
  ['t07q24', 'the tram question rests on HC Rule 305 (standing passengers), not an unverified stopping claim', q =>
    /standing passengers/i.test(q.options[q.correctIndex]) && !/more slowly/i.test(q.options.join(' ')) && /Rule 305/.test(q.ruleRef)],
  ['t07q10', 'only one right answer: never between a stopped tram and the left kerb (HC Rule 303)', q =>
    q.options[q.correctIndex] === 'Between the tram and the kerb on its left' &&
    !q.options.includes('On a straight road') && !q.options.includes('On the right') && /Rule 303/.test(q.ruleRef)],
  ['t07q25', 'passing people working by a vehicle is HC Rule 206', q => q.ruleRef === 'HC Rule 206 (see also Rule 225)'],
  ['t07q04', 'trams cannot steer to avoid you is HC Rule 224', q => q.ruleRef === 'HC Rule 224 (see also Rule 302)'],
  ['t09q11', 'carry on to the next exit is HC Rule 263', q => q.ruleRef === 'HC Rule 263'],
  ['t09q14', 'face the traffic on the emergency phone is HC Rule 277', q => q.ruleRef === 'HC Rule 277'],
  ['t09q12', 'the hard shoulder is also for when police, traffic officers or signs direct you (HC Rules 269, 271)', q =>
    /directed by police, traffic officers or signs/.test(q.options[q.correctIndex]) && q.ruleRef === 'HC Rules 269 and 271'],
  ['t09q21', 'emergency areas are HC Rule 270', q => q.ruleRef === 'HC Rule 270'],
  ['t09q27', 'leaving a motorway is HC Rules 273 and 274', q => q.ruleRef === 'HC Rules 273 and 274'],
  ['t08q19', 'a hump bridge hiding the road ahead is HC Rule 166', q => q.ruleRef === 'HC Rule 166 (see also Rule 126)'],
  ['t08q13', 'rain after a dry spell making roads slippery is HC Rule 237', q => q.ruleRef === 'HC Rule 237'],
  ['t08q16', 'no unverified "halve your grip"; wet stopping distances are at least double (HC Rule 227)', q =>
    !/halve/i.test(q.explanation) && /at least double/.test(q.explanation)],
  ['t07q15', 'large vehicles needing more distance to stop is HC Rule 126', q => q.ruleRef === 'HC Rule 126'],
  ['t11q26', 'level crossings show twin flashing RED lights, not white (HC Rule 293)', q =>
    !/white light/i.test(q.question) && /twin red lights/i.test(q.question) && /Twin flashing red/.test(q.explanation)],
  ['t11q19', 'the triangle is a plain bend sign, not a "sharp" bend (HC: Traffic signs)', q =>
    q.options[q.correctIndex] === 'A bend to the left ahead' && !/sharp/i.test(q.options.join(' '))],
  ['t10q11', 'you may also pass a stationary vehicle, and the limit is 10 mph or less (HC Rule 129)', q =>
    /stationary vehicle/.test(q.explanation) && /10 mph or less/.test(q.explanation) && !/under 10 mph/.test(q.explanation)],
  ['t12q06', 'supervisor age and years held are in HC Annex 3', q => q.ruleRef === 'HC Annex 3'],
  ['t12q18', 'supervisor age and years held are in HC Annex 3', q => q.ruleRef === 'HC Annex 3'],
  ['t11q17', 'the No overtaking sign is on the Traffic signs page', q => q.ruleRef === 'HC: Traffic signs'],
  ['t12q16', 'an untaxed car may go to AND from a pre-booked MOT (VERA 1994 Sch 2 para 22)', q =>
    /to or from a pre-booked MOT/.test(q.options[q.correctIndex]) && /to or from a pre-booked MOT/.test(q.explanation)],
  ['t12q11', 'in Wales D plates can be used instead of L plates (HC Annex 3)', q => /Wales/.test(q.explanation) && /D plates/.test(q.explanation)],
  ['t12q21', 'in Wales D plates can be used instead of L plates (HC Annex 3)', q => /D plates in Wales/.test(q.explanation)],
  ['t13q07', 'the warning triangle is HC Rule 276', q => q.ruleRef === 'HC Rule 276'],
  ['t13q26', 'hazard lights after an incident is HC Rule 283', q => q.ruleRef === 'HC Rule 283'],
  ['t13q14', 'do not open the bonnet at all, not "fully" (HC Annex 6)', q =>
    /Do not open the bonnet$/.test(q.options[q.correctIndex]) && !/fully/.test(q.options.join(" ")) && q.ruleRef === 'HC Annex 6'],
  ['t13q22', 'a tyre burst is HC Annex 6', q => q.ruleRef === 'HC Annex 6'],
  ['t13q15', 'breaking down in a tunnel is not in the Highway Code; the source is the tunnel safety guide', q => q.ruleRef === 'Traffic Wales tunnel safety guide'],
  ['t13q21', 'the 101 number is on gov.uk "Contact the police", not in the Highway Code', q => q.ruleRef === 'gov.uk: Contact the police'],
  ['t13q03', '30:2 CPR is St John Ambulance guidance, not in HC Annex 7', q => q.ruleRef === 'St John Ambulance CPR guide'],
  ['t13q05', 'defibrillators are St John Ambulance guidance, not in HC Annex 7', q => q.ruleRef === 'St John Ambulance: how to use a defibrillator'],
  ['t13q27', 'the signs of shock are St John Ambulance guidance, not in HC Annex 7', q => q.ruleRef === 'St John Ambulance: shock'],
  ['t13q23', 'the car is on the hard shoulder, so "behind the barrier" is the only right answer (HC Rules 275, 277)', q =>
    /hard shoulder/.test(q.question) && q.ruleRef === 'HC Rules 275 and 277'],
  ['t14q17', 'the 2.55 metre trailer width is on gov.uk "Towing with a car"', q => q.ruleRef === 'gov.uk: Towing with a car'],
  ['t14q08', 'tyre pressures for the load are in HC Annex 6', q => q.ruleRef === 'HC Annex 6']
];

test('corrections: each corrected question is listed once and exists in the bank', () => {
  const ids = CORRECTIONS.map(c => c[0]);
  assert.equal(new Set(ids).size, ids.length, 'a question is listed twice in CORRECTIONS');
  ids.forEach(id => assert.ok(byId[id], id + ' is not in the bank'));
});

for (const [id, fact, check] of CORRECTIONS) {
  test('correction ' + id + ': ' + fact, () => {
    assert.ok(check(byId[id]), id + ' no longer says what the UK rule says (' + fact + '): ' + JSON.stringify(byId[id]));
  });
}

