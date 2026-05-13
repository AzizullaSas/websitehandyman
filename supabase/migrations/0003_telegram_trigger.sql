-- Migration 0003 — Telegram notification trigger
--
-- Pre-requisites:
--   1. Extension pg_net enabled (`create extension if not exists pg_net with schema extensions;`)
--   2. Shared secret stored in Vault:
--        select vault.create_secret('<random-secret>', 'lead_notify_secret', 'used by leads_notify_telegram trigger');
--   3. Edge function `lead-notify` deployed with verify_jwt=false and env var
--      LEAD_NOTIFY_SECRET set to the same value as the Vault secret.
--
-- When a new row lands in public.leads, this trigger fetches the secret
-- from Vault (no plaintext in pg_proc), POSTs the row as a standard
-- Supabase-style webhook payload to the lead-notify Edge Function, which
-- forwards it to the Telegram "Website Requests" topic.

create or replace function public.notify_telegram_on_lead()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $fn$
declare
  v_secret  text;
  v_payload jsonb;
begin
  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
    where name = 'lead_notify_secret'
    limit 1;

  if v_secret is null then
    raise warning 'lead_notify_secret not found in vault — skipping notification';
    return NEW;
  end if;

  v_payload := jsonb_build_object(
    'type',       'INSERT',
    'table',      'leads',
    'schema',     'public',
    'record',     to_jsonb(NEW),
    'old_record', null
  );

  perform net.http_post(
    url     := 'https://hfnuudllnfnunvodreao.supabase.co/functions/v1/lead-notify',
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'X-Lead-Notify-Secret',  v_secret
    ),
    body                 := v_payload,
    timeout_milliseconds := 5000
  );

  return NEW;
end;
$fn$;

drop trigger if exists leads_notify_telegram on public.leads;

create trigger leads_notify_telegram
  after insert on public.leads
  for each row execute function public.notify_telegram_on_lead();
