## Changelog
- **Every mock number comes from one place** (issue #65): `coach.js` `coachDefaults` (`mockSize` 50,
  `mockMinutes` 57, `passMark` 43) and two new rules for a test of any size, `mockPassMark` and
  `mockClock`, which keep the real test's proportions (the new `mockMinMinutes` 3 is the shortest
  clock). Build your own's pass mark and timer, Home's Mock Test card, Print's test paper (its
  header, its choice and hint, and how many questions it holds), the dashboard's Log a mock (its
  "Score out of", highest score, total and pass check), the mock chart's pass line and scale, the
  results screen, the "Mock passed" badge and "Last mock" all read them. No more 1.14, 0.86 or a
  typed 43/50/57; a test in `tests/app-files.test.js` fails if one comes back.
- Build your own's timer is now worked out in whole numbers: 25 questions get 29 minutes (28.5
  rounded up), where "x 1.14" gave 28; the same one minute more at 75, 175, 325, 375, 425, 625 and
  675 questions. Every other size up to 700, and every pass mark, is as before (checked 1 to 700).
- A test keeps the pass mark it started with, so a test finished after an update is marked as it
  began. Print's test paper and "Like the real test" now pick their questions the same way
  (`realTestPick`, from `mockMix`): same spread and order as before.
- Without `coach.js` (the one open after an update, issue #51) no test, paper or logged mock is made
  (each says why), and the mock chart is left out; her list of mocks still shows.
- **Mock chart**: the "pass 43" label no longer sits on her last dot when her last mock is near the
  pass mark. It stays at the right end above the line unless a dot touches it there; then it goes
  below the line, then further left. Measured at 390 and 1280px, light and dark, last mock 44 and
  45: overlap with her last dot was 22px² (390) and 116px² (1280); now 0.
- **Adventure map**: the road is drawn only inside the map. Its round top used to reach 17.8px
  (390px) and 22.8px (768 and 1280px) up into the row of sign-world tabs; it now starts 7.2px below
  that row (light and dark).

## Requirements
- REQUIREMENTS.md line "Mock test: 50 questions, 57 minutes, flag/review grid, pass mark 43" → stays
  ✅; the numbers now live only in `coach.js` `coachDefaults`.

## Status
- Remove from "Known issues": "Adventure map: the road's rounded top reaches up into the bottom of the
  world-tab row …; the chart's "pass 43" label can overlap the last dot …" (both fixed, #65).
- What exists: `coach.js` `mockPassMark(total)` and `mockClock(total)`; the page reads them through
  `TTScreen.mock`, `passMark`, `clock`, `outOf`, `testPassMark` and `paperLine`.
- How to test: `node --test` (489 tests). In a browser (harness), Mock Test → Build your own with 25
  questions shows "22 to pass" and "Timer (29 min)"; Print → Test paper → Preview shows "50 questions ·
  57 minutes · pass mark 43"; a learner whose last mock is 44 or 45 has the chart's label under the line.
- Left: XP numbers (10 a right answer, 50 for a passed mock) are still typed into the app; the topic
  tips that teach "50 questions, 57 minutes, 43 to pass" are words to learn and stay as written.
