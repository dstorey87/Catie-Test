## Changelog
- Question bank checked again from scratch against official sources (issue #70, Darren
  2026-11-17: the questions "aren't right"). Five agents checked one bank file each; a second,
  independent agent re-opened every quoted source. **80 of 378 questions corrected** (81
  findings: 57 confirmed as proposed, 24 amended by the second check, none rejected). No marked
  answer was simply wrong, but:
  - 5 had a second defensible answer, so a learner who knew the rule could be marked wrong
    (e.g. t05q02 "It saves fuel" is also true; t09q22 didn't say the limit was in a red circle).
  - 9 stated a wrong or out-of-date fact (e.g. t11q22 called the camera sign yellow — it is white
    with a black border; t02q01 said "slow gently" when tailgated — official advice is drive
    normally, don't speed up or slow down; t13q06 left out "and you are trained to do so").
  - 21 explanations stated something no official source says (now say only what the source says).
  - 19 had wording that didn't match their options; 26 cited the wrong rule.
- 5 of the 20 free-sample questions changed (t01q02, t02q01, t02q02, t05q02, t13q01);
  `questions-free.json` is still an exact copy of the bank.
- The same 80 rows were corrected in the live Supabase `questions` table in one transaction and
  read back. Draft memory tips and plain explanations for questions whose wording changed were
  set to `rejected` (none had been approved), so a draft written for the old wording can't be
  approved by mistake; re-draft them with `tools/write-memory-tips.js` /
  `tools/write-plain-explanations.js`.
- New test data `tests/data/bank-recheck-2026-11.json` (id, why, source link, the fields it
  pins); `tests/bank.test.js` checks every one, so a corrected fact cannot quietly come back.

## Requirements
- No REQUIREMENTS.md line changes ("only questions and answers from the bank" still holds: every
  new wording is drawn from its quoted official source).

## Status
- Add: ✅ Question bank re-checked 2026-11-17 (#70): 80 corrected, each with its official
  source, in `questions-1..5.json`, the free sample and the live bank. Test: `tests/bank.test.js`
  with `tests/data/bank-recheck-2026-11.json`.
