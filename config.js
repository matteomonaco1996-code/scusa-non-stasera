// Configurazione di "Scusa, non stasera".
// Account, punti e recensioni si attivano solo quando questi due valori sono compilati.
// Prendili da Supabase → Project Settings → API:
//   supabaseUrl  = "Project URL"            (es. https://abcdefghijkl.supabase.co)
//   supabaseKey  = chiave "anon" / "public" (è pensata per stare nel browser: la sicurezza
//                  la fanno le regole del database in supabase/schema.sql)
// NON inserire MAI qui la chiave "service_role": darebbe accesso a tutto il database.
window.SNS_CONFIG = {
  supabaseUrl: "",
  supabaseKey: "",
  // Versioni dei documenti accettati alla registrazione: aggiornale se cambi privacy.html o termini.html.
  versioneTermini: "1.0",
  versionePrivacy: "1.0",
};
