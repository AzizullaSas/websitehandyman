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
  hours: { days: [1, 2, 3, 4, 5, 6], open: 9, close: 18 },

  // Shown in "replies within N minutes" microcopy — keep it honest.
  responseMinutes: 60,

  // ───────────────────────── SCHEDULING ─────────────────────────
  // The quiz asks for a preferred day and start time. It is still a
  // REQUEST, not a confirmed booking — no money changes hands and Max
  // confirms by phone — but the picker now hides times that are already
  // spoken for, so the copy says "we'll confirm", never "you're booked".
  //
  //   slotHours   — bookable START times, HST 24h. First job at 9am, last
  //                 at 5pm so the van is packed by close (18:00 above).
  //                 The grid renders straight from this list.
  //   daysAhead   — how far ahead the day strip runs, in calendar days.
  //                 Sundays — and any day missing from `hours.days` —
  //                 drop out on their own.
  //   leadHours   — minimum notice before the next job. At 10am with
  //                 leadHours 2, today starts at 12pm. When no time is
  //                 left, today drops off the strip entirely.
  //   bufferHours — spacing between two jobs: travel across Oahu plus the
  //                 install itself. With 2, a 9am booking also takes 10am
  //                 off the board (and 8am, if it existed) — the next
  //                 bookable time is 11am. Raise it if jobs start running
  //                 long; it is the single number that controls how many
  //                 jobs a day can hold.
  //   checkAvailability — ask the backend which slots are taken. Requires
  //                 the GET handler in submit-lead (see DEPLOY note in
  //                 AI AGENT FOR TG). Until that is deployed the request
  //                 fails and every slot simply stays open — a lead is
  //                 never lost to a scheduling lookup. Set false to stop
  //                 asking at all.
  //   services    — which quiz paths show the picker. One service, one
  //                 entry; emptying `slotHours` disables the picker and
  //                 the quiz falls back to ASAP / This week / Flexible.
  booking: {
    slotHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    daysAhead: 14,
    leadHours: 2,
    bufferHours: 2,
    checkAvailability: true,
    services: ["tv_mounting"]
  },

  // Max characters in the quiz's free-text "details" box.
  // Deliberately tight: a real job reads "two fans in Aiea, patch a
  // doorknob hole" (~60 chars), while the B2B cold-pitches that were
  // coming through this field ran 500-700. Raising this re-opens that
  // door. Enforced again server-side — maxlength alone is trivial to
  // bypass by posting straight to the endpoint.
  maxDetailsChars: 300,

  // ─────────────────────── LEGAL / LICENSING ───────────────────────
  // Hawaii HRS §444-9.2(a): it is a MISDEMEANOR to advertise as a
  // contractor without a license — and that applies even to businesses
  // exempt from licensing under §444-2. So this value is load-bearing:
  //
  //   null        → the site never claims to be licensed, and shows the
  //                 handyman-exemption scope note instead.
  //   "C-33456"   → the number is rendered site-wide, which §444-9.2(b)
  //                 REQUIRES of anyone who is licensed and advertises.
  //
  // Do NOT put anything here until a license is actually issued —
  // an unlicensed "Licensed" claim is the exact thing the statute
  // penalises. Confirmed Aug 2026: no contractor license.
  contractorLicense: null,

  // Hawaii handyman exemption ceiling (HRS §444-2): total labor +
  // materials per job. Above this — or if the job needs a building
  // permit, or is electrical/plumbing work — a licensed contractor is
  // required and the job must be referred out.
  handymanJobLimit: 1500,

  // General liability insurance in force (policy via Thimble).
  // Thimble sells short-term policies — if coverage ever lapses, set
  // this to false and every "Insured" claim disappears site-wide.
  insured: true,

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
    "addon-mount-pickup": 50    // we bring the right mount to you
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
  //
  // TODO(owner) — два пустых поля стоят денег, пока реклама крутится:
  //
  //  1. ga4Id: analytics.google.com → Admin → Create property → Web →
  //     скопировать "G-XXXXXXXXXX". Без него неизвестно, сколько людей
  //     заходит и где отваливается — все события уже шлются в код.
  //
  //  2. adsCallLabel: Ads → Цели → Конверсии → Создать действие →
  //     "Сайт" → тип «Обращение по телефону» → взять label из сниппета.
  //     Кнопка «Позвонить» стоит в 7 местах страницы и для этого бизнеса
  //     звонок — основной канал; сейчас Ads эти конверсии не видит вообще.
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
