# Theory Trainer — request checklist

States: ✅ done & verified in preview · ⚠️ built, needs your account/keys to test live · 📋 your step (free, minutes) · ❌ not possible from this tool, honest alternative given.

## Content & learning
- ✅ Question bank: 398 original questions, 14 DVSA topics, 4 options each, explanation + Highway Code ref (verified: counts, per-topic spread, no missing fields)
- ❌ The *actual* DVSA question bank — it is licensed/copyrighted and not published; ✅ same format/facts, and licensed sets you obtain load via packs
- ✅ Packs: Set 1/2/3, sign quiz, custom; per-pack Practise/Test toggles; JSON pack import/remove
- ✅ Practise: read-aloud (question/options/explanation), Leitner boxes, 50:50 hint toggle, auto-advance toggle, 10/20/30 lengths
- ✅ Custom mix: per-topic question counts with steppers
- ✅ Signs section: browse 20 signs (tap = spoken meaning) + sign quiz in test format
- ✅ Tips: on wrong answers, at session end, on progress screen, tip-of-day per weakest topics

## Testing
- ✅ Mock test: 50q, 57:00, flag + review grid, pass 43, per-topic results; survives reload/crash (verified by reload mid-test)
- ✅ Random "Surprise mix" test + balanced "like the real test" mode
- ✅ Wrong answers reviewed after every test: your pick, correct answer, explanation, sign visual, save-for-revision
- ✅ Flagging ("Tricky?") in practise + test; feeds revision list, Focus Drill, analytics

## Insights & analytics
- ✅ Session insights after every set, regardless of history (per-topic bars + tip)
- ✅ Readiness dial, coach advice, topic traffic-lights with improvement actions, mock trend chart, history with per-topic detail, 20 hardest, external mock logging
- ✅ Adaptive practice after 2 mocks (weak topics weighted)
- ✅ Per-learner analytics; admin learner switcher

## Users, login, subscription
- ✅ Login screen listing learners + Admin; add learner; per-learner storage
- ✅ Real accounts reworked per your request — **no Supabase anywhere**. Sign-in is now GitHub family sync: connect any device with your repo + token (login screen → Set up family sync) and every learner + their progress appears on it. ⚠️ Live push/pull needs your one-time token (SETUP.md §3, ~3 min) — I can't create tokens on your account
- ⚠️ Subscription gate: admin toggle, paywall screen, payment-link button, per-learner grant/revoke — app side done; needs your free Stripe Payment Link (Stripe hosts checkout; no gateway can be "downloaded" as static files)
- ❌ Enforcement stronger than app-level lock — client code can't hide secrets; real DRM needs a server

## Data & sync
- ✅ Offline-first: every answer saved to device instantly; test resumes after power loss
- ⚠️ Cloud sync — now via **GitHub** (no Supabase): snapshot lives in your private repo at sync/data.json; pull on open, debounced push after answers, pull-merge before every push (newest wins per learner), retry on reconnect. Built + wired; end-to-end test needs your token (SETUP.md §3)
- ✅ Export/Import backup files
- ✅ Question editor: add/edit/delete, correct-answer marking, sign picker, search across all questions, bank export
- ✅ Full accounting: printable answer book (every question, answer marked ✓, explanation, ref), flashcards, test paper + key

## Platforms & publishing
- ✅ Installable app (PWA): manifest, icons, service worker, offline cache — iPhone/iPad/Android/PC via Add to Home Screen
- 📋 Publish: upload the files to github.com/dstorey87/Catie-Test → enable Pages (SETUP.md §1) → live at https://dstorey87.github.io/Catie-Test/
- ❌ Me uploading the files into Catie-Test — my GitHub connector is read-only (browse/import only); your upload is 2 minutes via the repo's Add file → Upload files (SETUP.md §1)
- ❌ App Store / Play Store binaries — needs paid developer accounts + native build; PWA is the free route
- ❌ "Non-stealable" code — served web code is always viewable; keep the site name unguessable and repo private; user data is per-account and safe

## Voice
- ✅ Best-voice auto-pick (Enhanced/Premium en-GB preferred), voice picker with ★, speed control, sample
- 📋 One-time iPad/iPhone step for a genuinely nice voice: Settings → Accessibility → Spoken Content → Voices → English (UK) → download Enhanced (e.g. Kate)
