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

  // Published before any early return below: main.js's "Open now" pill
  // depends on this, and it must not disappear just because the quiz
  // markup did.
  window.HappyMaxHours = { isOpenNow, fmtHour };

  // Nothing further to wire up without quiz containers or the lead API.
  if (!containers.length || !LEAD) return;

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

  // No electrical or plumbing options here — Hawaii's handyman exemption
  // (HRS §444-2) does not cover that work at any price, so we must not
  // take it or advertise it. Fan/light swaps were removed Aug 2026.
  // Trimmed Aug 2026 to the three jobs the business advertises. Drywall
  // repair, doors/locks and the small-job list were retired from the whole
  // site in the same pass. Bringing any of them back needs four edits, not
  // one: an entry here, a STEP2 branch, a service card in index.html, and
  // a JSON-LD offer — otherwise the funnel and the structured data drift.
  const SERVICES = [
    { value: "tv_mounting",        label: "Mount a TV", tag: "Most popular" },
    { value: "furniture_assembly", label: "Assemble furniture" },
    { value: "picture_shelves",    label: "Pictures, mirrors & shelves", wide: true }
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
    picture_shelves: {
      title: "What are we hanging?",
      micro: "Heavy pieces get proper anchors.",
      chips: ["A few items", "Gallery wall", "Heavy mirror or shelves"]
    },
    // No longer offered on step 1, but kept as step2HTML's `|| STEP2.other`
    // fallback: a browser holding a cached page can still carry a retired
    // service value, and that must render a free-text box, not throw.
    other: {
      title: "Tell us about the job in one sentence.",
      micro: "One sentence is plenty. Photos help too — you can text them after.",
      textarea: true
    }
  };

  const TV_WALLS = ["Drywall", "Concrete", "Brick", "Tile", "Not sure"];
  const TV_MOUNT = ["Yes, I have one", "No — bring one", "Recommend one"];
  const TIMING = ["ASAP", "This week", "Flexible"];

  // Where on Oahu the job is. Drive time across the island is the single
  // biggest scheduling variable, so this rides along to the CRM's
  // `location` column instead of being asked on the callback.
  const AREAS = [
    "Honolulu / Downtown", "Waikiki", "Kakaʻako / Ala Moana",
    "Kailua", "Kaneohe", "Hawaii Kai", "Aiea / Pearl City",
    "Kapolei / Ewa Beach", "Mililani / Wahiawa", "North Shore",
    "Somewhere else on Oahu"
  ];

  const DETAILS_PLACEHOLDER =
    "e.g., patch a doorknob hole in Aiea, hang a gallery wall…";

  // Keep the free-text box small enough that it can't be used as a
  // cold-email channel — see config.maxDetailsChars.
  const MAX_DETAILS = CONFIG.maxDetailsChars || 300;

  // One textarea markup for both places that render it.
  function detailsHTML(id, label) {
    const used = state.details.length;
    return `
      ${label}
      <textarea class="quiz-textarea" id="${id}-details" data-input="details"
        maxlength="${MAX_DETAILS}" placeholder="${esc(DETAILS_PLACEHOLDER)}"
        aria-describedby="${id}-count">${esc(state.details)}</textarea>
      <p class="quiz-count${used > MAX_DETAILS - 40 ? " is-near" : ""}" id="${id}-count">
        <span data-count>${MAX_DETAILS - used}</span> characters left — a sentence is plenty.
      </p>`;
  }

  // service → pricing key in config (thank-you price hint, non-TV paths)
  const PRICE_KEYS = {
    furniture_assembly: "furniture-assembly",
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
    area: "",      // Oahu neighborhood → CRM `location`
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

  // The error message renders immediately above the control that produced
  // it. It used to sit at the very bottom of the card — under the consent
  // copy and the Back button — which on a phone left the visitor looking
  // at a red-outlined field roughly 900px above an off-screen explanation,
  // with the keyboard covering whatever was left.
  const statusHTML = () =>
    `<div class="quiz-status${state.error ? " is-error" : ""}">${esc(state.error)}</div>`;

  function step1HTML() {
    return `
      <p class="quiz-step-title" tabindex="-1">What do you need done?</p>
      <p class="quiz-microcopy">Pick the closest one — you can add details in a sec.</p>
      <div class="chip-grid">
        ${SERVICES.map((s) =>
          chipHTML(s.value, s.label, state.service === s.value,
            { field: "service", tag: s.tag, wide: s.wide })).join("")}
      </div>
      ${statusHTML()}`;
  }

  function step2HTML(id) {
    const cfg = STEP2[state.service] || STEP2.other;
    if (cfg.textarea) {
      return `
        <p class="quiz-step-title" tabindex="-1">${esc(cfg.title)}</p>
        <p class="quiz-microcopy">${esc(cfg.micro)}</p>
        ${detailsHTML(id, "")}
        ${statusHTML()}
        <div class="quiz-nav">
          <button type="button" class="quiz-back" data-action="back">← Back</button>
          <button type="button" class="btn btn-navy quiz-next" data-action="next">Next</button>
        </div>`;
    }
    const field = state.service === "tv_mounting" ? "tvSize" : "scope";
    const current = state.service === "tv_mounting" ? state.tvSize : state.scope;
    return `
      <p class="quiz-step-title" tabindex="-1">${esc(cfg.title)}</p>
      <p class="quiz-microcopy">${esc(cfg.micro)}</p>
      <div class="chip-grid">
        ${cfg.chips.map((c) => chipHTML(c, c, current === c, { field })).join("")}
      </div>
      ${statusHTML()}
      <div class="quiz-nav">
        <button type="button" class="quiz-back" data-action="back">← Back</button>
      </div>`;
  }

  // Area picker — shared by both step-3 branches. A select rather than
  // chips: 11 options would swamp the card, and one tap on mobile opens
  // the native picker.
  function areaHTML(id) {
    return `
      <p class="chip-row-label"><label for="${id}-area">Which part of Oahu?</label></p>
      <select class="quiz-select" id="${id}-area" data-input="area">
        <option value="">Choose your area…</option>
        ${AREAS.map((a) =>
          `<option value="${esc(a)}"${state.area === a ? " selected" : ""}>${esc(a)}</option>`).join("")}
      </select>`;
  }

  function timingHTML() {
    return `
      <p class="chip-row-label">When do you need it?</p>
      <div class="chip-grid">
        ${TIMING.map((t) => chipHTML(t, t, state.timing === t, { field: "timing" })).join("")}
      </div>`;
  }

  function step3HTML(id) {
    if (state.service === "tv_mounting") {
      return `
        <p class="quiz-step-title" tabindex="-1">What's the wall made of?</p>
        <p class="quiz-microcopy">Oahu condo towers are usually concrete — we mount on it every week.</p>
        <div class="chip-grid">
          ${TV_WALLS.map((w) => chipHTML(w, w, state.wall === w, { field: "wall" })).join("")}
        </div>
        <p class="chip-row-label">Do you already have a mount?</p>
        <div class="chip-grid">
          ${TV_MOUNT.map((m) => chipHTML(m, m, state.mount === m, { field: "mount" })).join("")}
        </div>
        ${timingHTML()}
        ${areaHTML(id)}
        ${statusHTML()}
        <div class="quiz-nav">
          <button type="button" class="quiz-back" data-action="back">← Back</button>
          <button type="button" class="btn btn-navy quiz-next" data-action="next">Next</button>
        </div>`;
    }
    return `
      <p class="quiz-step-title" tabindex="-1">When and where?</p>
      <p class="quiz-microcopy">Same-day is often possible when you reach out in the morning.</p>
      <div class="chip-grid">
        ${TIMING.map((t) => chipHTML(t, t, state.timing === t, { field: "timing" })).join("")}
      </div>
      ${areaHTML(id)}
      ${state.service === "other" ? "" : detailsHTML(id,
        `<p class="chip-row-label"><label for="${id}-details">Anything else we should know? <span class="optional">(optional)</span></label></p>`)}
      ${statusHTML()}
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
      <p class="quiz-step-title" tabindex="-1">Where should we send your quote?</p>
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
      ${statusHTML()}
      <button type="button" class="btn btn-gold btn-lg quiz-submit${state.sending ? " is-loading" : ""}"
        data-action="submit" ${state.sending ? "disabled" : ""}>Get my free quote</button>
      <p class="quiz-under">Free quote · No obligation · You approve the price before any work starts.</p>
      <p class="quiz-consent">By tapping “Get my free quote” you agree that Happy Max Handyman
        Service LLC may call or text you at the number above about this request. Message and data
        rates may apply; reply STOP at any time to opt out. Consent is not a condition of purchase.
        See our <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p>
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
        <button type="button" class="quiz-restart" data-action="restart">Need something else quoted? Start a new request →</button>
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
    else if (state.step === 2) stepHTML = step2HTML(id);
    else if (state.step === 3) stepHTML = step3HTML(id);
    else stepHTML = step4HTML(id);

    // Each step template places its own .quiz-status next to the control
    // that can fail, so there is no trailing one here.
    container.innerHTML = `
      <div class="quiz-head">
        <p class="quiz-title">Get your free quote in 60 seconds</p>
        <p class="quiz-sub">~60 seconds · no email required</p>
        ${progressHTML()}
      </div>
      ${stepHTML}`;
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

  // Selectors are tried in order, not merged: querySelector on a list
  // returns whatever comes first in the document, and the step title
  // precedes the chips — so a merged list would never focus a chip.
  function focusIn(container, selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (let i = 0; i < list.length; i++) {
      const el = container.querySelector(list[i]);
      if (el) { el.focus({ preventScroll: true }); return true; }
    }
    return false;
  }

  // Focus the first chip belonging to the question that failed, so the
  // visitor lands on "pick a timing", not back at the top of the step.
  function focusField(container, field) {
    const el = Array.prototype.find.call(
      container.querySelectorAll("[data-chip]"),
      (c) => c.dataset.field === field
    );
    if (el) { el.focus({ preventScroll: true }); return true; }
    return false;
  }

  // Steps 3 and 4 are taller than a phone screen. If a re-render leaves
  // the top of the card above the fold, bring it back — otherwise the
  // visitor is dropped into the middle of a question they can't see.
  function keepCardInView(container) {
    const card = container.closest(".quiz-card") || container;
    if (card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Chip values carry quotes and dashes ('56" – 65"'), so match on the
  // dataset instead of building an attribute selector around them — no
  // escaping to get wrong, and no dependency on CSS.escape.
  function focusChip(container, field, value) {
    const el = Array.prototype.find.call(
      container.querySelectorAll("[data-chip]"),
      (c) => c.dataset.field === field && c.dataset.chip === value
    );
    if (el) el.focus({ preventScroll: true });
  }

  /* ------------------------------ flow ------------------------------ */

  let quizStarted = false;

  function goTo(step, sourceContainer) {
    state.step = Math.min(4, Math.max(1, step));
    state.error = "";
    renderAll();
    if (sourceContainer) {
      keepCardInView(sourceContainer);
      // Deliberately no .quiz-input here: auto-focusing the name field
      // threw up the phone keyboard the instant "Next" was tapped, which
      // hid the reply promise and the TCPA consent the visitor is about
      // to agree to. The step title takes focus instead — same landing
      // spot for keyboard and screen-reader users, no keyboard.
      focusIn(sourceContainer, [".chip", ".quiz-textarea", ".quiz-step-title"]);
    }
    const title = document.querySelector("[data-quiz] .quiz-step-title");
    announce(`Step ${state.step} of 4.` + (title ? " " + title.textContent : ""));
    track("quiz_step", { step: state.step, service: state.service });
  }

  // `done` is sticky, and both instances plus all seven CTAs read it — so
  // without this the visitor who submits a TV job can never ask about the
  // bookshelves too: every button just re-shows the thank-you card. Contact
  // details are kept (same person, second job); the job answers are not.
  function restart(container) {
    state.step = 1;
    state.service = "";
    state.scope = "";
    state.tvSize = "";
    state.wall = "";
    state.mount = "";
    state.timing = "";
    state.area = "";
    state.details = "";
    state.error = "";
    state.sending = false;
    state.done = false;
    quizStarted = false;      // a second job is a second funnel entry
    renderAll();
    keepCardInView(container);
    focusIn(container, [".chip", ".quiz-step-title"]);
    announce("Starting a new request. Step 1 of 4.");
  }

  // Switching to a different service invalidates every path-specific
  // answer — otherwise a TV answer leaks into a furniture lead.
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
    focusChip(container, field, value);
  }

  function validateStep(container) {
    let error = "";
    let field = "";              // chip group to send focus back to
    let focusSel = [".quiz-textarea", ".chip"];
    if (state.step === 2 && state.service === "other" && !state.details.trim()) {
      error = "A single sentence about the job helps us quote it right.";
    } else if (state.step === 3 && state.service === "tv_mounting" && !state.wall) {
      error = "Pick the closest wall type — \"Not sure\" is fine.";
      field = "wall";
    } else if (state.step === 3 && !state.timing) {
      error = "Pick a timing — \"Flexible\" is fine.";
      field = "timing";
    } else if (state.step === 3 && !state.area) {
      error = "Pick your part of the island so we can plan the drive.";
      focusSel = [".quiz-select"];
    }
    if (error) {
      state.error = error;
      renderAll();
      announce(error);
      if (!field || !focusField(container, field)) focusIn(container, focusSel);
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
    if (state.area) parts.push("Area: " + state.area);
    if (state.details.trim()) parts.push("Details: " + state.details.trim().slice(0, MAX_DETAILS));
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
      area: state.area,
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
      if (action.dataset.action === "restart") restart(container);
    });

    // inputs update state without re-render (keeps focus while typing);
    // mirror the value into the sibling instance so the two forms never
    // visibly desync when the visitor scrolls between them.
    const onFieldChange = (e) => {
      const input = e.target.closest("[data-input]");
      if (!input) return;
      const key = input.dataset.input;
      if (key === "website" || !(key in state)) return;
      // phone: allow only digits and common separators as they type
      if (key === "phone") {
        const cleaned = input.value.replace(/[^\d\s().+-]/g, "");
        if (cleaned !== input.value) input.value = cleaned;
      }
      // details: maxlength stops typing and pasting, but a stale cached
      // page could still carry the old limit — clamp regardless
      if (key === "details" && input.value.length > MAX_DETAILS) {
        input.value = input.value.slice(0, MAX_DETAILS);
      }
      if (state[key] === input.value) return;
      state[key] = input.value;
      // update the counter in place — re-rendering would drop focus mid-typing
      if (key === "details") {
        const left = MAX_DETAILS - input.value.length;
        containers.forEach((c) => {
          const box = c.querySelector(".quiz-count");
          const num = box && box.querySelector("[data-count]");
          if (num) num.textContent = String(left);
          if (box) box.classList.toggle("is-near", left < 40);
        });
      }
      containers.forEach((other) => {
        if (other === container) return;
        const twin = other.querySelector(`[data-input="${key}"]`);
        if (twin && twin !== document.activeElement) twin.value = input.value;
      });
    };
    container.addEventListener("input", onFieldChange);
    // <select> fires "input" in modern browsers but only "change" in
    // older Safari — the handler no-ops when the value already matches.
    container.addEventListener("change", onFieldChange);

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
      // block:"start" (+ the card's scroll-margin-top), not "center":
      // steps 3 and 4 run ~950px tall against an ~840px phone viewport,
      // so centring the card pushes its question and progress bar off
      // the top of the screen.
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        const first = target.querySelector(".chip, .quiz-textarea, .quiz-step-title");
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
