// Supabase Edge Function: submit-lead
//
// Public endpoint for the website contact form. Replaces the old direct
// anon INSERT into public.leads so that validation, the honeypot check,
// and per-IP rate limiting all happen server-side where bots can't skip
// them. Inserts run with the service role; the anon role has NO
// privileges on the leads table (see migration 0005).
//
// Flow: website form → POST here → validate + rate-limit → INSERT into
// public.leads → trigger leads_notify_telegram → lead-notify → Telegram.
//
// IMPORTANT: deploy with `verify_jwt = false` — the browser calls this
// directly without a Supabase JWT. Abuse is contained by validation and
// the per-IP rate limit below.
//
// Required environment secrets (auto-provided by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Max submissions per IP per window. Generous for a real customer
// re-submitting, tight enough to keep the Telegram topic spam-free.
const RATE_LIMIT = 5;
const RATE_WINDOW_MINUTES = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// Quiz service values the website can send. Anything else drops to null.
const SERVICE_ALLOWLIST = new Set([
  "tv_mounting",
  "furniture_assembly",
  "ceiling_fan_light",
  "drywall_repair",
  "door_lock",
  "picture_shelves",
  "other",
]);

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  // Honeypot: real visitors leave it empty. Pretend success, store nothing.
  if (clean(body.website, 200)) {
    return json(200, { ok: true });
  }

  const name = clean(body.name, 100);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 200);
  const tv_size = clean(body.tv_size, 50);
  const wall_type = clean(body.wall_type, 50);
  const message = clean(body.message, 2000);
  const serviceRaw = clean(body.service, 40);
  const service = SERVICE_ALLOWLIST.has(serviceRaw) ? serviceRaw : "";
  const attribution = clean(body.attribution, 300);

  if (name.length < 2) {
    return json(400, { error: "Please enter your name." });
  }
  if (phone.replace(/\D/g, "").length < 7) {
    return json(400, { error: "Please enter a valid phone number." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json(400, { error: "Please enter a valid email or leave it blank." });
  }

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const ip_hash = await sha256Hex(ip);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const since = new Date(
    Date.now() - RATE_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const { count, error: countError } = await sb
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ip_hash)
    .gte("created_at", since);

  if (countError) {
    console.error("submit-lead rate-limit check failed:", countError);
    // Fail open: a broken counter shouldn't block real customers.
  } else if ((count ?? 0) >= RATE_LIMIT) {
    return json(429, {
      error:
        "Too many requests from your connection — please call (808) 201-1311 instead.",
    });
  }

  const { error } = await sb.from("leads").insert([
    {
      name,
      phone,
      email: email || null,
      tv_size: tv_size || null,
      wall_type: wall_type || null,
      message: message || null,
      service: service || null,
      attribution: attribution || null,
      source: "website",
      status: "new",
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
      ip_hash,
    },
  ]);

  if (error) {
    console.error("submit-lead insert failed:", error);
    return json(500, { error: "could not save your request" });
  }

  return json(200, { ok: true });
});
