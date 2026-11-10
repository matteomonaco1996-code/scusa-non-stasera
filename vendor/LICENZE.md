# Componenti di terze parti ospitati nel sito

| Componente | Versione | Licenza | File |
| --- | --- | --- | --- |
| Leaflet | 1.9.4 | BSD-2-Clause | `vendor/leaflet/LICENSE` |
| supabase-js | 2.118.0 | MIT | `vendor/supabase/LICENSE` |
| Jersey 10 (via Fontsource 5.3.0) | — | SIL Open Font License 1.1 | `fonts/OFL-Jersey10.txt` |
| Figtree (via Fontsource 5.3.0) | — | SIL Open Font License 1.1 | `fonts/OFL-Figtree.txt` |

Sono copiati qui (invece di caricarli da CDN o da Google Fonts) per non trasmettere l’IP
dei visitatori a terzi e per poter usare una Content Security Policy che consente solo file del sito.
Per aggiornarli: `npm pack <pacchetto>@<versione>`, copia i file, rileggi il changelog.
