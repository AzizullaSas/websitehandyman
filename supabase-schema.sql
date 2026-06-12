-- Happy Max Handyman — Supabase schema for the website lead form.
--
-- This is the FULL baseline for a fresh project (current production
-- state after migrations 0002–0005). On the existing project
-- hfnuudllnfnunvodreao just run the numbered migrations instead.
--
-- How to apply on a fresh project:
--   1. Open the Supabase dashboard for your project.
--   2. SQL Editor → New query → paste this entire file → Run.
--   3. Then follow supabase/DEPLOY.md (Edge Functions, Vault secret,
--      Telegram trigger from migration 0003).
--
-- Security model:
--   - anon / authenticated have NO privileges on "leads" at all.
--   - The ONLY write path is the `submit-lead` Edge Function (service
--     role), which validates input, checks the honeypot, and rate-limits
--     per IP before inserting.
--   - CHECK constraints duplicate the length/format limits server-side.
--   - You read leads via the Supabase Table Editor (postgres role) or
--     from the Telegram cards posted by `lead-notify`.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  phone         text not null,
  email         text,
  tv_size       text,
  wall_type     text,
  message       text,
  source        text not null default 'website',
  status        text not null default 'new',
  user_agent    text,
  ip_hash       text,    -- sha-256 of client IP, for rate limiting (no raw IPs)
  tg_message_id bigint,  -- Telegram notification message, edited on status change
  tg_thread_id  bigint,  -- Telegram forum topic the notification went to

  constraint leads_name_len       check (char_length(name) between 1 and 100),
  constraint leads_phone_len      check (char_length(phone) between 7 and 30),
  constraint leads_email_len      check (email is null or char_length(email) <= 200),
  constraint leads_message_len    check (message is null or char_length(message) <= 2000),
  constraint leads_tv_size_len    check (tv_size is null or char_length(tv_size) <= 50),
  constraint leads_wall_type_len  check (wall_type is null or char_length(wall_type) <= 50),
  constraint leads_status_allowed check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  constraint leads_user_agent_len check (user_agent is null or char_length(user_agent) <= 400),
  constraint leads_source_len     check (char_length(source) <= 40),
  constraint leads_ip_hash_len    check (ip_hash is null or char_length(ip_hash) <= 64)
);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

-- Supports the submit-lead per-IP rate-limit lookup.
create index if not exists leads_ip_hash_created_at_idx
  on public.leads (ip_hash, created_at desc);

-- Client roles get nothing; all writes go through the submit-lead
-- Edge Function using the service role.
alter table public.leads disable row level security;
revoke all on public.leads from anon, authenticated;

comment on table public.leads is 'Lead submissions from the happymax handyman website contact form';
