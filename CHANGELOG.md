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
