# Changelog

Newest first. The version is the service-worker `VERSION` in `sw.js` — it changes on every
deploy that touches the app's cached files. Earlier history: `git log`.

## v18-2026-09-26
The app and Adventure stay in step (#51) and everything she does is tracked (#57), PR #58. 455 tests.
- **Two tabs:** with the app open beside Adventure (or a second app tab), the app shows her new answers,
  goal ring, streak, XP, flags and stars the moment the other saves, with no reload, and never saves
  back in reply. When another tab saved in between, the app joins the two copies (answers by question
  and time, sign answers too; flags question by question; Adventure stars stage by stage; XP added up;
  goal days of both) instead of writing its own copy whole. "Reset all progress" and "Import backup"
  still replace her answers.
- The app uses the rules it shares with Adventure (`coach.js`): streak and daily goal, reading style,
  the voice, and the words read aloud.
- Fixed: reading an explanation aloud ended with "undefined" when a question had no rule reference.
- **Admin → Activity** also lists notes added, changed or deleted (where, and how long — never the
  words), every Settings change (old → new), printing (format and how many), and Adventure stages in
  plain words.
- The first open after an update no longer risks a blank page while an older offline `coach.js` is in use.

## v17-2026-09-25
Every road sign on the test, by category, with quizzes and Adventure sign worlds (#48, PR #54). 436 tests.
- **Road Signs has every sign, road marking, light signal and vehicle marking in The Highway Code**:
  205 official pictures with the Highway Code's own caption word for word, under the pages' own
  headings (Signs giving orders 47, Warning signs 50, Direction signs 21, Information signs 24, Road
  work signs 11, Road markings 28, Light signals controlling traffic 14, Vehicle markings 10), plus 7
  DfT signs with no Highway Code twin. Category buttons at the top jump to each section.
- **Quiz me on all signs** and **Quiz me on this category**: the official picture, its caption as the
  right answer, and three other official captions from the same category as the wrong ones — nothing
  written by us. Sign answers count toward the daily goal, streak and XP; the bank's coach (Today's
  lesson, stuck questions, My answers, readiness) never sees them.
- **Adventure: 8 sign worlds** (15–22, one per category, 37 stages) on their own road, open from the
  start; same pass mark, stars and replays. Saved topic-world progress is untouched.
- 212 pictures in `signs/` (3.8 MB); only the 30 that bank questions use are downloaded on install,
  the rest the first time they're seen. One credit line (Crown copyright, OGL v3.0) on Road Signs,
  About and Help.
- Left out, each with its reason in `tests/data/highway-code-catalogue.json`: 2 pictures the official
  page gets wrong, 2 logos (not covered by the licence), 26 photographs of people (the arm-signal
  pages; not decided), and 26 whose caption is not a meaning.

## v16-2026-09-25
Official road sign pictures (#44, PR #50) and Adventure counting like practice (#47, PR #49). 422 tests.
- **Road signs are the real ones now.** Every sign picture is official Great Britain artwork from
  GOV.UK, unchanged except scaled down: signs from the Department for Transport's traffic sign images,
  road markings and traffic/motorway lights from The Highway Code. 37 pictures instead of 20 hand
  drawings, in one map (`signs.js`, `TTSigns.list`) that the question pictures, the Road Signs screen,
  the editor's list and the signs quiz all read. Credited (Crown copyright, Open Government Licence
  v3.0) on Road Signs, About and Help.
- **13 more bank questions show their sign**, and the three traffic-light questions show the light
  they ask about. Pictures that gave the answer away are off their questions (the stop sign's shape,
  the motorway colour, the speed camera, the brown sign, the zigzag lines). Live bank updated with
  `supabase/data/2026-09-25-sign-images.sql`.
- **"Quiz me on the signs" asks real bank questions** with a picture (up to 20); the 20 questions the
  code made up, and the "Road-sign quiz" pack, are gone.
- **Adventure answers count toward the daily goal and the streak** exactly like practice, and mark her
  active for reminders.
- **Adventure follows her reading settings** (text size, easy-reading font, high contrast, reduce
  motion, theme) and **reads aloud** like practice (speakers by the question, each option and the
  explanation; automatic read-aloud if she has it on).
- **Two tabs:** Adventure puts back answers, XP and flags that an older app tab saves over, while
  Adventure is open (the app's own half is still to do).
- The rules both pages use (goal, streak, reading style, voice, what is read aloud) live once in `coach.js`.

## v15-2026-09-25
Fixes for what Darren hit on v14 live (issue #42, PR #43). 389 tests (9 new, each seen failing first).
- **Signing in from an email link no longer shows the admin a paywall.** `config.js` and `backend.js`
  sat in `<helmet>`, so they ran twice; the second `backend.js` replaced the sign-in half-way with a
  copy that had no user, and until a reload the app skipped the admin check, the age check and sync.
  Both now load once, from the page head. A test fails if any script goes back into `<helmet>`.
- **No payment buttons that can only fail.** Stripe isn't set up (no Payment Links, no server
  functions), so `config.js` now has `payments: false`: the lock screen shows no Subscribe, Manage
  subscription or "I've paid", says to ask the admin for free access, and "Check my access again"
  says what it found. Nothing claims to be "checking with Stripe".
- **The admin gives an account free access from the app:** Progress dashboard → Accounts lists every
  account and its access, with Free for good, Free until a day and Take free access away. The server
  decides and refuses anyone but the admin, a day already gone and a Stripe payer (`admin_accounts`,
  `admin_set_access`; `has_access` honours a free-until day; migration `admin_free_access`).
- The admin's account line says "admin account: full access, never charged"; the per-learner access
  chips are labelled "On this device".
- Catie's managed login was rotated again (Vault first, proven by signing in): its password had been
  changed outside Vault after 2026-09-23.

## v14-2026-09-25
Fixes from the v13 live browser check (issue #38, PR #39). 380 tests (13 new, each seen failing first).
- **Adventure progress is no longer lost when two devices sync.** The sync kept the newer copy of a
  learner's whole record, so a device that had never played Adventure could wipe the stars earned on
  another. Adventure progress is now merged stage by stage, like flags: best score, most stars, passed
  on either device, most plays, latest play (`TTCoach.mergeAdventure`, used by the app's `mergeSnapshot`).
- Adventure map: on wide screens all 14 world tabs sit on one row (the 14th used to wrap onto the road).
- Adventure top bar fits a phone: the title stays on one line, her name shows in full, the star pill
  shows just her stars on a phone; the world header's stray "·" is gone.
- Adventure results: the in-a-row counter and "Best run" count first tries only, like the score.
- No more console errors on every load: the mock charts' marks are drawn by `TTScreen.chartMarks`
  instead of template values the browser read too early. The charts look the same.
- The how-to guide's pictures were retaken for v13 (36 of 41), and its Adventure and syncing words updated.

## v13-2026-09-25
The number after a line is the GitHub issue where the work is described.

### Adventure mode
- **A new Adventure page**, `adventure.html` (https://dstorey87.github.io/Catie-Test/adventure.html):
  a Duolingo-style route through the 14 theory test topics. Each topic is a world, drawn as a
  winding road with its stages on it: round lesson stops and a checkpoint flag (a trophy once
  passed). World tabs and arrows move between worlds; the top bar shows her stars out of all
  there are. It links back to the app. (#27)
- **An Adventure card on Home**, just under Today's lesson: a little map picture, the world she
  is on ("World 3 · Safety and your vehicle"), how many of its stages she has passed, and her
  stars out of every star on the route. Tapping it opens the Adventure page. Before she has
  played it says "Start your road trip through 14 topics"; once every stage is passed, "Every
  world done". (#27)
- **The route** (`coach.js` `adventureRoute`): one world per topic that has questions, in topic
  order. Inside a world the questions are sorted by id and cut into lessons of 7; a last lesson
  shorter than 4 joins the one before it. Each world ends with a 10-question checkpoint picked
  evenly across the whole world, so it tests every lesson. Only bank questions are used, and the
  same bank always gives the same route: with today's bank, 14 worlds of 4 lessons (7, 7, 7 and
  6 questions) and a checkpoint, 70 stages in all. (#27)
- **Unlocking and replaying** (`adventureStatus`): the first stage is always open; every other
  stage opens once the one before it is passed, across worlds too. A passed stage stays open to
  replay. Locked stages are grey with a padlock and say what to pass first; the stage she is up
  to pulses, with a little car on it and a "Start" label. (#27)
- **Pass mark and stars** (`adventureScore`, `adventureRecord`): 80% right passes. Stars: 1 at
  80%, 2 at 90%, 3 at 100%, and only with a pass. A replay keeps her best score and most stars,
  and a pass stays a pass. Every Adventure number is in `TTCoach.ADVENTURE`; the page types
  none of them. They are choices from Darren's brief, not measurements. (#27)
- **Playing a stage**: a progress bar, one question at a time with its options in a new order
  each play, and instant feedback: green "Nice!" with +10 XP, or red "Not quite" with the right
  answer. Both show the bank's explanation and rule reference, and the memory tip when the admin
  has approved one. A combo counter shows right answers in a row. A question she gets wrong
  comes back once before the stage ends; the score counts first tries only. Answer with a tap or
  the keys 1-4 or A-D; Enter moves on. Quit asks first ("Keep going" / "Leave"). (#27)
- **Results**: her score, stars that pop in, pass or fail with encouraging words, confetti on a
  pass (none when the device or the app's Reduce motion setting asks for less movement), and
  Next stage / Try again / Map. A pass that opens the next world says so. (#27)
- **Flags**: a Flag button on every question uses the app's own flags, so a question flagged in
  Adventure is on her Flagged screen and syncs the same way. (#27)
- **Saved with her learner**: each answer joins her answers (`src: 'adventure'`), +10 XP for each
  right answer as in the app, and her route progress under `adventure`. Activity gets the same
  events as the app, plus `adventure_stage_start` and `adventure_stage_end`. It uses the app's
  bank (server, then the offline copy, then the free sample) with the admin's deletions and
  corrections. On the free sample it says "Sign in to the app to unlock every world"; with no
  learner chosen yet it sends her to the app first. (#27)
- **Opens offline**: `adventure.html`, `adventure/adventure.js` and `adventure/adventure.css` are
  now in `sw.js` CORE, beside the four scripts it shares with the app, so any change to them now
  needs a VERSION bump. (#27)
- Light and dark follow the app's Appearance choice or the device. It works at 390px and
  1280px, with real buttons, a visible focus ring, a skip link and screen-reader messages. (#27)
- **Guide**: `help.html` has an Adventure mode section (what it is, how stages and worlds
  unlock, the pass mark and stars, replaying, flags and where progress is saved), with a
  screenshot of the map at 390px. (#27)

### Accessibility (WCAG 2.2 AA audit)
- **Every app screen checked and fixed**, for learner and admin, at 390px and 1280px, light and
  dark. On v12, axe-core found 10 rules failing; now it finds none against WCAG 2.0, 2.1 and 2.2
  A and AA (and its best-practice rules) on 34 app states. The help, about and legal pages pass
  too, and so does `adventure.html`, though the audit notes name only its "Open the app first"
  screen. A person using a real screen reader has not checked any of it yet. (#10, #32)
- **Right and wrong without colour**: after a practice answer the right option shows a tick and
  her wrong pick a cross. A screen reader is told the result straight away ("Not quite. The
  right answer is B: …", in the bank's own words), and each option's name says "Right answer"
  or "Your answer". The read-aloud button sits beside the option, not inside it. The two options
  the 50:50 hint takes away leave the Tab order. In a mock, the chosen option and the flag are
  announced as selected. (#10)
- **Keyboard**: the road-sign tiles, the dashboard's mock-history rows and the editor's question
  list are real buttons now. "Upload a photo", "Import backup" and "Load a question pack" can be
  reached with Tab. The notes sheet works as a dialog: focus moves into it, Tab stays inside,
  Escape closes it and focus goes back to the notes button. On a new screen or question, focus
  moves to its heading, and the browser tab shows the screen's name. (#10)
- **Names and states**: every form field has a name. Switches say on or off; choice buttons say
  which one is picked; the three Text size buttons, which all read "A", have their own names.
  Each mock review square says, for example, "Question 7, not answered, flagged". The mock-score
  chart is described with her real scores. The road-sign picture is named "Road sign picture",
  because naming the sign would give the answer away. (#10)
- **Contrast, light and dark**: all words reach at least 4.5:1 against their background (faint
  greys, grey words on beige chips, status words, white letters on the green and red answer
  squares, dark words on amber buttons in dark mode, the print preview's greys, amber topic
  labels). Switch tracks when off, the flagged-square border and the chart's pass line reach
  3:1. In the colour map (`TT_DARK`), `bg-d8d0bf` became `bg-8c8779`, `fg-686458` was added and
  six unused colours were removed. (#10)
- **The help and legal pages**: the teal panels' bold words, links and section numbers use a new
  darker teal, `--on-tint`; the guide's contents labels use `--muted` (`--faint` is for
  decoration only); code and path chips set their own text colour; and on `help.html` the title
  and introduction are inside `<main>`, so the skip link lands on the title. (#10, #32)
- **Narrow screens**: the Home header, the My Progress readiness card, the mock results topic
  bars and a flagged mock question's header no longer run off a 320px screen. (#10)
- **Kept on purpose**: "Like the real test" and "Surprise mix" keep the 57-minute limit,
  because matching the real test is their point; "Build your own" and tests from My answers can
  switch it off with "Timer for tests". (#10)

### Fixed
- **The My notes button never covers anything.** On a phone, and on every question, it is part
  of the page, at the bottom of the screen. On a wide screen it floats in the bottom-right
  corner, only in the empty space beside the page. On v12 at 390px it covered Reduce motion as
  Settings opened, Start the test, a Practise topic, a My answers row, Home's cards and the Home
  button after a session. Turning a tablet, resizing a window or changing the text size moves
  it straight away. (#32)
- **Opening the app no longer wipes Adventure progress.** The app's save rebuilt her record
  without `adventure`; it now carries the stored copy over, so the Adventure page's latest save
  survives, even with the app open in another tab. Coming back with the browser's Back button
  now re-reads her record, so the app doesn't save over what the page added. (#27)
- **My Progress wording**: "1 more right answer gets you there" (it said "1 more right answers
  gets"). After a shorter mock the line uses that mock's own size and pass mark, not "/50" and
  43. The readiness dial says "Based on your mocks", not "her mocks", and two more lines were
  fixed the same way. (#32)
- **The mock chart** starts a little under her lowest score instead of at 0, so the scores no
  longer bunch at the top. It always shows at least 30 to 50, so the pass line shows, and a
  line under it gives the range ("The chart runs from 30 to 50."). (#32)
- **Today's lesson for a brand-new learner** says "Your first 20 questions, to get you started",
  not "Built from your answers: 20 new". (#32)
- **After a wrong answer**, the memory tip and "Explain it differently" boxes use the answer
  card's full width instead of the narrow column beside the read-aloud button. (#32)
- **The legal pages at 1280px** are one centred reading column; they left 424px empty on the
  right. (#32)
- **Adventure's "Open the app first" message**: its car no longer runs 46px off the right edge
  and makes the page scroll sideways. (#10, #32)
- **Guide**: the Notes section says where the button is on a phone and on a wide screen; Today's
  lesson and My Progress match the fixes above; `help/img/settings.png` and
  `help/img/mock-intro.png` are retaken (both showed the old button covering controls). (#32)

### Tests
- `node --test`: 367 tests, all passing (291 at v12). New: 15 for the Adventure route in
  `tests/coach.test.js` (one fails if `TTCoach.TOPIC_NAMES` ever differs from the app's topic
  list); 21 in the new `tests/adventure-page.test.js` (saving, flags, comebacks, scoring, map
  maths, no Adventure number typed into the page), and 1 more there at this release: every file
  the page loads is precached; 8 in `tests/app-files.test.js` for the Home card and the app keeping Adventure progress; 19
  for accessibility, each failing on v12; 12 for the #32 fixes, each failing before its fix.
- The WCAG contrast sum is in one shared file, `tests/contrast.js`.

## v12-2026-09-25
The number after a line is the GitHub issue where the work is described.

### New for learners
- **Quick setup** on a learner's first open, one question per screen: test date (optional),
  questions a day (10, 20 or 30), reminder time (8am, Midday, 5pm, 8pm or none). Each answer
  saves into her normal settings; Skip or Done ends it for good; **Settings → Quick setup →
  Run it again** repeats it. It waits until her saved copy has come down from the server, so
  a new phone can't make an empty copy look newer than her real progress. (#7)
- **What's new** card on Home, once per app version, for a learner who was here before it;
  **Got it** hides it. The version is read from `sw.js`; the words are `TTWelcome.NEWS`. (#7)
- **Help, About, Privacy and Terms** links on both sign-in screens and in **Settings → Help and
  legal**, with Help on Home too; each opens in its own tab. The "not affiliated with or
  endorsed by the DVSA" line is on both sign-in screens and in Settings. (#7)
- **Pass prediction** on My Progress: expected mock score out of 50 and the chance of 43 or
  more, with what would raise it. Below 50 answers it says "Not enough answers yet". A chance
  is never shown as 0% or 100%. (#5, #8)
- **What to work on** on Home: the topic where more right answers would lift her expected
  score most, in one sentence, with a **Drill <topic> now** button. (#5, #8)
- **Study plan** screen (tap the test countdown on Home, or the button on My Progress): today's
  target and two focus topics, missed days spread over the days left, and the next 14 days.
  The test date can be set there. (#5, #8)
- **The wrong answer she keeps choosing**, in the bank's own words, on "Keeps tripping you up"
  and every My answers row; My answers has a new filter, **Same wrong answer again**. (#5, #8)
- **Close to a badge**: the Level card says what earns the nearest badge once she is 70% of
  the way there. (#5, #8)
- **Streak freezes**: one earned per 7 goal days, up to 2 held; a missed day uses one and the
  streak survives. Tap the streak tile to see them. The streak now counts her local days, so
  the tile, the streak badges and the family board agree. (#5, #8)
- **Family board** (Settings → Family board, off by default): a Home card comparing this
  account's learners who switched it on, by questions this week and current streak. Worked
  out on the device; nothing new is sent to the server. (#8)
- **Explain it differently**: under a wrong practice answer, a button shows an admin-approved
  plainer explanation. Only approved ones reach a learner; none is approved on the live
  server yet, so nobody sees the button until Darren approves some. (#6, #9)
- **Settings → Your data**: **Download my data** (one JSON file of everything the server keeps
  for the account), **Your age**, and **Delete my account** (lists exactly what goes; the
  button stays off until DELETE is typed; the server's refusal is shown word for word). The
  admin account is told why it can't be deleted here. (#4, #9)
- **The age question**, once, after an account's first sign-in (and once for accounts made
  before it). Under 16 (`config.js` `age.guardianUnder`) a parent or guardian ticks to agree
  and adds their email. Only the year is kept. "Not now" asks again next time the app opens.
  (#4, #9)

### For the admin
- **Admin → Memory tips → Plain explanations**: each AI draft beside the bank's own
  explanation, to approve, edit or reject; the same screen and save path as memory tips.
  Activity names "Asked for it explained differently" and logs each review. (#9)
- New tool `tools/write-plain-explanations.js`: the local AI (Ollama `qwen3:14b`, home PC)
  drafts a plainer explanation per question, at most 45 words, from the question, its right
  answer, explanation and rule reference only. Drafts land in `tools/out/` (not in git) for
  review; nothing reaches a learner from the tool. (#6)
- Both AI tools now share one set of checks (`tools/ai-checks.js`) and one ask / retry /
  resume loop (`tools/ai-drafts.js`). New rejections: an invented colour, and "the length of
  a …" comparisons. Fixed: the invented-number check didn't know "two", "eleven", "twelve"
  and a few others. New setting `AI_TIMEOUT_MS`. (#6)

### Server and data
- **Download my data**: server function `export_my_data()` returns everything held for the
  signed-in account, and only its own, even for the admin; `TTAccount.exportData()`. (#4)
- **Delete my account**: `delete_my_account()` deletes the account and every row it owns. It
  refuses the admin account, and an account whose Stripe subscription would still bill it,
  saying what to do. (#4)
- **Age and guardian consent**: profiles hold `birth_year`, `guardian_consent` and
  `guardian_email`; `TTAccount.saveAge()`, `age()` and `needsGuardian()`. The age lives only in
  `config.js`: 16, Darren's decision of 2026-09-24, stricter than the UK GDPR's 13. Only a
  birth year is stored, so someone turning 16 this year is still asked. (#4)
- **Plain explanations**: questions hold `plain_explanation` and `plain_status`; the app gets
  one only once it is approved (the same rule as memory tips). (#4)
- Applied to the live project as migration `privacy_export_delete_age_plain_explanations`
  (expand-only) and mirrored in `supabase/schema.sql`. (#4)
- **Coach** (`coach.js`): `passPrediction`, `improvements`, `studyPlan`, `misconceptions`,
  `badgeCloseness` and `streakWithFreeze`, all pure functions, with every threshold in one
  `COACH` object. The tuning values are choices, not measurements. (#5)
- New saved learner settings (expand-only; older versions ignore them): `onboardedAt`,
  `seenVersion`, `planStart`, `familyBoard`, and `streak.goalDays`. (#7, #8)

### Question bank (UK rules)
- Every question checked against current UK rules (Darren, 2026-09-24): **44 corrected**, each
  found by one agent and confirmed by a second with the official source quoted. Ids, topics
  and packs are unchanged, and so is the free sample. (#20, PR #24)
- 18 had a wrong fact: for example a doctor's car shows a **green** light, not blue; a level
  crossing has twin flashing **red** lights, not white; the horn ban is 11.30 pm to 7 am, not
  "at night". The other 26 named the wrong rule and now name the rule or official page that
  says it.
- The same 44 were corrected in the live Supabase `questions` table; all 378 live rows were
  read back and match the files.
- Their memory tips and plain explanations were re-drafted from the corrected wording; the 44
  tips are live as `draft`, waiting for approval.
- The full list, with what was wrong and the source for each:
  https://github.com/dstorey87/Catie-Test/blob/8834baa/changes/section-bank-uk.md

### Pages: help, about, legal
- `help.html`: how to use every feature as it works today, with screenshots of the real app,
  an FAQ, and a DVSA and accuracy section. (#2, kept up to date by #7, #8, #9)
- `about.html`: what the app is, for a parent or learner who has never seen it: how the
  coaching works, screenshots (a demo learner and free-sample questions only), prices and the
  free-sample size read from `config.js`, installing, and "Not affiliated with the DVSA". It
  states no bank size. (#3)
- `legal/privacy.html`, `terms.html`, `cookies.html`, `refunds.html`: complete sample pages.
  Darren has no business yet, so they carry clearly marked mock operator details
  (`support@example.com`, a mock address, all-zero company and ICO numbers) under a
  sample-policy banner, to be replaced before charging anyone. (#2, #21)
- What the legal pages state was checked on 2026-09-24: data stored in Supabase's Frankfurt
  region; kept while the account exists and deleted with it; no cookies at all; data requests
  answered within one month; England and Wales law. The lawful bases, liability wording,
  price-change notice and refund rules are sample choices for Darren to confirm. (#21)
- All the pages use the app's colours and fonts and follow its dark mode; prices, the free
  sample and the guardian age come from `config.js`.

### Fixed
- A new screen opened at the previous screen's scroll position; every screen and question now
  starts at the top. (#12)
- On a 390px phone, My Progress's topic rows and the admin dashboard's "Topics — weakest
  first" overflowed or squeezed to a letter or two a line; they wrap now, as does "20 hardest
  questions". (#8, #12)
- The notes button covered "Next →" on a long mock question; on question screens it is now a
  "My notes" button under the answers. It no longer covers the DVSA line on sign-in. (#7, #12)
- The readiness dial on My Progress showed only "%"; the number shows again. (#12)
- At 390px, the Settings Voice speed buttons (at the largest text size) and a long voice name
  ran out of their card. (#7, #9)
- Switching a reminder on no longer writes back settings from before the phone's permission
  prompt (found by reading the code; not reproduced). (#7)

### Tests and CI
- `node --test`: 291 tests, all passing. New files: `tests/bank.test.js` (every question's
  shape, plus one check per corrected fact), `tests/about-page.test.js`,
  `tests/help-pages.test.js` (fails if the guide or legal pages drift from the app, or a mock
  detail looks real), `tests/plain-explanations.test.js`, `tests/ai-checks.test.js` and
  `tests/ai-drafts.test.js`; more in `coach.test.js`, `backend.test.js` and `app-files.test.js`.
- `tests/browser/harness.js`: the fake account has a saved birth year by default
  (`birthYear: null` shows the age question); fake questions carry plain explanations.

## v11-2026-09-24 (hotfix)
- Fixed: the admin account could lose its admin screens. The "am I admin?" check asked the
  server for one profile without saying whose; since v10 the admin may read every profile
  (for Activity), so it could get a learner's row back. It now asks for its own row by id.
  Found by the server-privacy section (PR #11); test in `tests/backend.test.js`.

## v10-2026-09-24
- **Flags stay until she un-flags them.** New **Flagged** screen (Home card, and from the Admin
  dashboard): each flagged question with its answer and an **Un-flag** button. Getting it right
  doesn't remove a flag.
- A flag tapped in a mock is saved straight away, so leaving a mock unfinished no longer loses it.
- Fixed: syncing kept whichever device's whole copy was newer, so a flag made on the other device
  could vanish. Flags now merge question by question (`coach.js` `mergeFlags`, tested).
- Fixed: a background sync ended the practice session she was in the middle of.
- The flag button says whether it's on (`aria-pressed`) for screen readers.
- **Everything she does is recorded** in a new `events` table (Supabase): every answer with the
  option picked and the seconds taken, each question shown, sessions started, finished or left,
  mocks started, finished or abandoned, changed mock answers, hints, read-aloud, flags,
  "More like this", and screens opened. Events queue on the phone and send in batches, so
  nothing is lost offline (`backend.js` `TTTrack`, tested).
- **Admin → Activity:** totals, day by day, the questions she misses most (with the wrong
  answer she usually picks), time to answer by topic, and a plain-English log of the latest.
- **Today's lesson is now a drill built from her own answers** (`coach.js`, tested): questions
  she's stuck on (missed 3 times, or on 2 different days, and not since right twice running)
  first, then flagged, then ones due again by spacing (after 1, 3, 7, 14, 30 days as she keeps
  getting them right), then new ones, with topics alternating. A question she misses in the
  drill comes back 4 questions later, up to twice. The card says why: "Built from your answers:
  3 you keep missing · 2 flagged · 9 due again · 6 new". Only questions from the bank are used.
- **Memory tips.** Local AI (Ollama, `qwen3:14b`, on the home PC) drafts one tip per question
  from that question's own text (`tools/write-memory-tips.js`). A tip with a number the question
  doesn't contain (digits or words like "twice"/"halves"), one that repeats a wrong answer, or
  one over 25 words is rejected and asked for again. First run, 2026-09-24: 372 drafts loaded
  for review; 4 more rejected by hand for false analogies (e.g. "30 days in March"); 2
  questions have no tip and keep the topic tip. Drafts go into the bank as `draft`; **Admin → Memory tips** shows each beside its
  question to approve, edit or reject. Only approved tips reach Catie: after a wrong answer
  ("Memory tip: …", else the topic tip as before).
- **Keeps tripping you up** card (Home and session results): the questions she's stuck on, the
  wrong answer she tends to pick, the right answer, the memory tip (or the explanation), and
  **Drill these**.
- Fixed: the tip box after a wrong answer was a fixed pale box, unreadable in dark mode.
- Fixed: the answer options couldn't be chosen with a keyboard or a screen reader. They now
  take focus and answer on Enter or Space.

## v9-2026-09-23
- **Dark mode.** Settings → Appearance: Match device (the default), Light or Dark. It's per
  device and applies before the page draws, so there's no white flash. Printing is always
  light. How it works: colours are `var(--tt-<role>-<hex>)`, one map (`TT_DARK`, top of
  `Theory Trainer.dc.html`) gives each its dark version; a test fails if the two drift.
- Fixed: signing in to an unconfirmed account said only "Email not confirmed", with no way
  forward. It now says to open the emailed link (and check spam), with a **Send the
  confirmation email again** button.
- Fixed: links in confirmation and password-reset emails pointed at Supabase's default
  address (`localhost:3000`). The app now asks for them to come back to itself.
- Fixed: a password-reset link had nowhere to land. It now signs you in and opens **Set a
  new password**; an expired link says so and offers a new one.
- Tests: `tests/backend.test.js` (sign-in and email links), plus a theme-map check.

## v8-2026-09-23
- **My answers** screen (Home, My Progress, mock intro and mock results link to it): every
  question answered in practice or a mock, newest first, with what was chosen and the right
  answer. Filter by wrong/right, tick any, then practise them, make a test of exactly those
  (timer on or off), or get more like them.
- **More like this**: after any practice answer (the similar questions slot in next), on
  each wrong mock answer, on every My answers row, and "More like the ones I missed" at the
  end of a session. Logic in `picker.js`, tests in `tests/`.
- Mock answers are now logged (marked as mock) so they appear in My answers and count
  towards badges. The readiness dial and topic bars still count practice only — the mock
  score already feeds them.
- Every answer now records which option was picked.
- Fixed: a wrong practice answer printed the same "Remember" tip twice.
