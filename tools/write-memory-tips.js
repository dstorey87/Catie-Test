#!/usr/bin/env node
// write-memory-tips.js — local AI drafts one memory tip per bank question, on Darren's PC.
//
// WHAT IT DOES
//   For each question in questions-1..5.json it sends the question, its right answer, its
//   explanation and its Highway Code reference to the local Ollama model, and asks for ONE
//   short way to remember the right answer. Every tip is checked (checkTip below) and, if it
//   fails, asked for again (up to 3 goes). Results go to tools/out/memory-tips.json, which is
//   NOT in git (the repo is public). Nothing reaches Catie from here: tips are loaded into the
//   question bank as drafts and only show once Darren approves them in Admin → Memory tips.
//
// WHY LOCAL AI, AND WHY IT CAN'T MAKE THINGS UP
//   Free, and the question text never leaves the PC. The model only rewords facts it is given:
//   a tip with any number not in the question's own text is rejected, as is one that repeats a
//   wrong option. Darren still reads every tip before it goes live.
//
// RUN (Windows or WSL, Ollama running):   node tools/write-memory-tips.js
//   Re-run any time: questions that already have a tip are skipped, so it resumes.
//   Settings (environment variables): OLLAMA_URL (default http://127.0.0.1:11434),
//   TIP_MODEL (default qwen3:14b — the lus-ai "chat" alias's model), TIP_LIMIT (test on a few).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'memory-tips.json');
const SETTINGS = {
  url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  model: process.env.TIP_MODEL || 'qwen3:14b',
  limit: Number(process.env.TIP_LIMIT) || Infinity,
  maxWords: 25,
  tries: 3
};

// Every number written in a piece of text ("1.6 mm", "70 mph", "2 metres" → 1.6, 70, 2).
function numbers(text) { return (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number); }

// The question's own words: everything the tip is allowed to draw facts from.
function sourceText(q) {
  return [q.question, q.options[q.correctIndex], q.explanation || '', q.ruleRef || ''].join(' \n ');
}

// Returns a list of problems; an empty list means the tip may go to Darren for review.
function checkTip(tip, q) {
  const problems = [];
  const t = String(tip || '').trim();
  if (!t) return ['empty'];
  const words = t.split(/\s+/).length;
  if (words > SETTINGS.maxWords) problems.push('too long (' + words + ' words, max ' + SETTINGS.maxWords + ')');
  const allowed = new Set(numbers(sourceText(q)));
  const invented = numbers(t).filter(n => !allowed.has(n));
  if (invented.length) problems.push('number not in the question: ' + invented.join(', '));
  q.options.forEach((opt, i) => {
    if (i === q.correctIndex) return;
    const o = String(opt).toLowerCase().replace(/[.!?]+$/, '');
    if (o.split(/\s+/).length >= 3 && t.toLowerCase().includes(o)) problems.push('repeats a wrong answer: "' + opt + '"');
  });
  return problems;
}

function prompt(q, lastProblems) {
  return [
    'You help a UK learner driver remember one theory test answer.',
    'Question: ' + q.question,
    'Right answer: ' + q.options[q.correctIndex],
    'Why: ' + (q.explanation || ''),
    q.ruleRef ? 'Highway Code: ' + q.ruleRef : '',
    '',
    'Write ONE memory tip of at most 20 words that makes the right answer stick: a picture to',
    'imagine, a short rhyme, a first-letters trick, or a link to everyday life.',
    'Use only facts written above. Do not add any number that is not written above.',
    'Do not mention the wrong answers. Plain British English, friendly, no emoji.',
    lastProblems ? 'Your last tip was rejected because: ' + lastProblems.join('; ') + '. Try again.' : ''
  ].filter(Boolean).join('\n');
}

async function askModel(text) {
  let r;
  try {
    r = await fetch(SETTINGS.url + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: SETTINGS.model, stream: false, think: false,
        options: { temperature: 0.4 },
        format: { type: 'object', properties: { tip: { type: 'string' } }, required: ['tip'] },
        messages: [{ role: 'user', content: text }]
      })
    });
  } catch (e) {
    throw new Error('Could not reach Ollama at ' + SETTINGS.url + ' (' + e.message + '). Start Ollama, or set OLLAMA_URL.');
  }
  if (!r.ok) throw new Error('Ollama answered ' + r.status + ' at ' + SETTINGS.url + ': ' + (await r.text()).slice(0, 200) + '. Check TIP_MODEL is pulled (ollama list).');
  const body = await r.json();
  try { return JSON.parse(body.message.content).tip; }
  catch (e) { return ''; }                     // unreadable answer: treated as empty, asked again
}

async function main() {
  const bank = [1, 2, 3, 4, 5].flatMap(n => JSON.parse(fs.readFileSync(path.join(ROOT, 'questions-' + n + '.json'), 'utf8')));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const todo = bank.filter(q => !(done[q.id] && done[q.id].tip)).slice(0, SETTINGS.limit);
  console.log(todo.length + ' of ' + bank.length + ' questions still need a tip (model ' + SETTINGS.model + ').');
  let n = 0;
  for (const q of todo) {
    let tip = '', problems = null;
    for (let go = 1; go <= SETTINGS.tries; go++) {
      tip = String(await askModel(prompt(q, problems)) || '').trim();
      problems = checkTip(tip, q);
      if (!problems.length) break;
    }
    done[q.id] = problems.length ? { tip: '', rejected: tip, problems } : { tip };
    fs.writeFileSync(OUT, JSON.stringify(done, null, 1));   // after every question, so a stop loses nothing
    n++;
    console.log(n + '/' + todo.length + ' ' + q.id + (problems.length ? ' REJECTED: ' + problems.join('; ') : ' ok: ' + tip));
  }
  const ok = Object.values(done).filter(x => x.tip).length;
  console.log('Done. ' + ok + ' tips ready for review in ' + OUT + '; ' + (Object.keys(done).length - ok) + ' rejected (re-run to try those again).');
}

module.exports = { checkTip, numbers, sourceText };
if (require.main === module) main().catch(e => { console.error('write-memory-tips failed: ' + e.message); process.exit(1); });
