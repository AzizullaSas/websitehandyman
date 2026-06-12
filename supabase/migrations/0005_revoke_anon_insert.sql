-- Migration 0005 — revoke direct anon INSERT
--
-- ⚠️ ORDER MATTERS: run this ONLY AFTER the `submit-lead` Edge Function
-- is deployed and verified (see DEPLOY.md step 4). Until then the
-- website form still uses the direct REST insert as a fallback, and
-- this migration would break it.
--
-- After this migration the ONLY write path into public.leads is the
-- submit-lead Edge Function (service role), which enforces validation,
-- the honeypot, and per-IP rate limiting server-side. The publishable
-- key in config.js can no longer write anything.

revoke insert on public.leads from anon, authenticated;
