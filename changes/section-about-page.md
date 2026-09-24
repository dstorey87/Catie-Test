## Changelog
- New public page `about.html`: explains Theory Trainer to a parent or learner who has never seen it: what it does, who it is for, how the coaching works, screenshots, prices, the free sample, installing to the home screen, and "Not affiliated with the DVSA".
- Prices and the free-sample size on the page are read from `config.js` (`priceMonthly`, `priceAnnual`, `trialCount`) by `about/about.js`; nothing is typed into the page. If they can't be read (or JavaScript is off) the page says "see the prices in the app" instead of showing blanks.
- The page uses the app's colours and fonts, in light and dark: it follows the device, or the Appearance choice saved in the app (`tt.theme`) when there is one.
- Twelve pictures in `about/` (six screens, each in light and dark), taken from the real app by `about/capture.js` with a demo learner ("Sam") and only the public 20-question free sample, so no paid question and no real person's name appears on a public page.
- Search and sharing basics: title, description, canonical URL `https://dstorey87.github.io/Catie-Test/about.html`, Open Graph tags, one H1, alt text on every picture.
- Install steps checked against Apple's and Google's live help pages on 2026-09-24.
- 23 new tests in `tests/about-page.test.js`, including two for bugs found in the browser while building it (light mode showed both the light and dark pictures; the page's side gutter was wiped out at 390px).

## Requirements
- REQUIREMENTS.md line "Marketing page with pricing, screenshots and SEO" → ✅ (`about.html`; browser-checked at 390px and 1280px, light and dark; live once `develop` is promoted to `main`)
- REQUIREMENTS.md line "\"Not affiliated with DVSA\" disclaimer, and accuracy/liability wording" → 🟡 (on the about page: the disclaimer, "not the DVSA's official revision question bank", "no app can promise a pass". Still needed inside the app itself (issue #7) and in the terms (issue #2))
- REQUIREMENTS.md line "Bank size vs claims … Marketing copy must not overstate it" → stays ⛔, but the about page complies: it states no bank size at all

## Status
- ✅ About page: `about.html`, live at https://dstorey87.github.io/Catie-Test/about.html once `develop` is promoted to `main`. Links: "Open the app" → the app, "How to use it" → `help.html`, footer → `legal/privacy.html` and `legal/terms.html`
- How to test: `node --test` (23 about-page tests), then serve the repo (`python -m http.server <port> --bind 127.0.0.1`) and open `/about.html` at 390px and 1280px, in light and dark
- How to refresh the screenshots after the app changes: serve the repo, then `BASE=http://127.0.0.1:<port>/ node about/capture.js` (it drives the real app through `tests/browser/harness.js` and rewrites `about/*.png`)
- ⚠️ The prices section shows the prices in `config.js`; paying only works once Stripe is set up (SETUP.md §3)
- Left: the app does not link to the about page yet (App/UI lane, issue #7); `help.html` and `legal/*.html` come from issue #2 (the links are in place); the My Progress readiness dial is left out of the screenshots until its number shows (issue #12, item D)
