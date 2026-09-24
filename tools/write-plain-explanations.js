#!/usr/bin/env node
// write-plain-explanations.js — local AI drafts a plainer explanation of each bank question's
// answer ("Explain it differently"), on Darren's PC, for Darren to approve.
//
// WHAT IT DOES
//   For each question in questions-1..5.json it sends the question, its right answer, its
//   explanation and its Highway Code reference — nothing else, not the wrong answers — to the
//   local Ollama model, and asks it to explain the answer again as it would to a 17-year-old,
//   with one everyday analogy, in at most 45 words. Every draft is checked (checkExplanation
//   below, built on the shared checks in ai-checks.js) and, if it fails, asked for again (up to
//   3 goes). Results go to tools/out/plain-explanations.json, which is NOT in git (the repo is
//   public). Nothing reaches Catie from here: drafts are loaded into the question bank as
//   drafts and only show once Darren approves them in the admin screen.
//
// WHY LOCAL AI, AND WHY IT CAN'T MAKE THINGS UP
//   Free, and the question text never leaves the PC. A draft with any number not in the
//   question's own text is rejected, as is one that repeats a wrong option or just copies the
//   existing explanation. Darren still reads every draft before it goes live.
//
// RUN (Windows or WSL, Ollama running):   node tools/write-plain-explanations.js
//   Re-run any time: questions that already have a good draft are skipped, so it resumes.
//   Settings (environment variables): OLLAMA_URL (default http://127.0.0.1:11434),
//   EXPLAIN_MODEL (default qwen3:14b), EXPLAIN_LIMIT (try it on a few questions first),
//   AI_TIMEOUT_MS (give up on one answer after this long).
//
// OUTPUT FORMAT (one entry per question id)
//   { "t01q01": { "plainExplanation": "…", "tries": 1 } }                       passed the checks
//   { "t01q02": { "plainExplanation": "", "rejected": "…", "problems": [...], "tries": 3 } }
//   The key matches the app's q.plainExplanation and the database column plain_explanation.
'use strict';
const path = require('node:path');
const { checkDraft } = require('./ai-checks.js');
const drafts = require('./ai-drafts.js');

// This tool's own choices. maxWords is the hard limit the check enforces; askWords is what the
// prompt asks for, a little under it, so a slightly wordy answer still fits.
const SETTINGS = drafts.settings('EXPLAIN', {
  field: 'plainExplanation', maxWords: 45, askWords: 40,
  outFile: path.join(drafts.OUT_DIR, 'plain-explanations.json')
});

// Lower case, letters and digits only: so "Check your mirrors." and "check your mirrors" match.
function squash(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// The shared checks, plus one of this tool's own: a "plainer explanation" that is just the
// existing explanation again gives Catie nothing new.
function checkExplanation(text, q) {
  const problems = checkDraft(text, q, SETTINGS.maxWords);
  if (problems[0] === 'empty') return problems;
  if (q.explanation && squash(text) === squash(q.explanation)) problems.push('same as the existing explanation');
  return problems;
}

// The words sent to the model. Only the question's own fields go in — the wrong options never
// do, so the model cannot copy one. On a retry, the reasons the last draft failed are added.
function prompt(q, lastProblems) {
  return [
    'You help a 17-year-old UK learner driver understand one theory test answer.',
    'Question: ' + q.question,
    'Right answer: ' + q.options[q.correctIndex],
    'Why: ' + (q.explanation || ''),
    q.ruleRef ? 'Highway Code: ' + q.ruleRef : '',
    '',
    'Explain again why the right answer is right, in plainer words than the "Why" above, the way',
    'you would explain it to a 17-year-old, using one everyday analogy (home, school, sport, a phone).',
    'At most ' + SETTINGS.askWords + ' words. Use only the facts written above: do not add any rule, fact or',
    'number that is not written above, and do not say how old the learner is.',
    'Do not mention the wrong answers. Plain British English, friendly, no emoji, no heading.',
    lastProblems ? 'Your last answer was rejected because: ' + lastProblems.join('; ') + '. Try again.' : ''
  ].filter(Boolean).join('\n');
}

async function main() {
  const bank = drafts.loadBank();
  console.log('Drafting plain explanations with ' + SETTINGS.model + ' at ' + SETTINGS.url + '.');
  await drafts.draftAll({
    bank, outFile: SETTINGS.outFile, field: SETTINGS.field,
    check: checkExplanation, prompt,
    ask: text => drafts.askModel(SETTINGS, text, SETTINGS.field),
    limit: SETTINGS.limit, tries: SETTINGS.tries
  });
}

module.exports = { SETTINGS, checkExplanation, prompt };
if (require.main === module) main().catch(e => { console.error('write-plain-explanations failed: ' + e.message); process.exit(1); });
