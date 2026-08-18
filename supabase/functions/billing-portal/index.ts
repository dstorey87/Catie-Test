// Supabase Edge Function: billing-portal
// Opens Stripe's own subscription page so a subscriber can change card, switch
// plan or cancel without you doing anything.
// Secrets required: STRIPE_SECRET_KEY

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Accepts either key generation: legacy service_role, or sb_secret_ keys which
// arrive as a JSON map in SUPABASE_SECRET_KEYS.
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const map = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return map.default || (Object.values(map)[0] as string) || '';
  } catch { return ''; }
}

// Only ever send Stripe back to our own site, keeping the pathname's %20
// intact (the app's filename contains a space). Also closes an open redirect.
const APP_URL = 'https://dstorey87.github.io/Catie-Test/Theory%20Trainer.dc.html';
function safeReturnUrl(raw: unknown): string {
  try {
    const u = new URL(String(raw || ''));
    if (u.origin === 'https://dstorey87.github.io') return u.origin + u.pathname;
  } catch { /* fall through */ }
  return APP_URL;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = serverKey();
  const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  if (!STRIPE_KEY) return json({ error: 'Stripe is not configured on the server yet.' }, 500);
  if (!SERVICE_KEY) return json({ error: 'Server key missing.' }, 500);

  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') || '', apikey: SERVICE_KEY }
  });
  if (!me.ok) return json({ error: 'Sign in first.' }, 401);
  const user = await me.json();

  const rows = await fetch(`${SUPABASE_URL}/rest/v1/entitlements?user_id=eq.${user.id}&select=stripe_customer_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  }).then((r) => r.json()).catch(() => []);
  const customer = rows?.[0]?.stripe_customer_id;
  if (!customer) return json({ error: 'No subscription on this account yet.' }, 400);

  const body = await req.json().catch(() => ({}));
  const origin = safeReturnUrl(body.origin);

  const form = new URLSearchParams();
  form.set('customer', customer);
  form.set('return_url', origin);

  const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20' },
    body: form
  });
  const session = await r.json();
  if (!r.ok) return json({ error: session?.error?.message || 'Stripe refused the request.' }, 400);
  return json({ url: session.url });
});
