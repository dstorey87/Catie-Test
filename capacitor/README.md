# iOS and Android builds

The app is the same code in all three places — browser, iPhone/iPad, Android.
Capacitor wraps the web files in a native shell so they can be signed and
submitted to the stores. Nothing here changes how the app behaves.

## What you need
- A Mac with Xcode (iOS builds only run on macOS) — Android Studio works on any OS
- Node.js 18 or newer
- Apple Developer Program (~£79/yr) to submit to the App Store; Google Play (~£20 one-off)

## Steps
1. Copy this `capacitor/` folder somewhere on your machine and open a terminal in it.
2. Put the app's files into a `www` folder next to `capacitor.config.json`:
   `index.html`, `Theory Trainer.dc.html`, `support.js`, `signs.js`, `config.js`,
   `backend.js`, `manifest.json`, `questions-free.json`, the four icons.
   (Download them from the repo, or copy your local copies.)
3. `npm install`
4. `npx cap add ios` and/or `npx cap add android`
5. `npx cap sync`
6. `npx cap open ios` → Xcode → set your team and bundle id → Product → Archive
   `npx cap open android` → Android Studio → Build → Generate Signed Bundle

After any change to the web files: replace them in `www`, run `npx cap sync`, rebuild.

## Two things to know before submitting

**Apple requires in-app purchase for digital subscriptions.** A native iOS build
that sells access with Stripe will be rejected under App Store rule 3.1.1. Your
options, in order of least work:

1. Ship the iOS app free, with sign-in only — people subscribe on the website and
   sign in on the phone. Apple allows an app to read an existing subscription;
   it must not link out to, or mention, buying elsewhere. This is what most small
   apps do. Keep the paywall screen out of the native build.
2. Add Apple in-app purchase alongside Stripe (StoreKit plugin + a receipt check
   in another Edge Function). Apple takes 15–30%. More work, but the paywall
   works inside the app.
3. Stay with the installable web app (Add to Home Screen). No fees, no review,
   Stripe throughout — which is what you have today.

**Google Play is looser** but the same rule exists in practice for subscriptions;
option 1 works there too.

## Native-side notes
- The web app already handles safe areas (`viewport-fit=cover` + `env(safe-area-inset-*)`), so notches and home bars are respected.
- Account, billing and question-bank calls go to Supabase over HTTPS, which works unchanged inside a WebView.
- Progress is stored locally first, so the app keeps working with no signal — same as on the web.
- Speech (read-aloud) uses the system voices on both platforms.

## Reminders in a native build
The Reminders switch uses browser push, which a WebView doesn't provide. Native
background reminders need `@capacitor/push-notifications` plus a Firebase project
(Android) and an Apple push key (iOS), and `send-reminders` would send through
FCM/APNs instead of Web Push. Both are free to set up.

Until that's added, a native build still nudges **while the app is open**, and the
installable web app on the home screen gets the real background reminders. Say the
word if you want the plugin path wired in.
