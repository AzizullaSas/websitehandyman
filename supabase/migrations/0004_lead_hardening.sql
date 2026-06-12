-- Migration 0004 — lead hardening
--
-- Closes the gaps left after the first schema pass:
--   * status had no whitelist — anyone could insert a lead born as 'won'.
--   * user_agent / source had no length caps.
--   * Adds ip_hash (sha-256 of the client IP) used by the submit-lead
--     Edge Function for per-IP rate limiting. No raw IPs are stored.
--
-- Safe to run on a live table: existing out-of-range values are
-- normalized first so the constraints validate cleanly.
--
-- Apply via Supabase SQL Editor on project hfnuudllnfnunvodreao.

alter table public.leads
  add column if not exists ip_hash text;

-- Normalize any pre-existing data that would violate the new constraints.
update public.leads
  set status = 'new'
  where status not in ('new', 'contacted', 'quoted', 'won', 'lost');

update public.leads
  set user_agent = left(user_agent, 400)
  where char_length(user_agent) > 400;

update public.leads
  set source = left(source, 40)
  where char_length(source) > 40;

alter table public.leads
  add constraint leads_status_allowed
    check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  add constraint leads_user_agent_len
    check (user_agent is null or char_length(user_agent) <= 400),
  add constraint leads_source_len
    check (char_length(source) <= 40),
  add constraint leads_ip_hash_len
    check (ip_hash is null or char_length(ip_hash) <= 64);

-- Supports the submit-lead rate-limit query:
--   "how many leads from this ip_hash in the last hour?"
create index if not exists leads_ip_hash_created_at_idx
  on public.leads (ip_hash, created_at desc);
