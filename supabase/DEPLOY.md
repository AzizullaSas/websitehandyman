# Backend Deployment — Supabase + Telegram

Project: **`hfnuudllnfnunvodreao`** · Telegram group topic: **Website Requests** (thread 98)

## Architecture

```
website form
  → Edge Function `submit-lead`        (validates, honeypot, rate-limits 5/IP/hour,
                                        inserts via service role)
    → table public.leads
      → trigger leads_notify_telegram  (pg_net, secret from Vault — migration 0003)
        → Edge Function `lead-notify`  (formats card, posts to Telegram topic,
                                        saves tg_message_id back on the lead)
          → inline status buttons
            → Telegram → Edge Function `tg-webhook`
              (updates leads.status, edits the original card)
```

All three functions are deployed with **Verify JWT = OFF**. Each protects
itself instead:

| function      | auth                                                  |
|---------------|-------------------------------------------------------|
| `submit-lead` | public endpoint; validation + per-IP rate limit       |
| `lead-notify` | `X-Lead-Notify-Secret` header (value lives in Vault)  |
| `tg-webhook`  | `X-Telegram-Bot-Api-Secret-Token` from setWebhook     |

## 0. ⚠️ Rotate the bot token FIRST

The previous `TG_BOT_TOKEN` was committed to this **public** repo and must
be treated as compromised — removing it from the docs does not remove it
from git history.

1. In Telegram: **@BotFather → /mybots → @Handyhappyman_bot → API Token → Revoke current token.**
2. Dashboard → **Project Settings → Edge Functions → Secrets** → update `TG_BOT_TOKEN`.
3. Re-register the webhook with the new token (step 5 below) — the old
   registration dies with the old token.

## 1. Edge Function secrets

Dashboard → **Project Settings → Edge Functions → Secrets**:

| key                  | value                                                        |
|----------------------|--------------------------------------------------------------|
| `TG_BOT_TOKEN`       | from @BotFather — **never commit this**                      |
| `TG_CHAT_ID`         | `-1003948492906`                                             |
| `TG_THREAD_ID`       | `98`                                                         |
| `TG_WEBHOOK_SECRET`  | any long random string; same one passed to setWebhook        |
| `LEAD_NOTIFY_SECRET` | same value as the Vault secret `lead_notify_secret`          |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 2. SQL migrations (SQL Editor, in order)

| file                            | status                | what it does                                  |
|---------------------------------|-----------------------|-----------------------------------------------|
| `supabase-schema.sql`           | ✅ applied            | base `leads` table (fresh projects only)      |
| `0002_telegram_tracking.sql`    | ✅ applied            | `tg_message_id`, `tg_thread_id` columns       |
| `0003_telegram_trigger.sql`     | ✅ applied            | pg_net trigger → `lead-notify` (Vault secret) |
| `0004_lead_hardening.sql`       | ⬜ run now            | `ip_hash`, status whitelist, length caps      |
| `0005_revoke_anon_insert.sql`   | ⬜ run AFTER step 4   | kills direct inserts with the publishable key |

## 3. Deploy the Edge Functions

Dashboard → **Edge Functions → Create / edit function**. For each:
paste `index.ts`, add the shared file `_shared/format.ts` where imported
(`lead-notify`, `tg-webhook`), set **Verify JWT: OFF**, deploy.

- `submit-lead` — new; no shared files needed.
- `lead-notify` — already deployed; unchanged.
- `tg-webhook` — already deployed; unchanged.

## 4. Verify submit-lead end-to-end

```sh
curl -X POST "https://hfnuudllnfnunvodreao.supabase.co/functions/v1/submit-lead" \
  -H "Content-Type: application/json" \
  -d '{"name":"TEST — ignore","phone":"8085550123","tv_size":"65\" – 75\"","message":"deployment test"}'
```

Expected: `{"ok":true}`, a card in the Website Requests topic within ~2s,
status buttons work. Then delete the test row in the Table Editor.

Only after this works, run `0005_revoke_anon_insert.sql` (step 2).

## 5. Register the Telegram webhook

(Re-)run after every bot-token rotation:

```sh
curl -X POST "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hfnuudllnfnunvodreao.supabase.co/functions/v1/tg-webhook",
    "secret_token": "<TG_WEBHOOK_SECRET>",
    "allowed_updates": ["callback_query"],
    "drop_pending_updates": true
  }'
```

Verify: `curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo"`

## 6. Final checks

1. Submit the real website form → card appears, form shows the success
   message.
2. Tap a status button → card gets `✓`, `leads.status` changes.
3. Submit 6 times quickly from one machine → the 6th returns the
   "too many requests" message (rate limit works).
4. `POST /rest/v1/leads` with the publishable key → **401/permission
   denied** (after migration 0005).
