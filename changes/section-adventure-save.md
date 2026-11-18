## Changelog
- Adventure stars are no longer lost when an app tab saves while running without coach.js (#75). The first open after a long gap can load the new page with the old offline coach.js; that tab used to save her whole record without joining it, wiping the stages another tab had just saved (Catie lost three 3-star World 1 stages on 2026-11-18). The app now joins every save, coach.js or not (`TTAdv.join` copes without it), and the Adventure page puts back stages it saved, not only answers and flags.
- "Adventure needs an update" (an old offline copy) now reloads itself once, when the new version takes over or after a moment, instead of waiting for a tap. Never twice in a visit.

## Requirements
- No line changes state: Adventure mode stays ✅; this fixes a way its progress could be lost.

## Status
- Adventure: an app tab without coach.js can no longer save over Adventure stages (#75). Tests: `tests/app-files.test.js` "adventure (#75)", `tests/adventure-page.test.js` "#75".
- Catie's three World 1 stages were restored on the server by hand on 2026-11-18 from her own `adventure_stage_end` events; every account's snapshot was copied to `private.snapshot_backups` first.
- Left: with coach.js missing, the cloud sync (`mergeSnapshot`) stops with "Sync problem" for that one open (it needs coach.js's flag rule); nothing is lost, it syncs on the next open.
