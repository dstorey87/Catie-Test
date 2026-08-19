# Theory Trainer — launch runbook

Every step to go from today's state to taking real money, in order. Steps marked
**[YOU]** need your accounts/dashboards; steps marked **[CLAUDE]** happen in a
Claude Code session. Code-side fixes are already live on `main` (2026-08-19).

App: **https://dstorey87.github.io/Catie-Test/** · Supabase project:
`njajxuzhgxqcjfhjpkyp` · publishing = merging to `main` (GitHub Pages serves it).

---

## Step 0 — [YOU] Start Stripe verification FIRST (~30 min + a multi-day wait)

dashboard.stripe.com → complete business/identity verification and add the bank
account for payouts. Stripe's review takes a day or two, so start it before
anything else. Everything below except "Go live" works in test mode meanwhile.

---

## Step 1 — [YOU] Supabase database (~10 min)

1. supabase.com/dashboard/project/njajxuzhgxqcjfhjpkyp → **SQL Editor** → New query
   → paste **all of `supabase/schema.sql`** (copy it fresh from the repo — it was
   updated 2026-08-19) → **Run**.
   A NOTICE about the auth trigger is fine; the backfill at the bottom covers it.
   Safe to re-run any time.
2. New query → paste `supabase/schema-notifications.sql` → **Run**.
3. **Authentication → URL Configuration**:
   - Site URL: `https://dstorey87.github.io/Catie-Test/`
   - Additional Redirect URLs: `https://dstorey87.github.io/Catie-Test/*`

## Step 2 — [YOU] Email that actually sends (~15 min)

Supabase's built-in mailer sends only a handful per hour — real sign-ups would
silently fail. Brevo's free tier needs no domain:

1. brevo.com → sign up (free) → verify your own sender address →
   **SMTP & API** → copy the SMTP login + SMTP key.
2. Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   host `smtp-relay.brevo.com`, port `587`, your Brevo login/key,
   sender = your verified address, sender name `Theory Trainer`.
3. **Authentication → Rate Limits** → raise the email rate (default is ~2/hour).

When you buy the product domain later, swap the sender address.

## Step 3 — [YOU] Stripe test mode: product + prices (~5 min)

1. dashboard.stripe.com → **Test mode ON** → Product catalogue → **+ Add product**
   "Theory Trainer" with two recurring prices: **£4.99/month** and **£50/year**.
2. Copy both `price_…` ids and the test **Secret key** (`sk_test_…`).

## Step 4 — [YOU] Secrets BEFORE functions (~10 min) — order matters

1. Supabase → **Edge Functions → Secrets** → add:

   | Name | Value |
   | --- | --- |
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_PRICE_MONTHLY` | `price_…` (monthly) |
   | `STRIPE_PRICE_ANNUAL` | `price_…` (annual) |

   (Do **not** add SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — auto-injected.)
2. Stripe → **Workbench → Webhooks** → Create event destination → Webhook endpoint:
   - URL: `https://njajxuzhgxqcjfhjpkyp.supabase.co/functions/v1/stripe-webhook`
   - Events (5): `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_failed`
   - Create → copy the Signing secret `whsec_…` → add it as Supabase secret
     `STRIPE_WEBHOOK_SECRET`. (Deliveries 404 until step 5 — Stripe retries.)
3. Supabase → **Edge Functions** → Deploy a new function → paste from the repo:

   | Function | Paste from | Verify JWT |
   | --- | --- | --- |
   | `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | **OFF** |
   | `create-checkout` | `supabase/functions/create-checkout/index.ts` | ON |
   | `billing-portal` | `supabase/functions/billing-portal/index.ts` | ON |

   (`send-reminders` comes later — see "After launch".)
4. Stripe (test mode) → **Settings → Billing → Customer portal** → activate,
   with "cancel at end of billing period". The portal is per-mode — you'll
   repeat this once more in live mode.

## Step 5 — [YOU] Your account + the question bank (~10 min)

1. Open the live app → **Create an account** with your real email → click the
   confirmation email (this also proves Brevo works) → sign in.
2. Supabase → SQL Editor:
   ```sql
   insert into public.profiles (id,email,name) select id,email,'' from auth.users on conflict (id) do nothing;
   insert into public.entitlements (user_id) select id from auth.users on conflict (user_id) do nothing;
   update public.profiles set role='admin' where email = 'YOUR@EMAIL';
   ```
3. In the app (signed in as admin) → Settings → account/cloud card →
   **Upload question bank to server** → wait for "378 questions are on the server."
4. For the automated test run only: **Authentication → Sign In / Providers →
   Email → Confirm email OFF** — tell Claude when done. (Back ON in step 7.)

## Step 6 — [CLAUDE] Verify and close the paywall

Claude then: smoke-tests the live site with Playwright; confirms the server bank
is gated (anonymous and unpaid accounts get nothing); deletes the public
`questions-1..5.json` + the local fallback (Deploy 2 — after this, the full bank
exists only behind the paywall); then drives the full end-to-end in test mode:
sign-up → free sample → paywall → **4242 4242 4242 4242** → access appears →
portal cancel → access goes. You watch the `entitlements` table and the Stripe
webhook log go green.

## Step 7 — [YOU] Tidy up test mode

Confirm-email back **ON**; delete the throwaway test users (Authentication →
Users); one fresh sign-up with a second real address to prove the confirm leg.

## Step 8 — [YOU] Go live (~20 min, after Stripe verification clears)

1. Stripe → **Test mode OFF** → recreate the product + both prices (live mode).
2. Replace the Supabase secrets with live values: `STRIPE_SECRET_KEY` =
   `sk_live_…`, both `STRIPE_PRICE_…` = the live `price_…` ids.
3. New **live** webhook endpoint (same URL, same 5 events) → live `whsec_…`
   into `STRIPE_WEBHOOK_SECRET`.
4. Settings → Billing → **Customer portal** → activate (live mode).
5. The proof: pay a real £4.99 on your own card → access appears → refund it
   from the Stripe dashboard and cancel → access goes.

**After step 8 you can take money.** Before telling strangers: legal pages and
a domain (roadmap Phase 1, items 6–7).

---

## After launch (not needed for Phase 0)

- **Reminders/push**: run `supabase/schema-notifications.sql` (done in step 1),
  generate a VAPID keypair, add `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
  `VAPID_SUBJECT` secrets, deploy `send-reminders` (Verify JWT ON), schedule it
  hourly (Integrations → Cron) with the service-role key as bearer. The public
  key goes into `config.js` → `pushPublicKey`.
- **Voice on iPhone/iPad** (once per device): Settings → Accessibility → Spoken
  Content → Voices → English (UK) → download an Enhanced voice (Kate, Serena).
- **Supabase free tier** pauses inactive projects — move to the paid plan before
  real customers depend on it.

## Where things live

| Thing | Where |
| --- | --- |
| App files | github.com/dstorey87/Catie-Test (`main` = live; work on branches, integrate via `develop` — see CLAUDE.md) |
| Accounts, progress, question bank, access | Supabase project (private, RLS-enforced) |
| Card details, invoices, cancellations | Stripe (you never see card numbers) |
| Stripe secret key, webhook secret | Supabase Edge Function secrets, server-side only |
| Anon key in `config.js` | public on purpose — grants nothing without an account |
