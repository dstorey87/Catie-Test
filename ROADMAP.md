# Theory Trainer — roadmap, ordered by how fast it earns

Read with `REQUIREMENTS.md`. This orders the same work by revenue, not by interest.
Money-blocking items first: anything that stops a stranger paying you, or exposes you
once they have.

---

## Phase 0 — Today. Nothing earns until this is done.
1. **Publish the current build** — one press in `Publish to GitHub.html` (27 files). The
   live site is still the 13th's build. *5 min, you.*
2. **Supabase project live**: create, run `schema.sql` + `schema-notifications.sql`, paste
   URL + publishable key, set Site URL, make yourself admin. *~15 min, you.*
3. **Transactional email that actually sends.** Supabase's built-in mailer is rate-limited
   to a handful per hour and is not for production — confirmation and reset emails will
   silently fail on launch day. Add an SMTP provider (Resend or Postmark free tier) in
   Authentication → SMTP. *~15 min, you. Not previously on the list.*
4. **Stripe live**: business/identity verification, bank account for payouts, two prices,
   two payment links, the webhook. Verification can take a day or two, so start it now.
   *~30 min of clicks, plus Stripe's review.*
5. **Prove it end to end**: sign up on a phone, take the free sample, hit the paywall,
   pay with the test card, watch access appear, cancel, watch it go. Then one real £4.99
   on your own card, and refund it. *~30 min, both of us.*

**After phase 0 you can legally and technically take money — but see phase 1 before you advertise.**

## Phase 1 — This week. Required before charging strangers.
6. **Legal minimum**, or Stripe and the ICO become your problem: privacy policy, terms of
   service, refund policy, and the **UK 14-day cooling-off waiver** for digital services
   (without express consent at checkout, buyers can demand refunds for 14 days). Plus a
   "not affiliated with DVSA" line and a support email address. *~2 hours with templates.*
7. **A name and a domain.** Nobody pays for something at `dstorey87.github.io/Catie-Test/`,
   and the App Store won't take it later. Pick a name, check it isn't trademarked, buy the
   domain, point Pages at it, update the Supabase Site URL and Stripe links. *~1 hour + ~£12/yr.*
8. **Server-side comps and exemptions.** Today "free access" is device-local — it grants
   nothing to a customer on their own phone. This is the item that lets you say yes to
   family, instructors and complainers without shipping code. *Half a day of work.*
9. **Owner console v1, read-only plus one switch**: customer list (email, plan, status,
   signed-up, last active), customer detail, a comp/suspend toggle, and today's numbers
   (subscribers, MRR, failed payments). Nothing clever. *1–2 days.*
10. **Failed-payment handling**: in-app banner, grace period, dunning emails. Failed cards
    are the largest silent revenue leak in every subscription app. *Half a day.*
11. **Error monitoring + database backups you've restored once.** *~2 hours.*
12. **Funnel analytics**: sign-up → sample finished → paywall seen → checkout opened →
    paid. Without this you're guessing at why people don't pay. *~3 hours.*
13. **Account controls you now legally owe customers**: change email, change password,
    delete my account, export my data. *1 day.*

## Phase 2 — Next. Grows revenue rather than protecting it.
14. **Discount codes and gift codes** — percentage or fixed, usage and per-customer limits,
    expiry, plan restriction, redemption list, kill switch. Needed for a launch promo and
    for instructor deals. *2 days.*
15. **Referral codes** — learner shares, both get free time. Cheapest growth channel. *1 day.*
16. **Free-trial choice**: keep the 20-question sample, or 7 days with a card. Test which
    converts. Add abuse limiting — today someone can re-register for another free sample. *1 day.*
17. **First-run onboarding**: test date, daily goal, reminder time, first lesson, in under
    a minute. Directly raises the number who reach the paywall. *1 day.*
18. **A real landing page** with pricing, screenshots and SEO. The app is not a sales page. *1–2 days.*
19. **Email lifecycle**: welcome, day-3 nudge, abandoned checkout, test-day good luck. *1 day.*
20. **Seat and device limits** — one account is currently shareable by a whole class. *Half a day.*

## Phase 3 — Retention and the reason to charge more.
21. **Per-answer attempt history table.** Foundation for everything below; today only a
    progress snapshot is stored. Also fixes a real risk: the newest-wins snapshot merge can
    overwrite a learner's day if two devices sync out of order. *1 day.*
22. **Stuck detection + tailored micro-lessons + re-test.** *3–4 days.*
23. **Tailored test generator** from the learner's own error pattern. *2 days.*
24. **Distractor analysis** — which wrong answer they pick, and the misconception behind it. *2 days.*
25. **Improvement suggestions on Home, ranked by predicted gain, and pass prediction.** *2 days.*
26. **Study plan to test date** that adapts when a day is missed. *2 days.*
27. **Cohort progress dashboard** for you: readiness distribution, hardest questions across
    all learners, pass rates. Doubles as marketing evidence. *2 days.*

## Phase 4 — Content depth. Competitors advertise volume.
28. **More road signs.** 20 today; the real test covers far more, and the artwork is drawn
    hints rather than real sign imagery. Open-licensed Highway Code sign sets exist — I
    can't generate images, so this needs sourcing. *1–2 days once sourced.*
29. **More questions.** 378 today; the published DVSA pool is roughly double. Be careful
    what you claim in marketing until the bank matches it. *Ongoing.*
30. **Junction and road-marking diagrams** for the questions that need them. *Needs artwork.*
31. **Hazard perception clips** — half the real test, and completely absent. Video licensing
    or filming. *Decide whether the product claims full test preparation without it.*
32. **DVSA case-study questions** (the scenario format). *2 days.*

## Phase 5 — Stores, only when the web version earns.
33. Native builds run on real devices; native push (Firebase + Apple key). *2–3 days.*
34. **Apple rule 3.1.1**: Stripe cannot sell digital subscriptions in a native iOS app.
    Either sell on the web and ship iOS sign-in-only, or implement Apple IAP + Google Play
    Billing — which also costs 15–30% of revenue. *3–5 days if you do IAP.*
35. Store enrolment (~£79/yr Apple, ~£20 Google), assets, privacy questionnaires, review. *2–3 days.*

## Phase 6 — Engineering hygiene. Cheap insurance, no revenue.
36. Automated tests for scoring, Leitner, entitlements and sync; CI. *2 days.*
37. Staging project separate from live, and a rollback path. *1 day.*
38. Accessibility audit against WCAG 2.2 AA. *1 day.*
39. Rate limits on Edge Functions; abuse protection on the bank endpoint. *Half a day.*
40. 2FA for admin, sessions list, Apple/Google sign-in. *2 days.*
41. Supabase paid plan before the free project pauses on inactivity or hits its limits. *~£20/mo.*

---

## The shortest path to your first pound
Phase 0 in one sitting (~1½ hours of your time plus Stripe's verification wait), then
items 6 and 7 before you tell anyone about it. Everything else can follow while money
comes in.

## What I cannot do for you, at any point
Create your Supabase, Stripe, Apple or Google accounts; hold your secret keys; push to
your repo; sign or upload store binaries; write your legal pages as a lawyer would;
generate real illustrations or sign artwork; or supply the licensed DVSA bank.
