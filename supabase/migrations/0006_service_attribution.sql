-- 0006: quiz funnel fields.
--
-- The website quiz now sends `service` (which of the 7 service paths the
-- visitor picked) and `attribution` (utm_source/medium/campaign + referrer
-- captured on landing). Both are optional and additive: the frontend also
-- serializes everything into `message`, so nothing breaks if this migration
-- and the submit-lead redeploy lag behind the site deploy.
--
-- Deploy order:
--   1. Run this migration.
--   2. Redeploy supabase/functions/submit-lead (verify_jwt = false, as before).
--   3. Redeploy supabase/functions/lead-notify (shared format.ts adds the
--      service/attribution lines to the Telegram card).

alter table public.leads
  add column if not exists service text,
  add column if not exists attribution text;

-- drop-then-add keeps the migration safely re-runnable
alter table public.leads
  drop constraint if exists leads_service_len;
alter table public.leads
  add constraint leads_service_len
    check (service is null or char_length(service) <= 40);

alter table public.leads
  drop constraint if exists leads_attribution_len;
alter table public.leads
  add constraint leads_attribution_len
    check (attribution is null or char_length(attribution) <= 300);
