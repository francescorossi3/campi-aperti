# Columella – istruzioni per Claude

Front end agricoltura (ex Campi Aperti): mappa dei campi, catasto, prodotti Copernicus, colture, servizi agli agricoltori; account opzionali con Supabase (vedi `SUPABASE.md`, `supabase/`).
Contesto: README.md. Codice principale in `js/` (app.js, i18n.js per le traduzioni EN/IT, layers.js, delineate.js, croplayer.js, account.js…); pipeline Python in `pipeline/`.
Attenzione licenze: Delineate Anything è AGPL-3.0 (incompatibile con "tutti i diritti riservati" se integrato: chiedere prima di modificarne l'uso).
Privacy: `privacy.html` va aggiornata a ogni nuovo trattamento di dati.

## Regole comuni (famiglia Prognostica · Columella · Torricelli · Census)
- Proprietario: Francesco Rossi (CNR-IMIOT). Rispondere in italiano.
- Python (back end): script **lineari stile Spyder**, poche funzioni, **niente `main()` / `if __name__`**; file numerati `NN_nome.py`.
- JavaScript (front end): sito statico GitHub Pages, calcolo nel browser, niente build step.
- Lingua dei siti: **inglese** principale + traduzione italiana (pulsante EN/IT). Nomi di file/CSV in inglese.
- Licenza: codice tutti i diritti riservati, dati CC BY-NC 4.0 (`LICENSE`). Non aggiungere dipendenze con licenze copyleft senza chiedere.
- Mai mettere chiavi/token nel codice: solo GitHub Secrets. Open-Meteo gratuito = uso non commerciale.
- Commit piccoli e descrittivi in italiano; dopo modifiche al sito lanciare il workflow di pubblicazione.
- Non aprire file sul PC di Francesco senza permesso; niente controllo di mouse/schermo.
- Risparmio token: leggere solo i file necessari (usare grep), non rileggere file appena modificati, risposte brevi.
