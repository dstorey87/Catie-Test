## Changelog
- Signing in can no longer wipe a learner's progress on the server (#77). A browser that still held a newer, emptier copy of her record (signing out leaves it on the device) used to win the cloud merge whole, show the Quick setup and 0 XP, and send the empty copy up over her real progress. Now a copy with no progress never beats one with progress, whatever their times.
- The cloud merge joins two devices' copies instead of keeping the newer one whole: every answer and finished test from both, the higher XP, the streak's goal days from both, flags and Adventure stages as before. Answers given on two devices between syncs are all kept.
- Reset all progress and Import backup are dated in her record (`resetAt`), so another device's older answers don't come back after a reset.
- The merge also works when `coach.js` is older than the page for one open (#75 left that open as "Sync problem").

## Requirements
- No line changes state: this keeps "progress synced across devices" working as written.

## Status
- ✅ Cloud sync merge (`TTAdv.joinDevices`, `Theory Trainer.dc.html`): an empty copy never beats real progress; answers and tests from both devices are kept; XP takes the higher copy; Reset progress still wins. Tests: `tests/app-files.test.js` "#77". Browser-checked with the fake server at 390 and 1280 px, light and dark: a leftover empty record plus sign-in now keeps her 1120 XP on screen and on the server (before the fix: Quick setup, 0 XP, server copy wiped).
- ⚠️ Known limit: two devices that both earned XP between syncs keep the higher XP, not the sum (answers and tests are all kept). A test has a day, not a time, so after a Reset on one device the other device's tests from that day are dropped.
- ⚠️ Live note (2026-11-19): the empty record's test date "tomorrow" seen in the live reproduction is set by no code path (only the date input writes `examDate`); it came from a record left in the automated browser's profile. Not verified further.
