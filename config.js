// Happy Max Handyman — contact form backend configuration.
//
// Two modes:
//   "mailto"   — opens the visitor's email client with a prefilled message.
//   "supabase" — sends leads to the `submit-lead` Edge Function, which
//                validates, rate-limits per IP, and writes to the "leads"
//                table with the service role.
//
// The publishable key below is safe to expose on the client side. It is
// only used by the temporary direct-insert fallback in form.js; once
// migration 0005 revokes anon INSERT, that key can't write anything.

window.HAPPY_MAX_CONFIG = {
  backend: "supabase",

  contactEmail: "happymaxhandyman@gmail.com",
  contactPhone: "+18082011311",
  contactPhoneDisplay: "(808) 201-1311",

  supabase: {
    url: "https://hfnuudllnfnunvodreao.supabase.co",
    anonKey: "sb_publishable_6qvwEGrj0h9if9RkugbJcA_m8hEIMqo"
  }
};
