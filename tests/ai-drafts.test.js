// Tests for tools/ai-drafts.js — the shared ask / retry / resume engine behind both AI tools.
// No network and no Ollama: the model is replaced by a fake `ask` function or a fake `fetch`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const drafts = require('../tools/ai-drafts.js');
const { checkTip } = require('../tools/write-memory-tips.js');
const plain = require('../tools/write-plain-explanations.js');

// Two small questions in the bank's shape.
const BANK = [
  { id: 'q1', question: 'What should you check first?', options: ['Mirrors', 'Horn', 'Radio', 'Fuel'], correctIndex: 0, explanation: 'Mirrors show what is behind you.', ruleRef: 'HC Rule 161' },
  { id: 'q2', question: 'When should you stop to rest?', options: ['When tired', 'Never', 'Hourly', 'At night'], correctIndex: 0, explanation: 'Only rest cures tiredness.', ruleRef: 'HC Rule 91' }
];
// A simple check for these tests: the word "bad" fails, anything else passes.
const check = text => (!text ? ['empty'] : /bad/.test(text) ? ['says bad'] : []);
const prompt = (q, last) => q.id + (last ? ' retry: ' + last.join('; ') : '');
const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-drafts-')), 'out', 'drafts.json');
const quiet = () => {};

// A fake model: hands back the given answers in order and records every prompt it was sent.
function fakeModel(answers) {
  const prompts = [];
  return { prompts, ask: async p => { prompts.push(p); return answers.shift(); } };
}

test('settings(): defaults, per-tool environment variables, and the tool\'s own fixed values', () => {
  const s = drafts.settings('EXPLAIN', { maxWords: 45 }, {});
  assert.equal(s.url, 'http://127.0.0.1:11434');
  assert.equal(s.model, 'qwen3:14b');
  assert.equal(s.limit, Infinity);
  assert.equal(s.maxWords, 45);
  const e = drafts.settings('EXPLAIN', {}, { OLLAMA_URL: 'http://gpu:1', EXPLAIN_MODEL: 'm2', EXPLAIN_LIMIT: '5', TIP_MODEL: 'other', AI_TIMEOUT_MS: '9' });
  assert.deepEqual([e.url, e.model, e.limit, e.timeoutMs], ['http://gpu:1', 'm2', 5, 9]);
  assert.equal(drafts.settings('EXPLAIN', {}, { EXPLAIN_LIMIT: 'lots' }).limit, Infinity, 'a limit that is not a number means no limit');
});

test('askModel(): sends the prompt with think off and a JSON shape for the one field, and returns that field', async () => {
  let sent;
  const fakeFetch = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ message: { content: JSON.stringify({ plainExplanation: 'Plain words.' }) } }) }; };
  const s = drafts.settings('EXPLAIN', {}, {});
  assert.equal(await drafts.askModel(s, 'hello', 'plainExplanation', fakeFetch), 'Plain words.');
  assert.equal(sent.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(sent.body.think, false);
  assert.equal(sent.body.model, 'qwen3:14b');
  assert.deepEqual(sent.body.format.required, ['plainExplanation']);
  assert.equal(sent.body.messages[0].content, 'hello');
});

test('askModel(): an unreadable answer comes back empty (so it is asked again), not as a crash', async () => {
  const s = drafts.settings('EXPLAIN', {}, {});
  const garbled = async () => ({ ok: true, json: async () => ({ message: { content: 'not json' } }) });
  assert.equal(await drafts.askModel(s, 'x', 'tip', garbled), '');
});

test('askModel(): Ollama down or refusing gives an error that says where and what to do next', async () => {
  const s = drafts.settings('EXPLAIN', {}, {});
  const down = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(drafts.askModel(s, 'x', 'tip', down), /Could not reach Ollama at http:\/\/127\.0\.0\.1:11434 \(ECONNREFUSED\)\. Start Ollama/);
  const refused = async () => ({ ok: false, status: 404, text: async () => 'model not found' });
  await assert.rejects(drafts.askModel(s, 'x', 'tip', refused), /Ollama answered 404 .*model not found.*ollama list/);
});

test('draftAll(): a failed draft is asked for again, telling the model what was wrong, until one passes', async () => {
  const outFile = tmpFile();
  const m = fakeModel(['bad one', 'good one', 'fine']);
  const c = await drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask: m.ask, log: quiet });
  assert.deepEqual(m.prompts, ['q1', 'q1 retry: says bad', 'q2']);
  const saved = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.deepEqual(saved.q1, { tip: 'good one', tries: 2 });
  assert.deepEqual(saved.q2, { tip: 'fine', tries: 1 });
  assert.deepEqual(c, { total: 2, drafted: 2, rejected: 0, missing: 0, retried: 1 });
});

test('draftAll(): after the last go fails, the draft is saved as rejected with its problems', async () => {
  const outFile = tmpFile();
  const m = fakeModel(['bad', 'bad again', 'still bad', 'fine']);
  const c = await drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask: m.ask, tries: 3, log: quiet });
  const saved = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.deepEqual(saved.q1, { tip: '', rejected: 'still bad', problems: ['says bad'], tries: 3 });
  assert.equal(c.rejected, 1);
  assert.equal(c.drafted, 1);
});

test('draftAll(): resumes — a question with a good draft is not asked again; a rejected one is', async () => {
  const outFile = tmpFile();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ q1: { tip: 'kept' }, q2: { tip: '', rejected: 'bad', problems: ['says bad'] } }));
  const m = fakeModel(['now fine']);
  await drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask: m.ask, log: quiet });
  assert.deepEqual(m.prompts, ['q2']);
  const saved = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.equal(saved.q1.tip, 'kept');
  assert.equal(saved.q2.tip, 'now fine');
});

test('draftAll(): an old draft that fails today\'s checks is redone', async () => {
  const outFile = tmpFile();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ q1: { tip: 'bad, passed under the old checks' }, q2: { tip: 'kept' } }));
  const m = fakeModel(['good now']);
  await drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask: m.ask, log: quiet });
  assert.deepEqual(m.prompts, ['q1']);
  assert.equal(JSON.parse(fs.readFileSync(outFile, 'utf8')).q1.tip, 'good now');
});

test('draftAll(): saves after every question, so a stop half way keeps what was done', async () => {
  const outFile = tmpFile();
  const answers = ['fine'];
  const ask = async () => { if (!answers.length) throw new Error('Ollama stopped'); return answers.shift(); };
  await assert.rejects(drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask, log: quiet }), /Ollama stopped/);
  assert.deepEqual(JSON.parse(fs.readFileSync(outFile, 'utf8')), { q1: { tip: 'fine', tries: 1 } });
});

test('draftAll(): a limit does only that many questions, and the rest count as not tried', async () => {
  const outFile = tmpFile();
  const m = fakeModel(['fine']);
  const c = await drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask: m.ask, limit: 1, log: quiet });
  assert.deepEqual(c, { total: 2, drafted: 1, rejected: 0, missing: 1, retried: 0 });
});

test('draftAll(): a broken results file stops the run with the file name and what to do', async () => {
  const outFile = tmpFile();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, '{ half a file');
  await assert.rejects(drafts.draftAll({ bank: BANK, outFile, field: 'tip', check, prompt, ask: async () => 'x', log: quiet }),
    /Could not read .*drafts\.json .*Fix or delete that file, then run again/);
});

test('summarise(): counts only questions still in the bank', () => {
  const c = drafts.summarise(BANK, { q1: { tip: 'a', tries: 1 }, gone: { tip: 'old' } }, 'tip');
  assert.deepEqual(c, { total: 2, drafted: 1, rejected: 0, missing: 1, retried: 0 });
});

test('loadBank(): reads every question from all five bank files, each with a unique id', () => {
  const bank = drafts.loadBank();
  // Counted from the files themselves, so adding a question to the bank does not break this test.
  const inFiles = [1, 2, 3, 4, 5].reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'questions-' + f + '.json'), 'utf8')).length, 0);
  assert.ok(bank.length > 0);
  assert.equal(bank.length, inFiles);
  assert.equal(new Set(bank.map(q => q.id)).size, bank.length);
});

test('both tools use the ONE shared check: the same invented number is caught by each', () => {
  const q = BANK[0];
  assert.match(checkTip('Mirrors, 3 times.', q).join(), /number not in the question: 3/);
  assert.match(plain.checkExplanation('Mirrors, 3 times.', q).join(), /number not in the question: 3/);
});
