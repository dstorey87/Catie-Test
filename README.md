# Theory Trainer

UK driving theory practice app for learners — installable, offline-first, no accounts or servers required.

**Live app:** https://dstorey87.github.io/Catie-Test/ (Settings → Pages → main / root, if not enabled yet)

## What's here
Everything lives flat at the repo root on purpose — GitHub's web uploader flattens folders, so the app expects no folders at all. To update the app, just re-upload changed files (Add file → Upload files → commit).

- `index.html` → redirects into `Theory Trainer.dc.html` (the whole app)
- `support.js`, `signs.js`, `sync.js`, `sw.js`, `manifest.json` — runtime, road signs, GitHub sync, offline cache, install manifest
- `questions-1..5.json` — 398 practice questions across 14 DVSA topics
- `icon*.png` — app icons
- `SETUP.md` — publish, install and family-sync steps · `STATUS.md` — feature checklist

## Family sync (optional)
Scores sync through a **separate private repo** (e.g. `Catie-Test-data`) using a fine-grained token with Contents read & write on that repo only — full steps in `SETUP.md` §3. The token is pasted into the app per device and never stored in this repo.

## Install as an app
Open the live URL → iPhone/iPad: Share → Add to Home Screen · Android: Install app · PC: install icon in the address bar. Works fully offline after first visit.
