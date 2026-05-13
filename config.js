// Happy Max Handyman — contact form backend configuration.
//
// Two modes:
//   "mailto"   — opens the visitor's email client with a prefilled message.
//                Works immediately, no setup.
//   "supabase" — saves leads to a Supabase "leads" table.
//                Set url + anonKey below, then change backend to "supabase".
//
// The "leads" table SQL is in the project plan if you need to recreate it.

window.HAPPY_MAX_CONFIG = {
  backend: "mailto",

  contactEmail: "happymaxhandyman@gmail.com",
  contactPhone: "+18082011311",
  contactPhoneDisplay: "(808) 201-1311",

  supabase: {
    url: "",
    anonKey: ""
  }
};
