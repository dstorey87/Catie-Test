# Theory Trainer — full requirements

Master list. Everything asked for, plus the gaps a paid consumer app needs.

**Standing rule (Darren, 2026-09-24): only questions and answers that are in the bank.** Nothing the app shows a learner may be a question, answer or fact it made up. The coach picks and orders bank questions; AI-written memory tips and plain explanations are drafted from their own question's text, machine-checked, and shown only after the admin approves them.

**Darren's decisions, 2026-09-24:**
- **Guardian consent under 16.** A learner who may be younger than 16 needs a parent's or guardian's agreement. That is stricter than the UK GDPR's own age of 13 (Article 8(1)); it is his choice, and one value in `config.js` (`age.guardianUnder`).
- **Mock legal details until there is a business.** He has no business, so the legal pages carry clearly-labelled mock operator details (`support@example.com`, a mock address, all-zero company and ICO numbers) under a sample-policy banner. Real details and a legal review come before charging anyone.
- **UK answers.** Every bank answer checked against current UK/GB rules: 44 corrected, each with its official source (issue #20, PR #24).

States: ✅ built · 🟡 partly built, or built but only tested against a simulated server · ⛔ not built · 📋 your account/keys needed

---

## 1. Learning content and modes
- ✅ 378 original questions, 14 DVSA topics, 4 options, explanation + Highway Code reference. *Checked against current UK rules 2026-09-24 (issue #20): 44 corrected, each with its source; `tests/bank.test.js` guards the shape and each corrected fact*
- ✅ Road signs with spoken meanings, sign learning screen, signs quiz. *v17 (#48): every sign, road marking, light signal and vehicle marking in The Highway Code (205 official pictures, 7 more from the DfT) by the Highway Code's own categories, with its official caption; a quiz per category and one for all signs (official caption as the answer, other official captions from the same category as the wrong ones); 8 Adventure sign worlds. Left out: the arm-signal pages (photographs of people, not decided) and pictures whose caption is not a meaning*
- ✅ Practise mode: read-aloud, Leitner boxes, 50:50, auto-advance
- ✅ Mock test: 50 questions, 57 minutes, flag/review grid, pass mark 43
- ✅ Build-your-own test, surprise mix, focus drill
- ✅ My answers: tick past questions (practice and mock) → practise them or make a test from exactly those
- ✅ More like this: similar questions on demand (shared wording weighted by rarity, same topic, same sign)
- ✅ Notes on any screen, question flagging, revision list. Flags stay until the learner un-flags them (getting it right doesn't clear one); her own Flagged screen; flags merge per question across devices (2026-09-24)
- ✅ Printable answer book, flashcards, test paper
- ✅ Test-date countdown
- ✅ **Adventure mode** (Darren asked 2026-09-24, issue #27): a Duolingo-style learning route. Each of the 14 topics is a world of short lessons and a checkpoint, drawn as a winding road; a stage needs 80% to pass and opens the next; 1 to 3 stars; any passed stage can be replayed; questions can be flagged. *v13: `adventure.html`, the route in `coach.js`, a Home card, progress kept when the app saves, a guide section. v16 (#47): answers count toward the daily goal and streak; follows text size, easy-reading font, contrast, reduce motion and read-aloud. Left: with the app open in another tab, the app tab still shows its old numbers until reloaded, and if Adventure is closed before that tab saves again, that save can still drop Adventure's answers, XP and flags (Adventure puts them back while it is open; the app half is not built yet); the 80% and star levels are choices from Darren's brief, not measurements* Progress survives syncing between devices (merged stage by stage) and Best run counts first tries (v14, #38). v17 (#48): 8 sign worlds, one per Highway Code category, on their own road, open from the start.
- ⛔ Hazard perception (the second half of the real test) — needs video clips
- ⛔ Case-study questions (the DVSA scenario format)
- ⛔ Licensed DVSA bank — refused; pack import exists so a bought set can be loaded

## 2. Clever / adaptive — the app should coach, not just quiz
- ✅ Leitner spacing, per-topic traffic lights, readiness dial, 20 hardest questions
- ✅ "Today's lesson" is a drill built from her own answers (`coach.js`): stuck, then flagged, then due by spacing (1/3/7/14/30 days), then new; topics interleaved; a missed question comes back 4 later, up to twice (2026-09-24)
- ✅ **Stuck detection** (2026-09-24: 3+ misses, or misses on 2 different days, until right twice running; shown as "Keeps tripping you up" with her usual wrong pick, and drilled first): spot a question or topic a learner keeps failing (3+ misses, or repeated misses across sessions) and change tactics instead of repeating the same card
- 🟡 **Tailored micro-lessons**: when stuck, a short explainer for that exact concept, then re-test it. *Built as an approved memory tip per question plus the drill's re-test. The "easier scaffolding questions" part is dropped: it would mean inventing questions, which the standing rule above forbids*
- 🟡 **Tailored test generator** (2026-09-24: Today's lesson, from `coach.js`; difficulty and distractor types not used yet — the audit of 2026-09-25 found the drill uses neither): build a test on demand from the learner's own error pattern (topic mix, difficulty, distractor types they fall for), not a fixed template. *Hand-picked version done (My answers); automatic version not built*
- 🟡 **Distractor analysis**: record which wrong option was chosen, cluster the misconception, address that specifically. *The chosen option is recorded on every answer, and `TTCoach.misconceptions` finds the wrong answer she keeps choosing, per question and per topic. On screen since v12: "Keeps tripping you up", My answers and its "Same wrong answer again" filter. Grouping similar misconceptions by meaning is not built*
- ✅ **Improvement suggestions on Home**: "You lose most marks on stopping distances — 10 minutes here would move your readiness 6%", ranked by predicted gain. *v12: Home's "What to work on" card, ranked by predicted gain, with a drill button. Measured as "N more right answers → expected score", not minutes or readiness %*
- ✅ **Pass prediction**: estimate mock score and probability of passing, with what would raise it. *v12, on My Progress. Not checked against real test results: not verified*
- ✅ **Study plan to test date**: given the test date, a day-by-day plan that adapts when a day is missed. *v12: the Study plan screen, which adapts when a day is missed*
- 🟡 **Explain-it-differently**: ask for another explanation of a question in plainer terms, or an analogy. *Built: drafts by local AI (377 of 378 passing the checks), the database columns with approved-only delivery, the admin review (Admin → Memory tips → Plain explanations) and the learner's button, browser-checked with faked rows. Not yet: the drafts loaded into the live server as `draft` and approved, so no learner sees it; not seen working with real rows*
- ✅ AI layer, decided 2026-09-24: **local** AI (Ollama on the home PC) drafts memory tips once, offline, for the admin to approve; the test-building runs as fixed rules on the phone, so everything works offline and costs nothing. No Claude API. *The same local AI also drafts plain explanations ("Explain it differently"), under the same checks*

## 3. Accounts and the login experience
- ✅ Email + password sign-up, sign-in, password reset, email confirmation
- ✅ One account covers a family; multiple learners; switch learner; profile photos
- ✅ Automatic sync — pulls on open, pushes after answers, retries offline; no sync button. Flags and Adventure progress merge item by item across devices (v10, v14); the rest of a learner record is newest-copy-wins
- ✅ Admin role flag
- 🟡 All of the above against a real Supabase project
- ⛔ **Standard paid-service account controls**, missing unless marked:
  - 🟡 Change email, change password while signed in, delete my account (GDPR), export my data. *Delete my account and export my data are built (Settings → Your data, v12; the server functions were proven on the live database inside rolled-back transactions). Change email and change password while signed in are not built*
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
- ✅ **Server-side free access** (v15, #42): Progress dashboard → Accounts lists every account with its access; the admin gives free access for good or until a day, or takes it away, written to `entitlements` by the server (`admin_set_access`), refused for anyone but the admin and for a Stripe payer
- ⛔ **A real admin console, server-side**, signed in as admin, seeing every customer:
  - Customer list: email, signed-up date, plan, status, last active, lifetime value, search and filter
  - Customer detail: their learners, progress, mock history, sessions, devices, payment history, notes
  - ✅ **Exempt from paying** (v15): mark an account free, with optional expiry, written to `entitlements` server-side (Accounts). *No reason field yet*
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
- 🟡 £4.99/month and £50/year in the app; Stripe hosts the card page. *Code only: payments are switched OFF (`config.js payments: false`, v15) because Stripe is not set up — no Payment Links, no edge functions, no webhook deployed (checked 2026-09-25). Until then the lock screen sends people to the admin for free access*
- 🟡 Payment-link checkout with account id attached; Stripe billing portal; free 20-question sample. *The sample works; checkout and portal are off (above)*
- 🟡 Access granted/revoked by webhook on payment, cancellation and failure. *The webhook is written (SETUP.md) but not deployed*
- 🟡 Never tested against real Stripe
- 📋 Your Stripe prices, links and webhook
- ⛔ Coupons and codes at checkout (see §4)
- ⛔ Free trial with card (7 days) as an alternative to the 20-question sample
- ⛔ Dunning: retry schedule, "your payment failed" email + in-app banner, grace period before lock
- ⛔ Proration when switching monthly → annual mid-term
- ⛔ Receipts and VAT: invoices with your business details, UK VAT handling, Stripe Tax
- 🟡 Refund policy and a self-serve refund request path. *Sample refund rules written (`legal/refunds.html`, with mock business details; for Darren to confirm). No self-serve path*
- ⛔ Cancellation flow that asks why (churn reasons feed §4 metrics), with a save offer
- ⛔ Apple's rule 3.1.1: Stripe can't sell digital subscriptions inside a native iOS app. Decide: web-only purchase, or add Apple in-app purchase + Google Play Billing

## 6. Engagement
- ✅ Levels (Provisional → Full Licence), XP bar, level-up card
- ✅ 10 badges from real activity, with progress on locked ones
- ✅ Daily goal 10/20/30, day streak with flame
- ✅ Daily reminder per learner: time of day, own timezone, only on days with no practice
- 🟡 Server reminders (needs push keypair + hourly cron)
- ⛔ Native push on iOS/Android (Firebase + Apple push key; a WebView doesn't get web push)
- 🟡 Streak freeze / repair, weekly summary email, "you're close to a badge" nudge. *Streak freezes and the badge nudge are built (v12); streak repair and the weekly summary email are not*
- ✅ Leaderboard or family comparison (opt-in). *As the family board (v12): opt-in, this account's learners only, no server. No public leaderboard, by design*
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
- 🟡 Privacy policy, terms of service, cookie/consent notice, refund policy. *Complete sample pages (`legal/`, v12) with clearly-marked mock business details, written from the code and schema; the app links to them. Still needed before charging anyone: real details and a legal review*
- 🟡 GDPR: data export, deletion, lawful basis, processor list (Supabase, Stripe), retention policy. *Export and deletion built (server, `backend.js`, Settings → Your data). The lawful basis, the processor list with the storage region (Supabase, Frankfurt) and the retention rule (kept while the account exists, deleted with it) are written in `legal/privacy.html`; the lawful bases are sample choices for Darren to confirm*
- 🟡 Age handling: under-16 sign-ups need parental consent in the UK. *16 is Darren's decision (above); the UK GDPR's own age is 13. Built: storage, the rule in `config.js`, `saveAge`, and the age question with the guardian's consent and email, browser-checked against the fake server; the rule and the manual process are in the privacy notice and terms. Not yet run from the app against the live Supabase project: not verified there*
- 🟡 "Not affiliated with DVSA" disclaimer, and accuracy/liability wording. *The disclaimer is in the app (both sign-in screens and Settings), on the about page, the guide and every legal page; accuracy and liability wording is in the terms. Left: Darren to confirm the liability wording, and a legal review*
- 🟡 Support: contact route, FAQ, response expectation. *FAQ in `help.html#faq`, and Help is one tap away in the app. Response times written: data requests within one month, refund emails within 5 working days. The contact address is a mock (`support@example.com`)*
- ⛔ Error monitoring (Sentry or similar) and uptime alerting
- 🟡 Product analytics: funnel, retention, feature use — privacy-respecting. *Per-learner activity is built (every answer, session, mock, hint, read-aloud, flag and screen, in the `events` table; Admin → Activity). Funnel and retention across learners are not*
- ⛔ Database backups and a restore you've actually tested
- ⛔ Rate limits on Edge Functions; abuse protection on the bank endpoint
- 🟡 Accessibility audit against WCAG 2.2 AA. *v13 (issues #10, #32): automated audit done and every failure it found fixed. Every app screen (learner and admin) and the help, about and legal pages pass axe-core's WCAG 2.0, 2.1 and 2.2 A and AA rules at 390px and 1280px, light and dark; keyboard-only use, focus, reduced motion, reflow and target size were checked by script; 19 tests pin the fixes. Not done: a check by a person using a real screen reader (VoiceOver, TalkBack or NVDA), so not verified. Also open: slight sideways scrolling at 320px with the app's biggest text size (up to 14px, on Road signs), and a flagged, answered mock square shows only the flag on screen (its spoken name says both)*
- 🟡 Automated tests (the scoring, Leitner, entitlement and sync logic at minimum) and CI. *CI runs `node --test` on every pull request and every push to `develop` and `main` (`.github/workflows/test.yml`). 380 tests (v14) cover question picking, the coach and the Adventure route, sign-in and email links, the activity queue, memory tips, plain explanations, export/delete/age, the question bank, the help/about/legal and Adventure pages, accessibility (names, keyboard, contrast in both themes) and the app's own files. The snapshot merge's flag and Adventure handling is tested through the app's real `mergeSnapshot()` (v14); no tests yet for the Leitner boxes, entitlements, or the sync's pull/push*
- ⛔ Staging environment separate from live, and a rollback path
- ✅ Versioning + changelog; a "what's new" card in the app. *`CHANGELOG.md` + the `sw.js` VERSION; since v12 the What's new card on Home reads that VERSION, and a test keeps its words in step with it*
- ✅ Onboarding: first-run flow that sets test date, goal and reminder in under a minute. *v12: the quick setup, checked in a browser. "Under a minute" was not timed with a real learner: not verified. It is one date field and two taps*
- ✅ Marketing page with pricing, screenshots and SEO (the app is not a landing page). *`about.html` (v12), browser-checked at 390px and 1280px, light and dark*

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
- 🟡 **Snapshot merge risk**: progress is one blob per account with newest-wins. Two devices
  syncing out of order can overwrite a learner's day. *Flags now merge per question, and every answer is also kept in the `events` table, so nothing is lost for good; the snapshot itself is still newest-wins*
- 🟡 **Road signs**: 212 official pictures since v17 (#48), credited under the Open Government
  Licence v3.0: every Highway Code sign, marking, light signal and vehicle marking with its caption.
  Left: the two signals pages (arm signals; police and other authorised persons) are photographs of
  people, left out until decided; 26 Highway Code pictures whose caption is not a meaning aren't shown.
- 🟡 **Diagrams**: road-marking questions show the Highway Code's marking pictures (centre line,
  double white lines, double yellow lines, box junction) since v16; junction layouts still have none.
- ⛔ **Bank size vs claims**: 378 questions against a published pool roughly double that.
  Marketing copy must not overstate it. *The about page complies: it states no bank size at all*
- ⛔ **Support load**: a support address at the domain, and somewhere to answer from.
- ⛔ **Price changes later** need existing subscribers grandfathered rather than repriced.
- ⛔ **Paywall funnel analytics** — without them, "why isn't anyone paying" is unanswerable.

---

## Honest summary
Everything in §1, and most of §3 and §6, is built. §2's clever coaching is mostly built (spacing, stuck detection, the tailored drill, approved memory tips, pass prediction, what to work on, the study plan); explain-it-differently is built but has nothing approved on the live server yet, and misconceptions are not grouped by meaning. §4's real admin console does not exist — what's there is device-local. §5 works in code but has never seen a real card. §7 has the project but no native build. §8 is under way: sample legal pages with mock details, data export and deletion, the age question, onboarding, the What's new card and the about page are built; the automated accessibility audit and its fixes are done (v13); real business details, a legal review, error monitoring, backups, staging and a screen-reader check by a person are not, and they are what actually block charging the public.
