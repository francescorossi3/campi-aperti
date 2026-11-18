# Come funziona Columella

Columella è un **sito statico** (GitHub Pages: HTML + JavaScript semplice, nessun build, nessun server proprio).
Tutti i calcoli per l'utente avvengono **nel browser**; i lavori pesanti e lenti girano **una volta nelle GitHub Actions**
(script Python in `pipeline/`) e i risultati sono pubblicati come file (in `data/` di questo repo o nel dataset Hugging Face
`Bradipo92/campi-aperti-data`). Versione inglese: [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

## 1. Struttura del sito

```mermaid
flowchart TB
  html[index.html] --> vendor["js/vendor/ (Leaflet, Chart.js, geotiff.js, proj4, supabase-js)"]
  html --> config[config.js<br/>impostazioni pubbliche Supabase]
  html --> i18n[i18n.js<br/>testi EN/IT, classi CORINE]
  html --> crop[croplayer.js<br/>raster COG: colture, suolo, CLMS]
  html --> layers[layers.js<br/>catalogo dei livelli]
  html --> ms[mapstyle.js<br/>pannello Stile come QGIS]
  html --> clip[clip.js<br/>raster ritagliati sul campo]
  html --> seg[segment.js<br/>campi dalla serie NDVI]
  html --> del[delineate.js<br/>Delineate Anything, AGPL]
  html --> live[live.js<br/>Sentinel-2 in diretta + scheda campo]
  html --> adv[advice.js<br/>modelli malattie / meteo]
  html --> reg[regions.js<br/>tab Regioni]
  html --> acc[account.js<br/>account Supabase]
  html --> tools[tools.js<br/>disegno, caricamento, esportazione, i miei campi]
  html --> app[app.js<br/>mappa, pannello livelli, clic, ricerca, lingua]
  seg -.usa.-> del
  live -.usa.-> seg
  live -.usa.-> adv
  tools -.usa.-> acc
  app -.usa.-> layers & crop & live & tools & reg & ms & clip
  live -.usa.-> ms & clip
```

### Impaginazione

```mermaid
flowchart LR
  subgraph Barra["Barra laterale (foglio dal basso sul telefono)"]
    s1[Ricerca e campi<br/>disegna · area · carica · prato · i miei campi]
    s2[Livelli<br/>mappe di base · gruppi · Stile per livello · punto cliccato]
    s3[Indici e serie temporali<br/>mappa del campo · grafici · CSV]
    s4[Servizi<br/>coltura · resa · suolo · carbonio · avvisi · regioni]
    s5[Account]
    s6[Dati · Progetto]
  end
  Barra --- M[Mappa grande<br/>raster solo dentro il campo selezionato<br/>legenda in basso a destra]
```

Nessun pannello copre la mappa: strumenti, schede e grafici stanno nelle sezioni a scomparsa della barra laterale. Selezionando un campo
la mappa si centra su di esso, tutti i livelli raster sono mostrati **solo dentro il poligono** (`clip-path` CSS sul riquadro Leaflet
`rasters`, `clip.js`) e le statistiche (media, min, max, dev. std.) sono calcolate sull'intero campo. Il pannello **Stile** (`mapstyle.js`,
ripreso da Prognostica) offre scala di colori, inversione, minimo/massimo (predefiniti, min–max del campo, percentili 2–98 %, media ± 2 dev.
std., manuali), classi continue / a intervalli uguali / quantili, trasparenza, colore per nessun dato, istogramma dei valori del campo e
legenda aggiornata; lo stile di ogni livello è salvato nel browser (`localStorage`, chiave `columella.style.<id del livello>`).
I mosaici Sentinel-2 per periodo sono colorati dal server: per loro solo scala, limiti manuali e trasparenza.

Gli script sono caricati in quest'ordine da `index.html` e condividono variabili globali (`LANG`, `Live`, `Tools`, `Account`, …).
Il suffisso `?v=NN` di ogni script obbliga i browser a ricaricarlo dopo una modifica.

## 2. Flusso dei dati

```mermaid
flowchart LR
  subgraph Browser
    map[Mappa Leaflet]
    field[Scheda campo<br/>serie temporali, coltura, suolo, resa, avvisi]
  end
  subgraph "Servizi ufficiali (letti in diretta)"
    ade[Agenzia delle Entrate<br/>WMS catasto]
    eea[EEA / CLMS<br/>ArcGIS REST]
    pc[Microsoft Planetary Computer<br/>Sentinel-1/2, DEM]
    om[Open-Meteo<br/>ERA5 + previsioni]
    isric[ISRIC SoilGrids]
    osm[OSM / Nominatim / Photon]
  end
  subgraph "Preparati dalle GitHub Actions"
    hf[(Dataset Hugging Face<br/>COG: colture, CLMS, ETA, suolo;<br/>modelli ONNX e JSON)]
    repo[(data/ del repo<br/>riepiloghi, rese, comuni,<br/>clms_indice, monteith)]
  end
  ade --> map
  eea --> map
  osm --> map
  pc --> map & field
  om --> field
  isric --> field
  hf --> map & field
  repo --> map & field
```

### Catasto
`layers.js` (`type: "catasto"`) → WMS INSPIRE dell'Agenzia delle Entrate, tasselli chiesti in EPSG:4258. Le particelle si vedono solo
a grande scala; il clic apre la scheda della particella in una nuova finestra (il servizio non ha CORS).

### Copernicus
- **Layer CLMS / EEA** (CORINE, CLC+, densità chiome, prati, fenologia…): `layers.js` → ArcGIS `export`/`exportImage`, `identify`, `legend`.
- **Variabili biogeofisiche ed ETA** (NDVI, LAI, FAPAR, ET…): `pipeline/16_clms_italia.py` le ritaglia sull'Italia in COG → Hugging Face;
  `17_indice_clms.py` scrive `data/clms_indice.json` (date disponibili); `croplayer.js` legge solo i byte necessari (HTTP range) con geotiff.js.
- **HRL Crop Types**: `01`→`02` producono un COG all'anno (`crop_types/cty_AAAA_italia_3035.tif`), disegnato da `CropLayer`.
- **Sentinel-2 in diretta**: `live.js` registra un mosaico su Planetary Computer (ultimi 10–90 giorni, nuvole < 20 %) per colori naturali/falsi e indici.

### Meteo
Open-Meteo (archivio ERA5 + previsioni a 7 giorni) è chiamato direttamente dal browser per il campo scelto (`live.js`, `advice.js`).
I riepiloghi regionali vengono da `04_meteo_celle.py` → `05_bilancio_regioni.py` → `data/riepiloghi.json` (`regions.js`).

### Campi e modelli delle colture

```mermaid
flowchart LR
  click[Clic / disegno] --> seg{Confine del campo}
  seg -->|prima scelta| da[Delineate Anything S<br/>ONNX nel browser]
  seg -->|riserva| fz[Felzenszwalb sulla serie NDVI]
  seg -->|utente| drawn[Poligono disegnato / caricato]
  da & fz & drawn --> poly[Poligono del campo]
  poly --> ts[Serie temporali medie del campo<br/>NDVI/NDRE/NDMI…, S1, meteo]
  poly --> cls[Classificatore colture<br/>3 MLP che votano, pesi JSON da 18_modello_web.py]
  poly --> soil[Tessitura del suolo<br/>SoilGrids]
  poly --> yld[Resa: ISTAT 07 + Monteith 12]
  poly --> adv[Avvisi: modelli malattie/meteo]
```

I valori sono sempre **medie sull'intero campo** (nuvole e ombre escluse con la classe SCL di Sentinel-2).
Il classificatore è addestrato offline (`13_dataset_v2.py` → `14_addestra_v2.py` → `18_modello_web.py`).

## 3. Supabase (account facoltativi)

```mermaid
sequenceDiagram
  participant U as Browser (account.js)
  participant S as Supabase Auth
  participant DB as Postgres (tabella campi, RLS)
  U->>S: registrazione / accesso (email + password, PKCE)
  S-->>U: sessione (salvata in localStorage)
  U->>DB: select/insert/update/delete campi (chiave anon + JWT utente)
  DB-->>U: solo le righe con user_id = auth.uid()
  U->>DB: rpc elimina_il_mio_account()
  Note over DB: vista campi_condivisi leggibile solo con la chiave di servizio (GitHub Secrets)
```

- `js/config.js` contiene solo URL e chiave anon **pubblici**; se è vuoto gli account sono spenti e i campi restano in `localStorage`.
- La sicurezza sta in `supabase/schema.sql` (Row Level Security, al massimo 500 campi per utente). Attivazione: `SUPABASE.md`. Informativa: `privacy.html`.
- La pagina ha una Content-Security-Policy (`index.html`): script solo dal sito, da jsDelivr (onnxruntime-web, con SRI) e da GoatCounter;
  richieste di rete solo verso i servizi elencati. Un nuovo servizio di dati va aggiunto anche lì.

## 4. File → cosa fa

| File | Cosa fa |
|---|---|
| `index.html` | Scheletro della pagina, carica gli script in ordine |
| `css/style.css` | Stile |
| `js/config.js` | Impostazioni pubbliche Supabase (URL, chiave anon) |
| `js/i18n.js` | Testi EN/IT, nomi delle classi CORINE, catalogo "in arrivo" |
| `js/layers.js` | Catalogo dei livelli (gruppi, URL, testi, fonti) |
| `js/mapstyle.js` | Pannello Stile: scale, limiti, classi, istogramma, legenda, salvato per livello |
| `js/clip.js` | Ritaglia i raster sul campo selezionato e centra la mappa sul campo |
| `js/vendor/` | Copie locali di Leaflet, supabase-js, Chart.js, geotiff.js, proj4 (licenze in `LICENSES.md`) |
| `js/app.js` | Mappa, mappe di base, sezioni della barra laterale, pannello livelli e stili, statistiche sul campo, legenda, clic sul punto, ricerca, lingua, URL condivisibile |
| `js/croplayer.js` | Raster COG nel browser: Crop Types, suolo, CLMS; scale di colori |
| `js/live.js` | Livelli Sentinel-2/1 in diretta, scheda campo: serie, coltura, suolo, resa, bilancio idrico, CSV |
| `js/segment.js` | Divisione in campi dalla serie NDVI Sentinel-2 (riserva) |
| `js/delineate.js` | Confini dei campi con Delineate Anything S (ONNX, AGPL-3.0, scaricato al momento dell'uso) |
| `js/advice.js` | Avvisi agronomici per coltura dal meteo orario |
| `js/regions.js` | Tab "Regioni": riepiloghi per regione, coltura e periodo; Monteith vs ISTAT |
| `js/tools.js` | Disegno/caricamento di campi e mappe, esportazione area, "i miei campi", prato, benvenuto |
| `js/account.js` | Account Supabase, campi salvati, esportazione e cancellazione |
| `supabase/schema.sql` | Tabella `campi`, regole RLS, massimo 500 campi per utente, cancellazione account, vista condivisa |
| `pipeline/00`–`02` | Crop Types: download da CDSE, COG Italia, caricamento su HF |
| `pipeline/03`–`05` | Superfici per blocco di 1 km, celle meteo, bilanci regionali → `data/riepiloghi.json` |
| `pipeline/06` | ET reale Copernicus per regione e coltura |
| `pipeline/07` | Rese ISTAT per provincia → `data/rese.json` |
| `pipeline/10`, `12` | NDVI per provincia e modello di resa di Monteith vs ISTAT |
| `pipeline/11` | Esporta Delineate Anything S in ONNX (AGPL-3.0) |
| `pipeline/13`, `14`, `18` | Classificatore colture: dataset, addestramento, pesi per il browser |
| `pipeline/15` | Indice dei comuni per la ricerca → `data/comuni.json` |
| `pipeline/16`, `17` | Variabili CLMS sull'Italia (COG) e indice delle date |
| `pipeline/19` | Mappe del suolo SoilGrids per l'Italia (COG) |
| `pipeline/classi.py` | Classi Crop Types e coefficienti colturali |
| `pipeline/hf_sync.py` | Sincronizza le cartelle di lavoro con il dataset Hugging Face |
| `.github/workflows/*.yml` | GitHub Actions: pipeline, raccolta contributi, prova del sito |
