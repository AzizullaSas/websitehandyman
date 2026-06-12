// Happy Max Handyman — contact form handler.
// Backend is picked from config.js:
//   - "mailto"   → opens the visitor's mail client with a prefilled email.
//   - "supabase" → POSTs to the `submit-lead` Edge Function, which
//     validates, rate-limits per IP, and inserts into the "leads" table.
//     Falls back to a direct REST insert for the deploy window where the
//     function isn't live yet (the fallback dies once anon INSERT is
//     revoked by migration 0005 — by then the function is the only path).

(function () {
  const CONFIG = window.HAPPY_MAX_CONFIG || {};
  const form = document.getElementById("leadForm");
  if (!form) return;

  const status = document.getElementById("lf-status");
  const submit = document.getElementById("lf-submit");

  const GENERIC_ERROR =
    "Couldn't send right now — please call (808) 201-1311 or email happymaxhandyman@gmail.com.";

  const showStatus = (msg, kind) => {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove("is-success", "is-error");
    if (kind) status.classList.add("is-" + kind);
  };

  const setLoading = (on) => {
    if (!submit) return;
    submit.disabled = on;
    submit.classList.toggle("is-loading", on);
  };

  const sanitize = (v) => (typeof v === "string" ? v.trim() : "");

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

  const markInvalid = (errors) => {
    ["name", "phone", "email"].forEach((key) => {
      const el = form.elements[key];
      if (!el) return;
      if (errors[key]) {
        el.setAttribute("aria-invalid", "true");
      } else {
        el.removeAttribute("aria-invalid");
      }
    });
  };

  const buildMailto = (data) => {
    const subject = `Quote request — ${data.name}`;
    const lines = [
      `Name:   ${data.name}`,
      `Phone:  ${data.phone}`,
      data.email   ? `Email:  ${data.email}` : null,
      data.tv_size ? `TV Size: ${data.tv_size}` : null,
      data.wall_type ? `Wall Type: ${data.wall_type}` : null,
      "",
      data.message ? `Message:\n${data.message}` : null,
      "",
      "— Sent from happymax-handyman website."
    ].filter(Boolean);
    const body = lines.join("\n");
    const to = CONFIG.contactEmail || "happymaxhandyman@gmail.com";
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const submitMailto = (data) =>
    new Promise((resolve) => {
      // Open the user's mail client. We can't truly "confirm" delivery, so
      // we treat the click as success — the form was filled out earnestly.
      window.location.href = buildMailto(data);
      // Give the OS handler a moment, then resolve.
      setTimeout(resolve, 400);
    });

  // Legacy path: direct REST insert with the publishable key. Only works
  // while the anon role still has INSERT on "leads" (pre-migration-0005).
  const insertDirect = async (sb, data) => {
    const res = await fetch(`${sb.url}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: sb.anonKey,
        Authorization: `Bearer ${sb.anonKey}`,
        Prefer: "return=minimal"
      },
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

    let res = null;
    try {
      res = await fetch(`${sb.url}/functions/v1/submit-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email,
          tv_size: data.tv_size,
          wall_type: data.wall_type,
          message: data.message,
          website: "" // honeypot field, always empty for real visitors
        })
      });
    } catch (_) {
      res = null; // network error — try the legacy path below
    }

    if (res && res.ok) return;

    // Validation / rate-limit responses carry a visitor-friendly message.
    if (res && (res.status === 400 || res.status === 429)) {
      const body = await res.json().catch(() => null);
      throw userError((body && body.error) || GENERIC_ERROR);
    }

    // Function not deployed yet (404) or gateway rejected the call (401):
    // fall back to the direct insert while that path still exists.
    if (sb.anonKey && (!res || res.status === 404 || res.status === 401)) {
      await insertDirect(sb, data);
      return;
    }

    throw new Error(`submit-lead failed: ${res ? res.status : "network"}`);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Honeypot: real visitors don't fill this. Bots do.
    if (form.elements.website && form.elements.website.value) {
      showStatus("Thanks! We'll be in touch shortly.", "success");
      form.reset();
      return;
    }

    const data = {
      name: sanitize(form.elements.name.value),
      phone: sanitize(form.elements.phone.value),
      email: sanitize(form.elements.email.value),
      tv_size: sanitize(form.elements.tv_size.value),
      wall_type: sanitize(form.elements.wall_type.value),
      message: sanitize(form.elements.message.value)
    };

    const errors = validate(data);
    markInvalid(errors);
    if (Object.keys(errors).length) {
      showStatus(Object.values(errors)[0], "error");
      const first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }

    setLoading(true);
    showStatus("");

    try {
      if (CONFIG.backend === "supabase") {
        await submitSupabase(data);
        showStatus("Thanks! Max will call you back shortly.", "success");
        form.reset();
      } else {
        await submitMailto(data);
        showStatus(
          "Thanks! Your email app should be opening. If it didn't, please call (808) 201-1311.",
          "success"
        );
        form.reset();
      }
    } catch (err) {
      console.error("[leadForm]", err);
      showStatus(err.userMessage || GENERIC_ERROR, "error");
    } finally {
      setLoading(false);
    }
  });
})();
