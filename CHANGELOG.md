# Changelog

Newest first. The version is the service-worker `VERSION` in `sw.js` — it changes on every
deploy that touches the app's cached files. Earlier history: `git log`.

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
