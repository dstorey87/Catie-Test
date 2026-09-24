// ai-checks.js — the checks every piece of AI-drafted text must pass before Darren sees it.
//
// WHY THIS FILE EXISTS
//   Two tools ask the local AI to write text about a bank question: write-memory-tips.js (a short
//   way to remember the answer) and write-plain-explanations.js (the answer explained again, more
//   plainly). Both must obey the standing rule: nothing shown to a learner may be a fact the AI
//   made up. The checks that enforce that live here, ONCE, so the two tools can never drift apart.
//
// WHAT IS CHECKED (checkDraft)
//   1. Not empty.
//   2. Not longer than the tool's word limit (each tool passes its own limit).
//   3. No number that the question's own text does not contain — digits ("5 mm") AND number
//      words ("halves", "two", "four times"). A number is the easiest fact to invent.
//   4. Does not repeat a wrong answer word for word (only wrong answers of 3+ words are checked,
//      so short everyday phrases like "Speed up" do not cause false alarms).
//   5. No colour that the question's own text does not contain. In driving theory a colour is a
//      fact (lights, signs, road markings): "amber" where the question says "red" is invented.
//   6. Does not compare a measurement with something the question never mentions ("the length
//      of a football pitch" for 23 metres). Such an analogy is a made-up fact without a number.
//      Caught by the phrases in COMPARISONS; a phrase the question itself uses is allowed.
//
// These checks catch the kinds of invention a machine can spot. They cannot judge whether an
// analogy is apt: that is what Darren's review is for, and nothing goes live without it.
//
// These are pure functions: no network, no files. tests/ai-checks.test.js covers every rule.
'use strict';

// Number words and the value each one stands for. "one", "once", "single", "third" and "both"
// are deliberately NOT here: in this bank they are mostly ordinary words ("the right one",
// "single carriageway", "third-party insurance"), and counting them would reject good text.
const NUMBER_WORDS = {
  zero: 0, quarter: 0.25, half: 0.5, halves: 0.5, halve: 0.5, halved: 0.5,
  double: 2, doubles: 2, doubled: 2, twice: 2, two: 2,
  triple: 3, triples: 3, tripled: 3, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, fifteen: 15, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000
};

// Every number in a piece of text, as a list of values. "1.6 mm and 70 mph" → [1.6, 70];
// "rain halves your grip, twice the distance" → [0.5, 2].
function numbers(text) {
  const t = String(text).toLowerCase();
  // Digits, with an optional decimal part: "1.6", "70", "161".
  const digits = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  // Whole words that are in the number-word list above.
  const words = (t.match(/[a-z]+/g) || []).filter(w => w in NUMBER_WORDS).map(w => NUMBER_WORDS[w]);
  return digits.concat(words);
}

// Colour words. All of the first nine appear in this bank's questions and answers.
const COLOURS = ['red', 'amber', 'green', 'blue', 'yellow', 'white', 'black', 'orange', 'brown', 'grey', 'gray', 'purple', 'pink'];

// Every colour word in a piece of text (whole words only: "whiteboard" is not "white").
function colours(text) {
  return (String(text).toLowerCase().match(/[a-z]+/g) || []).filter(w => COLOURS.includes(w));
}

// Phrases that compare a size or distance with some other thing: "the length of a bus",
// "as far as a football pitch". "as long as you…" is NOT matched (it means "provided that"),
// because each pattern needs "a" or "an" straight after it. "distance of a" is left out on
// purpose: "the stopping distance of a car" is a plain statement, not a comparison.
const COMPARISONS = /\b(?:length|size|width|height|depth|weight) of an?\b|\bas (?:long|far|big|wide|tall|high|heavy|deep|fast) as an?\b/g;

// Every comparison phrase in a piece of text, in lower case.
function comparisons(text) {
  return String(text).toLowerCase().match(COMPARISONS) || [];
}

// The question's own words: the ONLY text the AI is allowed to draw facts from. The wrong
// options are left out on purpose — they are wrong, so they are not facts.
function sourceText(q) {
  return [q.question, q.options[q.correctIndex], q.explanation || '', q.ruleRef || ''].join(' \n ');
}

// Checks one draft against one question. Returns a list of problems in plain words; an empty
// list means the draft may go to Darren for review (he still reads every one before it is live).
//   text     — what the AI wrote
//   q        — the bank question it was written for ({question, options, correctIndex, ...})
//   maxWords — the tool's word limit
function checkDraft(text, q, maxWords) {
  const problems = [];
  const t = String(text || '').trim();
  if (!t) return ['empty'];

  // Rule 2: length, counted as runs of non-space characters.
  const words = t.split(/\s+/).length;
  if (words > maxWords) problems.push('too long (' + words + ' words, max ' + maxWords + ')');

  // Rule 3: every number in the draft must also appear in the question's own text.
  const allowed = new Set(numbers(sourceText(q)));
  const invented = numbers(t).filter(n => !allowed.has(n));
  if (invented.length) problems.push('number not in the question: ' + invented.join(', '));

  // Rule 4: no wrong answer (3+ words long) copied into the draft, ignoring a trailing full stop.
  q.options.forEach((opt, i) => {
    if (i === q.correctIndex) return;
    const o = String(opt).toLowerCase().replace(/[.!?]+$/, '');
    if (o.split(/\s+/).length >= 3 && t.toLowerCase().includes(o)) problems.push('repeats a wrong answer: "' + opt + '"');
  });

  // Rule 5: every colour in the draft must also appear in the question's own text.
  const source = sourceText(q);
  const allowedColours = new Set(colours(source));
  const newColours = [...new Set(colours(t).filter(c => !allowedColours.has(c)))];
  if (newColours.length) problems.push('colour not in the question: ' + newColours.join(', '));

  // Rule 6: no "length of a …" style comparison, unless the question itself uses that phrase.
  const sourcePhrases = new Set(comparisons(source));
  const newPhrases = [...new Set(comparisons(t).filter(p => !sourcePhrases.has(p)))];
  if (newPhrases.length) problems.push('compares a measurement with something not in the question: "' + newPhrases.join('", "') + '"');
  return problems;
}

module.exports = { NUMBER_WORDS, COLOURS, numbers, colours, comparisons, sourceText, checkDraft };
