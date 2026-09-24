## Changelog
- **Fixed first (issue #12, bugs stop the line)**, each with a test that failed before its fix:
  - A: a new screen opened at the previous screen's scroll position (Road Signs opened at
    scrollY 1398 after a tap low on Home at 390px). Every new screen and every next question
    now starts at the top (`window.TTScreen.key`); answering in place keeps the page still.
  - B: the admin dashboard's "Topics — weakest first" was 421px wide on a 390px phone, and
    My Progress's topic names (after #22) were 18px wide at the default text size, one or two
    letters a line. Both lists now wrap on a phone: the name keeps its line, the bar and its
    figure go underneath. "20 hardest questions" wraps too (it was 5px too wide at the
    largest text size).
  - C: the floating notes button covered "Next →" on a long mock question. On question
    screens (practice, mock question, mock review) it is now a "My notes" button in the page
    after the answer row; elsewhere it floats and the page leaves room to scroll clear of it.
  - D: the readiness dial on My Progress showed only "%". The number is now drawn (HTML over
    the ring); a test stops any `{{ value }}` going inside SVG text again.
  - Also found and fixed: Settings' Voice speed buttons ran 6px off a 390px screen at the
    largest text size; they now wrap.
- **Settings → Your data** (new): **Download my data** saves everything the server keeps for
  the account as one JSON file (`TTAccount.exportData`). **Your age** shows the saved answer
  and opens the age question. **Delete my account** lists exactly what the server deletes
  (one line per table that goes with the account), what this device forgets, and that a
  renewing subscription must be cancelled first; the button stays off until DELETE is typed.
  The server's refusal (admin account, renewing subscription) shows word for word. After a
  deletion this device also clears the learners' progress, so it can't be sent to the next
  account signed in here, and the app restarts on Sign in saying it is done. The admin
  account sees why it can't be deleted here instead of the button.
- **The age question** (new): opens by itself right after an account's first sign-in, and
  once for accounts made before it existed. Under the age in `config.js`
  (`TT_CONFIG.age.guardianUnder`, 16) a parent or guardian ticks a box to agree and adds their
  email. `TTAccount.saveAge` checks every answer (a real year; the tick; an email that isn't
  the learner's own) and its sentence shows on screen. Only the year is kept. "Not now" puts
  it off until the app is next opened.
- **Explain it differently** (new): after a wrong practice answer, a button shows the
  admin-approved plain explanation ("In other words: …"); read aloud with the explanation
  while open. Only approved ones reach a learner (backend.js already filters). Tapping it is
  recorded in the activity log (`plain_shown`; Admin → Activity says "Asked for it explained
  differently").
- **Admin → Memory tips** gets a second set of tabs, **Plain explanations**: the same review
  screen and save path for both (one `REVIEW` map in the app), with the bank's own
  explanation ("In the bank") beside each draft. Reviews are logged as `plain_approved` /
  `plain_rejected` (tips stay `tip_approved` / `tip_rejected`). The dashboard link now reads
  "Memory tips and plain explanations: check the AI's words before Catie sees them".
- `tests/browser/harness.js`: the fake account has a saved birth year by default (option
  `birthYear`, `null` = never answered, which opens the age question), so other browser checks
  don't land on it; fake question rows carry `plain_explanation` / `plain_status`.
- **How-to guide (`help.html`)**: new parts "Your year of birth" (under sign-in), "Explain it
  differently" (under answering a question), "Your data" (under Settings), "Memory tips and
  plain explanations"; two FAQ answers (copy or delete your data; why the app asks your year
  of birth); the "Known problem" box about the dial removed. Screenshots: new `age.png` and
  `settings-your-data.png`; retaken `progress.png`, `admin-dashboard.png`, `admin-links.png`
  (they showed bugs D and B and the old Memory tips button). `help.html` is the Pages lane's
  file: its section (#2) has merged and nobody is working on it; issue #9 asked for the
  "Known problem" box to go in this PR.

## Requirements
- REQUIREMENTS.md line "⛔ **Explain-it-differently**: ask for another explanation…" → 🟡:
  the learner's button and the admin review are built and browser-checked with faked rows.
  No plain explanation is on the live server yet (the hub loads the 376 drafts as `draft`,
  then Darren approves them in Admin → Memory tips → Plain explanations); not seen working
  with real rows.
- REQUIREMENTS.md line "Change email, change password while signed in, delete my account
  (GDPR), export my data" → 🟡: delete my account and export my data are built (Settings →
  Your data; server from #14). Change email and change password while signed in are not.
- REQUIREMENTS.md line "⛔ GDPR: data export, deletion, lawful basis, processor list…" → 🟡:
  export and deletion now have screens; lawful basis, processor list and retention policy are
  documents (the legal pages, #21), not written here.
- REQUIREMENTS.md line "⛔ Age handling: under-16 sign-ups need parental consent in the UK" →
  🟡: the age question and the guardian's consent and email are built and browser-checked
  against the fake server (under-16 sign-up, adult, Not now, change from Settings). Not yet
  run from the app against the live Supabase project: not verified there.
- REQUIREMENTS.md line "⛔ Accessibility audit against WCAG 2.2 AA" stays ⛔ (no audit), but
  three reflow failures (1.4.10) are fixed here: #12 B's two lists and the Voice speed row.

## Status
- **Where the new things are:** Settings → **Your data** (Download my data, Your age, Delete my
  account). The age question: by itself after the first sign-in, or Settings → Your data →
  Your age → Change. **Explain it differently**: under a wrong practice answer, when an
  approved plain explanation exists. Admin dashboard → **Memory tips and plain explanations**
  → Plain explanations.
- **How to test:** `node --test` (tests/app-files.test.js: 6 tests for #12, 12 for #9 and
  1 for the Voice speed row). In a browser, `tests/browser/harness.js`: pass `birthYear: null`
  to see the age question; route `/rest/v1/rpc/export_my_data` and
  `/rest/v1/rpc/delete_my_account` to fake the server's answers; give the bank rows
  `plain_explanation` + `plain_status: 'approved'` to see Explain it differently.
- **Browser checks done (fake server, 390 and 1280, light and dark):** download (the file is
  the server's export, named with the day), delete (off until DELETE is typed; a refusal shown
  word for word; a real deletion lands on Sign in, and the device keeps only the theme and the
  app's empty fresh-start defaults: no session, offline bank, unsent activity or any learner's
  progress), the admin's reason, an under-16 sign-up (create account → age question →
  2012 → the tick and a parent's email, with saveAge's refusals for no tick and for the
  learner's own email), an adult answer, Not now then asked again after reopening, changing
  the answer from Settings, Explain it differently (shows after a wrong answer only, never for
  a draft), and approving a plain explanation. Every touched screen fits 390px at text sizes
  0, 1 and 2.
- **Left:**
  - Load the plain-explanation drafts into Supabase as `draft` (hub), then Darren reviews
    them here. Until then no learner sees the button.
  - Run the delete and age flows once from the app against the live project with a throwaway
    account: not done in this section (it has no live account to delete); the server side was
    proven live by #14.
  - `legal/privacy.html` still says the delete button and the age question "are not built
    yet", and its activity-log list doesn't name "Explain it differently" taps or
    plain-explanation reviews. It is #21's file (running now): told on #21.
  - Change email, change password while signed in: not built.
- **Choices made (easy to change):** the age question comes after the first sign-in rather
  than on the Create account form, because the answer can only be saved to a signed-in
  account (with email confirmation on, the form would have to hold it until the link is
  opened). "Not now" puts it off until the next open, and it keeps coming back until answered,
  because under the age a parent or guardian has to agree. Deleting also clears the learners'
  progress on this device, so it can't end up in another account signed in here later.
- **At promotion (hub):** suggested What's new lines for `TTWelcome.NEWS` — "Got one wrong?
  Explain it differently shows the same answer in plainer words." / "Settings → Your data:
  download everything kept for your account, or delete it." / "The app now asks the year you
  were born, once."
