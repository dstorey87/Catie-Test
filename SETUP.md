# Theory Trainer — setup

Five parts. §1 is done. §2 and §3 are what make accounts and paid access real.
§4 fills the server with the question bank. §5 is only if you want store apps.

Everything runs on free tiers except Stripe's cut of a payment and the store fees.

---

## §1 Publish the web app — done
Repo: **github.com/dstorey87/Catie-Test** (public) → Settings → Pages →
Deploy from a branch → `main` → `/ (root)`.
Live at **https://dstorey87.github.io/Catie-Test/**

To update the app later, open **Publish to GitHub.html** (in the project), paste
your GitHub token, press Publish. It replaces every file in one go.

---

## §2 Supabase — accounts and the server side (~10 minutes)

1. **supabase.com** → sign up (free) → **New project**. Any name. Pick the region
   closest to you (London/eu-west-2). Save the database password somewhere.
2. Left sidebar → **SQL Editor** → **New query** → paste the whole of
   `supabase/schema.sql` from this project → **Run**. It creates the accounts,
   progress, access and question tables, plus the rules that keep every account's
   data private.
3. Left sidebar → **Project Settings → API**. Copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key (the long `eyJ…` string)
4. Put those two values into the app. Either:
   - open **Publish to GitHub.html**, paste them in the Supabase box, and publish —
     it writes them into `config.js` for every device at once; **or**
   - open the live app → **Server settings** (small link under the sign-in box) →
     paste → Connect. That only affects the device you're on.
5. **Authentication → URL Configuration → Site URL**:
   `https://dstorey87.github.io/Catie-Test/`
   (this is where password-reset and confirmation links come back to)
6. **Authentication → Providers → Email** is on by default and requires people to
   confirm their address. Leave it on for paying customers. If you want instant
   sign-up while testing, switch **Confirm email** off, then back on.
7. Open the app, **Create an account** with your own email. Then back in Supabase →
   **SQL Editor**, run this so you're the admin (never locked out, and you can edit
   questions):
   ```sql
   update public.profiles set role = 'admin' where email = 'YOUR@EMAIL';
   ```

At this point sign-in works on every device and progress syncs by itself. No tokens.

---

## §3 Stripe — charging, enforced on the server

Two routes. **Route A (payment links)** is far less work and is the one to start
with: two links to create, one function to deploy. **Route B** adds in-app plan
switching and self-service cancelling.

### Both routes: make the prices (~5 min)
1. **stripe.com** → **Products** → **Add product**: "Theory Trainer", then add two
   prices to it: **£4.99 / month** recurring, and **£50 / year** recurring.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_…` while testing,
   `sk_live_…` when you go live).

### Route A — payment links (~10 min)
3. Stripe → **Payment links** → **New** → pick the £4.99 monthly price → Create.
   Copy the link (`https://buy.stripe.com/…`). Repeat for the £50 yearly price.
4. Paste both links into **Publish to GitHub.html** (step 1, Stripe boxes) and
   publish. They go into `config.js`, and the app's Subscribe buttons open them
   with the account id attached, so the payment can be matched to the account.
5. Deploy **one** function so access switches on by itself: Supabase → **Edge
   Functions** → **Deploy a new function** → name it `stripe-webhook` → paste
   `supabase/functions/stripe-webhook/index.ts` → deploy → open its settings and
   turn **Verify JWT OFF**.
6. Supabase → **Edge Functions → Secrets**: add `STRIPE_SECRET_KEY` (your `sk_…`)
   and, after step 7, `STRIPE_WEBHOOK_SECRET`.
7. Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_failed`
   - Save → copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`
     → redeploy the function.

That's charging done: people subscribe in the app, access appears within seconds,
and a cancellation or failed payment removes it. Cancelling happens through the
email receipt Stripe sends, or you do it from the Stripe dashboard.

### Route B — add plan switching and self-service cancelling (~10 min more)
8. Also deploy `create-checkout` and `billing-portal` the same way (leave Verify
   JWT ON for these two).
9. Add two more secrets: `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` — the
   `price_…` ids from step 1.
10. Clear the two payment-link fields in `config.js` (or leave them; links win when
    present). The app then builds checkout sessions itself, and **Manage
    subscription** opens Stripe's own portal where subscribers change card, switch
    plan or cancel.

### Testing either route
Use Stripe **test mode** and card `4242 4242 4242 4242`, any future expiry, any CVC.
Subscribe in the app; access should switch on within a couple of seconds. Stripe →
**Webhooks** shows each delivery and any error.

What this buys you: the app never decides who has paid. Stripe tells the server,
the server writes the access row, and the question bank is only readable by an
account with access. Editing the app in a browser gets someone nowhere.

---

## §4 Put the question bank on the server (~2 minutes)

Until this is done, a signed-in account sees only the 20-question free sample.

1. Supabase → **Project Settings → API** → reveal the **service_role** key.
   (This one is powerful — never put it in the app or the repo. It's used once, here.)
2. Open **Publish to GitHub.html** → **Question bank** section → paste the project
   URL and the service_role key → **Upload bank to server**. It writes all 378
   questions into the `questions` table.
3. In the same page, tick **Remove the public question files** so
   `questions-1…5.json` are deleted from the repo. The bank is then only available
   to accounts with access — that's the part that stops copying.

The 20-question sample (`questions-free.json`) stays public on purpose: it's the
free trial on the paywall.

---

## §5 Reminders and notifications (~10 minutes)

The app asks for permission the first time a learner turns **Reminders** on in
Settings, and only nudges on days with no practice. For nudges to arrive while the
app is closed you need one keypair and one function.

1. Open **Publish to GitHub.html** → **Notifications** → **Generate keys**. You get
   a public key (written into `config.js` when you publish) and a private key
   (shown once — copy it now).
2. Supabase → **SQL Editor** → paste `supabase/schema-notifications.sql` → **Run**.
3. Supabase → **Edge Functions** → deploy `send-reminders` from
   `supabase/functions/send-reminders/index.ts`. Leave Verify JWT ON.
4. Supabase → **Edge Functions → Secrets** → add:
   | Name | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | the public key from step 1 |
   | `VAPID_PRIVATE_KEY` | the private key from step 1 |
   | `VAPID_SUBJECT` | `mailto:your@email` |
5. Run it hourly: Supabase Dashboard → **Integrations → Cron** → new job → hourly →
   POST to `https://YOUR-PROJECT.supabase.co/functions/v1/send-reminders` with your
   service-role key as the bearer token. (The SQL alternative is commented at the
   bottom of `schema-notifications.sql`.)

Each learner picks their own time (8am / midday / 5pm / 8pm) in Settings, and the
sweep uses their own timezone. Nobody gets two nudges in a day, and nobody gets one
after they've practised.

**iPhone and iPad:** Apple only allows notifications for apps added to the home
screen. The app says so on the Reminders card. Until then it shows an in-app nudge
instead.

---

## §6 Store apps — optional
See `capacitor/README.md`. Read the note about Apple requiring in-app purchase for
subscriptions before you pay the developer fee.

---

## Voice
For a genuinely good read-aloud voice on iPhone/iPad, once per device:
Settings → Accessibility → Spoken Content → Voices → English (UK) → download an
Enhanced or Premium voice (Kate, Serena). The app picks the best one it finds.

---

## Where things live
| Thing | Where |
| --- | --- |
| App files | github.com/dstorey87/Catie-Test (public) |
| Accounts, progress, question bank, access | your Supabase project (private) |
| Card details, invoices, cancellations | Stripe (you never see card numbers) |
| Stripe secret key, webhook secret | Supabase Edge Function secrets, server-side only |
| Anon key in `config.js` | public on purpose — grants nothing without an account |
