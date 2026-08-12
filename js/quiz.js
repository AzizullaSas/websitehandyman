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

  const HOURS = CONFIG.hours || { days: [1, 2, 3, 4, 5, 6], open: 9, close: 18 };

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

  // TV mounting is the ONLY thing this business advertises (Aug 2026 —
  // the remaining handyman paths were retired site-wide, after drywall,
  // doors/locks, fans and light fixtures went earlier). So the quiz has
  // no service picker: a one-option question is a wasted tap. `service`
  // is a constant that still rides along to the CRM, which files leads
  // from several channels and needs to know which one this is.
  //
  // Re-adding a service is deliberately more than a one-line edit: an
  // entry here, its own step-2 branch, a card in index.html, and a
  // JSON-LD offer — otherwise the funnel and the structured data drift.
  // Nothing electrical or plumbing may ever be added: Hawaii's handyman
  // exemption (HRS §444-2) doesn't cover that work at any price.
  const SERVICE = "tv_mounting";
  const SERVICE_LABEL = "TV mounting";

  const TV_SIZES = [
    { value: 'Up to 55"', tag: "Most common" },
    { value: '56" – 65"' },
    { value: '66" – 85"' },
    { value: '86" or larger' },
    { value: "Not sure", wide: true }
  ];

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
    "e.g., mounting over a fireplace, 3rd floor walk-up, old TV to take down…";

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
    service: SERVICE,   // constant — kept so the CRM payload stays shaped
    tvSize: "",
    wall: "",
    mount: "",
    timing: "",    // non-booking paths: ASAP / This week / Flexible
    date: "",      // booking paths: preferred day, ISO "2026-08-12" (HST)
    slot: "",      // booking paths: arrival window value, or "flexible"
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

  /* --------------------------- scheduling --------------------------- */
  // Preferred day + arrival window, for the services listed in
  // config.booking.services. Everything is computed in Pacific/Honolulu,
  // never in the visitor's time zone: someone browsing from the mainland
  // at 9pm their time must still see Oahu's today, or they'd be offered a
  // window that already closed.
  //
  // Nothing here reserves a slot — there is no calendar to check against.
  // It is a preference that rides along to the CRM so Max calls back
  // knowing when to aim for, and the copy never says "booked".

  const BOOKING = CONFIG.booking || {};
  const SLOT_HOURS = Array.isArray(BOOKING.slotHours) ? BOOKING.slotHours : [];
  const BOOK_SERVICES = BOOKING.services || ["tv_mounting"];
  const DAYS_AHEAD = BOOKING.daysAhead || 14;
  const LEAD_HOURS = BOOKING.leadHours == null ? 2 : BOOKING.leadHours;
  const BUFFER_HOURS = BOOKING.bufferHours == null ? 2 : BOOKING.bufferHours;
  const CHECK_AVAIL = BOOKING.checkAvailability !== false;

  // A path shows the picker only if config lists it AND there are times
  // to offer — emptying config.booking.slotHours turns the feature off.
  const isBookingService = (s) =>
    SLOT_HOURS.length > 0 && BOOK_SERVICES.indexOf(s) !== -1;

  // Day/month names are hard-coded rather than taken from Intl: the site
  // is English-only, and Intl would render "вт, 12 авг" for a visitor
  // whose browser is set to Russian.
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const pad2 = (n) => (n < 10 ? "0" + n : String(n));
  const fmtClock = (h) => `${((h + 11) % 12) + 1} ${h >= 12 ? "PM" : "AM"}`;

  // Today's calendar date in Honolulu, as plain numbers.
  function honoluluToday() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Pacific/Honolulu",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const get = (t) => parseInt((parts.find((p) => p.type === t) || {}).value, 10);
      return { y: get("year"), m: get("month"), d: get("day") };
    } catch (_) {
      const n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
    }
  }

  /* ---------------------- taken-slot lookup ----------------------
     The site is static, so it cannot know what is already booked without
     asking. `submit-lead` answers a GET with the hours already spoken for
     — dates and hours only, no names or numbers, nothing worth scraping.

     Failure is deliberately silent and open: if the request errors, times
     out, or the GET handler isn't deployed yet, every slot stays
     selectable. Losing a lead to a scheduling lookup would cost far more
     than Max moving one appointment by phone. */

  const busy = { status: "idle", days: {} };

  function busyHours(iso) {
    const list = busy.days[iso];
    return Array.isArray(list) ? list : [];
  }

  function loadAvailability() {
    if (!CHECK_AVAIL || busy.status === "loading" || busy.status === "ready") return;
    const sb = CONFIG.supabase || {};
    if (!sb.url) { busy.status = "failed"; return; }
    busy.status = "loading";

    const headers = {};
    if (sb.anonKey) {
      headers.apikey = sb.anonKey;
      headers.Authorization = `Bearer ${sb.anonKey}`;
    }
    fetch(`${sb.url}/functions/v1/submit-lead?days=${encodeURIComponent(DAYS_AHEAD)}`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((body) => {
        busy.days = (body && body.busy) || {};
        busy.status = "ready";
        dropStaleChoice();
        if (state.step === 3) renderAll();
      })
      .catch(() => {
        busy.status = "failed";
        if (state.step === 3) renderAll();
      });
  }

  // Availability can land after the visitor has already tapped a time.
  // If their pick turns out to be spoken for, clear it and say so —
  // quietly leaving it selected would send Max a double-booking.
  function dropStaleChoice() {
    if (!state.date || state.slot === "flexible" || state.slot === "") return;
    if (slotStatus(state.date, state.slot, false) === "open") return;
    state.slot = "";
    state.error = "That time was just taken — please pick another.";
  }

  /* ------------------------- slot availability -------------------------
     A time is closed when it is too soon (today only, `leadHours`) or when
     it sits within `bufferHours` of a job already on the books. The buffer
     is symmetric on purpose: a 9am job blocks 10am because Max is still
     there, and blocks 8am because he could not finish and cross the island
     in time. So the next bookable start after a 9am job is 11am. */

  function slotStatus(iso, hour, isToday) {
    if (isToday && hour < honoluluNow().hour + LEAD_HOURS) return "past";
    const taken = busyHours(iso);
    for (let i = 0; i < taken.length; i++) {
      if (Math.abs(hour - taken[i]) < BUFFER_HOURS) {
        return hour === taken[i] ? "taken" : "buffer";
      }
    }
    return "open";
  }

  // Every slot for a day, each tagged with why it can or can't be picked.
  function slotsFor(iso, isToday) {
    return SLOT_HOURS.map((hour) => ({
      hour,
      label: fmtClock(hour),
      status: slotStatus(iso, hour, isToday)
    }));
  }

  const openCount = (slots) => slots.filter((s) => s.status === "open").length;

  // The day strip, recomputed on every render — a visitor who leaves the
  // tab open past closing time gets a strip that has moved on with them.
  // Dates are walked in UTC at midday: no DST or local-midnight edge can
  // shift the calendar date out from under the arithmetic.
  function buildDays() {
    const t = honoluluToday();
    const cursor = new Date(Date.UTC(t.y, t.m - 1, t.d, 12));
    const days = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const dow = cursor.getUTCDay();
      if (HOURS.days.indexOf(dow) !== -1) {
        const iso = `${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`;
        const slots = slotsFor(iso, i === 0);
        const open = openCount(slots);
        // A day with nothing bookable left is not a choice — drop it
        // rather than let someone tap into a wall of greyed-out times.
        if (open > 0) {
          days.push({
            iso,
            dow: DOW[dow],
            day: cursor.getUTCDate(),
            mon: MON[cursor.getUTCMonth()],
            isToday: i === 0,
            isTomorrow: i === 1,
            slots,
            open
          });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }

  // Label straight from the ISO value, not from the strip: a stored
  // choice must still read correctly on the thank-you card after the
  // day it referred to has rolled off the strip.
  function dayLabel(iso) {
    const p = String(iso || "").split("-");
    if (p.length !== 3) return "";
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    if (isNaN(d.getTime())) return "";
    return `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  function slotLabel(value) {
    if (value === "flexible") return "Flexible — any time that day";
    const h = Number(value);
    return SLOT_HOURS.indexOf(h) === -1 ? "" : fmtClock(h);
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

  // Step 1 used to ask which service. With one service left, the funnel
  // opens on the question that actually varies the price.
  function step1HTML() {
    return `
      <p class="quiz-step-title" tabindex="-1">What size is the TV?</p>
      <p class="quiz-microcopy">Not sure? Take a guess — we'll confirm before we quote.</p>
      <div class="chip-grid">
        ${TV_SIZES.map((s) =>
          chipHTML(s.value, s.value, state.tvSize === s.value,
            { field: "tvSize", tag: s.tag, wide: s.wide })).join("")}
      </div>
      ${statusHTML()}`;
  }

  // Both wall questions together: they're the two that decide which
  // anchors and which mount go in the van.
  function step2HTML() {
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
      ${statusHTML()}
      <div class="quiz-nav">
        <button type="button" class="quiz-back" data-action="back">← Back</button>
        <button type="button" class="btn btn-navy quiz-next" data-action="next">Next</button>
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

  // Day strip. The arrows are a mouse affordance only — they are
  // aria-hidden and out of the tab order because Tab already walks the
  // cards and the browser scrolls the container to whatever it focuses.
  function dayStripHTML(id) {
    const days = buildDays();
    if (!days.length) return ""; // no windows left anywhere — see whenHTML
    return `
      <p class="chip-row-label" id="${id}-dayq">Which day works best?</p>
      <div class="daystrip">
        <button type="button" class="daystrip-arrow" data-strip="prev" aria-hidden="true" tabindex="-1">‹</button>
        <div class="daystrip-scroll" data-daystrip role="group" aria-labelledby="${id}-dayq">
          ${days.map((d) => `
            <button type="button" class="day-card${d.isToday ? " is-today" : ""}"
              data-chip="${d.iso}" data-field="date"
              aria-label="${esc(dayLabel(d.iso))}${busy.status === "ready" ? `, ${d.open} time${d.open === 1 ? "" : "s"} available` : ""}"
              aria-pressed="${state.date === d.iso ? "true" : "false"}">
              <span class="day-dow">${d.isToday ? "Today" : d.isTomorrow ? "Tmrw" : d.dow}</span>
              <span class="day-num">${d.day}</span>
              <span class="day-mon">${d.mon}</span>
              ${busy.status === "ready"
                ? `<span class="day-left${d.open <= 2 ? " is-scarce" : ""}">${d.open} left</span>`
                : ""}
            </button>`).join("")}
        </div>
        <button type="button" class="daystrip-arrow" data-strip="next" aria-hidden="true" tabindex="-1">›</button>
      </div>`;
  }

  // Times appear only after a day is picked — one question at a time on a
  // phone, and it guarantees the grid on screen always belongs to the day
  // above it (today's list is shorter, and every day's differs once
  // bookings come back from the server).
  function slotsHTML() {
    const day = buildDays().filter((d) => d.iso === state.date)[0];
    if (!day) return "";
    const note = busy.status === "loading"
      ? `<span class="slot-checking">Checking what's still open…</span>`
      : busy.status === "ready"
        ? `Greyed-out times are already booked. Jobs are spaced ${BUFFER_HOURS} hours apart.`
        : `We'll confirm the exact time when Max calls.`;
    return `
      <p class="chip-row-label">What time on ${esc(dayLabel(state.date))}?</p>
      <div class="slot-grid">
        ${day.slots.map((s) => {
          const open = s.status === "open";
          const why = s.status === "taken" ? "already booked"
            : s.status === "buffer" ? "too close to another job"
            : s.status === "past" ? "too soon today"
            : "";
          return `
          <button type="button" class="slot${open ? "" : " is-closed"}"
            data-chip="${s.hour}" data-field="slot"
            ${open ? "" : "disabled"}
            aria-label="${s.label}${why ? " — " + why : ""}"
            aria-pressed="${String(state.slot) === String(s.hour) ? "true" : "false"}">
            <span class="slot-time">${s.label}</span>
            ${s.status === "taken" || s.status === "buffer"
              ? `<span class="slot-tag">Booked</span>` : ""}
          </button>`;
        }).join("")}
      </div>
      <button type="button" class="chip chip-flexible" data-chip="flexible" data-field="slot"
        aria-pressed="${state.slot === "flexible" ? "true" : "false"}">
        I'm flexible — Max picks the time
      </button>
      <p class="quiz-slot-note">${note}<br>Times are a request, not a locked-in booking — Max confirms when he calls.</p>`;
  }

  // Falls back to the old timing chips if config leaves no bookable day
  // at all (every window past, tomorrow closed) — the visitor still has
  // a way to say when, and the funnel never dead-ends.
  function whenHTML(id) {
    const strip = dayStripHTML(id);
    if (!strip) return timingHTML();
    return strip + (state.date ? slotsHTML() : "");
  }

  function step3HTML(id) {
    return `
      <p class="quiz-step-title" tabindex="-1">When and where?</p>
      <p class="quiz-microcopy">Pick the day that suits you — Max confirms the window when he calls.</p>
      ${isBookingService(state.service) ? whenHTML(id) : timingHTML()}
      ${areaHTML(id)}
      ${detailsHTML(id,
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
    const price = tvEstimate();
    // Read back the requested slot, and say plainly that it isn't booked.
    // Nothing on this site reserves time, so nothing here may imply it.
    const when = state.date
      ? `<p class="quiz-when-hint">You asked for <strong>${esc(dayLabel(state.date))}${
          state.slot !== "" ? " · " + esc(slotLabel(state.slot)) : ""
        }</strong>. Max will confirm that time when he calls — it's a request, not a locked-in booking.</p>`
      : "";
    return `
      <div class="quiz-thanks">
        <h3 tabindex="-1">Mahalo, ${esc(state.name.split(" ")[0] || state.name)} — you're on the list!</h3>
        <p>Here's what happens next: ${timing} Save this number so you know it's us: <strong>${PHONE_DISPLAY}</strong>.</p>
        ${when}
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
    else if (state.step === 2) stepHTML = step2HTML();
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

  const stripOf = (container) => container.querySelector("[data-daystrip]");

  // Grey out an arrow once the strip is against that edge.
  function syncArrows(strip) {
    const wrap = strip.parentElement;
    if (!wrap) return;
    const max = strip.scrollWidth - strip.clientWidth - 1;
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-strip]"), (btn) => {
      btn.disabled = btn.dataset.strip === "prev"
        ? strip.scrollLeft <= 0
        : strip.scrollLeft >= max;
    });
  }

  // Re-rendering replaces the strip element, so its scroll listener dies
  // with it — rewire after every render.
  function enhanceStrips() {
    containers.forEach((container) => {
      const strip = stripOf(container);
      if (!strip) return;
      strip.addEventListener("scroll", () => syncArrows(strip), { passive: true });
      // Coming Back to step 3 rebuilds the strip at scrollLeft 0. If the
      // chosen day sits beyond the fold, pull it into view so the visitor
      // sees their own answer instead of an apparently empty strip.
      const picked = strip.querySelector('[aria-pressed="true"]');
      if (picked && strip.scrollLeft === 0 &&
          picked.offsetLeft + picked.offsetWidth > strip.clientWidth) {
        strip.scrollLeft = Math.max(0, picked.offsetLeft - 12);
      }
      syncArrows(strip);
    });
  }

  // innerHTML wipes the strip's scroll position on every keystroke-free
  // re-render (picking a window, an error appearing). Carry it across so
  // the visitor never loses their place mid-question.
  const renderAll = () => {
    const positions = containers.map((c) => {
      const s = stripOf(c);
      return s ? s.scrollLeft : 0;
    });
    containers.forEach(render);
    containers.forEach((c, i) => {
      const s = stripOf(c);
      if (s && positions[i]) s.scrollLeft = positions[i];
    });
    enhanceStrips();
  };

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
      (c) => c.dataset.field === field && c.dataset.chip === String(value)
    );
    if (el) el.focus({ preventScroll: true });
  }

  /* ------------------------------ flow ------------------------------ */

  let quizStarted = false;

  function goTo(step, sourceContainer) {
    state.step = Math.min(4, Math.max(1, step));
    state.error = "";
    // Fetch the booked slots one step early so the grid on step 3 is
    // already accurate the moment it appears.
    if (state.step >= 2) loadAvailability();
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

  // `done` is sticky, and both instances plus every CTA read it — so
  // without this a visitor who just booked the living-room TV can never
  // ask about the bedroom one: every button re-shows the thank-you card.
  // Contact details are kept (same person, second TV); job answers are not.
  function restart(container) {
    state.step = 1;
    state.tvSize = "";
    state.wall = "";
    state.mount = "";
    state.timing = "";
    state.date = "";
    state.slot = "";
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

  function selectChip(field, value, container) {
    // Slot values arrive from the DOM as strings; keep the hour numeric
    // in state so arithmetic against the buffer never compares "10" < 9.
    if (field === "slot" && value !== "flexible") value = Number(value);
    state[field] = value;
    // The size chips are step 1, so the first chip tapped anywhere in the
    // card is the moment the funnel starts.
    if (!quizStarted) {
      quizStarted = true;
      track("quiz_start", { service: SERVICE, instance: container.dataset.quiz });
    }
    // step 1 asks a single question — no reason to make them press Next
    if (field === "tvSize") {
      goTo(2, container);
      return;
    }
    // Today offers fewer windows than tomorrow, so changing the day can
    // strand a window that was legal a moment ago.
    if (field === "date") {
      const day = buildDays().filter((d) => d.iso === value)[0];
      // The same hour can be free on one day and booked on the next.
      if (state.slot !== "" && state.slot !== "flexible" && day &&
          !day.slots.some((s) => s.hour === state.slot && s.status === "open")) {
        state.slot = "";
      }
      renderAll();
      focusChip(container, field, value);
      // The window buttons only exist once a day is chosen, so say so —
      // a sighted visitor sees them appear, a screen-reader user doesn't.
      announce(`${dayLabel(value)} selected. Now choose a time.`);
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
    const booking = state.step === 3 && isBookingService(state.service);
    const day = booking && state.date
      ? buildDays().filter((d) => d.iso === state.date)[0]
      : null;

    // A visitor can sit on step 3 long enough for their own answer to
    // expire — the 9am window, tapped at 8:55, submitted at 10:10. Drop
    // the stale choice and say why, rather than sending Max a slot that
    // has already passed.
    let expired = "";
    if (booking && state.date && !day) {
      state.date = "";
      state.slot = "";
      expired = "That day is no longer available — please pick another.";
    } else if (day && state.slot !== "" && state.slot !== "flexible" &&
               !day.slots.some((s) => s.hour === state.slot && s.status === "open")) {
      state.slot = "";
      expired = "That time is no longer available — please pick another.";
    }

    if (state.step === 2 && !state.wall) {
      error = "Pick the closest wall type — \"Not sure\" is fine.";
      field = "wall";
    } else if (booking && !state.date) {
      error = expired || "Pick the day that works best for you.";
      field = "date";
    } else if (booking && state.slot === "") {
      error = expired || "Pick a start time — \"I'm flexible\" is fine.";
      field = "slot";
    } else if (state.step === 3 && !booking && !state.timing) {
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
    // TV size and wall type are NOT repeated here — they travel as their
    // own payload keys and submit-lead prepends them to the message.
    parts.push("Service: " + SERVICE_LABEL);
    if (state.mount) parts.push("Mount: " + state.mount);
    // Booking paths carry a day + window; the others still carry the old
    // ASAP/This week/Flexible answer. Never both — one question, one line.
    if (state.date) {
      parts.push("When: " + dayLabel(state.date) +
        (state.slot !== "" ? " · " + slotLabel(state.slot) : ""));
    } else if (state.timing) {
      parts.push("Timing: " + state.timing);
    }
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
      tv_size: state.tvSize,
      wall_type: state.wall,
      message: buildMessage(),
      service: state.service,
      area: state.area,
      // Sent as their own keys so the Telegram card can lay them out as
      // labelled blocks instead of re-printing the whole serialized
      // `message` under a speech bubble.
      mount: state.mount,
      details: state.details.trim(),
      // Sent as separate keys too, for whenever submit-lead grows columns
      // for them. Until then they're ignored server-side and the same
      // facts arrive inside `message` — the additive-only contract.
      preferred_date: state.date,
      // The hour is what the backend stores and hands back as "taken";
      // the label is only for humans reading the Telegram card.
      preferred_hour: typeof state.slot === "number" ? state.slot : "",
      preferred_time: state.date && state.slot !== "" ? slotLabel(state.slot) : "",
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
        // Booked times render as disabled buttons. Browsers already
        // swallow clicks on those, but this handler is delegated — don't
        // let a synthetic or bubbled event book a slot that isn't free.
        if (chip.disabled) return;
        selectChip(chip.dataset.field, chip.dataset.chip, container);
        return;
      }
      // Desktop-only nudge buttons for the day strip: a mouse can't swipe
      // and the wheel scrolls the page, not the strip.
      const arrow = e.target.closest("[data-strip]");
      if (arrow) {
        const strip = stripOf(container);
        if (strip) {
          const card = strip.querySelector(".day-card");
          const step = (card ? card.offsetWidth + 8 : 82) * 3;
          const delta = arrow.dataset.strip === "next" ? step : -step;
          if (typeof strip.scrollBy === "function") {
            strip.scrollBy({ left: delta, behavior: "smooth" });
          } else {
            strip.scrollLeft += delta; // older Safari
          }
        }
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
    // Every CTA on the page lands here. There is no service left to
    // preselect, so this only clears a stale error and brings the card
    // into view — at whatever step the visitor had reached, never
    // resetting progress they already made.
    open() {
      if (!state.done) state.error = "";
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
    window.HappyMaxQuiz.open();
  });

  renderAll();
})();
