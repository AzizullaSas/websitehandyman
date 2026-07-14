// Happy Max Handyman — lead submission API.
// Used by js/quiz.js. Backend is picked from config.js:
//   - "supabase" → POSTs to the `submit-lead` Edge Function, which
//     validates, rate-limits per IP, and inserts into the "leads" table.
//   - "mailto"   → opens the visitor's mail client with a prefilled email.
//
// The payload contract with submit-lead is additive-only:
//   name, phone, email, tv_size, wall_type, message, website (honeypot)
// plus the optional `service` / `attribution` keys, which the deployed
// function safely ignores until migration 0006 + redeploy. Everything the
// quiz collects is ALSO serialized into `message`, so no data is lost
// either way.

(function () {
  "use strict";

  const CONFIG = window.HAPPY_MAX_CONFIG || {};

  const GENERIC_ERROR =
    "Couldn't send right now — please call or text (808) 201-1311, or email happymaxhandyman@gmail.com.";

  // An error whose message is safe to show to the visitor as-is.
  const userError = (msg) => {
    const e = new Error(msg);
    e.userMessage = msg;
    return e;
  };

  const validate = (data) => {
    const errors = {};

    // name: at least two real letters — rejects "123", "...", lone emoji
    const letters = (data.name || "").match(/[A-Za-zÀ-ɏʻЀ-ӿ]/g) || [];
    if (letters.length < 2) errors.name = "Please enter your name.";

    // phone: US format — 10 digits, or 11 starting with 1
    const digits = (data.phone || "").replace(/\D/g, "");
    const phoneOk =
      (digits.length === 10 || (digits.length === 11 && digits[0] === "1")) &&
      !/^(\d)\1{9}$/.test(digits.slice(-10)); // reject 0000000000-style junk
    if (!phoneOk) errors.phone = "Please enter a valid 10-digit phone number.";

    if (data.email) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email);
      if (!ok) errors.email = "Please enter a valid email or leave it blank.";
    }
    return errors;
  };

  const buildMailto = (data) => {
    const subject = `Quote request — ${data.name}`;
    const lines = [
      `Name:   ${data.name}`,
      `Phone:  ${data.phone}`,
      data.email ? `Email:  ${data.email}` : null,
      "",
      data.message ? `Details:\n${data.message}` : null,
      "",
      "— Sent from happymaxhandymanservice.com"
    ].filter(Boolean);
    const to = CONFIG.contactEmail || "happymaxhandyman@gmail.com";
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  };

  const submitMailto = (data) =>
    new Promise((resolve) => {
      window.location.href = buildMailto(data);
      setTimeout(resolve, 400);
    });

  // Fallback path: direct REST insert with the publishable key. Works
  // while the anon role still has INSERT on "leads" (pre-migration-0005);
  // the Telegram trigger fires on the insert either way.
  const insertDirect = async (sb, data) => {
    const res = await fetch(`${sb.url}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: sb.anonKey,
        Authorization: `Bearer ${sb.anonKey}`,
        Prefer: "return=minimal"
      },
      // legacy columns only — pre-0006 tables reject unknown keys
      body: JSON.stringify([{
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        tv_size: data.tv_size || null,
        wall_type: data.wall_type || null,
        message: data.message || null,
        source: "website",
        user_agent: navigator.userAgent
      }])
    });
    if (!res.ok) throw new Error(`REST insert failed: ${res.status}`);
  };

  const submitSupabase = async (data) => {
    const sb = CONFIG.supabase || {};
    if (!sb.url) throw new Error("Supabase is not configured. Set url in config.js.");

    const headers = { "Content-Type": "application/json" };
    if (sb.anonKey) {
      // harmless when verify_jwt is off; required when it's on
      headers.apikey = sb.anonKey;
      headers.Authorization = `Bearer ${sb.anonKey}`;
    }

    let res = null;
    try {
      res = await fetch(`${sb.url}/functions/v1/submit-lead`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || "",
          tv_size: data.tv_size || "",
          wall_type: data.wall_type || "",
          message: data.message || "",
          service: data.service || "",
          attribution: data.attribution || "",
          website: data.website || "" // honeypot — empty for real visitors
        })
      });
    } catch (_) {
      res = null; // network error — project paused or offline
    }

    if (res && res.ok) return;

    // Validation / rate-limit responses carry a visitor-friendly message.
    if (res && (res.status === 400 || res.status === 429)) {
      const body = await res.json().catch(() => null);
      throw userError((body && body.error) || GENERIC_ERROR);
    }

    // Function missing or gateway rejected the call — try the direct
    // insert while that path still exists.
    if (sb.anonKey && res && (res.status === 404 || res.status === 401)) {
      try {
        await insertDirect(sb, data);
        return;
      } catch (_) { /* fall through to the generic error */ }
    }

    throw userError(GENERIC_ERROR);
  };

  // data: { name, phone, email, tv_size, wall_type, message,
  //         service, attribution, website }
  const submit = (data) =>
    CONFIG.backend === "supabase" ? submitSupabase(data) : submitMailto(data);

  window.HappyMaxLead = { validate, submit, GENERIC_ERROR };
})();
