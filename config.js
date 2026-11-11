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
  // Con il database acceso si possono tenere separati i due usi:
  //   conto: false       → niente account, punti e recensioni (restano solo i contatori)
  //   statistiche: false → niente contatori anonimi delle visite (vedi statistiche.html)
  conto: true,
  statistiche: true,
  // Donazione facoltativa ("Dona una moneta"): incolla qui il link della tua pagina per ricevere denaro
  // (per esempio PayPal.me, Ko-fi, Satispay). Deve iniziare con https://
  // Finché resta vuoto la moneta non compare da nessuna parte. Prima di attivarla leggi LEGALE_E_SICUREZZA.md.
  donazione: "https://www.paypal.me/MatteoMonaco01",
  // Quando ricordare la moneta prima di aprire le indicazioni ("Portami lì"):
  // "sempre" = ogni volta, "una" = una volta sola per visita, "mai" = mai (la moneta resta negli altri punti).
  monetaPrima: "sempre",
  // Versioni dei documenti accettati alla registrazione: aggiornale se cambi privacy.html o termini.html.
  versioneTermini: "1.1",
  versionePrivacy: "1.3",
};
