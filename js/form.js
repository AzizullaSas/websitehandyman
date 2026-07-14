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
    if (!data.name || data.name.length < 2) errors.name = "Please enter your name.";
    if (!data.phone || data.phone.replace(/\D/g, "").length < 7) errors.phone = "Please enter a valid phone number.";
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

  const submitSupabase = async (data) => {
    const sb = CONFIG.supabase || {};
    if (!sb.url) throw new Error("Supabase is not configured. Set url in config.js.");

    let res = null;
    try {
      res = await fetch(`${sb.url}/functions/v1/submit-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      res = null;
    }

    if (res && res.ok) return;

    // Validation / rate-limit responses carry a visitor-friendly message.
    if (res && (res.status === 400 || res.status === 429)) {
      const body = await res.json().catch(() => null);
      throw userError((body && body.error) || GENERIC_ERROR);
    }

    throw userError(GENERIC_ERROR);
  };

  // data: { name, phone, email, tv_size, wall_type, message,
  //         service, attribution, website }
  const submit = (data) =>
    CONFIG.backend === "supabase" ? submitSupabase(data) : submitMailto(data);

  window.HappyMaxLead = { validate, submit, GENERIC_ERROR };
})();
