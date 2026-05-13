-- Happy Max Handyman — Supabase schema for the website lead form.
--
-- How to apply on a fresh project:
--   1. Open the Supabase dashboard for your project.
--   2. SQL Editor → New query → paste this entire file → Run.
--
-- What this does:
--   - Creates a "leads" table for contact-form submissions.
--   - Locks the anon role down to INSERT-only on this table:
--       * anon CAN submit a lead (HTTP POST from the website form).
--       * anon CANNOT SELECT / UPDATE / DELETE leads.
--   - Enforces length limits via CHECK constraints (server-side validation).
--   - You read leads as an authenticated dashboard user via the Supabase
--     Table Editor (which uses postgres role and bypasses these grants).
--
-- Why CHECK constraints instead of RLS policies?
--   - RLS policies on INSERT for anon misbehaved in this project
--     (rejected even WITH CHECK (true)). CHECK constraints achieve the
--     same data-validation goal at the table level and are simpler.
--   - Read protection is achieved by table-level grants
--     (anon does not have SELECT permission).

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
  user_agent  text,

  constraint leads_name_len      check (char_length(name) between 1 and 100),
  constraint leads_phone_len     check (char_length(phone) between 7 and 30),
  constraint leads_email_len     check (email is null or char_length(email) <= 200),
  constraint leads_message_len   check (message is null or char_length(message) <= 2000),
  constraint leads_tv_size_len   check (tv_size is null or char_length(tv_size) <= 50),
  constraint leads_wall_type_len check (wall_type is null or char_length(wall_type) <= 50)
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- Lock anon and authenticated to INSERT-only on this table.
alter table public.leads disable row level security;
revoke all on public.leads from anon, authenticated;
grant insert on public.leads to anon, authenticated;

comment on table public.leads is 'Lead submissions from the happymax handyman website contact form';
