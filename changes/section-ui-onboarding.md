## Changelog
- **Quick setup on a learner's first open** (issue #7). Three questions, one per screen: theory
  test date (optional), questions a day (10 / 20 / 30), reminder time (8am, Midday, 5pm, 8pm or
  No reminders). Each answer is saved straight into her normal settings, the same ones Settings
  changes, so skipping part-way keeps what she picked. **Skip** or **Done** both count, so it
  never opens by itself again; **Settings → Quick setup → Run it again** repeats it.
- It opens only for a learner with no answers and no mocks, and only once her saved copy has
  come down from the server. On a new phone an empty device can't be told apart from a new
  learner, and saving her choices then would have made the empty copy look newer than her real
  progress (sync keeps the newer copy).
- Picking a reminder time in the quick setup switches the reminder on in the same tap (the phone
  asks for permission). If the phone refuses, the screen says so and keeps the time.
- **What's new card on Home**, once per app version, for a learner who was here before that
  version; **Got it** hides it until the next one. The version is read from `sw.js` `VERSION`
  (offline: from the app cache's name). It is not shown to a brand-new learner, in the admin
  view, or when the version can't be read. The words are `TTWelcome.NEWS` at the top of
  `Theory Trainer.dc.html`; a test fails when `sw.js` `VERSION` moves on and they don't.
- **Help** link on Home (beside Settings). **Help, About, Privacy, Terms** on both sign-in screens
  ("Who's here today?" and "Sign in") and in **Settings → Help and legal**. Each opens in its
  own tab, so the app keeps its place. Targets: `help.html`, `about.html`, `legal/privacy.html`,
  `legal/terms.html` (written by issues #2 and #3).
- "Theory Trainer is not affiliated with or endorsed by the DVSA (Driver and Vehicle Standards
  Agency)." on both sign-in screens and in Settings.
- Fixed: the floating notes button covered the DVSA line on the Sign in screen. It is now hidden
  on all the sign-in screens (Who's here, Sign in, Server settings) and during the quick setup.
- Fixed: at phone width (390px) a long voice name pushed the Settings Voice list 13px out of its
  card.
- Switching the reminder on now re-reads her settings when the phone answers, instead of writing
  back the copy from before the permission prompt (a setting changed in between could have been
  undone). Found by reading the code, not reproduced in a browser.
- Tests (`tests/app-files.test.js`, +14): the quick-setup and What's new rules (run from the
  page's own `TTWelcome` block), reading the version from `sw.js` and from cache names, the notes
  matching `sw.js` `VERSION`, links and the DVSA line on each screen, every link opening in its
  own tab, one list of goal/reminder choices shared with Settings, the two fixes above, and one
  check per link that its file exists.

## Requirements
- "Versioning + changelog; a "what's new" card in the app" → ✅ (the card is built, reads `sw.js`
  `VERSION`, and a test keeps its words in step with that version).
- "Onboarding: first-run flow that sets test date, goal and reminder in under a minute" → ✅
  (built and checked in a browser. "Under a minute" was not timed with a real learner: not
  verified. It is one date field and two taps.)
- "\"Not affiliated with DVSA\" disclaimer, and accuracy/liability wording" → 🟡 (the disclaimer is
  in the app: Settings and both sign-in screens. The accuracy and liability wording belongs to
  issue #2's terms page, not this section.)
- "Privacy policy, terms of service, cookie/consent notice, refund policy" → unchanged by this
  section (the app now links to `legal/privacy.html` and `legal/terms.html`; the pages are issue #2's).
- "Support: contact route, FAQ, response expectation" → unchanged (the Help link is in place; the
  guide and FAQ are issue #2's).

## Status
- **Quick setup:** opens by itself for a learner with no answers once her saved copy has loaded.
  Settings → Quick setup → Run it again. It stores `settings.examDate`, `dailyGoal`,
  `remindHour`/`remindOn` (the existing settings), plus `settings.onboardedAt` (the date it was
  done or skipped).
- **What's new:** Home card, once per `sw.js` `VERSION`, for learners who were here before it.
  Dismissing stores `settings.seenVersion`. A brand-new learner gets `seenVersion` set when the
  quick setup ends, so she isn't shown notes for the version she started on.
- **At promotion (hub):** `node --test` fails until `TTWelcome.NEWS` (top of
  `Theory Trainer.dc.html`) is rewritten for the new `VERSION`: set `version` to it and write up to
  six plain lines to the learner. Suggested lines from this section: "Settings → Quick setup sets
  your test date, daily goal and reminder time in a few taps." / "Help is one tap away on Home
  and in Settings; Privacy and Terms are in Settings and on the sign-in screen." Worth adding to
  CLAUDE.md's gotchas at the same time.
- **Pending pages:** `tests/app-files.test.js` `PENDING_PAGES` lists `help.html`,
  `legal/privacy.html`, `legal/terms.html` (issue #2) and `about.html` (issue #3). While a page is
  missing, its link check is skipped with that reason. Once the page exists, the check runs for
  real. Delete each line once its page is on develop.
- **Browser checks from now on:** the harness learner has no answers, so tapping Catie opens the
  quick setup. Tap **Skip**, or seed her as set up:
  `seed: {'theoryTrainer.d.u1': JSON.stringify({settings: {learnerName: 'Catie', onboardedAt: '2026-09-24'}})}`.
- Known, not changed here: the default reminder hour is 6pm, which is not one of the four time
  buttons, so a reminder switched on in Settings without picking a time lights no button. The
  quick setup always sets one of the four.
- The help guide (issue #2) was written from develop before this section merged, so it may not
  mention the quick setup or What's new yet (not verified).
