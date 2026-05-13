// Happy Max Handyman — contact form backend configuration.
//
// Two modes:
//   "mailto"   — opens the visitor's email client with a prefilled message.
//   "supabase" — saves leads to a Supabase "leads" table.
//
// The publishable key below is safe to expose on the client side.
// Database is protected by Row Level Security policies — anon role can
// only INSERT into the "leads" table, nothing else.

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
