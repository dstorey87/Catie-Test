# Theory Trainer — setup guide (GitHub, no Supabase)

## 1. Publish it on GitHub Pages (free, ~2 minutes)
Your repo already has the files: https://github.com/dstorey87/Catie-Test
The app now lives FLAT at the repo root (no folders) so the web uploader can never scramble the structure again.
1. Download the "GitHub upload" zip from the chat and unzip it — it's all loose files, no folders.
2. Repo → **Add file → Upload files** → drag all the files in → Commit (existing files are overwritten — that's the update path forever).
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → Save.
4. After ~1 minute the app is live at **https://dstorey87.github.io/Catie-Test/**

## 2. Install it as an app
- iPhone/iPad: open the URL in Safari → Share → **Add to Home Screen**.
- Android: open in Chrome → menu → **Install app**.
- PC/Mac: open in Chrome/Edge → install icon in the address bar.
It works fully offline after the first visit; scores save on the device instantly.

## 3. Family sync via GitHub (free, ~3 minutes, no Supabase)
Scores sync through a JSON file the app writes to a repo of yours (`sync/data.json`). Use a **separate private repo** so progress isn't public and the token can't touch your app code:
1. github.com → New repository → name **Catie-Test-data** → **Private** → tick "Add a README" → Create.
2. Make a token: github.com → Settings → Developer settings → **Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories** → Catie-Test-data
   - Permissions → Repository permissions → **Contents: Read and write**
   - Expiration: 1 year (you'll paste a fresh one when it expires) → Generate, then copy the `github_pat_…` value.
3. In the app: **Admin → Family sync (GitHub)** → Repository `dstorey87/Catie-Test-data` + the token → **Save & connect**.
4. On every other device (Catie's iPad etc.): login screen → **Set up family sync** → enter the same two values → Connect. Her learner profile and all progress appear automatically.

What syncs: all learners, scores, attempts, memory boxes, flags, settings, question-bank edits and packs.
Merge rule: newest wins per learner; the app pulls and merges before every push, so two devices can't wipe each other.
The token is saved only on your devices (never uploaded); anyone with it could edit that one data repo, so don't share it.

## 4. Backups without the cloud
Admin → Data → **Export backup** (a JSON file) and **Import backup** on another device.

## 5. Editing questions
Admin → Edit questions (search box finds anything). Packs can be toggled per practise/tests, and new packs load from JSON files (same fields as the exported bank).
