## Changelog
- **Signing in from an email link (password reset or confirm) no longer shows the admin a paywall.** `config.js` and `backend.js` were loaded from `<helmet>`, so they ran twice; the second copy replaced the sign-in half-way with one that had no user. Until a reload the app skipped the admin check, the age check and sync. Both now load once, from the page head (#42).
- **No payment buttons that can only fail.** Stripe isn't set up yet (no Payment Links, no server functions), so with the new `config.js` switch `payments: false` the lock screen shows no Subscribe, Manage subscription or "I've paid" buttons. It says to ask the admin for free access, and "Check my access again" says what it found. Nothing claims to be "checking with Stripe" any more: it reads the account's access record.
- **The admin gives an account free access from the app:** Progress dashboard → Accounts lists every account with its access (admin, free for good, free until a day, pays by subscription, or no access) and has Free for good, Free until that day, and Take free access away. The server does the deciding and refuses anyone but the admin, a day already gone, and an account paying through Stripe (`admin_accounts`, `admin_set_access`; `has_access` honours a free-until day).
- The admin's own account line says "admin account: full access, never charged" instead of "no subscription yet", and the admin's Account card no longer offers Manage subscription.
- The per-learner access chips are now labelled "On this device", with a pointer to Accounts for someone's own account.

## Requirements
- REQUIREMENTS.md: add "✅ The admin gives any account free access (for good or until a day) from Progress dashboard → Accounts (#42)".
- REQUIREMENTS.md subscription/Stripe lines: payments are switched off (`config.js payments: false`) until Stripe is set up (SETUP.md steps 0–8); the app says so rather than offering buttons that fail.

## Status
- Accounts: Admin → Progress dashboard → Accounts. Give free access for good or until a day; take it away. Server functions `admin_accounts` and `admin_set_access` (migration `admin_free_access`, applied 2026-09-25).
- Payments: OFF (`config.js payments: false`). Turning them on needs Stripe set up end to end first (SETUP.md steps 0–8), then `payments: true`.
- Test: `node --test` (#42 tests in tests/app-files.test.js and tests/backend.test.js).
