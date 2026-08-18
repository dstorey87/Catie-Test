-- Theory Trainer — reminders and push notifications.
-- Paste into Supabase → SQL Editor → Run. Safe to run after schema.sql.

create table if not exists public.reminders (
  user_id       uuid primary key references auth.users on delete cascade,
  enabled       boolean not null default true,
  hour          int not null default 18,     -- the learner's own local hour, 0–23
  tz_offset     int not null default 0,      -- minutes, as Date.getTimezoneOffset() reports
  streak_guard  boolean not null default true,
  last_active_day date,                      -- last day they answered anything
  last_notified date,                        -- stops a second nudge the same day
  updated_at    timestamptz not null default now()
);

create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);

alter table public.reminders enable row level security;
alter table public.push_subs enable row level security;

drop policy if exists "own reminders" on public.reminders;
drop policy if exists "own push subs" on public.push_subs;

create policy "own reminders" on public.reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own push subs" on public.push_subs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The send-reminders function uses the service-role key and bypasses both policies.

-- ---------- run the reminder sweep every hour ----------
-- Easiest: Supabase Dashboard → Integrations → Cron → new job, hourly, calling
-- https://YOUR-PROJECT.supabase.co/functions/v1/send-reminders with your
-- service-role key as the Authorization bearer.
--
-- Or in SQL (needs the pg_cron and pg_net extensions enabled):
-- select cron.schedule('theory-trainer-reminders', '0 * * * *', $$
--   select net.http_post(
--     url := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-reminders',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR-SERVICE-ROLE-KEY"}'::jsonb
--   );
-- $$);
