# Componenti di terze parti ospitati nel sito

| Componente | Versione | Licenza | File |
| --- | --- | --- | --- |
| Leaflet | 1.9.4 | BSD-2-Clause | `vendor/leaflet/LICENSE` |
| supabase-js | 2.118.0 | MIT | `vendor/supabase/LICENSE` |
| Dati della mappa (`mappa/roma.js`) | estratto 2026-11 | ODbL 1.0, © OpenStreetMap contributors | https://www.openstreetmap.org/copyright |
| Jersey 10 (via Fontsource 5.3.0) | — | SIL Open Font License 1.1 | `fonts/OFL-Jersey10.txt` |
| Press Start 2P (via Fontsource 5.3.0), usato per il logo | — | SIL Open Font License 1.1 | `fonts/OFL-PressStart2P.txt` |
| Figtree (via Fontsource 5.3.0) | — | SIL Open Font License 1.1 | `fonts/OFL-Figtree.txt` |

Sono copiati qui (invece di caricarli da CDN o da Google Fonts) per non trasmettere l’IP
dei visitatori a terzi e per poter usare una Content Security Policy che consente solo file del sito.
Per aggiornarli: `npm pack <pacchetto>@<versione>`, copia i file, rileggi il changelog.
