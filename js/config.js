// Configurazione pubblica del sito. Questi due valori NON sono segreti: la chiave "anon/publishable" di Supabase
// è fatta per stare nel browser; la sicurezza dei dati è garantita dalle regole Row Level Security del database
// (supabase/schema.sql). NON mettere mai qui la chiave "service_role"/"secret".
window.CAMPI_APERTI = {
  supabaseUrl: "",        // es. https://abcdefghijk.supabase.co
  supabaseAnonKey: "",    // Project Settings -> API Keys -> anon / publishable
};
