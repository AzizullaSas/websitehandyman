// Happy Max Handyman — UI behaviors + config-driven rendering.
// Sticky-header shadow, mobile menu, scroll reveals, open-now pill,
// pricing render, sticky mobile dock, analytics loader, footer year.

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const CONFIG = window.HAPPY_MAX_CONFIG || {};

  /* ---------------------------- analytics ---------------------------- */
  // Trackers load only when an ID is configured. HMTrack is safe to call
  // regardless — it forwards to gtag when present, otherwise no-ops.

  const A = CONFIG.analytics || {};

  if (A.ga4Id) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(A.ga4Id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", A.ga4Id);
  }

  if (A.metaPixelId) {
    /* Meta pixel bootstrap */
    (function (f, b, e, v) {
      if (f.fbq) return;
      const n = (f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      const t = b.createElement(e); t.async = true; t.src = v;
      const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", A.metaPixelId);
    window.fbq("track", "PageView");
  }

  window.HMTrack = function (name, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params || {});
    } catch (_) {}
  };

  // Delegate clicks on anything carrying data-track (tel/sms/mailto/CTAs).
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (!el) return;
    window.HMTrack(el.dataset.track, {
      placement: el.dataset.placement || "",
      service: el.dataset.service || ""
    });
  });

  /* ---------------------------- footer year ---------------------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------- header scrolled ------------------------- */
  const header = $("#siteHeader");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* --------------------------- mobile menu --------------------------- */
  const toggle = $("#menuToggle");
  const menu = $("#mobileMenu");
  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  };
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setMenu(false);
    });
    const mq = window.matchMedia("(min-width: 980px)");
    const onMq = (e) => { if (e.matches) setMenu(false); };
    // Safari/iOS <=13: MediaQueryList has addListener but not addEventListener
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onMq);
    else if (typeof mq.addListener === "function") mq.addListener(onMq);
  }

  /* -------------------------- scroll reveal -------------------------- */
  const revealEls = $$(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* -------------------- anchor offset under header -------------------- */
  const HEADER_H = 80;
  $$("section[id], article[id]").forEach((sec) => {
    sec.style.scrollMarginTop = HEADER_H + "px";
  });

  /* --------------------------- open-now pill --------------------------- */
  const pill = $("#openPill");
  const pillText = $("#openPillText");
  const hoursApi = window.HappyMaxHours;
  if (pill && pillText && hoursApi) {
    const openHour = hoursApi.fmtHour((CONFIG.hours || {}).open || 8);
    const renderPill = () => {
      const open = hoursApi.isOpenNow();
      pill.classList.toggle("is-closed", !open);
      pillText.textContent = open
        ? `Open now · Max typically replies within ${CONFIG.responseMinutes || 60} minutes`
        : `Closed now — request tonight and you're first in line at ${openHour}.`;
      pill.hidden = false;
    };
    renderPill();
    window.setInterval(renderPill, 5 * 60 * 1000);
  }

  /* ----------------------- guarantee months sync ----------------------- */
  const months = CONFIG.guaranteeMonths || 12;
  $$("[data-guarantee-months]").forEach((el) => { el.textContent = months; });
  const gHead = $("#guaranteeHeadline");
  if (gHead && months !== 12) {
    gHead.textContent = `Guaranteed for ${months} months. In writing.`;
  }
  const payLine = $("#payAfterLine");
  if (payLine && CONFIG.payAfterCompletion) payLine.hidden = false;

  /* ----------------------- pricing (config-driven) ----------------------- */
  const P = CONFIG.pricing || {};
  const CUR = P.currency || "$";
  // number → "$120" ("+$30" for addon-* keys); string → as-is;
  // [low, high] → "typically $low–$high"; [low, null] → "from $low"
  const fmt = (v, key) => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number") {
      return (key && key.indexOf("addon-") === 0 ? "+" : "") + CUR + v;
    }
    if (!Array.isArray(v) || v[0] == null) return "";
    return v[1] != null ? `typically ${CUR}${v[0]}–${CUR}${v[1]}` : `from ${CUR}${v[0]}`;
  };
  const baseNum = (v) =>
    typeof v === "number" ? v : (Array.isArray(v) && typeof v[0] === "number" ? v[0] : null);

  // "from $X" chips on service cards
  $$("[data-price-chip]").forEach((chip) => {
    const n = baseNum(P[chip.dataset.priceChip]);
    if (n != null) {
      chip.textContent = `from ${CUR}${n}`;
      chip.hidden = false;
    }
  });

  // typical-pricing section
  const PRICING_ROWS = [
    ["tv-upto-55", "TV mounting — up to 55″"],
    ["tv-56-65", "TV mounting — 56″–65″"],
    ["tv-66-85", "TV mounting — 66″–85″"],
    ["tv-86plus", "TV mounting — 86″ and up"],
    ["addon-concrete", "Add-on: concrete wall"],
    ["addon-wire-hiding", "Add-on: wires hidden"],
    ["addon-mount-pickup", "Add-on: we bring the right mount"],
    ["furniture-assembly", "Furniture assembly"],
    ["ceiling-fan", "Ceiling fan swap"],
    ["drywall", "Drywall repair"],
    ["door-lock", "Door or lock work"],
    ["picture-hanging", "Pictures, mirrors & shelves"]
  ];
  const pricingSection = $("#pricing");
  const pricingRows = $("#pricingRows");
  if (pricingSection && pricingRows) {
    const rows = PRICING_ROWS
      .map(([key, label]) => ({ label, value: fmt(P[key], key) }))
      .filter((r) => r.value);
    if (rows.length) {
      pricingRows.innerHTML = rows
        .map((r) =>
          `<div class="pricing-row"><span class="p-label">${r.label}</span><span class="p-value">${r.value}</span></div>`)
        .join("");
      pricingSection.hidden = false;
      // pricing_view — once, when the strip scrolls into view
      if ("IntersectionObserver" in window) {
        const pio = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              window.HMTrack("pricing_view", {});
              pio.disconnect();
            }
          });
        }, { threshold: 0.3 });
        pio.observe(pricingSection);
      }
    }
  }

  // TV vignette screen line + FAQ price prefix
  const tvFrom = baseNum(P["tv-upto-55"]);
  const tvLine = $("#tvScreenLine");
  if (tvLine && tvFrom != null) {
    tvLine.textContent = `TV mounting from ${CUR}${tvFrom} · Same-day on Oahu`;
  }
  const faqPrefix = $("#faqPricePrefix");
  if (faqPrefix && tvFrom != null) {
    faqPrefix.textContent = `Most standard installs start at ${CUR}${tvFrom}. `;
    faqPrefix.hidden = false;
  }

  /* --------------------- Google profile links --------------------- */
  const G = CONFIG.google || {};
  const linkWrap = $("#googleLinks");
  const profileLink = $("#googleProfileLink");
  const reviewLink = $("#googleReviewLink");
  if (linkWrap && (G.profileUrl || G.reviewUrl)) {
    linkWrap.hidden = false;
    if (profileLink && G.profileUrl) { profileLink.href = G.profileUrl; profileLink.hidden = false; }
    if (reviewLink && G.reviewUrl) { reviewLink.href = G.reviewUrl; reviewLink.hidden = false; }
  }

  /* ------------------- real-rating chip (config-gated) ------------------- */
  const R = CONFIG.reviews || {};
  const trustRow = $("#trustRow");
  if (trustRow && R.rating != null && R.count != null) {
    const li = document.createElement("li");
    li.textContent = `Rated ★ ${R.rating} on Google (${R.count} reviews)`;
    trustRow.insertBefore(li, trustRow.children[2] || null);
  }

  /* ------------------------- sticky mobile dock ------------------------- */
  const dock = $("#stickyDock");
  const heroCtas = $(".hero-ctas");
  const contactSection = $("#contact");
  if (dock) {
    dock.hidden = false; // CSS keeps it translated off-screen until .dock-visible
    document.body.classList.add("has-dock");

    let pastHero = false;
    let overContact = false;
    const sync = () => {
      dock.classList.toggle("dock-visible", pastHero && !overContact);
    };

    if ("IntersectionObserver" in window && heroCtas) {
      const hio = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { pastHero = !entry.isIntersecting; });
        sync();
      }, { threshold: 0 });
      hio.observe(heroCtas);
    } else {
      pastHero = true;
      sync();
    }

    if ("IntersectionObserver" in window && contactSection) {
      const cio = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { overContact = entry.isIntersecting; });
        sync();
      }, { threshold: 0.12 });
      cio.observe(contactSection);
    }
  }
})();
