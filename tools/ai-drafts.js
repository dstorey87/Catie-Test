// ai-drafts.js — the shared engine behind every "local AI drafts X for each bank question" tool.
//
// WHAT IT DOES
//   loadBank()   reads the 5 question files (questions-1..5.json) into one list.
//   settings()   reads the tool's settings from environment variables, with safe defaults.
//   askModel()   sends one prompt to the local Ollama model and returns the one text field asked for.
//   draftAll()   walks the bank: for each question still without a good draft it asks the model,
//                checks the answer, asks again if the check fails (up to `tries` goes), and saves
//                the whole results file after EVERY question — so stopping half way loses nothing
//                and the next run carries on where this one stopped ("resumable").
//   summarise()  counts drafted / rejected / not yet tried, against the bank as it is today.
//
// Used by write-memory-tips.js and write-plain-explanations.js. The checks themselves live in
// ai-checks.js. Output files go in tools/out/, which is git-ignored: the bank is paid content
// and this repository is public.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'out');
const BANK_FILES = [1, 2, 3, 4, 5].map(n => 'questions-' + n + '.json');

// The defaults, in ONE place. Any of them can be changed without editing code:
//   OLLAMA_URL            where Ollama listens (the home PC's local port)
//   <PREFIX>_MODEL        which model writes the drafts (e.g. TIP_MODEL, EXPLAIN_MODEL)
//   <PREFIX>_LIMIT        only do this many questions (to try a change on a few first)
//   AI_TIMEOUT_MS         give up on one answer after this long, instead of hanging for ever
const DEFAULTS = { url: 'http://127.0.0.1:11434', model: 'qwen3:14b', timeoutMs: 120000, tries: 3, temperature: 0.4 };

// Builds one tool's settings. `prefix` names its environment variables; `own` holds the
// tool's own fixed choices (its word limit, its output file, its field name).
function settings(prefix, own, env = process.env) {
  return Object.assign({}, DEFAULTS, {
    url: env.OLLAMA_URL || DEFAULTS.url,
    model: env[prefix + '_MODEL'] || DEFAULTS.model,
    limit: Number(env[prefix + '_LIMIT']) || Infinity,
    timeoutMs: Number(env.AI_TIMEOUT_MS) || DEFAULTS.timeoutMs
  }, own);
}

// Reads a JSON file, and if it is broken says which file and what to do about it.
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error('Could not read ' + file + ' (' + e.message + '). Fix or delete that file, then run again.'); }
}

// All 378 bank questions, in file order.
function loadBank(root = ROOT) {
  return BANK_FILES.flatMap(f => readJson(path.join(root, f)));
}

// Asks the model once. Returns the text of `field` from its JSON answer, or '' if the answer
// could not be read (draftAll then treats it as empty and asks again). Throws — with the next
// step in the message — only when Ollama itself cannot be reached or refuses, because then every
// further question would fail the same way.
async function askModel(s, promptText, field, fetchFn = fetch) {
  let r;
  try {
    r = await fetchFn(s.url + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(s.timeoutMs),
      body: JSON.stringify({
        model: s.model, stream: false, think: false,          // think:false — just the answer, no reasoning text
        options: { temperature: s.temperature },
        // Ollama's structured output: the model must answer {"<field>": "..."}.
        format: { type: 'object', properties: { [field]: { type: 'string' } }, required: [field] },
        messages: [{ role: 'user', content: promptText }]
      })
    });
  } catch (e) {
    throw new Error('Could not reach Ollama at ' + s.url + ' (' + e.message + '). Start Ollama, or set OLLAMA_URL; if it is only slow, raise AI_TIMEOUT_MS.');
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error('Ollama answered ' + r.status + ' at ' + s.url + ': ' + detail.slice(0, 200) + '. Check the model ' + s.model + ' is pulled (ollama list).');
  }
  try { return String(JSON.parse((await r.json()).message.content)[field] || ''); }
  catch (e) { return ''; }                                     // unreadable answer: asked again by draftAll
}

// Counts results for the questions in today's bank (a draft for a question since removed from
// the bank is not counted).
//   drafted  — passed every check, waiting for Darren's review
//   rejected — failed the checks on every go; re-running tries them again
//   missing  — not tried yet (a run stopped early, or a *_LIMIT was set)
//   retried  — of the drafted ones, how many passed only after a rejected first go
function summarise(bank, done, field) {
  const c = { total: bank.length, drafted: 0, rejected: 0, missing: 0, retried: 0 };
  bank.forEach(q => {
    const d = done[q.id];
    if (!d) c.missing++;
    else if (d[field]) { c.drafted++; if (d.tries > 1) c.retried++; }
    else c.rejected++;
  });
  return c;
}

// The loop both tools share. Options:
//   bank    — the questions            outFile — where results are saved (JSON, keyed by question id)
//   field   — the key the text is saved under ('tip', 'plainExplanation')
//   check   — (text, q) => problems[]  prompt  — (q, lastProblems|null) => prompt text
//   ask     — (promptText) => Promise<text>   (the real one calls askModel; tests pass a fake)
//   limit, tries, log — how many questions, how many goes each, where progress lines go
async function draftAll({ bank, outFile, field, check, prompt, ask, limit = Infinity, tries = DEFAULTS.tries, log = console.log }) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const done = fs.existsSync(outFile) ? readJson(outFile) : {};

  // Drafts written under older, weaker checks are checked again; any that now fail are redone.
  bank.forEach(q => {
    const d = done[q.id];
    if (d && d[field]) {
      const problems = check(d[field], q);
      if (problems.length) done[q.id] = { [field]: '', rejected: d[field], problems };
    }
  });

  const todo = bank.filter(q => !(done[q.id] && done[q.id][field])).slice(0, limit);
  log(todo.length + ' of ' + bank.length + ' questions still need a draft.');
  let n = 0;
  for (const q of todo) {
    let text = '', problems = null, go = 0;
    // Ask, check, and on failure ask again — telling the model what was wrong last time.
    while (go < tries) {
      go++;
      text = String(await ask(prompt(q, problems)) || '').trim();
      problems = check(text, q);
      if (!problems.length) break;
    }
    done[q.id] = problems.length ? { [field]: '', rejected: text, problems, tries: go } : { [field]: text, tries: go };
    fs.writeFileSync(outFile, JSON.stringify(done, null, 1));   // after every question, so a stop loses nothing
    n++;
    log(n + '/' + todo.length + ' ' + q.id + (problems.length ? ' REJECTED: ' + problems.join('; ') : ' ok (go ' + go + '): ' + text));
  }
  const c = summarise(bank, done, field);
  log('Done. ' + c.drafted + ' of ' + c.total + ' drafted and waiting for review in ' + outFile +
      ' (' + c.retried + ' of those passed only on a later go); ' + c.rejected + ' rejected by the checks; ' +
      c.missing + ' not tried yet. Re-run to try the rejected and untried ones again.');
  return c;
}

module.exports = { DEFAULTS, OUT_DIR, settings, loadBank, readJson, askModel, draftAll, summarise };
