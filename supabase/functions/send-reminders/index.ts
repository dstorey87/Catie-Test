// Supabase Edge Function: send-reminders
// Runs on a schedule (hourly). For every account with reminders on, whose local
// hour matches their chosen time and who hasn't answered anything today, sends a
// push notification. Nothing is sent to accounts that already practised.
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@…)

import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = serverKey();
const H = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };

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

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

const LINES = [
  { title: 'Ten questions?', body: 'A short go now keeps your streak alive.' },
  { title: 'Your streak is waiting', body: 'Today\u2019s lesson takes about three minutes.' },
  { title: 'Quick practice', body: 'Reviews are due \u2014 they\u2019re the ones that stick.' }
];

Deno.serve(async () => {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const rows = await fetch(`${SUPABASE_URL}/rest/v1/reminders?enabled=eq.true&select=*`, { headers: H })
    .then((r) => r.json()).catch(() => []);
  if (!Array.isArray(rows)) return new Response('no rows', { status: 500 });

  let sent = 0, skipped = 0, dropped = 0;

  for (const r of rows) {
    // The learner's own clock: UTC minus the offset their browser reported.
    const localMinutes = ((utcMinutes - (r.tz_offset || 0)) % 1440 + 1440) % 1440;
    const localDate = new Date(now.getTime() - (r.tz_offset || 0) * 60000).toISOString().slice(0, 10);

    if (Math.floor(localMinutes / 60) !== (r.hour ?? 18)) { skipped++; continue; }
    if (r.last_active_day === localDate) { skipped++; continue; }   // already practised
    if (r.last_notified === localDate) { skipped++; continue; }     // already nudged

    const subs = await fetch(`${SUPABASE_URL}/rest/v1/push_subs?user_id=eq.${r.user_id}&select=*`, { headers: H })
      .then((x) => x.json()).catch(() => []);
    if (!subs.length) { skipped++; continue; }

    const line = LINES[Math.floor(Math.random() * LINES.length)];
    const payload = JSON.stringify({ title: line.title, body: line.body, url: './index.html' });

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { // device unsubscribed — clean it up
          await fetch(`${SUPABASE_URL}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`,
            { method: 'DELETE', headers: H });
          dropped++;
        }
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/reminders?user_id=eq.${r.user_id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ last_notified: localDate })
    });
  }

  return new Response(JSON.stringify({ sent, skipped, dropped }), { headers: { 'Content-Type': 'application/json' } });
});
