-- Happy Max Handyman — Supabase schema for the website lead form.
--
-- How to apply:
--   1. Open Supabase dashboard for project hfnuudllnfnunvodreao
--   2. SQL Editor → New query → paste this entire file → Run
--
-- What this does:
--   - Creates a "leads" table for contact-form submissions.
--   - Enables Row Level Security.
--   - Allows the anon (public) role to INSERT only (with length checks).
--   - No SELECT/UPDATE/DELETE for anon — leads are visible to you in the
--     Supabase Table Editor (which uses your authenticated session).

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text not null,
  email       text,
  tv_size     text,
  wall_type   text,
  message     text,
  source      text not null default 'website',
  status      text not null default 'new',
  user_agent  text
);

alter table public.leads enable row level security;

drop policy if exists "anon can submit leads" on public.leads;
create policy "anon can submit leads"
  on public.leads
  for insert
  to anon
  with check (
    char_length(name) between 1 and 100
    and char_length(phone) between 7 and 30
    and (email is null or char_length(email) <= 200)
    and (message is null or char_length(message) <= 2000)
    and (tv_size is null or char_length(tv_size) <= 50)
    and (wall_type is null or char_length(wall_type) <= 50)
  );

create index if not exists leads_created_at_idx on public.leads (created_at desc);

comment on table public.leads is 'Lead submissions from the happymax handyman website contact form';
