# Prompt to paste into Claude Code (VS Code)

Copy everything below the line into Claude Code with this repo open. Read
`REQUIREMENTS.md` first if you want to trim or reorder anything — the prompt tells
Claude to treat that file as the source of truth.

---

You are working in the repo for **Theory Trainer**, a UK driving theory practice app
that is live at https://dstorey87.github.io/Catie-Test/ and about to be sold to the
public at £4.99/month or £50/year.

**Your task in this first session is a plan, not code.** Do not change application
files until I approve the plan.

## Read first
- `REQUIREMENTS.md` — the full requirement list with what is built, what is only
  simulated, and what is missing. Treat it as the source of truth for scope.
- `SETUP.md` — how Supabase, Stripe, push and the native builds are wired.
- `STATUS.md` — feature-level state.
- `backend.js` — all client/server calls (accounts, entitlements, snapshot sync, bank, reminders).
- `supabase/schema.sql`, `supabase/schema-notifications.sql` — tables and row-level security.
- `supabase/functions/*` — create-checkout, stripe-webhook, billing-portal, send-reminders.
- `Theory Trainer.dc.html` — the entire front end (~2,250 lines): template plus a
  single logic class. `support.js` is its runtime. Inline styles only, no build step.
- `capacitor/` — the iOS/Android project and its notes.

## What is true today (verify, don't trust me)
- Accounts, entitlements, progress sync and the server-side question bank are implemented
  but have only ever run against a simulated Supabase and Stripe. Nothing has been tested live.
- The "admin dashboard" in the app is **device-local**: it edits that device's snapshot.
  There is no server-side view of other customers. No discounts, no discount codes,
  no cross-account reporting.
- Adaptive learning is Leitner spacing plus weak-topic weighting. There is no stuck
  detection, no generated micro-lessons, no tailored test generator, no pass prediction.
- Legal, analytics, monitoring, backups, tests and CI do not exist.

## Decide and justify, early in the plan
1. **Architecture.** The front end is one 2,250-line file with a bespoke runtime and no
   build step. An owner console, discount engine and adaptive coach are a lot to add to
   that. Recommend one: (a) keep the current single-file app and add a separate admin
   app; (b) migrate the app to Vite + React + TypeScript with real modules and tests;
   (c) something else. Give the cost, the risk to the working app, and the migration
   order. Assume the current app must keep working throughout.
2. **Where the intelligence runs.** Rules-based on-device, an LLM call server-side, or
   both with a no-network fallback. Cost per learner per month matters; so does offline.
3. **Payments on iOS.** Apple rule 3.1.1 blocks Stripe for digital subscriptions in a
   native app. Pick a route and price the work: web-only purchase, Apple IAP + Google
   Play Billing, or stay a home-screen web app.
4. **Admin surface.** Part of the app behind an admin role, or a separate protected
   dashboard? Consider that admin queries need to read other users' rows, which today's
   row-level security correctly forbids.

## What the plan must contain
- **Phases with a definition of done.** Phase 1 must be "prove the live stack works
  end to end with a real account and a real test-mode card", because that is unverified
  and everything else depends on it.
- **A data model.** New and changed tables for: discounts, discount codes and
  redemptions, comps/exemptions with reason and expiry, admin audit log, per-answer
  attempt history (needed for stuck detection and distractor analysis; today only a
  snapshot blob is stored), sessions/devices, support threads, announcements, consents.
  Include the row-level security policies for each, and how admin reads are allowed
  without opening data to everyone.
- **Server functions** to add, with inputs, outputs and failure behaviour.
- **The adaptive engine, specified.** Define "stuck" numerically. Say what happens when
  it triggers: which micro-lesson, which scaffolding questions, when to re-test, how
  mastery is recorded. Specify the tailored test generator's inputs and selection rules.
  Specify how pass probability is computed and how it is presented honestly.
- **Owner console screens**, listed with the data each needs: customers, customer detail,
  money (MRR/churn/failed payments), discounts and codes, content, cohort progress
  reporting, audit log, announcements.
- **Account controls** to add: change email, change password, delete account, export
  data, sessions, 2FA, Apple/Google sign-in, seat limits.
- **Everything in `REQUIREMENTS.md` §8** placed in a phase — legal pages, GDPR flows,
  analytics, error monitoring, backups, rate limits, accessibility audit, tests, CI,
  staging, onboarding, marketing page.
- **Anything missing that a paid consumer app needs and this list does not mention.**
  Add it and say why. Hazard perception clips and DVSA case-study questions are known
  gaps — judge how much they matter for a product sold as theory-test preparation.
- **Effort and sequence.** Rough size per item (hours or days), what blocks what, and
  what I have to do myself (accounts, keys, store enrolment, business details).
- **Risks**, especially: breaking the live app, losing learner progress during a schema
  change, Apple rejection, and anything that could leak the paid question bank.

## How to work
- Ask me the questions you need answered before planning; don't assume.
- Write the plan to `PLAN.md` in the repo, with numbered tasks I can hand back to you
  one at a time.
- Keep the paywall's integrity as a hard constraint: the question bank must never be
  readable without server-verified access.
- No secret keys in the repo or the client. `config.js` holds only publishable values.
- After the plan is approved, work in small verifiable steps, and after each one tell me
  exactly what to click to check it.
