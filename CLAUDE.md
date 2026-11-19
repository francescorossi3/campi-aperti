# Columella – istruzioni per Claude

Front end agricoltura (ex Campi Aperti): mappa dei campi, catasto, prodotti Copernicus, colture, servizi agli agricoltori; account opzionali con Supabase (vedi `SUPABASE.md`, `supabase/`).
Contesto: README.md. Codice principale in `js/` (app.js, i18n.js per le traduzioni EN/IT, layers.js, delineate.js, croplayer.js, account.js…); pipeline Python in `pipeline/`.
Attenzione licenze: Delineate Anything è AGPL-3.0 (incompatibile con "tutti i diritti riservati" se integrato: chiedere prima di modificarne l'uso).
Privacy: `privacy.html` va aggiornata a ogni nuovo trattamento di dati.

## Codice essenziale e documentazione
- Codice **essenziale**: niente codice morto, duplicati o astrazioni inutili; nomi chiari; commenti brevi solo dove la logica non è ovvia.
- Ogni file `js/*.js` e `pipeline/*.py` inizia con un'**intestazione**: cosa fa, cosa espone/produce, da cosa dipende (come si lancia, per gli script).
- Le pulizie non devono cambiare il comportamento; `node --check` (JS) o `python -m py_compile` (Python) prima di ogni commit.
- **Aggiornare `docs/`** (`HOW_IT_WORKS.md` in inglese e `COME_FUNZIONA.md` in italiano, diagrammi Mermaid e tabella "file → cosa fa")
  a ogni nuovo file, fonte di dati, livello, script della pipeline o modifica a Supabase, nello stesso commit o subito dopo.

## Interfaccia
- Barra laterale a **tab**: Mappe · Campi · Province · Regioni, con sezioni a scomparsa dentro le tab; su telefono diventa un foglio dal basso.
  Tab Mappe in quest'ordine: mappa di base · Campi e colture · Sentinel-2 · CLMS (gruppi come nel portafoglio CLMS) · Suolo · Catasto (`MAP_SECTIONS`).
  Sopra la mappa solo: finestra dei livelli (spostabile), legenda, controlli Leaflet. Nuove schede e strumenti vanno in una tab.
- Più campi selezionabili (`clip.js`, id temporanei C1, C2…; Ctrl/Maiusc + clic). I dati di ogni campo stanno nel suo oggetto in `live.js`
  (`fields`, `current` = campo mostrato): i caricamenti leggono `current` subito e poi usano solo il proprio campo.
- Ogni nuovo raster usa il riquadro `Clip.pane()` (così è ritagliato sui campi selezionati) e, se ha valori continui, lo stile di `mapstyle.js`
  (statistiche sempre sull'intero campo). Ogni testo nuovo va in IT e EN.
- Un nuovo servizio esterno va aggiunto alla Content-Security-Policy in `index.html`; librerie in copia locale in `js/vendor/` (o CDN con SRI).

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
