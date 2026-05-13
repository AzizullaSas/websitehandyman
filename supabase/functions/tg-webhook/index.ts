// Supabase Edge Function: tg-webhook
//
// Called by Telegram (via setWebhook) whenever someone taps an inline
// button on a lead notification. Parses callback_data of the form
//   s:<status>:<lead_id>
// updates leads.status in Supabase, then edits the original Telegram
// message to reflect the new status (visible "✓" marker on the chosen
// button).
//
// SECURITY: Telegram is instructed (via setWebhook secret_token) to
// send X-Telegram-Bot-Api-Secret-Token on every call. We reject any
// request whose header doesn't match TG_WEBHOOK_SECRET.
//
// IMPORTANT: This function must be deployed with "Verify JWT" disabled
// so that Telegram (which has no Supabase JWT) can call it.
//
// Required environment secrets:
//   TG_BOT_TOKEN              — bot API token
//   TG_WEBHOOK_SECRET         — any long random string; same one passed to setWebhook
//   SUPABASE_URL              — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatLead, buildKeyboard, STATUS_LABELS } from "../_shared/format.ts";

const TG_BOT_TOKEN       = Deno.env.get("TG_BOT_TOKEN")!;
const TG_WEBHOOK_SECRET  = Deno.env.get("TG_WEBHOOK_SECRET")!;
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function tg(method: string, payload: unknown) {
  return fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

Deno.serve(async (req) => {
  // Verify Telegram secret token
  if (req.headers.get("x-telegram-bot-api-secret-token") !== TG_WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const update = await req.json();
    const cb = update?.callback_query;
    if (!cb) return new Response("ok"); // ignore non-callback updates

    const parts = String(cb.data || "").split(":");
    if (parts[0] !== "s" || parts.length < 3) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Unknown action" });
      return new Response("ok");
    }
    const [, status, leadId] = parts;
    if (!STATUS_LABELS[status]) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Unknown status" });
      return new Response("ok");
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: lead, error } = await sb
      .from("leads")
      .update({ status })
      .eq("id", leadId)
      .select()
      .single();

    if (error || !lead) {
      console.error("Lead update failed:", error);
      await tg("answerCallbackQuery", {
        callback_query_id: cb.id,
        text: `Couldn't find lead ${leadId.slice(0, 8)}…`,
      });
      return new Response("ok");
    }

    await tg("editMessageText", {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: formatLead(lead, status),
      parse_mode: "Markdown",
      reply_markup: buildKeyboard(leadId, status),
      disable_web_page_preview: true,
    });

    await tg("answerCallbackQuery", {
      callback_query_id: cb.id,
      text: `Status → ${STATUS_LABELS[status]}`,
    });
    return new Response("ok");
  } catch (err) {
    console.error("tg-webhook error:", err);
    return new Response(String(err), { status: 500 });
  }
});
