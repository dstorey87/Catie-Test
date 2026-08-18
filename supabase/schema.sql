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

-- ---------- question bank (the paid content) ----------
create table if not exists public.questions (
  qid           text primary key,
  topic         text not null,
  question      text not null,
  options       jsonb not null,
  correct_index int  not null,
  explanation   text,
  rule_ref      text,
  sign          text,
  test_type     text not null default 'car',
  free_sample   boolean not null default false,
  updated_at    timestamptz not null default now()
);
create index if not exists questions_topic_idx on public.questions (topic);

-- ---------- who has access ----------
create or replace function public.has_access(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = uid
      and ( e.status = 'comp'
            or ( e.status in ('active','trialing')
                 and (e.current_period_end is null or e.current_period_end > now()) ) )
  ) or exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- ---------- row-level security ----------
alter table public.profiles     enable row level security;
alter table public.entitlements enable row level security;
alter table public.snapshots    enable row level security;
alter table public.questions    enable row level security;

drop policy if exists "read own profile"    on public.profiles;
drop policy if exists "update own profile"  on public.profiles;
drop policy if exists "read own access"     on public.entitlements;
drop policy if exists "own snapshot"        on public.snapshots;
drop policy if exists "read paid questions" on public.questions;
drop policy if exists "admin writes questions" on public.questions;

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

-- Entitlements are never written from the app — only by the Stripe webhook,
-- which uses the service-role key and bypasses these policies.

-- ---------- make yourself the admin (run after your first sign-up) ----------
-- update public.profiles set role = 'admin' where email = 'you@example.com';

-- ---------- give someone free access by hand (family, testers) ----------
-- insert into public.entitlements (user_id, status, plan)
--   select id, 'comp', 'comp' from auth.users where email = 'kid@example.com'
--   on conflict (user_id) do update set status = 'comp', plan = 'comp', updated_at = now();
