# Changelog

Newest first. The version is the service-worker `VERSION` in `sw.js` — it changes on every
deploy that touches the app's cached files. Earlier history: `git log`.

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
