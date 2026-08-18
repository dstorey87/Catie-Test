// Supabase Edge Function: stripe-webhook
// Stripe tells this function when a subscription starts, renews, fails or ends;
// it writes the account's access row with the service-role key. This is what
// makes payment enforcement real — the app can only read the result.
// Secrets required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Important: deploy with JWT verification OFF (Stripe calls it unauthenticated,
// signed instead). Supabase → Edge Functions → stripe-webhook → Details.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = serverKey();
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

async function verify(body: string, header: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=')) as [string, string][]);
  const t = parts['t'], v1 = parts['v1'];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay window
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== v1.length) return false;
  let same = 0; for (let i = 0; i < hex.length; i++) same |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return same === 0;
}

const patch = (row: Record<string, unknown>) =>
  fetch(`${SUPABASE_URL}/rest/v1/entitlements`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });

const stripeGet = (path: string) =>
  fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }).then((r) => r.json());

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

const planOf = (sub: any) => {
  const interval = sub?.items?.data?.[0]?.price?.recurring?.interval || sub?.plan?.interval;
  return interval === 'year' ? 'annual' : 'monthly';
};

async function userIdFor(sub: any): Promise<string | null> {
  if (sub?.metadata?.user_id) return sub.metadata.user_id;
  const cust = typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id;
  if (!cust) return null;
  const rows = await fetch(`${SUPABASE_URL}/rest/v1/entitlements?stripe_customer_id=eq.${cust}&select=user_id`, {
    headers: { apikey: SERVICE_KEY }
  }).then((r) => r.json()).catch(() => []);
  return rows?.[0]?.user_id || null;
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  if (!(await verify(body, sig))) return new Response('bad signature', { status: 400 });

  const event = JSON.parse(body);
  const obj = event.data?.object || {};

  try {
    if (event.type === 'checkout.session.completed') {
      const uid = obj.client_reference_id || obj.metadata?.user_id;
      const sub = obj.subscription ? await stripeGet(`subscriptions/${obj.subscription}`) : null;
      if (uid) await patch({
        user_id: uid,
        status: sub?.status || 'active',
        plan: sub ? planOf(sub) : 'monthly',
        stripe_customer_id: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id || null,
        stripe_subscription_id: sub?.id || null,
        current_period_end: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!sub?.cancel_at_period_end,
        updated_at: new Date().toISOString()
      });
    } else if (event.type.startsWith('customer.subscription.')) {
      const uid = await userIdFor(obj);
      if (uid) await patch({
        user_id: uid,
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status,
        plan: planOf(obj),
        stripe_customer_id: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id || null,
        stripe_subscription_id: obj.id,
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!obj.cancel_at_period_end,
        updated_at: new Date().toISOString()
      });
    } else if (event.type === 'invoice.payment_failed') {
      const sub = obj.subscription ? await stripeGet(`subscriptions/${obj.subscription}`) : null;
      const uid = sub ? await userIdFor(sub) : null;
      if (uid) await patch({ user_id: uid, status: 'past_due', updated_at: new Date().toISOString() });
    }
  } catch (e) {
    console.error('webhook handling failed', e);
    return new Response('error', { status: 500 }); // Stripe will retry
  }

  return new Response('ok');
});
