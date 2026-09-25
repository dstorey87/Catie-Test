## Changelog
- Coach (`coach.js`): **Adventure mode route** (`adventureRoute`, issue #27). It turns the bank into worlds and stages: one world per DVSA topic that has questions, in topic order, named from the app's own topic list. Inside a world, the questions are sorted by id and cut into lessons of 7 (`w<topic>s1`, `s2`, ...). A last lesson shorter than 4 joins the lesson before it. Each world ends with a checkpoint (`w<topic>c`) of 10 questions picked evenly across the whole world (about every 3rd question by id), so it tests every lesson. Only bank ids are used. The same bank always gives the same route. With today's bank that is 14 worlds, each with 4 lessons (7, 7, 7, 6) and a 10-question checkpoint: 70 stages in all.
- Coach: **where she is on the route** (`adventureStatus`). The first stage is always open. Every other stage opens once the stage before it is passed, even across worlds, so world 2 opens when world 1's checkpoint is passed. A passed stage stays open so it can be replayed. It also returns the current stage (the first open stage she hasn't passed yet; none once everything is passed) and how many worlds are done (a world is done once its checkpoint is passed).
- Coach: **scoring a stage** (`adventureScore`). 80% right passes. Stars: 1 at 80%, 2 at 90%, 3 at 100%. Stars only come with a pass. "Exactly 80%" passes. An empty stage scores 0.
- Coach: **saving a play** (`adventureRecord`). It returns a new copy of the progress and leaves the old one untouched. It keeps her best score and most stars, a pass stays a pass after a worse replay, the play count goes up by one and `lastAt` is set. Progress shape: `{stages: {<id>: {best, stars, passed, plays, lastAt}}}`. The page stores it in `theoryTrainer.d.<learnerId>` under `adventure`.
- `TTCoach.TOPIC_NAMES` is the 14 topic names, copied exactly from the app's `TOPICS`. A test fails if the two ever differ. `TTCoach.ADVENTURE` holds every Adventure number (7, 4, 10, 0.8, stars 0.8/0.9/1).
- 15 new tests in `tests/coach.test.js` (306 in the suite).
- `coach.js` is in `sw.js`'s CORE list, so bump `VERSION` at promotion.

## Requirements
- No REQUIREMENTS.md line names Adventure mode yet (Darren asked for it on 2026-09-24, issue #27). At promotion, add one: "Adventure mode: a Duolingo-style route of worlds and stages" → 🟡. The route logic is built here. The page (`adventure.html`) and the Home card are in their own sections.

## Status
- `coach.js` now builds the Adventure route and works out her place on it. To try it in the browser console: `TTCoach.adventureRoute(bank)`, then `TTCoach.adventureStatus(route, progress)`. To test: `node --test tests/coach.test.js`.
- Known limit: a stage's questions come from the bank the page passes in. If a learner unlocks more packs, lessons are recut, and saved progress (kept by stage id) then belongs to lessons whose questions have partly changed. With the full bank the route is fixed.
- The sizes and thresholds (7-question lessons, 10-question checkpoint, 80% to pass, stars at 80/90/100%) come from Darren's brief. They are design choices, not measurements (not verified against any learning study).
