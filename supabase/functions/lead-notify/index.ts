// Supabase Edge Function: lead-notify
//
// Called by a Supabase Database Webhook whenever a new row is inserted
// into public.leads. Sends a formatted message with inline status
// buttons to the Telegram "Website Requests" topic, then stores the
// Telegram message_id back on the lead row so tg-webhook can edit it
// later when the status changes.
//
// Required environment secrets (set in dashboard → Settings → Edge Functions → Secrets):
//   TG_BOT_TOKEN              — from @BotFather
//   TG_CHAT_ID                — e.g. -1003948492906
//   TG_THREAD_ID              — e.g. 98 (Website Requests topic id)
//   SUPABASE_URL              — auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatLead, buildKeyboard } from "../_shared/format.ts";

const TG_BOT_TOKEN = Deno.env.get("TG_BOT_TOKEN")!;
const TG_CHAT_ID   = Deno.env.get("TG_CHAT_ID")!;
const TG_THREAD_ID = Deno.env.get("TG_THREAD_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    if (body?.type !== "INSERT" || !body?.record) {
      return new Response("ignored: not an INSERT", { status: 200 });
    }
    const lead = body.record;
    const status = lead.status || "new";

    const tg = await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: Number(TG_CHAT_ID),
          message_thread_id: Number(TG_THREAD_ID),
          text: formatLead(lead, status),
          parse_mode: "Markdown",
          reply_markup: buildKeyboard(lead.id, status),
          disable_web_page_preview: true,
        }),
      },
    ).then((r) => r.json());

    if (tg?.ok) {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      await sb
        .from("leads")
        .update({
          tg_message_id: tg.result.message_id,
          tg_thread_id: Number(TG_THREAD_ID),
        })
        .eq("id", lead.id);
    } else {
      console.error("Telegram sendMessage failed:", tg);
    }

    return Response.json({ ok: true, tg });
  } catch (err) {
    console.error("lead-notify error:", err);
    return new Response(String(err), { status: 500 });
  }
});
