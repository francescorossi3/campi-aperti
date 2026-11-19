// Columella (ex Campi Aperti) – config.js
// IT: configurazione pubblica del sito (account opzionali Supabase). Espone window.CAMPI_APERTI
//     { supabaseUrl, supabaseAnonKey }, letto da account.js. Nessuna dipendenza.
//     Questi due valori NON sono segreti: la chiave "anon/publishable" di Supabase è fatta per stare nel browser;
//     la sicurezza dei dati è garantita dalle regole Row Level Security del database (supabase/schema.sql).
//     NON mettere mai qui la chiave "service_role"/"secret".
// EN: public site config (optional Supabase accounts). Exposes window.CAMPI_APERTI, read by account.js.
//     Only the public anon key belongs here, never the service_role key.
window.CAMPI_APERTI = {
  supabaseUrl: "https://eoasesjiarmxeglwahxg.supabase.co",
  supabaseAnonKey: "sb_publishable_S5hoJR877LDu0yp2mmAAQg_hzzxkRYT", // chiave pubblica (publishable)
};

// GoatCounter (statistiche anonime): prefisso del percorso. Qui e non inline in index.html, per la Content-Security-Policy.
window.goatcounter = { path: (p) => "columella" + p };
