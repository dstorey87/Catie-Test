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
- `backend.js` — accounts, progress sync, billing checks, reminders (talks to Supabase)
- `config.js` — your Supabase URL and publishable key, Stripe payment links, push key.
  Written by the publisher; safe to be public
- `questions-free.json` — the 20-question free sample
- `questions-1..5.json` — the full 378-question bank. Once it's uploaded to Supabase
  these come out of the repo, so only paying accounts can read it
- `supabase/` — `schema.sql`, `schema-notifications.sql`, and four Edge Functions
  (checkout, webhook, billing portal, reminder sweep). Pasted into the Supabase dashboard
- `capacitor/` — project and instructions for native iOS and Android builds
- `SETUP.md` — every setup step in order · `STATUS.md` — feature checklist

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
