// Theory Trainer — backend config.
// The anon key is designed to be public: every table is protected by row-level
// security, so a signed-out visitor can read nothing. Fill these in (Supabase →
// Project Settings → API) or paste them on the app's Server settings screen.
window.TT_CONFIG = {
  url: "https://njajxuzhgxqcjfhjpkyp.supabase.co",        // e.g. https://abcdefghijklm.supabase.co
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qYWp4dXpoZ3hxY2pmaGpwa3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODM1OTgsImV4cCI6MjEwMjY1OTU5OH0.nybVC3d3z1BMa4TwAvUI46pHZB01iCCggGRrvix-srg",    // the "anon public" key

  // Stripe Payment Links — the quick way to charge (SETUP.md §3, route A).
  // Leave blank to use the create-checkout Edge Function instead (route B).
  payLinkMonthly: "",
  payLinkAnnual: "",

      // Push notifications: the VAPID public key (generate it in Publish to GitHub.html,
      // section 4). Safe to publish. Leave blank and reminders fall back to in-app only.
  pushPublicKey: "",

  priceMonthly: "£4.99 a month",
  priceAnnual: "£50 a year",
  trialCount: 20
};
