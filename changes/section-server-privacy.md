## Changelog
- **Download my data (GDPR).** New server function `export_my_data()` returns everything the
  server holds about the signed-in account as one JSON object: profile, access (entitlement),
  progress snapshot, reminder settings, push devices (without their encryption keys) and every
  activity event. It only ever returns the caller's own data, even for the admin (who can read
  everyone's events elsewhere). `backend.js`: `TTAccount.exportData()` hands back exactly what
  the server sent.
- **Delete my account (GDPR).** New server function `delete_my_account()` deletes the
  signed-in account; every row it owns goes with it (profile, access, snapshot, events,
  reminders, push devices). It refuses, with a sentence saying what to do:
  - the admin account (so one tap cannot lock the owner out of the admin screens);
  - an account whose Stripe subscription would still bill it (cancel first, then delete).
  `TTAccount.deleteAccount()` checks nothing itself: the server's reason reaches the screen word
  for word (`err.message`), with a short code (`err.hint`: `admin_account`,
  `subscription_active`, `not_signed_in`). After a deletion the device forgets the account:
  session, offline question bank and any activity not yet sent.
- **Age and guardian consent.** Profiles now hold `birth_year`, `guardian_consent` and
  `guardian_email`. `TTAccount.saveAge(year, consent, guardianEmail)` checks everything before
  sending: a real birth year, and, for a learner who may be under the age, consent ticked and a
  guardian email that is not the learner's own. An adult's row keeps no guardian email.
  `TTAccount.age()` reads it back; `TTAccount.needsGuardian(year)` answers the rule. The rule
  lives in ONE place, `config.js` → `TT_CONFIG.age.guardianUnder` (16, as issue #4 asked). Only
  a birth year is stored, so the rule takes the younger possible age: someone who turns 16 this
  year is still asked.
- **Explain it differently (server side).** Questions now hold `plain_explanation` and
  `plain_status` (`draft` | `approved` | `rejected`, enforced by the database). The bank passes
  `plainExplanation` to the app only when approved (same rule as memory tips).
  `TTBank.explanations()` and `TTBank.saveExplanation(qid, text, status)` are ready for the
  admin review screen; saving says so plainly when nothing was changed.
- Database changes were applied to the live project as migration
  `privacy_export_delete_age_plain_explanations` (expand-only) and mirrored in
  `supabase/schema.sql`, which re-runs harmlessly.

## Requirements
- REQUIREMENTS.md line "Change email, change password while signed in, delete my account (GDPR),
  export my data" → 🟡: delete and export are built and proven on the live server, with
  `backend.js` calls; the Settings screens for them come from the UI section. Change email is not
  built.
- REQUIREMENTS.md line "GDPR: data export, deletion, lawful basis, processor list" → 🟡: export
  and deletion built (server + `backend.js`); lawful basis, processor list and retention policy
  are documents, not written.
- REQUIREMENTS.md line "Age handling: under-16 sign-ups need parental consent in the UK" → 🟡:
  storage, the rule and `saveAge` built; the sign-up / settings screen comes from the UI section.
  Note: the UK GDPR's own age is 13 (Article 8(1), checked on legislation.gov.uk on 2026-09-24),
  so 16 is stricter than the law requires. It is one value in `config.js`.
- REQUIREMENTS.md line "Explain-it-differently" → 🟡: columns, approved-only delivery and the
  admin review calls are built; no plain explanations are drafted yet and there is no screen.

## Status
- Server privacy functions (live, project `njajxuzhgxqcjfhjpkyp`): `export_my_data()`,
  `delete_my_account()` (the privileged part is `private.delete_my_account()`, in a schema the
  API does not expose). Signed-out callers are refused (HTTP 401). Proven on the live database
  inside rolled-back transactions with a throwaway account: own data only in the export,
  deletion removes all 7 kinds of rows, admin and renewing-subscription deletions refused, a
  learner cannot make themselves admin or write explanations. Security advisors: no new
  warnings (the two older `has_access` / `is_admin` warnings and leaked-password protection are
  unchanged).
- How to use (for the UI section): `TTAccount.exportData()`, `TTAccount.deleteAccount()`,
  `TTAccount.age()`, `TTAccount.saveAge(year, consent, guardianEmail)`,
  `TTAccount.needsGuardian(year)`, `TTBank.explanations()`,
  `TTBank.saveExplanation(qid, text, status)`; `q.plainExplanation` on approved questions.
- How to test: `node --test` (tests/backend.test.js covers every call above with a fake server).
- Also fixed first, in its own PR (#11): `TTAuth.profile()` could return another account's row
  for the admin, which would have hidden the admin screens.
- Left: the screens (UI section); drafting plain explanations (tools).
- Known effect, read from the code and not run (the live project has no Edge Functions
  deployed today, so no Stripe events arrive yet): once `stripe-webhook` is deployed, a late
  Stripe event for an account that was already deleted cannot be written (the account's row is
  gone), so the webhook answers 500 and Stripe retries it. Deletion is refused while a
  subscription still renews, so this can only follow a subscription that was already
  cancelling. The webhook was left unchanged: making it swallow a failed write could also hide
  a real "paid but access not granted" failure.
