// Theory Trainer — backend config.
// The publishable key (older projects: anon) is designed to be public: every table
// is protected by row-level security, so a signed-out visitor can read nothing.
// Get them from Supabase → Settings → API Keys, or paste them on the app's own
// Server settings screen.
window.TT_CONFIG = {
  url: "https://njajxuzhgxqcjfhjpkyp.supabase.co",        // e.g. https://abcdefghijklm.supabase.co
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYWp4dXpoZ3hxY2pmaGpwa3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODM1OTgsImV4cCI6MjEwMjY1OTU5OH0.nybVC3d3z1BMa4TwAvUI46pHZB01iCCggGRrvix-srg",    // sb_publishable_… (or a legacy anon key)

  // Payments master switch. false = no Subscribe, Manage subscription or "I've paid"
  // buttons anywhere (they could only fail): the paywall says to ask the admin, who gives
  // free access from Admin → Progress dashboard → Accounts. Set true ONLY once Stripe is set
  // up end to end (SETUP.md §3: the webhook, plus a Payment Link or the edge functions).
  payments: false,

  // Stripe Payment Links — the quick way to charge (SETUP.md §3, route A).
  // Leave blank to use the create-checkout Edge Function instead (route B).
  payLinkMonthly: "",
  payLinkAnnual: "",

      // Push notifications: the VAPID public key (generate it in Publish to GitHub.html,
      // section 4). Safe to publish. Leave blank and reminders fall back to in-app only.
  pushPublicKey: "",

  priceMonthly: "£4.99 a month",
  priceAnnual: "£50 a year",
  trialCount: 20,

  // Age rule: the ONE place it lives (backend.js TTAccount reads it; the server only
  // stores what the learner said). guardianUnder: a learner who may be younger than
  // this needs a parent's or guardian's consent. 16 is Darren's decision of 2026-09-24
  // (issue #4): the UK GDPR's own figure is 13 (Article 8(1), legislation.gov.uk), so 16
  // is stricter than the law requires, by his choice. Change it here and nowhere else.
  // oldest: a birth year more than this many years ago is treated as a typo.
  age: { guardianUnder: 16, oldest: 120 }
};
