# Telegram Integration Deployment

Step-by-step setup for the Supabase → Telegram lead notifications with
inline status management. Do this once per environment.

## 1. Add Telegram tracking columns

Open the SQL Editor of project **`hfnuudllnfnunvodreao`** and run
`supabase/migrations/0002_telegram_tracking.sql`. It adds two columns to
`public.leads`: `tg_message_id`, `tg_thread_id`.

## 2. Create Edge Function secrets

Dashboard → **Project Settings → Edge Functions → Secrets** → add:

| key                          | value                                                       |
|------------------------------|-------------------------------------------------------------|
| `TG_BOT_TOKEN`               | `8594104151:AAE1yzlcmvwDhKoYCrVWlxjvIaQ6DP2rDc4`           |
| `TG_CHAT_ID`                 | `-1003948492906`                                            |
| `TG_THREAD_ID`               | `98`                                                        |
| `TG_WEBHOOK_SECRET`          | any long random string, e.g. `tg_wh_47Yx9pQz3aB...`         |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
by Supabase — don't add them manually.

> ⚠️ After we're done, **rotate `TG_BOT_TOKEN`** in @BotFather — it
> appeared in chat. Update the secret here once you have the new value.

## 3. Deploy `lead-notify` function

Dashboard → **Edge Functions → Create a new function**.

- Name: `lead-notify`
- Verify JWT: **ON** (this one is called by Supabase, which signs its
  webhook with the service-role key).
- Paste the contents of `supabase/functions/lead-notify/index.ts`.
- ALSO need the shared helper: in the dashboard, create folder
  `_shared/` and add `format.ts` — paste the contents of
  `supabase/functions/_shared/format.ts`.
- Click **Deploy**.

> If the dashboard doesn't allow multiple files, inline `format.ts` at
> the top of `index.ts`.

## 4. Deploy `tg-webhook` function

Same flow as above, with one critical difference:

- Name: `tg-webhook`
- Verify JWT: **OFF** ← important, Telegram has no Supabase JWT
- Paste `supabase/functions/tg-webhook/index.ts` (+ `_shared/format.ts`)
- Click **Deploy**.

## 5. Wire Supabase Database Webhook → `lead-notify`

Dashboard → **Database → Webhooks → Create a new webhook**.

- Name: `notify-tg-on-new-lead`
- Table: `public.leads`
- Events: ☑ `Insert` (only)
- Type: **Supabase Edge Functions**
- Function: `lead-notify`
- HTTP headers: none required
- Click **Create webhook**.

When a new lead row appears, Supabase posts the standard webhook payload
to `lead-notify`, which formats and forwards to Telegram.

## 6. Tell Telegram about `tg-webhook`

Once `tg-webhook` is deployed and you know its public URL
(`https://hfnuudllnfnunvodreao.supabase.co/functions/v1/tg-webhook`),
run this curl to register it with Telegram:

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

Substitute `<TG_BOT_TOKEN>` and `<TG_WEBHOOK_SECRET>` with the values
from step 2.

To verify: `curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo"`

## 7. End-to-end test

1. Submit the website form (or `curl POST` directly to `/rest/v1/leads`
   with the publishable key).
2. Within a second or two, a card appears in the **Website Requests**
   topic with name/phone/TV size and four buttons.
3. Tap any status button — the message is edited in place with `✓` next
   to the chosen status, and `leads.status` is updated in Supabase.
