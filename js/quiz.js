// Happy Max Handyman — the 60-second quote quiz (conversion engine).
//
// One shared state, two DOM instances ([data-quiz="hero"] and
// [data-quiz="contact"]): answer three tap-steps, leave contact info last.
// Only the final step touches the network, via window.HappyMaxLead
// (js/form.js). Everything the quiz collects is serialized into `message`
// so the current submit-lead deployment loses nothing; `service` and
// `attribution` also ride along as separate keys for the future backend.

(function () {
  "use strict";

  const CONFIG = window.HAPPY_MAX_CONFIG || {};
  const LEAD = window.HappyMaxLead;
  const containers = Array.from(document.querySelectorAll("[data-quiz]"));
  if (!containers.length || !LEAD) return;

  const PHONE = CONFIG.contactPhone || "+18082011311";
  const PHONE_DISPLAY = CONFIG.contactPhoneDisplay || "(808) 201-1311";
  const RESPONSE_MIN = CONFIG.responseMinutes || 60;
  const REPLY_TEXT = RESPONSE_MIN === 60 ? "1 business hour" : `${RESPONSE_MIN} minutes`;
  const SMS_QUOTE = `sms:${PHONE}?&body=` +
    encodeURIComponent("Aloha Happy Max! I'd like a quote for: ");
  const SMS_PHOTO = `sms:${PHONE}?&body=` +
    encodeURIComponent("Aloha! Just sent the form — here's a photo of the job: ");

  /* ---------------- business hours (shared with main.js) ---------------- */

  const HOURS = CONFIG.hours || { days: [1, 2, 3, 4, 5, 6], open: 8, close: 19 };

  const fmtHour = (h) => `${((h + 11) % 12) + 1}${h >= 12 ? "pm" : "am"}`;
  const HOURS_TEXT = `Mon–Sat, ${fmtHour(HOURS.open)}–${fmtHour(HOURS.close)} HST`;

  function honoluluNow() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Honolulu",
        weekday: "short",
        hour: "numeric",
        hour12: false
      }).formatToParts(new Date());
      const get = (t) => (parts.find((p) => p.type === t) || {}).value;
      const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
      return { day: dayIdx, hour: parseInt(get("hour"), 10) % 24 };
    } catch (_) {
      const d = new Date();
      return { day: d.getDay(), hour: d.getHours() };
    }
  }

  function isOpenNow() {
    const { day, hour } = honoluluNow();
    return HOURS.days.indexOf(day) !== -1 && hour >= HOURS.open && hour < HOURS.close;
  }

  window.HappyMaxHours = { isOpenNow, fmtHour };

  /* --------------------------- attribution --------------------------- */

  (function captureAttribution() {
    try {
      if (sessionStorage.getItem("hm_attr")) return;
      const q = new URLSearchParams(location.search);
      const utm = ["utm_source", "utm_medium", "utm_campaign"]
        .map((k) => q.get(k))
        .filter(Boolean)
        .join("/");
      let ref = "";
      try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (_) {}
      if (ref && location.hostname && ref === location.hostname) ref = "";
      const attr = [utm || null, ref ? "ref=" + ref : null].filter(Boolean).join("; ");
      sessionStorage.setItem("hm_attr", attr.slice(0, 300));
    } catch (_) { /* storage blocked — fine */ }
  })();

  const getAttribution = () => {
    try { return sessionStorage.getItem("hm_attr") || ""; } catch (_) { return ""; }
  };

  /* ------------------------------ data ------------------------------ */

  const SERVICES = [
    { value: "tv_mounting",        label: "Mount a TV", tag: "Most popular" },
    { value: "furniture_assembly", label: "Assemble furniture" },
    { value: "ceiling_fan_light",  label: "Ceiling fan / light swap" },
    { value: "drywall_repair",     label: "Drywall repair" },
    { value: "door_lock",          label: "Door or lock" },
    { value: "picture_shelves",    label: "Pictures, mirrors & shelves" },
    { value: "other",              label: "Something else", wide: true }
  ];

  const SERVICE_LABELS = {};
  SERVICES.forEach((s) => { SERVICE_LABELS[s.value] = s.label; });

  const STEP2 = {
    tv_mounting: {
      title: "What size is the TV?",
      micro: "Not sure? Take a guess — we'll confirm before we quote.",
      chips: ['Up to 55"', '56" – 65"', '66" – 85"', '86" or larger', "Not sure"]
    },
    furniture_assembly: {
      title: "How much furniture are we building?",
      micro: "Rough count is fine.",
      chips: ["1 item", "2–3 items", "Whole room"]
    },
    ceiling_fan_light: {
      title: "What's the fan or light situation?",
      micro: "Like-for-like swaps on the existing wiring.",
      chips: ["Replace existing", "More than one", "Not sure"]
    },
    drywall_repair: {
      title: "How big is the damage?",
      micro: "A phone-photo guess is plenty.",
      chips: ["Small hole", "Large patch", "Texture match"]
    },
    door_lock: {
      title: "What's going on with the door?",
      micro: "We bring standard hardware sizes.",
      chips: ["Sticking door", "New lock or deadbolt", "Both"]
    },
    picture_shelves: {
      title: "What are we hanging?",
      micro: "Heavy pieces get proper anchors.",
      chips: ["A few items", "Gallery wall", "Heavy mirror or shelves"]
    },
    other: {
      title: "Tell us about the job in one sentence.",
      micro: "One sentence is plenty. Photos help too — you can text them after.",
      textarea: true
    }
  };

  const TV_WALLS = ["Drywall", "Concrete", "Brick", "Tile", "Not sure"];
  const TV_MOUNT = ["Yes, I have one", "No — bring one", "Recommend one"];
  const TIMING = ["ASAP", "This week", "Flexible"];

  const DETAILS_PLACEHOLDER =
    "e.g., two ceiling fans in Aiea, patch a doorknob hole, hang a gallery wall…";

  // service → pricing key in config (thank-you price hint, non-TV paths)
  const PRICE_KEYS = {
    furniture_assembly: "furniture-assembly",
    ceiling_fan_light: "ceiling-fan",
    drywall_repair: "drywall",
    door_lock: "door-lock",
    picture_shelves: "picture-hanging"
  };

  // TV size chip → pricing bracket key
  const TV_BRACKETS = {
    'Up to 55"': "tv-upto-55",
    '56" – 65"': "tv-56-65",
    '66" – 85"': "tv-66-85",
    '86" or larger': "tv-86plus"
  };

  /* ------------------------------ state ------------------------------ */

  const state = {
    step: 1,
    service: "",
    scope: "",     // step-2 answer (chips) for non-TV paths
    tvSize: "",
    wall: "",
    mount: "",
    timing: "",
    details: "",   // free text (step 2 "other" / step 3 optional)
    name: "",
    phone: "",
    email: "",
    sending: false,
    error: "",
    done: false
  };

  const track = (name, params) => {
    if (typeof window.HMTrack === "function") window.HMTrack(name, params || {});
  };

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* ----------------------------- pricing ----------------------------- */

  const PRICING = CONFIG.pricing || {};
  const CUR = PRICING.currency || "$";

  const priceNum = (key) => {
    const v = PRICING[key];
    if (typeof v === "number") return v;
    if (Array.isArray(v) && typeof v[0] === "number") return v[0];
    return null;
  };

  function priceText(key) {
    const v = PRICING[key];
    if (typeof v === "number") return `typically ${CUR}${v}`;
    if (Array.isArray(v) && v[0] != null) {
      return v[1] != null
        ? `typically ${CUR}${v[0]}–${CUR}${v[1]}`
        : `from ${CUR}${v[0]}`;
    }
    return "";
  }

  // Instant estimate for the thank-you panel: size bracket + the add-ons
  // the quiz already knows about (concrete wall, mount supplied by us).
  function tvEstimate() {
    if (state.tvSize === "Not sure") {
      const base = priceNum("tv-upto-55");
      return base != null ? `from ${CUR}${base}` : "";
    }
    const base = priceNum(TV_BRACKETS[state.tvSize]);
    if (base == null) return ""; // e.g. 86"+ — quoted personally
    let total = base;
    if (state.wall === "Concrete") total += priceNum("addon-concrete") || 0;
    if (state.mount === "No — bring one") total += priceNum("addon-mount-pickup") || 0;
    return `typically ${CUR}${total}`;
  }

  /* ---------------------------- templates ---------------------------- */

  const chipHTML = (value, label, selected, extra) =>
    `<button type="button" class="chip${extra && extra.wide ? " chip-wide" : ""}"
      data-chip="${esc(value)}" data-field="${esc(extra && extra.field || "")}"
      aria-pressed="${selected ? "true" : "false"}">
      ${extra && extra.tag ? `<span class="chip-tag">${esc(extra.tag)}</span>` : ""}
      ${esc(label)}
    </button>`;

  function progressHTML() {
    const pct = state.step * 25;
    const label = state.step === 1
      ? "Step 1 of 4 — takes about a minute"
      : `Step ${state.step} of 4`;
    return `
      <div class="quiz-progress">
        <div class="quiz-progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="4"
          aria-valuenow="${state.step}" aria-label="Quote form progress"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
        <span class="quiz-progress-label">${label}</span>
      </div>`;
  }

  function step1HTML() {
    return `
      <h4 class="quiz-step-title">What do you need done?</h4>
      <p class="quiz-microcopy">Pick the closest one — you can add details in a sec.</p>
      <div class="chip-grid">
        ${SERVICES.map((s) =>
          chipHTML(s.value, s.label, state.service === s.value,
            { field: "service", tag: s.tag, wide: s.wide })).join("")}
      </div>`;
  }

  function step2HTML() {
    const cfg = STEP2[state.service] || STEP2.other;
    if (cfg.textarea) {
      return `
        <h4 class="quiz-step-title">${esc(cfg.title)}</h4>
        <p class="quiz-microcopy">${esc(cfg.micro)}</p>
        <textarea class="quiz-textarea" data-input="details" maxlength="1500"
          placeholder="${esc(DETAILS_PLACEHOLDER)}">${esc(state.details)}</textarea>
        <div class="quiz-nav">
          <button type="button" class="quiz-back" data-action="back">← Back</button>
          <button type="button" class="btn btn-navy quiz-next" data-action="next">Next</button>
        </div>`;
    }
    const field = state.service === "tv_mounting" ? "tvSize" : "scope";
    const current = state.service === "tv_mounting" ? state.tvSize : state.scope;
    return `
      <h4 class="quiz-step-title">${esc(cfg.title)}</h4>
      <p class="quiz-microcopy">${esc(cfg.micro)}</p>
      <div class="chip-grid">
        ${cfg.chips.map((c) => chipHTML(c, c, current === c, { field })).join("")}
      </div>
      <div class="quiz-nav">
        <button type="button" class="quiz-back" data-action="back">← Back</button>
      </div>`;
  }

  function step3HTML() {
    if (state.service === "tv_mounting") {
      return `
        <h4 class="quiz-step-title">What's the wall made of?</h4>
        <p class="quiz-microcopy">Oahu condo towers are usually concrete — we mount on it every week.</p>
        <div class="chip-grid">
          ${TV_WALLS.map((w) => chipHTML(w, w, state.wall === w, { field: "wall" })).join("")}
        </div>
        <p class="chip-row-label">Do you already have a mount?</p>
        <div class="chip-grid">
          ${TV_MOUNT.map((m) => chipHTML(m, m, state.mount === m, { field: "mount" })).join("")}
        </div>
        <div class="quiz-nav">
          <button type="button" class="quiz-back" data-action="back">← Back</button>
          <button type="button" class="btn btn-navy quiz-next" data-action="next">Next</button>
        </div>`;
    }
    return `
      <h4 class="quiz-step-title">When do you need it?</h4>
      <p class="quiz-microcopy">Same-day is often possible when you reach out in the morning.</p>
      <div class="chip-grid">
        ${TIMING.map((t) => chipHTML(t, t, state.timing === t, { field: "timing" })).join("")}
      </div>
      ${state.service === "other" ? "" : `
        <p class="chip-row-label">Anything else we should know? <span class="optional">(optional)</span></p>
        <textarea class="quiz-textarea" data-input="details" maxlength="1500"
          placeholder="${esc(DETAILS_PLACEHOLDER)}">${esc(state.details)}</textarea>`}
      <div class="quiz-nav">
        <button type="button" class="quiz-back" data-action="back">← Back</button>
        <button type="button" class="btn btn-navy quiz-next" data-action="next">Next</button>
      </div>`;
  }

  function step4HTML(id) {
    const open = isOpenNow();
    const reply = open
      ? `Max will text or call you within ${REPLY_TEXT} (${HOURS_TEXT}). No spam, no sharing your info — ever.`
      : `It's after hours right now — Max will reach out first thing next business morning (${HOURS_TEXT}). No spam, no sharing your info — ever.`;
    return `
      <h4 class="quiz-step-title">Where should we send your quote?</h4>
      <div class="quiz-fields">
        <div class="quiz-field">
          <label for="${id}-name">Your name</label>
          <input class="quiz-input" id="${id}-name" data-input="name" type="text"
            autocomplete="name" maxlength="100" value="${esc(state.name)}">
        </div>
        <div class="quiz-field">
          <label for="${id}-phone">Mobile phone</label>
          <input class="quiz-input" id="${id}-phone" data-input="phone" type="tel"
            autocomplete="tel" maxlength="30" placeholder="(808) 555-0123" value="${esc(state.phone)}">
        </div>
        <div class="quiz-field">
          <label for="${id}-email">Email <span class="optional">(optional)</span></label>
          <input class="quiz-input" id="${id}-email" data-input="email" type="email"
            autocomplete="email" maxlength="200" value="${esc(state.email)}">
        </div>
      </div>
      <div class="hp" aria-hidden="true">
        <label for="${id}-website">Website</label>
        <input id="${id}-website" data-input="website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>
      <p class="quiz-note">${reply}</p>
      <button type="button" class="btn btn-gold btn-lg quiz-submit${state.sending ? " is-loading" : ""}"
        data-action="submit" ${state.sending ? "disabled" : ""}>Get my free quote</button>
      <p class="quiz-under">Free quote · No obligation · You approve the price before any work starts.</p>
      <div class="quiz-nav">
        <button type="button" class="quiz-back" data-action="back">← Back</button>
      </div>`;
  }

  function thanksHTML() {
    const open = isOpenNow();
    const timing = open
      ? `Max will text or call you at <strong>${esc(state.phone)}</strong> within ${REPLY_TEXT} (${HOURS_TEXT}) with your flat quote.`
      : `It's after hours right now, so you'll hear from Max at <strong>${esc(state.phone)}</strong> first thing next business morning.`;
    const price = state.service === "tv_mounting"
      ? tvEstimate()
      : (PRICE_KEYS[state.service] ? priceText(PRICE_KEYS[state.service]) : "");
    return `
      <div class="quiz-thanks">
        <h3 tabindex="-1">Mahalo, ${esc(state.name.split(" ")[0] || state.name)} — you're on the list!</h3>
        <p>Here's what happens next: ${timing} Save this number so you know it's us: <strong>${PHONE_DISPLAY}</strong>.</p>
        ${price ? `<p class="quiz-price-hint">Based on your answers, this job is <strong>${esc(price)}</strong>. Max will text your exact flat quote.</p>` : ""}
        <div class="quiz-thanks-actions">
          <a class="btn btn-gold" href="tel:${PHONE}" data-track="call_click" data-placement="thankyou">Call now instead</a>
          <a class="btn btn-outline" href="${SMS_PHOTO}" data-track="sms_click" data-placement="thankyou">Text us a photo of the job</a>
          <a class="btn btn-outline" href="assets/happymax.vcf" download>Add Max to contacts</a>
        </div>
      </div>`;
  }

  function render(container) {
    const id = "q-" + (container.dataset.quiz || "x");
    if (state.done) {
      container.innerHTML = thanksHTML();
      return;
    }
    let stepHTML = "";
    if (state.step === 1) stepHTML = step1HTML();
    else if (state.step === 2) stepHTML = step2HTML();
    else if (state.step === 3) stepHTML = step3HTML();
    else stepHTML = step4HTML(id);

    container.innerHTML = `
      <div class="quiz-head">
        <p class="quiz-title">Get your free quote in 60 seconds</p>
        <p class="quiz-sub">~60 seconds · no email required</p>
        ${progressHTML()}
      </div>
      ${stepHTML}
      <div class="quiz-status${state.error ? " is-error" : ""}">${esc(state.error)}</div>`;
  }

  const renderAll = () => containers.forEach(render);

  // One persistent live region per instance, OUTSIDE the re-rendered
  // container, so step changes / errors are reliably announced.
  const liveRegions = new Map();
  containers.forEach((c) => {
    const region = document.createElement("span");
    region.className = "sr-only";
    region.setAttribute("aria-live", "polite");
    c.insertAdjacentElement("afterend", region);
    liveRegions.set(c, region);
  });
  function announce(text) {
    liveRegions.forEach((region) => { region.textContent = text; });
  }

  function focusIn(container, selector) {
    const el = container.querySelector(selector);
    if (el) el.focus({ preventScroll: true });
    return !!el;
  }

  /* ------------------------------ flow ------------------------------ */

  let quizStarted = false;

  function goTo(step, sourceContainer) {
    state.step = Math.min(4, Math.max(1, step));
    state.error = "";
    renderAll();
    if (sourceContainer) {
      focusIn(sourceContainer, ".chip, .quiz-input, .quiz-textarea");
    }
    const title = document.querySelector("[data-quiz] .quiz-step-title");
    announce(`Step ${state.step} of 4.` + (title ? " " + title.textContent : ""));
    track("quiz_step", { step: state.step, service: state.service });
  }

  // Switching to a different service invalidates every path-specific
  // answer — otherwise a TV answer leaks into a drywall lead.
  function setService(value) {
    if (state.service !== value) {
      state.scope = "";
      state.tvSize = "";
      state.wall = "";
      state.mount = "";
      state.timing = "";
      state.details = "";
    }
    state.service = value;
  }

  function selectChip(field, value, container) {
    if (field === "service") {
      setService(value);
      if (!quizStarted) {
        quizStarted = true;
        track("quiz_start", { service: value, instance: container.dataset.quiz });
      }
      goTo(2, container);
      return;
    }
    state[field] = value;
    // single-question steps auto-advance
    if (field === "tvSize" || field === "scope") {
      goTo(3, container);
      return;
    }
    renderAll();
    // re-render dropped focus — put it back on the chip just pressed
    focusIn(container, `[data-chip="${CSS.escape(value)}"][data-field="${CSS.escape(field)}"]`);
  }

  function validateStep(container) {
    let error = "";
    if (state.step === 2 && state.service === "other" && !state.details.trim()) {
      error = "A single sentence about the job helps us quote it right.";
    } else if (state.step === 3 && state.service === "tv_mounting" && !state.wall) {
      error = "Pick the closest wall type — \"Not sure\" is fine.";
    } else if (state.step === 3 && state.service !== "tv_mounting" && !state.timing) {
      error = "Pick a timing — \"Flexible\" is fine.";
    }
    if (error) {
      state.error = error;
      renderAll();
      announce(error);
      focusIn(container, ".chip, .quiz-textarea");
      return false;
    }
    return true;
  }

  function buildMessage() {
    const parts = [];
    if (state.service) parts.push("Service: " + (SERVICE_LABELS[state.service] || state.service));
    if (state.scope) parts.push("Scope: " + state.scope);
    if (state.mount) parts.push("Mount: " + state.mount);
    if (state.timing) parts.push("Timing: " + state.timing);
    if (state.details.trim()) parts.push("Details: " + state.details.trim());
    const attr = getAttribution();
    if (attr) parts.push("Src: " + attr);
    return parts.join(" | ").slice(0, 2000);
  }

  async function submit(container) {
    if (state.sending) return;

    const honeypot = container.querySelector('[data-input="website"]');
    const data = {
      name: state.name.trim(),
      phone: state.phone.trim(),
      email: state.email.trim(),
      tv_size: state.service === "tv_mounting" ? state.tvSize : "",
      wall_type: state.service === "tv_mounting" ? state.wall : "",
      message: buildMessage(),
      service: state.service,
      attribution: getAttribution(),
      website: honeypot ? honeypot.value : ""
    };

    const errors = LEAD.validate(data);
    ["name", "phone", "email"].forEach((k) => {
      const el = container.querySelector(`[data-input="${k}"]`);
      if (el) {
        if (errors[k]) el.setAttribute("aria-invalid", "true");
        else el.removeAttribute("aria-invalid");
      }
    });
    if (Object.keys(errors).length) {
      state.error = errors[Object.keys(errors)[0]];
      const statusEl = container.querySelector(".quiz-status");
      if (statusEl) { statusEl.classList.add("is-error"); statusEl.textContent = state.error; }
      announce(state.error);
      const firstBad = container.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus({ preventScroll: true });
      return;
    }

    // duplicate-submit guard: identical payload in this session → thank-you
    const hash = JSON.stringify([
      data.name, data.phone, data.email, data.tv_size, data.wall_type, data.message
    ]);
    let lastSent = "";
    try { lastSent = sessionStorage.getItem("hm_lead_sent") || ""; } catch (_) {}
    if (hash === lastSent) {
      state.done = true;
      renderAll();
      return;
    }

    state.sending = true;
    state.error = "";
    renderAll();

    try {
      await LEAD.submit(data);
      try { sessionStorage.setItem("hm_lead_sent", hash); } catch (_) {}
      state.sending = false;
      state.done = true;
      renderAll();
      announce("Request sent. Max will be in touch shortly.");
      focusIn(container, ".quiz-thanks h3");
      track("generate_lead", {
        service: state.service,
        attribution: getAttribution(),
        instance: container.dataset.quiz
      });
      if (typeof window.fbq === "function") window.fbq("track", "Lead");
    } catch (err) {
      state.sending = false;
      state.error = err.userMessage || LEAD.GENERIC_ERROR;
      renderAll();
      announce(state.error);
      focusIn(container, '[data-action="submit"]');
    }
  }

  /* ---------------------------- listeners ---------------------------- */

  containers.forEach((container) => {
    container.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-chip]");
      if (chip && container.contains(chip)) {
        selectChip(chip.dataset.field, chip.dataset.chip, container);
        return;
      }
      const action = e.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "back") goTo(state.step - 1, container);
      if (action.dataset.action === "next") {
        if (validateStep(container)) goTo(state.step + 1, container);
      }
      if (action.dataset.action === "submit") submit(container);
    });

    // inputs update state without re-render (keeps focus while typing);
    // mirror the value into the sibling instance so the two forms never
    // visibly desync when the visitor scrolls between them.
    container.addEventListener("input", (e) => {
      const input = e.target.closest("[data-input]");
      if (!input) return;
      const key = input.dataset.input;
      if (key === "website" || !(key in state)) return;
      // phone: allow only digits and common separators as they type
      if (key === "phone") {
        const cleaned = input.value.replace(/[^\d\s().+-]/g, "");
        if (cleaned !== input.value) input.value = cleaned;
      }
      state[key] = input.value;
      containers.forEach((other) => {
        if (other === container) return;
        const twin = other.querySelector(`[data-input="${key}"]`);
        if (twin && twin !== document.activeElement) twin.value = input.value;
      });
    });

    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches(".quiz-input")) {
        e.preventDefault();
        submit(container);
      }
    });
  });

  /* ----------------------- global open() helper ----------------------- */

  function nearestContainer() {
    let best = containers[0];
    let bestDist = Infinity;
    containers.forEach((c) => {
      const card = c.closest(".quiz-card") || c;
      const r = card.getBoundingClientRect();
      const dist = Math.abs(r.top);
      if (dist < bestDist) { bestDist = dist; best = c; }
    });
    return best;
  }

  window.HappyMaxQuiz = {
    open(service) {
      if (state.done) {
        // already submitted — just show the thank-you card
      } else if (service && SERVICE_LABELS[service]) {
        setService(service);
        if (!quizStarted) {
          quizStarted = true;
          track("quiz_start", { service, instance: "cta" });
        }
        state.step = 2;
        state.error = "";
      } else if (!service) {
        state.error = "";
      }
      renderAll();
      const target = nearestContainer();
      const card = target.closest(".quiz-card") || target;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        const first = target.querySelector(".chip, .quiz-input, .quiz-textarea");
        if (first) first.focus({ preventScroll: true });
      }, 450);
    }
  };

  // wire every .quiz-open button on the page
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".quiz-open");
    if (!btn) return;
    e.preventDefault();
    window.HappyMaxQuiz.open(btn.dataset.service || "");
  });

  renderAll();
})();
