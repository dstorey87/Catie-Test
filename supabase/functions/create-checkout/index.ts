// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for the signed-in account. The Stripe secret
// key lives here, on the server — never in the app.
// Secrets required: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL
// (Supabase → Edge Functions → Secrets)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Works with both key generations: the legacy service_role JWT and the newer
// sb_secret_ keys, which arrive as a JSON map in SUPABASE_SECRET_KEYS.
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const map = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return map.default || (Object.values(map)[0] as string) || '';
  } catch { return ''; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = serverKey();
  const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const PRICES: Record<string, string | undefined> = {
    monthly: Deno.env.get('STRIPE_PRICE_MONTHLY'),
    annual: Deno.env.get('STRIPE_PRICE_ANNUAL')
  };
  if (!STRIPE_KEY) return json({ error: 'Stripe is not configured on the server yet.' }, 500);

  // Who is asking? Verified against Supabase, not trusted from the body.
  const auth = req.headers.get('Authorization') || '';
  const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SERVICE_KEY }
  });
  if (!me.ok) return json({ error: 'Sign in first.' }, 401);
  const user = await me.json();

  const body = await req.json().catch(() => ({}));
  const plan = body.plan === 'annual' ? 'annual' : 'monthly';
  const price = PRICES[plan];
  if (!price) return json({ error: `No Stripe price set for the ${plan} plan.` }, 500);
  const origin = String(body.origin || '').replace(/[^\w:/.\-]/g, '') || SUPABASE_URL;

  // Reuse the Stripe customer if we already made one for this account.
  const ent = await fetch(`${SUPABASE_URL}/rest/v1/entitlements?user_id=eq.${user.id}&select=stripe_customer_id`, {
    headers: { apikey: SERVICE_KEY }
  }).then((r) => r.json()).catch(() => []);
  const customer = ent?.[0]?.stripe_customer_id || '';

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', `${origin}?paid=1`);
  form.set('cancel_url', `${origin}?cancelled=1`);
  form.set('client_reference_id', user.id);
  form.set('subscription_data[metadata][user_id]', user.id);
  form.set('metadata[user_id]', user.id);
  form.set('allow_promotion_codes', 'true');
  if (customer) form.set('customer', customer);
  else if (user.email) form.set('customer_email', user.email);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const session = await r.json();
  if (!r.ok) return json({ error: session?.error?.message || 'Stripe refused the request.' }, 400);
  return json({ url: session.url });
});
