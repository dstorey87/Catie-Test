-- Theory Trainer — database schema.
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Once.
-- Everything below is protected by row-level security: a signed-out visitor,
-- or a signed-in account without an active subscription, can read nothing.

-- ---------- accounts ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  name        text,
  role        text not null default 'user',   -- 'user' | 'admin'
  created_at  timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id               uuid primary key references auth.users on delete cascade,
  status                text not null default 'none',  -- none|active|trialing|past_due|canceled|comp
  plan                  text,                          -- monthly|annual|comp
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  updated_at            timestamptz not null default now()
);

-- ---------- progress ----------
create table if not exists public.snapshots (
  user_id    uuid primary key references auth.users on delete cascade,
  blob       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- activity: everything a learner does, one row per event ----------
-- Append-only. The app queues events on the device and sends them in batches, so
-- it works offline; client_id makes a resend harmless (the unique index drops repeats).
-- To delete one account's history:  delete from public.events where user_id = '<uuid>';
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  client_id   text not null,               -- made on the device; retries reuse it
  learner_id  text,                        -- the learner profile on that device
  learner     text,                        -- her name at the time, for reading the log
  at          timestamptz not null,        -- when it happened on the device
  kind        text not null,               -- answer, question_shown, session_start, ...
  qid         text,                        -- the question, when there is one
  data        jsonb not null default '{}'::jsonb
);
create unique index if not exists events_client_idx on public.events (user_id, client_id);
create index if not exists events_user_at_idx on public.events (user_id, at desc);
create index if not exists events_user_qid_idx on public.events (user_id, qid);

-- ---------- question bank (the paid content) ----------
create table if not exists public.questions (
  qid           text primary key,
  topic         int  not null,               -- 1-14; the app compares numerically
  question      text not null,
  options       jsonb not null,
  correct_index int  not null,
  explanation   text,
  rule_ref      text,
  sign          text,
  test_type     text not null default 'car',
  pack          text not null default 'p1',  -- p1|p2|p3|custom — drives the pack toggles
  free_sample   boolean not null default false,
  updated_at    timestamptz not null default now()
);
-- Upgrades for a database that ran an earlier version of this file (create
-- table if not exists is a no-op there). Both statements re-run harmlessly.
alter table public.questions add column if not exists pack text not null default 'p1';
-- Memory tips: drafted by local AI (tools/write-memory-tips.js), shown to learners only once
-- the admin approves them (Admin → Memory tips). 'draft' | 'approved' | 'rejected'.
alter table public.questions add column if not exists memory_tip text;
alter table public.questions add column if not exists tip_status text;
alter table public.questions alter column topic type int using topic::int;

create index if not exists questions_topic_idx on public.questions (topic);

-- ---------- who has access ----------
create or replace function public.has_access(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid
      and ( ( e.status = 'comp'
              -- Free access given by the admin: for good (no end) or until a moment
              -- (admin_set_access below, issue #42).
              and ( e.current_period_end is null or e.current_period_end > now() ) )
            or ( e.status in ('active','trialing')
                 -- A null period end is only honoured briefly: it means the webhook
                 -- couldn't read the renewal date, and must not grant access forever.
                 and ( e.current_period_end > now()
                       or (e.current_period_end is null
                           and e.updated_at > now() - interval '72 hours') ) ) )
  ) or exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

-- Signed-out visitors may not probe anyone's access; signed-in accounts keep
-- EXECUTE because the questions policies below call these as the querying role.
revoke execute on function public.has_access(uuid) from public, anon;
revoke execute on function public.is_admin(uuid)   from public, anon;
grant  execute on function public.has_access(uuid) to authenticated;
grant  execute on function public.is_admin(uuid)   to authenticated;

-- ---------- new sign-up: create the rows automatically ----------
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  insert into public.entitlements (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end; $$;

-- Only the trigger calls this; keep it off /rest/v1/rpc (Supabase security advisor).
-- A trigger still fires without EXECUTE — checked on the live project, 2026-09-23.
revoke execute on function public.on_auth_user_created() from public, anon, authenticated;

-- Attaching a trigger to auth.users needs ownership of that table, which some
-- projects don't give the SQL editor. If that's refused, everything else still
-- works — the backfill at the bottom of this file repairs any missing rows.
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.on_auth_user_created();
exception when insufficient_privilege then
  raise notice 'Could not attach the sign-up trigger to auth.users. Re-run the backfill below after new sign-ups.';
end $$;

-- ---------- row-level security ----------
alter table public.profiles     enable row level security;
alter table public.entitlements enable row level security;
alter table public.snapshots    enable row level security;
alter table public.questions    enable row level security;
alter table public.events       enable row level security;

drop policy if exists "read own profile"    on public.profiles;
drop policy if exists "update own profile"  on public.profiles;
drop policy if exists "read own access"     on public.entitlements;
drop policy if exists "own snapshot"        on public.snapshots;
drop policy if exists "read paid questions" on public.questions;
drop policy if exists "admin writes questions" on public.questions;
drop policy if exists "add own events"      on public.events;
drop policy if exists "read own events"     on public.events;
drop policy if exists "admin reads profiles" on public.profiles;

create policy "read own profile"   on public.profiles     for select using (auth.uid() = id);
create policy "update own profile" on public.profiles     for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
create policy "read own access"    on public.entitlements for select using (auth.uid() = user_id);
create policy "own snapshot"       on public.snapshots    for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The whole point: questions are readable only with access (or if flagged as a sample).
create policy "read paid questions" on public.questions for select
  using (free_sample or public.has_access(auth.uid()));
create policy "admin writes questions" on public.questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Activity: an account adds and reads its own events; the admin reads everyone's
-- (that is how Darren's Activity screen sees Catie's). Nobody edits or deletes from the app.
create policy "add own events"  on public.events for insert with check (auth.uid() = user_id);
create policy "read own events" on public.events for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
-- The Activity screen names each account, so the admin may read every profile.
create policy "admin reads profiles" on public.profiles for select using (public.is_admin(auth.uid()));

-- Nobody writes entitlements through these tables' policies: the Stripe webhook uses the
-- service-role key, and the admin's free access goes through admin_set_access (below).

-- ---------- privacy: age, data export, account deletion (issue #4) ----------
-- Expand-only: new nullable/defaulted columns and new functions. Nothing is dropped.
-- Applied to the live project as migration privacy_export_delete_age_plain_explanations
-- (2026-09-24). Every statement re-runs harmlessly.

-- Age. The rule "younger than N needs a parent's or guardian's consent" lives in ONE
-- place, config.js (TT_CONFIG.age), and backend.js applies it; the server only keeps
-- what the learner said. The existing "update own profile" policy already lets an
-- account change its own row (never its role), so these columns need no new policy.
alter table public.profiles add column if not exists birth_year int;
alter table public.profiles add column if not exists guardian_consent boolean not null default false;
alter table public.profiles add column if not exists guardian_email text;

-- "Explain it differently": a plainer re-wording of a question's own explanation.
-- Same life cycle as memory tips — drafted, then shown to learners only once the admin
-- approves it (Admin review screen). 'draft' | 'approved' | 'rejected'.
alter table public.questions add column if not exists plain_explanation text;
alter table public.questions add column if not exists plain_status text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_plain_status_check') then
    alter table public.questions add constraint questions_plain_status_check
      check (plain_status is null or plain_status in ('draft', 'approved', 'rejected'));
  end if;
end $$;

-- Data export (GDPR right of access): everything the server holds about the CALLER.
-- SECURITY INVOKER on purpose: it runs as the signed-in account, so row-level security
-- still applies, and every query is also filtered to auth.uid() (the admin may read
-- everyone's events and profiles, but an export is only ever your own).
-- Push devices leave out their encryption keys (p256dh, auth): technical secrets for
-- that browser, not information about the person.
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = 'P0001', hint = 'not_signed_in',
      message = 'Not signed in. Sign in, then ask for your data again.';
  end if;
  return jsonb_build_object(
    'exported_at',  now(),
    'account_id',   uid,
    'profile',      (select to_jsonb(p) from public.profiles p where p.id = uid),
    'entitlement',  (select to_jsonb(e) from public.entitlements e where e.user_id = uid),
    'snapshot',     (select to_jsonb(s) from public.snapshots s where s.user_id = uid),
    'reminders',    (select to_jsonb(r) from public.reminders r where r.user_id = uid),
    'push_devices', coalesce((select jsonb_agg(jsonb_build_object('endpoint', d.endpoint, 'ua', d.ua, 'created_at', d.created_at)
                               order by d.created_at) from public.push_subs d where d.user_id = uid), '[]'::jsonb),
    'events',       coalesce((select jsonb_agg(to_jsonb(v) order by v.at, v.id)
                               from public.events v where v.user_id = uid), '[]'::jsonb)
  );
end $$;
revoke execute on function public.export_my_data() from public, anon;
grant  execute on function public.export_my_data() to authenticated;

-- Account deletion (GDPR right to erasure). Deleting the auth.users row removes every
-- row the account owns: profiles, entitlements, snapshots, events, reminders and
-- push_subs all reference it "on delete cascade" (checked on the live project).
-- Only a privileged function may delete from auth.users, so the work happens in a
-- SECURITY DEFINER function kept in the "private" schema, which the API does not
-- expose (Supabase's guidance). The public entry point is a plain SECURITY INVOKER
-- wrapper, and it only ever deletes the caller: it takes no arguments.
-- It refuses, with a message saying what to do:
--   * the admin account (so a tap cannot lock the owner out of the admin screens);
--   * an account whose Stripe subscription would still bill it (anything but a
--     finished subscription or one already set to cancel at the period end).
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception using errcode = 'P0001', hint = 'not_signed_in',
      message = 'Not signed in. Sign in again, then delete your account.';
  end if;
  if public.is_admin(uid) then
    raise exception using errcode = 'P0001', hint = 'admin_account',
      message = 'This is the admin account, so it cannot delete itself from the app (that would lock you out of the admin screens). Make another account the admin in Supabase first, then delete this one.';
  end if;
  if exists (select 1 from public.entitlements e
             where e.user_id = uid
               and e.stripe_subscription_id is not null
               and e.status not in ('canceled', 'incomplete_expired')
               and not e.cancel_at_period_end) then
    raise exception using errcode = 'P0001', hint = 'subscription_active',
      message = 'Your subscription is still set to renew. Cancel it first (Manage subscription), then delete your account.';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function private.delete_my_account() from public, anon;
grant  execute on function private.delete_my_account() to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.delete_my_account();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;

-- ---------- the admin gives an account free access (issue #42) ----------
-- Admin → Progress dashboard → Accounts calls these. Until Stripe is set up, free access
-- is the only way into the full question bank for anyone but the admin.
-- Same shape as delete_my_account: the work is a SECURITY DEFINER function in "private"
-- (not exposed by the API) behind a SECURITY INVOKER wrapper in public. Both refuse
-- anyone but the admin. Applied to the live project as migration admin_free_access.
--
-- admin_accounts(): every account with its access, for the list.
--   paying = a Stripe subscription that is still running (the webhook owns that row).
create or replace function private.admin_accounts()
returns table (id uuid, email text, name text, role text, status text,
               free_until timestamptz, paying boolean, last_seen timestamptz)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = 'P0001', hint = 'not_admin',
      message = 'Only the admin account can see the accounts list. Sign in as the admin.';
  end if;
  return query
    select p.id, p.email, p.name, p.role, coalesce(e.status, 'none'),
           case when e.status = 'comp' then e.current_period_end end,
           coalesce(e.stripe_subscription_id is not null
                    and e.status not in ('canceled', 'incomplete_expired'), false),
           u.last_sign_in_at
    from public.profiles p
    left join public.entitlements e on e.user_id = p.id
    left join auth.users u on u.id = p.id
    order by p.created_at;
end $$;
revoke execute on function private.admin_accounts() from public, anon;
grant  execute on function private.admin_accounts() to authenticated;

create or replace function public.admin_accounts()
returns table (id uuid, email text, name text, role text, status text,
               free_until timestamptz, paying boolean, last_seen timestamptz)
language plpgsql security invoker stable set search_path = '' as $$
begin
  return query select * from private.admin_accounts();
end $$;
revoke execute on function public.admin_accounts() from public, anon;
grant  execute on function public.admin_accounts() to authenticated;

-- admin_set_access(target, free, until):
--   free = true  -> free access, for good (until null) or until that moment. The app sends
--                   the start of the day AFTER the date picked, in the admin's own time,
--                   so the day picked is included and no time zone is guessed here.
--   free = false -> takes free access away (only a 'comp' row changes; nothing else).
-- Refuses: anyone but the admin; an account that no longer exists; an end already past;
-- an account paying through Stripe (its access follows the subscription).
create or replace function private.admin_set_access(target uuid, free boolean, until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = 'P0001', hint = 'not_admin',
      message = 'Only the admin account can change who has access. Sign in as the admin.';
  end if;
  if not exists (select 1 from auth.users u where u.id = target) then
    raise exception using errcode = 'P0001', hint = 'no_account',
      message = 'That account no longer exists. Press Refresh to reload the list.';
  end if;
  if free and until is not null and until <= now() then
    raise exception using errcode = 'P0001', hint = 'past_date',
      message = 'That date has already gone. Pick today or a later day.';
  end if;
  if exists (select 1 from public.entitlements e
             where e.user_id = target and e.stripe_subscription_id is not null
               and e.status not in ('canceled', 'incomplete_expired')) then
    raise exception using errcode = 'P0001', hint = 'paying',
      message = 'This account pays through Stripe, so its access follows the subscription. Cancel the subscription in Stripe first, then give free access.';
  end if;
  if free then
    insert into public.entitlements (user_id, status, plan, current_period_end, cancel_at_period_end, updated_at)
    values (target, 'comp', 'comp', until, false, now())
    on conflict (user_id) do update
      set status = 'comp', plan = 'comp', current_period_end = excluded.current_period_end,
          cancel_at_period_end = false, updated_at = now();
  else
    update public.entitlements
      set status = 'none', plan = null, current_period_end = null, updated_at = now()
      where user_id = target and status = 'comp';
  end if;
end $$;
revoke execute on function private.admin_set_access(uuid, boolean, timestamptz) from public, anon;
grant  execute on function private.admin_set_access(uuid, boolean, timestamptz) to authenticated;

create or replace function public.admin_set_access(target uuid, free boolean, until timestamptz default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.admin_set_access(target, free, until);
end $$;
revoke execute on function public.admin_set_access(uuid, boolean, timestamptz) from public, anon;
grant  execute on function public.admin_set_access(uuid, boolean, timestamptz) to authenticated;

-- ---------- backfill: repair rows for accounts that existed before this ran ----------
-- The sign-up trigger only covers NEW accounts. This is idempotent — safe to
-- re-run any time (and the fallback if the trigger couldn't be attached above).
insert into public.profiles (id, email, name)
  select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', '')
  from auth.users u
  on conflict (id) do nothing;
insert into public.entitlements (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;

-- ---------- make yourself the admin (run after your first sign-up) ----------
-- update public.profiles set role = 'admin' where email = 'you@example.com';

-- ---------- give someone free access by hand (family, testers) ----------
-- Easier: Admin → Progress dashboard → Accounts (admin_set_access above). By hand:
-- insert into public.entitlements (user_id, status, plan)
--   select id, 'comp', 'comp' from auth.users where email = 'kid@example.com'
--   on conflict (user_id) do update set status = 'comp', plan = 'comp', updated_at = now();
