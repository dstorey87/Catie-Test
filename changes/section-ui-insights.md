## Changelog
- **Pass prediction on My Progress** (issue #8), straight under the readiness dial: her expected
  mock score out of 50 and her chance of 43 or more, from `TTCoach.passPrediction`. Below 50
  answers it says "Not enough answers yet", how many more are needed, and shows a bar. It also
  says what would raise it (the coach's top "what to work on" sentence) and that it is an
  estimate from her own answers, not a promise. A chance is never shown as 0% or 100%
  ("under 1%", "over 99%").
- **What to work on, on Home**: the topic where more right answers would lift her expected mock
  score most (`TTCoach.improvements`), in the coach's own sentence, with **Drill <topic> now**
  and a second topic underneath. The drill uses the coach's drill rules inside that topic
  (stuck, flagged, due, then new), topped up from the Leitner boxes. Under 50 answers the card
  says it is early days.
- **Study plan screen** (new): from the test countdown on Home (which now also says "Today's
  plan: N questions") and a button on My Progress. It shows today's target, how many are done,
  today's two focus topics and a **Practise today's topics now** button; a note naming any
  missed days and saying their questions are spread over the days left; why the workload is
  what it is; and the next 14 days. No date, a past date and test day each get their own
  message, and the date can be set or changed on the screen. `TTCoach.studyPlan` rebuilds it
  every time; the day the plan began is saved when the date is set (or the plan is first
  opened), so a missed day is noticed.
- **The wrong answer she keeps choosing**: "Keeps tripping you up" (Home and session results)
  and every My answers row now say which wrong answer she keeps choosing and how often ("You
  keep choosing "12 metres" — 3 of your 4 wrong answers"), from `TTCoach.misconceptions`, in the
  bank's own words. If her latest answer was right it says "Right last time. Before that you
  chose …". My answers has a new filter, **Same wrong answer again**.
- **Close to a badge**: the Level card on Home shows "Close to a badge: 2 more right answers in a
  row earns Ten in a row" once she is 70% of the way to one (`TTCoach.badgeCloseness`).
- **Streak freezes**: the streak tile shows the freezes she holds; tapping it explains how they
  work (one per 7 goal days, hold up to 2, a missed day uses one), how many more goal days earn
  the next, and which days a freeze saved. The streak itself is now worked out from her local
  days with freezes (`TTCoach.streakWithFreeze`), so the tile, the streak badges and the family
  board agree. Goal days are recorded as they happen (`streak.goalDays`), so raising the daily
  goal later never takes a day back. "Today's goal" now counts her local day too.
- **Family board** (opt-in, Settings → Family board, off by default): a Home card comparing the
  learners on this account who have switched it on — questions this week (from Monday) and
  current streak. Worked out on the device from each learner's saved copy; nothing new is sent
  to the server. A learner who hasn't switched it on is never shown.
- Fixed (already on develop): at 390px My Progress scrolled sideways (425px wide) for a new
  learner, because the "Your topics" rows could not shrink. The topic name now wraps and the
  bar shrinks.
- Fixed before merge: the What to work on and study plan buttons named a question count the
  drill doesn't keep (a stuck question comes round again on top); they no longer promise one.
- The screen words live in one page-head block, `window.TTInsights` (like `TTWelcome`), with its
  tuning in `TTInsights.CFG`; the coach's numbers come from `TTCoach.coachDefaults`, not copies.
- **How-to guide (`help.html`) updated for all of the above**: new sections **Study plan** and
  **Family board** (both in the contents), new parts **Streak freezes** and **What to work on**
  under Home and **Pass prediction** under My Progress, the Family board switch under Settings,
  and "Same wrong answer again" under My answers. Two lines had become wrong and were rewritten:
  "Miss a day and it starts again from 1" (freezes now save a day) and "You tend to pick". Five
  new screenshots and two re-taken (`home.png`, `tripping.png`), all 390×844, light.
  `help.html` is the Pages lane's file: its section (#2) had merged and finished, nobody was
  working on it, and its test "every Settings switch in the app is explained in the guide"
  failed on the new switch, so it was updated here and said so on issues #2 and #8.
- Tests (`tests/app-files.test.js`, +17, run against the real `coach.js`): dates and weeks, goal
  days, the streak tile, pass chance wording, prediction, what to work on, the study plan (all
  four states, missed days, the unseen-question raise), misconception lines, the badge nudge,
  the family board, the wiring on each screen, the family board being off by default, the
  numbers coming from `coach.js`, the guide's numbers matching `coach.js`, and the two fixes
  above. The "pages still being written" skip list is gone: help.html and the legal pages have
  landed, so every help and legal link is now checked for real.

## Requirements
- REQUIREMENTS.md line "**Distractor analysis**: record which wrong option was chosen…" → 🟡
  stays. The analysis is now on screen ("Keeps tripping you up", My answers and its "Same wrong
  answer again" filter). Grouping similar misconceptions by meaning is still not built.
- REQUIREMENTS.md line "**Improvement suggestions on Home**…" → ✅. Home's "What to work on"
  card, ranked by predicted gain, with a drill button. Measured as "N more right answers → expected
  score", not minutes or readiness %.
- REQUIREMENTS.md line "**Pass prediction**: estimate mock score and probability of passing, with
  what would raise it" → ✅ (My Progress). Not checked against real test results: not verified.
- REQUIREMENTS.md line "**Study plan to test date**…" → ✅ (the Study plan screen, which adapts
  when a day is missed).
- REQUIREMENTS.md line "Streak freeze / repair, weekly summary email, "you're close to a badge"
  nudge" → 🟡. The streak freeze and the badge nudge are built; streak repair and the weekly
  summary email are not.
- REQUIREMENTS.md line "Leaderboard or family comparison (opt-in)" → ✅ as the family comparison
  (opt-in, this account's learners only, no server). No public leaderboard, by design.

## Status
- **Where the new things are:** Home → streak tile (tap it for freezes), the Level card (badge
  nudge), the test countdown (tap for the study plan), "What to work on", "Keeps tripping you up",
  and the Family board card (once switched on in Settings). My Progress → "Pass prediction" under
  the dial and a "Study plan" button. My answers → the "you keep choosing" line and the "Same wrong
  answer again" filter. Settings → Family board.
- **New saved data (expand only; older app versions ignore it):** `streak.goalDays` (local days
  the goal was met, newest 400 kept), `settings.planStart` (the day the study plan began; reset
  when the test date changes), `settings.familyBoard` (off unless she switches it on).
- **How to test:** `node --test`. In a browser, seed a learner with answers (see
  `tests/browser/harness.js`), tap the learner, and open Home, My Progress, the study plan and My
  answers.
- **At promotion (hub):** suggested What's new lines for `TTWelcome.NEWS` — "My Progress now
  predicts your mock score and your chance of passing." / "Set a test date and the Study plan
  says what today needs, and catches up if you miss a day." / "Streak freezes: every 7 goal days
  earns one, and it saves your streak if you miss a day." / "What to work on, on Home, shows the
  topic that would lift your score most."
- **Help guide:** `help.html` explains every new screen (see Changelog). Its `#progress` "Known
  problem" box about the readiness number is still there: that bug is #12 part D, not fixed here.
- **Issue #12 (App/UI bugs):** part B's My Progress overflow is fixed here ("Your topics" rows).
  Its note that the admin dashboard's "Topics — weakest first" rows also overflow at 390px was
  not checked or changed here. Parts A (screens open mid-scroll), C (notes button over Next) and
  D (readiness number not drawn) are untouched.
- The tuning values (70% for "close to a badge", 14 days listed in the plan, Monday week start,
  pass-chance colours at 70% and 40%) are choices, not measurements.
- Home re-renders in 12–19 ms with 3,000 answers (the app's cap), measured in headless Chromium
  on the home PC; not measured on a phone.
