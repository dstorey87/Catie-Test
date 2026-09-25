# Theory Trainer — request checklist

Last updated: 2026-09-25 (v14).

States: ✅ done & verified · 🟡 built, not yet seen working for real · ⚠️ built, needs your account/keys to go live · 📋 your step (minutes) · ❌ not possible, honest alternative given.

## The app
- ✅ 378 original questions, 14 DVSA topics, 4 options, explanation + Highway Code ref; 20 signs with spoken meanings
- ✅ **Every question checked against current UK rules** (2026-09-24, issue #20, PR #24): 44 corrected, each with its official source, in `questions-1..5.json` and the live Supabase bank (all 378 live rows read back and match the files). Test: `tests/bank.test.js`. The list with sources: https://github.com/dstorey87/Catie-Test/blob/8834baa/changes/section-bank-uk.md
- ❌ The actual DVSA question bank — licensed and not published; ✅ same format and facts, and licensed sets you buy load in as packs
- ✅ Practise (read-aloud, Leitner boxes, 50:50, auto-advance), mock test (50q/57min, flags, review grid, pass 43), build-your-own test, surprise mix, focus drill, signs quiz
- ✅ **My answers**: every question she has answered (practice and mock), newest first, with what she said and the right answer; filter wrong/right, or **Same wrong answer again**; tick any → practise them, make a timed or untimed test from them, or get more like them
- ✅ **More like this**: after any practice answer (slots similar questions in next), on each wrong mock answer, on every My answers row, and "More like the ones I missed" at the end of a session
- ✅ Duolingo-style loop: daily goal, day streak, XP + levels, "Today's lesson" remix
- ✅ **Adventure mode** (v13, issue #27): https://dstorey87.github.io/Catie-Test/adventure.html — a Duolingo-style route through the 14 topics, drawn as a winding road. Each topic is a world of 7-question lessons and a 10-question checkpoint (70 stages with today's bank). 80% right passes a stage and opens the next; stars at 80%, 90% and 100%; any passed stage can be replayed; a missed question comes back once; flags show in her Flagged screen. How to use it: choose the learner in the app, then Home → **Adventure** (just under Today's lesson) → tap the stop with the car on it → Start. Progress is saved in her record under `adventure` (best score, stars, plays) and the app keeps it when it saves; answers and XP join her normal ones. It opens offline (in `sw.js` CORE). On the free sample it says "Sign in to the app to unlock every world". Test: `node --test tests/coach.test.js tests/adventure-page.test.js`; in a browser, see How to test
- ✅ Insights after every session, readiness dial (its number shows again since v12), topic traffic-lights, mock trend, 20 hardest, external mock logging
- ✅ Notes on any screen (the **My notes** button: on a phone, and on every question, it is at the bottom of the screen; on a wide screen it floats beside the page; since v13 it never covers a control), question flagging (kept until she un-flags; her own Flagged screen), revision list, printable answer book / flashcards / test paper
- ✅ The coach (`coach.js`): Today's lesson is a drill built from her answers; "Keeps tripping you up" shows what she keeps missing, the wrong answer she keeps choosing (and how often), and a memory tip
- ✅ **Quick setup** on a learner's first open: test date, questions a day, reminder time. Settings → Quick setup → Run it again. It stores the existing settings (`examDate`, `dailyGoal`, `remindHour`/`remindOn`) plus `onboardedAt`
- ✅ **What's new** card on Home, once per `sw.js` VERSION, for learners who were here before it (Got it stores `settings.seenVersion`). At every release rewrite `TTWelcome.NEWS` (top of `Theory Trainer.dc.html`); `node --test` fails until you do
- ✅ **Pass prediction** (My Progress, under the dial): expected mock score out of 50 and the chance of 43 or more; "Not enough answers yet" below 50 answers. Not checked against real test results: not verified
- ✅ **What to work on** (Home): the topic that would lift her expected score most, with a Drill button
- ✅ **Study plan** (tap the test countdown on Home, or My Progress → Study plan): today's target and two focus topics, catches up after a missed day, the next 14 days. Stores `settings.planStart`
- ✅ **Close to a badge** nudge on the Level card; **streak freezes** (tap the streak tile): one per 7 goal days, hold up to 2, a missed day uses one. Goal days are kept in `streak.goalDays`
- ✅ **Family board** (Settings → Family board, off by default): compares this account's learners who switched it on, worked out on the device
- 🟡 **Explain it differently**: under a wrong practice answer, a button shows the approved plainer explanation. Built and browser-checked with faked rows; nobody sees it until the drafts are loaded into Supabase and approved (see What's left)
- ✅ Memory tips: drafted by local AI from each question's own text, checked for invented numbers, live only once approved in Admin → Memory tips. The 44 corrected questions' tips were re-drafted and are live as `draft`, waiting for approval
- ✅ Everything she does is recorded (`events` table) and shown in Admin → Activity (including "Asked for it explained differently"). To delete only an account's history: `delete from public.events where user_id = '<uuid>';` — Delete my account (below) removes it all
- ✅ Question editor with search, sign picker, pack import, bank export
- ✅ Test-date countdown (it also says "Today's plan: N questions"); accessibility (text size, dyslexia font, high contrast, reduced motion)
- ✅ Dark mode: Settings → Appearance (match device / light / dark), per device; printing stays light
- 🟡 **Accessibility, WCAG 2.2 AA** (v13, issues #10 and #32): every app screen (learner and admin) and the help, about and legal pages pass axe-core's automated WCAG 2.0, 2.1 and 2.2 A and AA checks at 390px and 1280px, light and dark. It works by keyboard alone; ticks and crosses show right and wrong; all text reaches 4.5:1 in both themes. Not done: a check by a person using a real screen reader (VoiceOver, TalkBack or NVDA), so not verified. Test: `node --test tests/app-files.test.js` (the `#10` tests); in a browser, switch the device to dark mode or reduce motion, or Tab through a practice session and a mock
- ✅ Works offline; a test in progress survives a reload or a flat battery
- ✅ Help, About, Privacy and Terms links on both sign-in screens and in Settings → Help and legal (Help on Home too); the "not affiliated with the DVSA" line on both sign-in screens and in Settings

## Pages (outside the app; live on the site from v12)
- ✅ How-to guide: https://dstorey87.github.io/Catie-Test/help.html — every feature, screenshots of the real app (`help/img/`), FAQ. To refresh a screenshot after a UI change: drive the app with `tests/browser/harness.js` at 390px and replace the file of the same name; `node --test` fails if a picture's size or alt text is wrong or a file is unused
- ✅ About page: https://dstorey87.github.io/Catie-Test/about.html — for a parent or learner who has never seen the app; prices and free-sample size come from `config.js`. To refresh its pictures: serve the repo, then `BASE=http://127.0.0.1:<port>/ node about/capture.js`
- ⚠️ Legal pages: https://dstorey87.github.io/Catie-Test/legal/privacy.html, and `/legal/terms.html`, `/legal/cookies.html`, `/legal/refunds.html` — complete sample pages with clearly-marked mock business details under a sample-policy banner (Darren has no business yet, 2026-09-24). To go live with real details: replace every highlighted "(mock)" value and delete the `<div class="draft" role="note">` banner from all four pages in the same change (the tests refuse one without the other)

## Duolingo-style habit loop
- ✅ Levels with names (Provisional → Full Licence), XP bar on Home showing progress to the next level, level-up card at the end of a session
- ✅ 10 badges earned from real activity: first go, ten in a row, century, five hundred, week/month streaks, mock passed, three mocks, topic mastered, every topic tried — with progress counts on the locked ones
- ✅ Daily goal (10/20/30), day streak with flame (now counted in her local days, with freezes), "Today's lesson" smart remix, XP for correct answers and mock passes
- ✅ Daily reminders: each learner picks 8am / midday / 5pm / 8pm; the server nudges only on days with no practice, in their own timezone, once a day
- ⚠️ Reminders while the app is closed need one keypair + one scheduled function (SETUP.md §5, ~10 min). Until then the app nudges in-app
- ✅ iPhone/iPad handled honestly: Apple only allows notifications for home-screen apps, and the Reminders card says so

## Accounts — no tokens anywhere
- ✅ Email + password sign-up and sign-in, on the app's own screens
- ✅ Password reset by email (the link opens "Set a new password"); email confirmation on new accounts, with a resend button when an account isn't confirmed yet
- ✅ One account covers every learner in a family and every device; progress merges (newest wins per learner)
- ✅ Sign out / switch learner; profile photos; admin role
- ✅ Progress syncs by itself: pulls on open, pushes a few seconds after answers, retries when signal returns. Learners never see a sync control
- 🟡 **Settings → Your data**: Download my data (one JSON file of everything the server keeps), Your age, Delete my account (off until DELETE is typed; refuses the admin account and a subscription that still renews). Browser-checked against the fake server; the server side is proven live. Not yet run from the app against the live project: not verified there
- 🟡 **The age question**: once, after an account's first sign-in; under 16 (`config.js`, Darren's decision 2026-09-24) a parent or guardian agrees and adds their email. Only the year is kept. Same checks as above: not yet run against the live project
- ✅ Supabase project `catiedriving` set up 2026-09-23: both schema files applied, 378 questions loaded into the server bank, security advisor clean apart from the two access-check functions the rules need
- ✅ Server privacy functions live (project `njajxuzhgxqcjfhjpkyp`, migration `privacy_export_delete_age_plain_explanations`): `export_my_data()`, `delete_my_account()` (the privileged part in `private`, which the API doesn't expose); signed-out callers refused. Proven inside rolled-back transactions with a throwaway account; no new security-advisor warnings. Profiles hold `birth_year`, `guardian_consent`, `guardian_email`; questions hold `plain_explanation`, `plain_status`
- ✅ Two accounts, 2026-09-23: the admin (Darren's Gmail) and Catie's (`darrenstorey87+catie@gmail.com` — a Gmail "+" address, so her emails reach Darren's inbox), both confirmed, Catie on free family access. Both proven to sign in and read the paid bank. Their passwords were generated straight into Vault and never shown: Vault UI → sign in as `darren` → secret → logins → `theory-trainer-admin` / `theory-trainer-catie`
- ✅ Supabase Authentication → URL Configuration set 2026-09-23: Site URL is the app page, `https://dstorey87.github.io/Catie-Test/**` is an allowed redirect. Checked: a reset request from the app was redirected back to the app, not `localhost:3000`
- ⚠️ Free tier: the project pauses after about a week with no use, and sign-in then hangs. Found paused 2026-09-23 and restored. Daily use keeps it awake
- ⚠️ Confirmation and password-reset emails go through Supabase's built-in mailer, which is rate-limited and for testing only — add an SMTP provider before strangers sign up (ROADMAP item 3)
- ✅ Every account's data is private at the database level, not by app-side checking

## Paying, enforced on the server
- ✅ £4.99/month and £50/year, both in the app; Stripe hosts the card page
- ✅ Access switches on the moment Stripe confirms, and off when a subscription is cancelled or a payment fails — no admin action, no emails to watch
- ✅ Subscribers manage card, plan and cancellation themselves (Stripe portal, opened from the app)
- ✅ **The question bank lives on the server and is only readable by an account with access** — so the paywall isn't a screen someone can skip in browser code. Editing the app in DevTools gets them nothing
- ✅ 20-question free sample for trying before paying
- ✅ Admin can still grant free access by hand (family, testers) and suspend or block a learner
- ⚠️ Needs your Stripe prices + 3 server functions deployed (SETUP.md §3, ~15 min). The about page shows the prices in `config.js`; paying only works once this is done
- ⚠️ Known effect, read from the code and not run: once `stripe-webhook` is deployed, a late Stripe event for an account already deleted can't be written, so the webhook answers 500 and Stripe retries. Deletion is refused while a subscription renews, so this can only follow one that was already cancelling
- ❌ Nothing stops someone screenshotting questions they've paid for. That's true of every app

## Local AI (home PC)
- ✅ Memory tips: `node tools/write-memory-tips.js`. Plain explanations ("Explain it differently"): `node tools/write-plain-explanations.js`. Both run with Ollama (`qwen3:14b`) on the home PC, resume where they stopped and retry the rejected ones; drafts land in `tools/out/` (git-ignored). Tests: `tests/memory-tips.test.js`, `plain-explanations.test.js`, `ai-checks.test.js`, `ai-drafts.test.js`
- ⚠️ The newest drafts exist only in `Catie-Test-wt-bank-uk/tools/out/`: `memory-tips.json` (372 of 378; rejected by the checks: t02q13, t02q24, t03q16, t04q01, t05q19, t09q24) and `plain-explanations.json` (377 of 378; rejected: t09q24). Counted 2026-09-25. Copy them to the hub's `tools/out/` (it doesn't exist yet) before that worktree is removed
- Review these first: they passed the checks but say something not in their question, so reject them — the memory tips for t13q03 ("30 compressions as a full minute"), t01q03 ("use hands-free") and t11q17 ("just like a stop sign"), and the plain explanation for t13q26 (a bike with hazard lights). The first plain-explanation run also flagged these for naming something their question doesn't (some were re-drafted since): t01q03, t03q01, t04q18, t11q01, t11q03, t11q09, t11q11, t12q02, t12q04, t12q12, t02q24, t08q23, t09q26, t10q21, t11q24, t12q23
- The stricter checks now reject five older tips: t02q13, t02q24 and t05q19 are still live as `draft`; t03q16 and t04q01 were already rejected in Admin. Reject or re-draft them before approving

## All devices
- ✅ Browser (any), plus installable to the home screen on iPhone, iPad, Android and desktop — fullscreen, own icon, works offline
- ✅ Native iOS and Android builds: Capacitor project, config and step-by-step included (`capacitor/`)
- 📋 Store submission needs the developer accounts (Apple ~£79/yr, Google ~£20 once) and a build on your machine — I can't sign or upload binaries
- ⚠️ **Apple rejects Stripe for digital subscriptions in native apps** (rule 3.1.1). Options written up in `capacitor/README.md`: ship the iOS app sign-in-only and sell on the web, add Apple in-app purchase, or stay with the installable web app

## Publishing
- ✅ Live at https://dstorey87.github.io/Catie-Test/ (public repo, GitHub Pages)
- ✅ Updates ship by git: section branches → `develop` → `main` (main is the live site; promoted only on your go-ahead). The old "Publish to GitHub.html" page is not in this repo

## Voice
- ✅ Best-voice auto-pick (Enhanced/Premium en-GB preferred), voice picker, speed control, sample
- 📋 One-time per iPhone/iPad: Settings → Accessibility → Spoken Content → Voices → English (UK) → download an Enhanced voice

## How to test
- `node --test` runs every test (367 at v13); CI runs it on every pull request and every push to `develop` and `main`
- In a browser: serve the repo (`python -m http.server <port> --bind 127.0.0.1`, never port 8765) and drive it with `tests/browser/harness.js` at 390px and 1280px, light and dark. The harness learner has no answers, so tapping Catie opens the quick setup: tap Skip, or seed her as set up with `seed: {'theoryTrainer.d.u1': JSON.stringify({settings: {learnerName: 'Catie', onboardedAt: '2026-09-24'}})}`. Pass `birthYear: null` to see the age question; route `/rest/v1/rpc/export_my_data` and `/rest/v1/rpc/delete_my_account` to fake the server's answers; give bank rows `plain_explanation` + `plain_status: 'approved'` to see Explain it differently; seed a learner with answers to see the prediction, the study plan and the "you keep choosing" lines. For Adventure: open the app through the harness (it seeds a signed-in learner), then tap Adventure on Home or go to `/adventure.html`

## What's left
- 📋 Approve or reject the plain-explanation drafts in Admin → Memory tips → Plain explanations (377 loaded as `draft` on 2026-09-25; t09q24 has none). Until then no learner sees Explain it differently
- 📋 Approve or reject the 44 re-drafted memory tips (and the ones listed under Local AI)
- Run the delete-account and age flows once from the app against the live project with a throwaway account (not verified there yet)
- Adventure (#27): with the app open in another tab, the app doesn't notice an Adventure save until it is reopened, so answers, XP and flags from Adventure can be saved over (Adventure progress itself is safe). Adventure answers don't count toward the daily goal or streak yet. The page doesn't follow the app's text size, dyslexia font or read-aloud yet
- Adventure: if a learner unlocks more packs, lessons are recut, and saved progress (kept by stage id) then belongs to lessons whose questions have partly changed. With the full bank the route is fixed
- Two copies to make one (Coach lane, `coach.js`): the Adventure stars total is counted by the page (`starsSummary`) and by the Home card; the scaled mock pass mark is worked out in `coach.js` (`Math.ceil(total * passMark / mockSize)`) and in the app's `TTScreen.passMark`. The 14 topic names are in both `TTCoach.TOPIC_NAMES` and the app's `TOPICS` on purpose (the app keeps its names if `coach.js` fails to load); a test fails if they ever differ
- The chart's "pass 43" label and the dashboard's "Log a mock" check (`score>=43`) use 43 as a fixed number; that is right for 50-question mocks
- Accessibility: no screen-reader check by a person (above). At 320px with the app's biggest text size, a few screens scroll sideways slightly (Road signs 14px, Mock test intro 12px, Practise setup 7px, Question editor 6px, Settings 2px, My Progress and the dashboard 1px); WCAG's 320px benchmark uses browser zoom, which passes. A flagged, answered mock square shows only the flag on screen (its spoken name says both)
- ⚠️ Before charging anyone: a real operator name, address and contact email (and company and ICO numbers, if they apply), a legal review, and Darren's yes or no on the sample choices: lawful bases, liability wording, 30 days' notice of price changes, a full refund within 14 days of the first payment until checkout asks for the waiver, full refunds for wrong charges, a 5-working-day reply to refund emails
- Not built: change email and change password while signed in; streak repair; the weekly summary email; grouping misconceptions by meaning
- t13q22's explanation says "come off the gas" (US wording; UK: accelerator). It needs a confirmed finding before it is changed
- Known: the default reminder hour is 6pm, which isn't one of the four time buttons, so a reminder switched on in Settings without picking a time lights no button (the quick setup always sets one of the four)
- The about page's pictures leave out the readiness dial because its number didn't show; it shows since v12, so they can be re-taken with it
- The tuning values (14-day half-life, 50-answer minimum, 10-answer what-if, 7-day freeze, hold 2, 70% for the badge nudge, pass-chance colours at 70% and 40%; Adventure's 7-question lessons, 10-question checkpoint, 80% pass and stars at 80/90/100%) are choices, not measurements
- Not started, and not yet GitHub issues (carried over from the old sections table): React and Babel copied to this site and precached, for true offline; manifest polish (maskable icon, id/scope, viewport tags, offline fallback page); removing the public `questions-1..5.json` and the app's `local()` path (note `tests/bank.test.js` reads those files)

- Adventure map: the road's rounded top reaches up into the bottom of the world-tab row (390, 768 and 1280px); the chart's "pass 43" label can overlap the last dot when her last mock is near 45 (both seen in the v14 check, not new)
- The help pictures' example learner and capture script were throwaway files, not in the repo: retaking the pictures means writing them again (or adding them to `tools/`)

## Work in progress
Tracked as GitHub issues, one per section: https://github.com/dstorey87/Catie-Test/issues (lanes and rules in `CLAUDE.md`).

## Timeline
- 2026-09-25 — v14 (`v14-2026-09-25`): fixes from the v13 live check (#38) — Adventure progress merged stage by stage across devices (no more lost stars), map tabs on one row, phone top bar, Best run counts first tries, no console errors on load, help pictures retaken. 380 tests.
- 2026-09-25 — v12 (`v12-2026-09-25`): quick setup, What's new, the help, about and sample legal pages, pass prediction, what to work on, study plan, streak freezes, family board, Your data and the age question, Explain it differently (waiting for approved text), 44 bank answers corrected to UK rules, and the #12 layout bugs fixed. Earlier versions: `CHANGELOG.md`
- 2026-09-25 — v13 (`v13-2026-09-25`): Adventure mode (14 worlds and 70 stages, a Home card, works offline), the WCAG 2.2 AA accessibility audit with every automated finding fixed (no screen-reader check by a person yet), the notes button no longer covering controls, and the #32 wording, chart and page fixes. 367 tests
