## Changelog
- **Mock Test → From my weak spots** (new, issue #61): a fourth kind of mock with the same format
  as the real one (50 questions, 57 minutes, 43 to pass, flags, review grid, results). Its
  questions come from her own results, in this order: questions she keeps missing, ones she got
  wrong last time, ones she flagged, ones due again, more from her 3 weakest topics (the Home
  card's "what to work on" order), then the rest spread like the real test. Each topic keeps
  within 2 of the real test's count, so every topic is still covered. Only bank questions, none
  twice (`TTCoach.buildWeakMock`).
- A line under the choice says what the mock holds and why, naming her weakest topics, e.g.
  "Built from your answers: 2 you keep missing · 2 you got wrong last time · 1 flagged · 2 due
  again · 13 from your weakest topics (Road and traffic signs, Rules of the road, Safety and
  your vehicle) · 30 spread like the real test". Before any answers it says the mock is like
  the real test.
- Saved tests now keep their kind. The results screen names it ("Mock from your weak spots"),
  the dashboard's list of mocks labels it "weak spots", and so do the mock chart's words for a
  screen reader. Admin → Activity says "Started a weak-spots mock (50 questions)". Its
  `test_start` event also carries the reasons.
- **Today's lesson and every drill**: inside each group (stuck, flagged, due, new), a question
  where she keeps choosing the same wrong answer comes first, then one she has got right under
  50% of the time over 3 or more tries. Before, ties went to the most misses, then the oldest.
- Every mock's size and clock come from `coach.js` (`coachDefaults.mockSize`, the new
  `mockMinutes`). "Like the real test" builds from `TTCoach.mockMix` (the coach's copy of its
  rule), and the Mock Test screen's 50 / 57 / 43 are values, not typed-in numbers. Its four
  choices sit two to a row on a phone.

## Requirements
- REQUIREMENTS.md line "**Tailored test generator**" → ✅ for the automatic version: "From my
  weak spots" builds a mock from her error pattern (stuck, missed, flagged, due, weakest
  topics), and the drill now uses her own difficulty and the wrong answer she keeps choosing.
  Remove "difficulty and distractor types not used yet".
- REQUIREMENTS.md line "**Distractor analysis**" → stays 🟡. The drill and the weak-spots mock
  now use the repeated wrong pick to rank questions. Grouping misconceptions by meaning is
  still not built.

## Status
- What exists: Mock Test → From my weak spots (`coach.js buildWeakMock`, the app's `startTest`
  and `weakMockPlan`). Tuning lives in `coachDefaults` (`weakMockSlack` 2, `weakMockTopics` 3,
  `mockMinutes` 57) and `drillDefaults` (`hardMin` 3, `hardAcc` 0.5). These are choices, not
  measurements (not verified against learning outcomes).
- How to test: `node --test` (474 tests). In a browser, seed a learner with answers (the
  `seed` option; answers need `p`, the option she picked, for the repeated-pick ranking). Open
  Mock Test → From my weak spots and read the line. Start it, end it, then open Admin →
  dashboard: the mock's row says "weak spots".
- Choices made (cheap to reverse; each is one number or one line in `coach.js`):
  - "Got wrong last time" means her latest answer on it was wrong.
  - Her weakest topics are the top 3 of `improvements()` with something to gain.
  - A repeated wrong pick and "hard" reorder questions inside a group. They never lift a
    question into an earlier group.
  - A weak-spots mock is saved and counted like any mock, so it shows in readiness and the
    chart (like Build your own). Its scores are likely lower on purpose.
  - Without `coach.js`, Start the mock now says coach.js did not load (it used to work
    without it).
- What's left: Build your own still has its own numbers (`1.14` minutes a question, `0.86` pass
  share), and so do Home's "50 questions" card, Print's paper mock and the dashboard's "Log a
  mock". Readiness does not tell a weak-spots mock from a plain one.
