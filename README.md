# Theory Trainer

UK driving theory practice app for learners — installable, works offline, with accounts,
progress that follows you between devices, and a subscription enforced on the server.

**Live app:** https://dstorey87.github.io/Catie-Test/

## What's here

The web app is flat at the repo root (that's what GitHub Pages serves). Server and
native sources live in folders and are not served.

- `index.html` → loads `Theory Trainer.dc.html` (the whole app)
- `support.js` — runtime · `signs.js` — road signs · `sw.js` — offline cache ·
  `manifest.json` — install metadata
- `picker.js` — picks questions for **My answers** and **More like this** (pure logic;
  tests in `tests/`, run with `node --test "tests/*.test.js"` — Node 22, nothing to install)
- `coach.js` — the coach: builds Today's lesson from her answers, spots what she keeps
  missing, merges flags across devices, summarises Activity, predicts her mock score, ranks
  what to work on, builds the study plan and works out streak freezes (pure logic, tested)
- `backend.js` — accounts, progress sync, billing checks, reminders, the activity log
  (`TTTrack`), memory tips, plain explanations, data export, account deletion and the age
  question (talks to Supabase)
- `tools/write-memory-tips.js` — run on the home PC: local AI drafts a memory tip per
  question for the admin to approve (drafts land in `tools/out/`, never committed)
- `tools/write-plain-explanations.js` — run on the home PC: local AI drafts a plainer
  explanation per question ("Explain it differently") for the admin to approve (drafts land
  in `tools/out/`, never committed); `tools/ai-checks.js` / `tools/ai-drafts.js` — the checks
  and the ask / retry / resume loop both AI tools share
- `help.html`, `about.html`, `legal/` — the how-to guide, the about page and the sample legal
  pages (shared look in `help/site.css` and `help/site.js`)
- `config.js` — your Supabase URL and publishable key, Stripe payment links, push key.
  Safe to be public
- `questions-free.json` — the 20-question free sample
- `questions-1..5.json` — the full 378-question bank. Once it's uploaded to Supabase
  these come out of the repo, so only paying accounts can read it
- `supabase/` — `schema.sql`, `schema-notifications.sql`, and four Edge Functions
  (checkout, webhook, billing portal, reminder sweep). Pasted into the Supabase dashboard
- `capacitor/` — project and instructions for native iOS and Android builds
- `SETUP.md` — every setup step in order · `STATUS.md` — feature checklist ·
  `CHANGELOG.md` — what changed in each version

## How the paid side works

Nothing in the browser decides who has paid. Stripe tells a webhook, the webhook writes
an access row, and the question bank is readable only by an account with access. Editing
the app in DevTools gets you the 20 free questions and nothing more.

## Accounts

Email and password, handled by Supabase Auth. One account covers every learner in a
family and every device; progress merges automatically, newest wins per learner.

## Install as an app

Open the live URL → iPhone/iPad: Share → Add to Home Screen · Android: Install app ·
Desktop: the install icon in the address bar. Daily reminders need the home-screen
install on iOS — an Apple rule, not a setting.
