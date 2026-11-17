## Changelog
- Fixed (#69): when the question server can't be reached, the app now says so — "Can't reach the
  server", what to do (check you're online, press Try again, tell the admin if it lasts) — instead
  of the paywall's untrue "no access yet, ask the admin for free access". Found 2026-11-17: the
  live Supabase project had paused (free plan, a quiet week), nothing had reached it since
  2026-09-25, and every learner was looping the 20-question free sample. New `window.TTServer`
  (page head) tells "the server never answered" from "the server said no"; tested in
  `tests/app-files.test.js`, browser-checked with the server cut off then restored.
- New daily check `keep-server-awake` (`.github/workflows/keep-server-awake.yml`,
  `tools/keep-awake.js`): one signed-out read of the live database a day, which Supabase says
  keeps a free project from pausing. If the project doesn't answer, the run fails and GitHub
  emails the owner, with the link and the button to press. Run it by hand from the Actions tab.

## Requirements
- No REQUIREMENTS.md line changes.

## Status
- Replace the ⚠️ "Free tier: the project pauses..." line with: ⚠️ Free tier: the project pauses
  after a quiet week. Paused 2026-09-23 and again by 2026-11-17 (nothing reached it after
  2026-09-25), restored both times. Since v21 the `keep-server-awake` workflow reads the database
  once a day to keep it awake and fails (GitHub emails Darren) if it can't; the app says "Can't
  reach the server" instead of looping the free sample. GitHub switches scheduled workflows off
  after 60 days without commits: re-enable it in the Actions tab if that happens.
- Add to How to test: `node tools/keep-awake.js` (exit 0 = the live project answered).
