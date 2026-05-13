-- Migration 0002 — Telegram tracking columns
--
-- Adds bookkeeping for the Telegram bot integration:
--   tg_message_id  — id of the original notification message in the
--                    Website Requests topic; lets tg-webhook edit
--                    the same message when status changes.
--   tg_thread_id   — id of the forum topic the notification was sent
--                    to (Website Requests = 98 right now).
--
-- Apply via Supabase SQL Editor on project hfnuudllnfnunvodreao.

alter table public.leads
  add column if not exists tg_message_id bigint,
  add column if not exists tg_thread_id  bigint;
