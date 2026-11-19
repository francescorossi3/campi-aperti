# Columella

🇬🇧 **The name.** Lucius Junius Moderatus **Columella** (1st century AD) wrote the *De re rustica*, the most complete treatise on agriculture of
Roman antiquity. Columella is the agriculture **front end** of a family of projects: **Prognostica** (weather forecast, front end) ·
**Columella** · **Torricelli** (atmosphere and atmospheric correction, back end) · **Census** (usage monitoring, private).
Site: https://francescorossi3.github.io/columella/ (English, with Italian translation) · formerly *Campi Aperti / Open Fields Italy*.

🇮🇹 **Il nome.** Lucio Giunio Moderato **Columella** (I secolo d.C.) scrisse il *De re rustica*, il trattato di agricoltura più completo
dell'antichità romana. Columella è il **front end** agricolo di una famiglia di progetti: **Prognostica** (previsione meteo) · **Columella** ·
**Torricelli** (atmosfera e correzione atmosferica, back end) · **Census** (monitoraggio d'uso, privato). Prima si chiamava *Campi Aperti*.

**Licence / Licenza:** © 2026 Francesco Rossi — code all rights reserved / codice tutti i diritti riservati; data / dati CC BY-NC 4.0 ([LICENSE](LICENSE)).

---

🇮🇹 Mappa gratuita che raccoglie i **dati aperti per l'agricoltura italiana**: catasto, prodotti del Copernicus Land Monitoring Service, meteo e, nelle prossime versioni, rese agricole e servizi per gli agricoltori.

🇬🇧 Free map gathering **open data for Italian agriculture**: cadastre, Copernicus Land Monitoring Service products, weather and, in coming versions, crop yields and farmer services.

---

## Novità v2

- **Satellite in tempo reale**: mosaico Sentinel-2 più recente (finestra 10–90 giorni, nuvole < 20 %) in colori naturali, falsi colori, NDVI, NDRE, NDMI — da Microsoft Planetary Computer, aggiornato ogni 2–5 giorni.
- **Confini reali dei campi 2025** (Fields of The World, CC BY 4.0), indipendenti dal catasto: PMTiles per l'Italia letti a pezzi dal browser.
- **Clic su un campo → serie temporali** sotto la mappa: NDVI, NDRE, NDMI (media del campo, nuvole e ombre escluse con la classe SCL), pioggia, temperatura e previsione a 7 giorni (ERA5 Copernicus via Open-Meteo), radar Sentinel-1 VV/VH su richiesta; partenza **da San Martino**, **dal 1° gennaio** o **ultimi 12 mesi**; somma piogge, gradi giorno, ultimo e massimo NDVI; **CSV** scaricabile.

## Cosa fa (v1)

- **Catasto** dell'Agenzia delle Entrate (CC BY 4.0): fogli di mappa con numero (zoom ≥ 13), confini delle particelle e fabbricati (zoom ≥ 16). Clic su un punto → link alla scheda della particella (comune, foglio, numero).
- **23 layer Copernicus** letti in diretta dai server EEA, in 7 gruppi: copertura del suolo (CORINE 2018, CLC+ 2018/2021 a 10 m), alberi e foreste (densità chiome, latifoglie/conifere, tipo di foresta, siepi e filari, vegetazione legnosa), agricoltura e prati, fenologia e produttività, acqua e suolo impermeabile, Natura 2000, zone ripariali, punti LUCAS.
- **Clic sul punto**: coordinate, classe CORINE (in italiano), valore di ogni layer acceso tradotto nel nome della classe, link a Copernicus Browser / Google Maps / OSM.
- **Ricerca indirizzi** (OpenStreetMap Nominatim, solo Italia).
- **Italiano / English**, scelta ricordata nel browser (anche `?lang=en`).
- **Link condivisibili**: l'URL contiene vista, mappa di base e layer accesi, es. `#16/41.87/12.22/sat/cat_particelle,tcd2018`.
- Catalogo dei dataset (anche quelli in arrivo) e pagina di progetto.
- Funziona su telefono.

## Architettura

Sito **statico** (HTML + JS + Leaflet): nessun server, nessun costo, nessuna registrazione. Ogni dato è richiesto direttamente dal browser dell'utente ai servizi ufficiali:

| Fonte | Servizio | Note |
|---|---|---|
| Agenzia delle Entrate | WMS INSPIRE `ows01.php` | Solo EPSG:4258/6706/UTM: i tasselli si chiedono in EPSG:4258. Le particelle si disegnano solo sopra ~1:5.000; il riempimento giallo viene tolto con un filtro CSS + `mix-blend-mode: multiply`. Niente CORS e `X-Frame-Options: DENY`, per cui la scheda particella si apre in una nuova finestra. |
| EEA / Copernicus | ArcGIS REST `image.discomap.eea.europa.eu` | `export` / `exportImage` in EPSG:3857, tasselli 512 px; `identify`, `legend`, `rasterAttributeTable` (CORS aperto). |
| OpenStreetMap | tile + Nominatim | |
| EOX | Sentinel-2 cloudless 2023 | CC BY-NC-SA 4.0 |
| Esri | World Imagery | |

### Struttura

Struttura del sito, flusso dei dati, Supabase e tabella "file → cosa fa": [docs/COME_FUNZIONA.md](docs/COME_FUNZIONA.md) (italiano) ·
[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) (English).

### Aggiungere un layer

In `js/layers.js` aggiungi un oggetto con `id`, `group`, `type` (`arcgis-map`, `arcgis-image` o `catasto`), `url`, i testi `it`/`en`, `source` e `link`. Compare da solo nel pannello, nel catalogo e nel clic sul punto.

## Pubblicare su GitHub Pages

1. Crea un repository vuoto, es. `github.com/francescorossi3/columella`.
2. Carica il contenuto di questa cartella (oppure `git init && git add . && git commit -m "v1" && git push`).
3. *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`*.
4. Dopo un minuto il sito è su `https://francescorossi3.github.io/columella/`.

Per provarlo in locale: `python -m http.server` nella cartella, poi apri `http://localhost:8000`.

## Roadmap

- **v2: scheda campo.** Serie temporali di NDVI e altri indici Sentinel-2 calcolati nel browser da COG pubblici (STAC Earth Search), con pioggia e temperatura dal repository *Meteo Accuracy*; partenza da **San Martino (11 novembre)** o dal **1° gennaio**.
- **v3: rese.** Rese ISTAT per provincia e coltura; HRL Croplands (tipi di coltura) e HR-VPP a 10 m.
- **v4: servizi per agricoltori.** Stima della resa dell'olivo, frantoio più vicino, potenziale di crediti di carbonio (suolo + siepi e filari), colture adatte al campo.
- Piccolo proxy gratuito (es. Cloudflare Worker) per leggere la particella dentro la pagina ed evidenziarne il contorno.
- Articoli di divulgazione su ogni dataset.

## Licenze

Codice: tutti i diritti riservati (vedi [LICENSE](LICENSE)). Il modello per i confini dei campi, Delineate Anything S (Lavreniuk et al., 2025, https://github.com/Lavreniuk/Delineate-Anything), è distribuito separatamente in formato ONNX con la sua licenza AGPL-3.0 e viene scaricato dal browser al momento dell'uso. Suolo: ISRIC SoilGrids 2.0 (CC BY 4.0). Dati: secondo le licenze delle rispettive fonti (Agenzia delle Entrate CC BY 4.0; Copernicus: accesso pieno, aperto e gratuito, Reg. UE 1159/2013; OpenStreetMap ODbL; EOX CC BY-NC-SA 4.0).

La mappa catastale ha valore indicativo e non sostituisce le visure ufficiali.

## Come citare / How to cite

Rossi, F. (2026). *Columella: open data for Italian agriculture* [web application]. CNR – Istituto di Metodologie Integrate per
l'Osservazione della Terra (IMIOT). https://francescorossi3.github.io/columella/

Vedi anche `CITATION.cff` (GitHub mostra il pulsante "Cite this repository") e cita le fonti dei dati usati (Copernicus, ESA, ISTAT, SoilGrids, ERA5/Open-Meteo).
