#!/usr/bin/env node
// write-memory-tips.js — local AI drafts one memory tip per bank question, on Darren's PC.
//
// WHAT IT DOES
//   For each question in questions-1..5.json it sends the question, its right answer, its
//   explanation and its Highway Code reference to the local Ollama model, and asks for ONE
//   short way to remember the right answer. Every tip is checked (checkTip below, built on the
//   shared checks in ai-checks.js) and, if it fails, asked for again (up to 3 goes). Results go
//   to tools/out/memory-tips.json, which is NOT in git (the repo is public). Nothing reaches
//   Catie from here: tips are loaded into the question bank as drafts and only show once Darren
//   approves them in Admin → Memory tips.
//
// WHY LOCAL AI, AND WHY IT CAN'T MAKE THINGS UP
//   Free, and the question text never leaves the PC. The model only rewords facts it is given:
//   a tip with any number not in the question's own text is rejected, as is one that repeats a
//   wrong option. Darren still reads every tip before it goes live.
//
// RUN (Windows or WSL, Ollama running):   node tools/write-memory-tips.js
//   Re-run any time: questions that already have a tip are skipped, so it resumes.
//   Settings (environment variables): OLLAMA_URL (default http://127.0.0.1:11434),
//   TIP_MODEL (default qwen3:14b — the lus-ai "chat" alias's model), TIP_LIMIT (test on a few),
//   AI_TIMEOUT_MS (give up on one answer after this long).
//
// The asking, retrying and resuming are shared with write-plain-explanations.js (ai-drafts.js).
'use strict';
const path = require('node:path');
const { checkDraft, numbers, sourceText } = require('./ai-checks.js');
const drafts = require('./ai-drafts.js');

// This tool's own choices. maxWords is the hard limit the check enforces; askWords is what the
// prompt asks for, a little under it, so a slightly wordy tip still fits.
const SETTINGS = drafts.settings('TIP', {
  field: 'tip', maxWords: 25, askWords: 20,
  outFile: path.join(drafts.OUT_DIR, 'memory-tips.json')
});

// Returns a list of problems; an empty list means the tip may go to Darren for review.
function checkTip(tip, q) {
  return checkDraft(tip, q, SETTINGS.maxWords);
}

// The words sent to the model. On a retry, the reasons the last tip failed are added.
function prompt(q, lastProblems) {
  return [
    'You help a UK learner driver remember one theory test answer.',
    'Question: ' + q.question,
    'Right answer: ' + q.options[q.correctIndex],
    'Why: ' + (q.explanation || ''),
    q.ruleRef ? 'Highway Code: ' + q.ruleRef : '',
    '',
    'Write ONE memory tip of at most ' + SETTINGS.askWords + ' words that makes the right answer stick: a picture to',
    'imagine, a short rhyme, a first-letters trick, or a link to everyday life.',
    'Use only facts written above. Do not add any number that is not written above.',
    'Do not mention the wrong answers. Plain British English, friendly, no emoji.',
    lastProblems ? 'Your last tip was rejected because: ' + lastProblems.join('; ') + '. Try again.' : ''
  ].filter(Boolean).join('\n');
}

async function main() {
  const bank = drafts.loadBank();
  console.log('Drafting memory tips with ' + SETTINGS.model + ' at ' + SETTINGS.url + '.');
  await drafts.draftAll({
    bank, outFile: SETTINGS.outFile, field: SETTINGS.field,
    check: checkTip, prompt,
    ask: text => drafts.askModel(SETTINGS, text, SETTINGS.field),
    limit: SETTINGS.limit, tries: SETTINGS.tries
  });
}

// numbers and sourceText are re-exported so anything that used them from here keeps working.
module.exports = { SETTINGS, checkTip, prompt, numbers, sourceText };
if (require.main === module) main().catch(e => { console.error('write-memory-tips failed: ' + e.message); process.exit(1); });
