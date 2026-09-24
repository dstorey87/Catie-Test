## Changelog
- **Legal pages: every "[to be filled in by Darren]" replaced** (issue #21; Darren, 2026-09-24:
  "I don't have a business, put in mock values for now"). `legal/privacy.html`, `terms.html`,
  `cookies.html` and `refunds.html` now carry obviously-mock business details, each highlighted
  and marked (mock): operator "Theory Trainer (mock operator — not a registered business)",
  contact `support@example.com` (example.com is reserved for examples and reaches no one),
  address "0 Sample Road, Mocktown, England (mock)", company number 00000000 (mock), ICO
  registration ZA000000 (mock). While the details are mock, the pages tell learners to ask the
  admin (the adult who gave them access) instead.
- **A sample-policy banner at the top of every legal page** (replaces "Draft — not yet in
  force"): sample policy with mock details; Theory Trainer is a family project, not a registered
  business; replace before charging anyone; not reviewed by a lawyer.
- **The rest now says what the app really does**, each fact checked on 2026-09-24:
  - Where the data is stored: Supabase's Frankfurt region, Germany (`eu-central-1`, read from
    the live project). UK law treats EU countries as adequate (ICO adequacy page), so no extra
    safeguard is needed; the other services' own safeguards are left to their linked policies
    and say "not checked one by one".
  - Retention: everything is kept for as long as the account exists and deleted with it (every
    personal table is `on delete cascade`; no automatic deletion exists).
  - Cookies: none. Chromium loaded the live app, and the develop app, help page and all four
    legal pages, with a fresh profile: 0 cookies stored, 0 `Set-Cookie` headers from GitHub
    Pages, unpkg.com, Google Fonts. Supabase is called with `fetch`'s default credentials
    mode and the session in a header, so no cookie is sent or kept for it.
  - No consent banner: the reasons are given against the ICO's PECR exceptions guidance
    (strictly necessary; the appearance exception for `tt.theme`, with "Match device" or
    clearing site data as the way to object).
  - Age: guardian consent under `config.js` → `age.guardianUnder` (16, Darren's decision
    2026-09-24, stricter than UK GDPR's 13), shown on the privacy notice and the terms from
    config, never typed. Until the app asks for a birth year, the admin checks for a parent's or
    guardian's agreement before giving a younger learner full access.
  - Answering data requests within one month (ICO: "usually one month"); England and Wales law
    in the terms.
- **Sample choices for Darren to confirm** (sensible defaults, not facts): lawful bases
  (contract for the account, progress, coach and payments; legitimate interests for the admin
  seeing activity; consent for reminders), liability wording, 30 days' notice of price changes,
  a full refund on request within 14 days of the first payment until checkout asks for the
  waiver, full refunds for wrong charges, a 5-working-day reply to refund emails.
- `tests/help-pages.test.js`: the old test demanded the placeholders and banned any email. It is
  replaced by 5 tests: no placeholder left; the same banner at the top of every legal page (or of
  none); while the banner is up, every email is at example.com, every highlighted value is marked
  (mock), registration numbers are all zeros, and there is no phone number or postcode; the
  banner and the mock values come off together; the guardian age is read from config.js; and
  "deleted with the account" holds for every table that holds personal data. Checked by breaking
  the pages on purpose (a real-looking email, a reworded banner, a banner removed while mock
  values stayed, a typed age, a non-zero company number, a placeholder put back, an unmarked
  highlighted value): each one fails. The "real details everywhere" state passes.

## Requirements
- REQUIREMENTS.md §8 line "Privacy policy, terms of service, cookie/consent notice, refund policy" → 🟡 (complete sample pages with mock business details, matching the app; still needs real details and a legal review before charging anyone)
- REQUIREMENTS.md §8 line "GDPR: data export, deletion, lawful basis, processor list (Supabase, Stripe), retention policy" → 🟡 (lawful basis, processor list with the storage region, and the retention rule are now written; the Settings buttons for export and deletion are still the UI section's)
- REQUIREMENTS.md §8 line "Age handling: under-16 sign-ups need parental consent in the UK" → 🟡 (the rule and the manual process until the app asks are stated in the privacy notice and terms; the sign-up screen is still the UI section's)
- REQUIREMENTS.md §8 line "\"Not affiliated with DVSA\" disclaimer, and accuracy/liability wording" → 🟡 (liability wording now in the terms; still not shown inside the app, #7)
- REQUIREMENTS.md §8 line "Support: contact route, FAQ, response expectation" → 🟡 (response expectations written: data requests within one month, refund emails within 5 working days; the contact address is a mock)
- REQUIREMENTS.md §5 line "Refund policy and a self-serve refund request path" → 🟡 (refund rules written; no self-serve path)

## Status
- ✅ Legal pages have mock business details and a sample-policy banner: `legal/privacy.html`, `legal/terms.html`, `legal/cookies.html`, `legal/refunds.html`, live at https://dstorey87.github.io/Catie-Test/legal/privacy.html (and the other three) once `develop` is promoted to `main` (today they return 404 there).
- How to test: `node --test` (the legal-page tests are in `tests/help-pages.test.js`), then serve the repo and open `legal/*.html` at 390px and 1280px, light and dark.
- How to go live with real details: replace every highlighted "(mock)" value, then delete the `<div class="draft" role="note">` banner from all four pages in the same change. The tests refuse a banner without mock values, and mock values without a banner.
- ⚠️ Before charging anyone: a real operator name, address, contact email, and (if they apply) company and ICO numbers; a legal review; confirm the sample choices listed in the Changelog above.
- Supersedes, in `changes/section-help-guide.md`: the Changelog line saying the legal pages are "marked 'Draft — not yet in force'" and leave details "[to be filled in by Darren]"; the test description "the legal drafts contain no invented email, phone or postcode"; and the Status line "Left for Darren: business name, address, contact email, lawful basis, retention periods, Supabase region, transfers, age/consent, liability, governing law, refund rules". Only a legal review and the real business details are left.
