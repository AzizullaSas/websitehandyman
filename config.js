// Happy Max Handyman — site configuration.
// Everything the owner may want to edit lives here: contact details,
// pricing anchors, guarantee terms, Google Business Profile links, and
// analytics IDs. Nothing in index.html hard-codes a dollar figure or a
// promise number — null/empty values simply hide the matching UI.
//
// Form backend modes:
//   "supabase" — sends leads to the `submit-lead` Edge Function, which
//                validates, rate-limits per IP, and writes to "leads".
//   "mailto"   — opens the visitor's email client with a prefilled message.

window.HAPPY_MAX_CONFIG = {
  backend: "supabase",

  contactEmail: "happymaxhandyman@gmail.com",
  contactPhone: "+18082011311",
  contactPhoneDisplay: "(808) 201-1311",

  // Business hours (HST) used by the "Open now" pill and thank-you copy.
  // days: 1 = Monday … 6 = Saturday (0 = Sunday).
  hours: { days: [1, 2, 3, 4, 5, 6], open: 8, close: 19 },

  // Shown in "replies within N minutes" microcopy — keep it honest.
  responseMinutes: 60,

  // Workmanship guarantee, in months. CONFIRM before changing copy-wide.
  guaranteeMonths: 12,

  // Owner confirmed the no-deposit policy (Jul 2026): shows the
  // "You pay when the work is done" line in the guarantee band.
  payAfterCompletion: true,

  // Price anchors. Value formats:
  //   120          → "$120" (flat price; addon-* keys render "+$120")
  //   [low, high]  → "typically $low–$high"
  //   [low, null]  → "from $low"
  //   "upon request" (any string) → shown as-is
  //   null         → that row/chip is hidden
  // The whole "Typical pricing" section stays hidden until at least one
  // value is set.
  pricing: {
    currency: "$",
    "tv-upto-55": 120,
    "tv-56-65": 150,
    "tv-66-85": 190,
    "tv-86plus": "upon request",
    "addon-concrete": 30,       // concrete wall add-on
    "addon-wire-hiding": 50,    // cables hidden add-on
    "addon-mount-pickup": 50,   // we bring the right mount to you
    "furniture-assembly": null,
    "ceiling-fan": null,
    "drywall": null,
    "door-lock": null,
    "picture-hanging": null
  },

  // Google Business Profile. Buttons/links render only when set.
  //   profileUrl — the public Maps/GBP listing URL
  //   reviewUrl  — the short "write a review" link (g.page/r/…)
  google: {
    profileUrl: "https://g.page/r/CSxvr1NoH1BfEBM",
    reviewUrl: "https://g.page/r/CSxvr1NoH1BfEBM/review"
  },

  // Real Google rating — fill ONLY from the live GBP numbers once
  // reviews exist. The hero rating chip renders only when both are set.
  reviews: { rating: null, count: null },

  // Analytics/ads tags — each loads only when its ID is present.
  //   ga4Id        — Google Analytics 4, e.g. "G-XXXXXXXXXX"
  //   adsId        — Google Ads tag (conversion tracking)
  //   adsLeadLabel — Ads conversion label for a submitted quiz lead
  //                  (Ads → Цели → Конверсии → создать действие → код → label)
  //   adsCallLabel — Ads conversion label for phone-number clicks
  //   metaPixelId  — Meta pixel, e.g. "1234567890"
  analytics: {
    ga4Id: "",
    adsId: "AW-18197555570",
    adsLeadLabel: "2vHkCNvd79QcEPLSouVD",  // «Отправка формы для потенциальных клиентов»
    adsCallLabel: "",
    metaPixelId: ""
  },

  // HappyMax CRM project (leads table + Telegram notifications).
  // The old standalone project (hfnuudllnfnunvodreao) is retired.
  supabase: {
    url: "https://fujjzktpumaxnyofsszy.supabase.co",
    anonKey: "sb_publishable_i8hLfI8yYcSNBS1cwj609A_bSqwvTZX"
  }
};
