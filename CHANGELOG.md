# Changelog

Newest first. The version is the service-worker `VERSION` in `sw.js` — it changes on every
deploy that touches the app's cached files. Earlier history: `git log`.

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
