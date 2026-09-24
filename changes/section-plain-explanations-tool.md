## Changelog
- New tool `tools/write-plain-explanations.js` ("Explain it differently"): the local AI (Ollama
  `qwen3:14b` on the home PC) drafts a plainer explanation of every bank question's answer, as
  it would explain it to a 17-year-old with one everyday analogy, in at most 45 words. It is
  given only the question, the right answer, the explanation and the Highway Code reference
  (never the wrong answers). Drafts go to `tools/out/plain-explanations.json` (git-ignored),
  keyed `plainExplanation`, for Darren to approve. Nothing reaches a learner from the tool.
- Every draft is machine-checked before Darren sees it: not empty, at most 45 words, no number
  or colour that is not in the question's own text (digits and number words), no comparison of
  a measurement with something the question never mentions ("the length of a football
  pitch"), no wrong answer repeated, and not just a copy of the existing explanation. A draft
  that fails is asked for again (up to 3 goes) with the reasons; the file is saved after every
  question, so a stopped run resumes. The checks cannot judge whether an analogy is apt, so
  Darren's review stays the gate.
- New shared checks, for memory tips too: an invented colour (lights, signs and road markings
  make colour a fact) and a "length of a …" / "as far as a …" comparison are rejected. The
  first full run showed why: it drafted "23 metres … like the length of a football pitch".
- The checks now live once in `tools/ai-checks.js`, and the ask / retry / resume loop once in
  `tools/ai-drafts.js`; `write-memory-tips.js` and `write-plain-explanations.js` both use them
  (memory tips: same prompt, limits and output file as before).
- Fix: the invented-number check did not know the word "two" (nor eleven, twelve, fifteen,
  eighty, ninety, thousand, zero, dozen). An invented "two car lengths" passed, and a "2" was
  wrongly rejected when the question itself said "two". Both are now handled, with a test.
  Re-running `write-memory-tips.js` re-checks existing tips under the stricter rule.
- New setting `AI_TIMEOUT_MS` (both tools): give up on one answer after this long instead of
  hanging; per-tool `EXPLAIN_MODEL` / `EXPLAIN_LIMIT` alongside the existing `TIP_*` ones.

## Requirements
- REQUIREMENTS.md line "⛔ **Explain-it-differently**" → 🟡: drafts exist for the bank (376
  of 378 drafted and passing every check). Still to do before ✅: the Backend section's
  `plain_explanation` / `plain_status` columns (#4), loading the drafts as `draft`, Darren's
  review screen and the learner's button (#9).
- REQUIREMENTS.md line "✅ AI layer, decided 2026-09-24" stays ✅; add that the same local AI
  also drafts plain explanations, under the same checks.

## Status
- ✅ Plain explanations ("Explain it differently"): drafted by local AI for the bank,
  2026-09-24: **376 of 378 drafted** and passing every check, **2 rejected by the checks**. One
  full pass (qwen3:14b, about 33 minutes): 374 drafted, 4 rejected, 17 needing a second or third
  go; two re-runs then drafted 2 of those 4. Still rejected: t09q08 (always a few words over 45)
  and t09q24 (keeps naming "the hard shoulder", one of its wrong answers). Drafts are 22–44 words.
  Review these first (they name something their question does not, e.g. "a stop sign", "a few
  seconds"): t01q03, t03q01, t04q18, t11q01, t11q03, t11q09, t11q11, t12q02, t12q04, t12q12,
  t02q24, t08q23, t09q26, t10q21, t11q24, t12q23.
  How to run: `node tools/write-plain-explanations.js` on the home PC with Ollama running
  (re-run any time; it resumes and retries the rejected ones). Output:
  `tools/out/plain-explanations.json` (not in git). Tests: `node --test`
  (`tests/plain-explanations.test.js`, `tests/ai-checks.test.js`, `tests/ai-drafts.test.js`).
- Left: load the drafts into Supabase as `draft` once #4 adds the columns (hub), Darren reviews
  them (#9 adds the screen), and the learner's "Explain it differently" button (#9).
- Bank bug to fix (Docs/data lane, reported on #6): t02q15's question says a doctor's car has a
  **blue** flashing light, its own explanation says **green**. Do not approve AI text for
  t02q15 until the bank is fixed against Highway Code Rule 219.
- The drafts live only on the PC that ran the tool, in the section worktree:
  `Catie-Test-wt-plain-explanations-tool/tools/out/plain-explanations.json`. Copy it to the hub's
  `tools/out/` before that worktree is removed (it is git-ignored, so git will not carry it).
- README.md `tools/` list: add `tools/write-plain-explanations.js` — run on the home PC: local
  AI drafts a plainer explanation per question for the admin to approve (drafts land in
  `tools/out/`, never committed); and `tools/ai-checks.js` / `tools/ai-drafts.js` — the checks
  and the ask / retry / resume loop both AI tools share.
