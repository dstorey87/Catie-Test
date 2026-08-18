# Theory Trainer — full requirements

Master list. Everything asked for, plus the gaps a paid consumer app needs.
States: ✅ built · 🟡 built but only tested against a simulated server · ⛔ not built · 📋 your account/keys needed

---

## 1. Learning content and modes
- ✅ 378 original questions, 14 DVSA topics, 4 options, explanation + Highway Code reference
- ✅ 20 road signs with spoken meanings, sign learning screen, signs quiz
- ✅ Practise mode: read-aloud, Leitner boxes, 50:50, auto-advance
- ✅ Mock test: 50 questions, 57 minutes, flag/review grid, pass mark 43
- ✅ Build-your-own test, surprise mix, focus drill
- ✅ Notes on any screen, question flagging, revision list
- ✅ Printable answer book, flashcards, test paper
- ✅ Test-date countdown
- ⛔ Hazard perception (the second half of the real test) — needs video clips
- ⛔ Case-study questions (the DVSA scenario format)
- ⛔ Licensed DVSA bank — refused; pack import exists so a bought set can be loaded

## 2. Clever / adaptive — the app should coach, not just quiz
- ✅ Leitner spacing, per-topic traffic lights, readiness dial, 20 hardest questions
- ✅ "Today's lesson" remix weighted to weak topics
- ⛔ **Stuck detection**: spot a question or topic a learner keeps failing (3+ misses, or repeated misses across sessions) and change tactics instead of repeating the same card
- ⛔ **Tailored micro-lessons**: when stuck, generate a short explainer for that exact concept, then easier scaffolding questions building up to the original, then re-test it
- ⛔ **Tailored test generator**: build a test on demand from the learner's own error pattern (topic mix, difficulty, distractor types they fall for), not a fixed template
- ⛔ **Distractor analysis**: record which wrong option was chosen, cluster the misconception, address that specifically
- ⛔ **Improvement suggestions on Home**: "You lose most marks on stopping distances — 10 minutes here would move your readiness 6%", ranked by predicted gain
- ⛔ **Pass prediction**: estimate mock score and probability of passing, with what would raise it
- ⛔ **Study plan to test date**: given the test date, a day-by-day plan that adapts when a day is missed
- ⛔ **Explain-it-differently**: ask for another explanation of a question in plainer terms, or an analogy
- ⛔ Optional AI layer for the above (Claude API) with a no-API fallback so everything still works offline

## 3. Accounts and the login experience
- ✅ Email + password sign-up, sign-in, password reset, email confirmation
- ✅ One account covers a family; multiple learners; switch learner; profile photos
- ✅ Automatic sync — pulls on open, pushes after answers, retries offline; no sync button
- ✅ Admin role flag
- 🟡 All of the above against a real Supabase project
- ⛔ **Standard paid-service account controls**, all missing:
  - Change email, change password while signed in, delete my account (GDPR), export my data
  - Active sessions list + sign out everywhere
  - Two-factor authentication (TOTP) for admins at minimum
  - Sign in with Apple / Google (Apple sign-in is required by App Store rules if any social login is offered)
  - Rate limiting and lockout on failed sign-ins; bot protection on sign-up
  - Verified-email gate before a subscription can start
  - Named seats: which learner belongs to which account, seat limit per plan
  - Consent record: T&Cs and privacy accepted, with date and version

## 4. Owner / admin console — currently the biggest gap
Today's "admin" is device-local: it edits the local snapshot on that one phone. It cannot see other customers.
- ✅ Local: grant a learner free access, free-until-a-date, suspend, block; question editor; pack toggles; bank upload
- ⛔ **A real admin console, server-side**, signed in as admin, seeing every customer:
  - Customer list: email, signed-up date, plan, status, last active, lifetime value, search and filter
  - Customer detail: their learners, progress, mock history, sessions, devices, payment history, notes
  - **Exempt from paying**: mark an account comp/free, with reason and optional expiry, written to `entitlements` server-side (not the device)
  - Suspend, block, restore, force sign-out, delete account with data
  - Refund or cancel a subscription from the console (via Stripe), and see failed payments
  - Change a customer's plan, extend a trial, add free days
  - **Discounts**: percentage or fixed, one-off or recurring, applied at checkout
  - **Discount codes**: create, name, set value, usage limit, per-customer limit, expiry date, first-payment-only or forever, restrict to plan; see redemptions; disable a live code
  - Gift codes / prepaid access codes (a code that grants N months without a card — good for schools and instructors)
  - Referral codes: a learner shares a code, both get free time
  - **Learner progress dashboard for owners**: cohort view — readiness distribution, average mock scores, hardest questions across all learners, topic weak spots, funnel from sign-up to first mock to pass
  - Content admin: edit questions server-side (today's editor writes locally), publish/unpublish, version the bank, import a licensed pack
  - Announcements/broadcast to all learners in-app
  - Audit log of every admin action, and safe impersonation ("view as this customer") without reading their password
  - Metrics: MRR, active subscribers, trials, churn, cancellations this month, signups today
  - Support inbox or at least a "contact support" thread per customer

## 5. Billing and money
- ✅ £4.99/month and £50/year in the app; Stripe hosts the card page
- ✅ Payment-link checkout with account id attached; Stripe billing portal; free 20-question sample
- ✅ Access granted/revoked by webhook on payment, cancellation and failure
- 🟡 Never tested against real Stripe
- 📋 Your Stripe prices, links and webhook
- ⛔ Coupons and codes at checkout (see §4)
- ⛔ Free trial with card (7 days) as an alternative to the 20-question sample
- ⛔ Dunning: retry schedule, "your payment failed" email + in-app banner, grace period before lock
- ⛔ Proration when switching monthly → annual mid-term
- ⛔ Receipts and VAT: invoices with your business details, UK VAT handling, Stripe Tax
- ⛔ Refund policy and a self-serve refund request path
- ⛔ Cancellation flow that asks why (churn reasons feed §4 metrics), with a save offer
- ⛔ Apple's rule 3.1.1: Stripe can't sell digital subscriptions inside a native iOS app. Decide: web-only purchase, or add Apple in-app purchase + Google Play Billing

## 6. Engagement
- ✅ Levels (Provisional → Full Licence), XP bar, level-up card
- ✅ 10 badges from real activity, with progress on locked ones
- ✅ Daily goal 10/20/30, day streak with flame
- ✅ Daily reminder per learner: time of day, own timezone, only on days with no practice
- 🟡 Server reminders (needs push keypair + hourly cron)
- ⛔ Native push on iOS/Android (Firebase + Apple push key; a WebView doesn't get web push)
- ⛔ Streak freeze / repair, weekly summary email, "you're close to a badge" nudge
- ⛔ Leaderboard or family comparison (opt-in)
- ⛔ Email lifecycle: welcome, day-3 nudge, abandoned checkout, test-day good luck, post-pass

## 7. Platforms
- ✅ Any browser; installable to home screen on iPhone, iPad, Android, desktop; offline; own icon
- ✅ Capacitor project for native iOS and Android with instructions
- ⛔ Native builds actually built and run on a device
- ⛔ Native push, native in-app purchase, deep links, app icons/splash set for both stores
- ⛔ Desktop as an installed app (the PWA covers it; Electron/Tauri only if you want a store presence)
- 📋 Store submission: Apple ~£79/yr, Google ~£20 once, builds signed on your machine
- ⛔ Store assets: screenshots per device size, description, keywords, privacy questionnaire, age rating

## 8. Legal, trust and operations — required before charging strangers
- ⛔ Privacy policy, terms of service, cookie/consent notice, refund policy
- ⛔ GDPR: data export, deletion, lawful basis, processor list (Supabase, Stripe), retention policy
- ⛔ Age handling: under-16 sign-ups need parental consent in the UK
- ⛔ "Not affiliated with DVSA" disclaimer, and accuracy/liability wording
- ⛔ Support: contact route, FAQ, response expectation
- ⛔ Error monitoring (Sentry or similar) and uptime alerting
- ⛔ Product analytics: funnel, retention, feature use — privacy-respecting
- ⛔ Database backups and a restore you've actually tested
- ⛔ Rate limits on Edge Functions; abuse protection on the bank endpoint
- ⛔ Accessibility audit against WCAG 2.2 AA (the controls exist; the audit doesn't)
- ⛔ Automated tests (the scoring, Leitner, entitlement and sync logic at minimum) and CI
- ⛔ Staging environment separate from live, and a rollback path
- ⛔ Versioning + changelog; a "what's new" card in the app
- ⛔ Onboarding: first-run flow that sets test date, goal and reminder in under a minute
- ⛔ Marketing page with pricing, screenshots and SEO (the app is not a landing page)

---

## 9. Found on a re-read of the whole project — not previously listed
These came out of going back through everything we've done. All are real, all are missing.

- ⛔ **Production email sending.** Supabase's built-in mailer is rate-limited to a handful
  of messages an hour and is explicitly not for production. Confirmation and password-reset
  emails will fail once real sign-ups arrive. Needs an SMTP provider (Resend, Postmark, SES).
- ⛔ **A name and a domain.** The app lives at `dstorey87.github.io/Catie-Test/` — a family
  placeholder. A paid product needs a name (trademark-checked), a domain, a logo/icon set,
  and the Supabase Site URL and Stripe links updated to match. Apple won't accept a
  github.io URL as a product home either.
- ⛔ **UK 14-day cooling-off for digital services.** Buyers can demand a refund within 14
  days unless they expressly consent to immediate access and waive it at checkout.
- ⛔ **Stripe onboarding reality**: identity/business verification, a bank account for
  payouts, sole trader vs company, and Stripe Tax if you ever sell outside the UK.
- ⛔ **Invoice details**: receipts need your business name and address to be valid.
- ⛔ **Supabase free tier pauses** an inactive project and caps rows/bandwidth — fine for
  testing, not for paying customers. Budget the paid plan.
- ⛔ **Free-sample abuse**: nothing stops one person registering repeatedly for another
  20-question sample, or a whole class sharing one paid account. Needs seat and device limits.
- ⛔ **Snapshot merge risk**: progress is one blob per account with newest-wins. Two devices
  syncing out of order can overwrite a learner's day. A per-answer history table fixes it.
- ⛔ **Road signs are thin**: 20 signs, drawn as hints rather than real sign artwork. The
  real test covers far more. Open-licensed Highway Code sets exist; I can't generate images.
- ⛔ **No diagrams** for junction-layout or road-marking questions.
- ⛔ **Bank size vs claims**: 378 questions against a published pool roughly double that.
  Marketing copy must not overstate it.
- ⛔ **Support load**: a support address at the domain, and somewhere to answer from.
- ⛔ **Price changes later** need existing subscribers grandfathered rather than repriced.
- ⛔ **Paywall funnel analytics** — without them, "why isn't anyone paying" is unanswerable.

---

## Honest summary
Everything in §1, and most of §3 and §6, is built. §2's clever coaching is partly built (spacing, weak-topic weighting) but the stuck-detection, micro-lessons and tailored generator are not. §4's real admin console does not exist — what's there is device-local. §5 works in code but has never seen a real card. §7 has the project but no native build. §8 is almost entirely outstanding, and it is what actually blocks charging the public.
