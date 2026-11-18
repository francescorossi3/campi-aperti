# How Columella works

Columella is a **static website** (GitHub Pages: HTML + plain JavaScript, no build step, no server of its own).
Every computation for the user runs **in the browser**; heavy, slow jobs run **once in GitHub Actions** (Python scripts in
`pipeline/`) and their results are published as files (in `data/` of this repo or in the Hugging Face dataset
`Bradipo92/campi-aperti-data`). Italian version: [COME_FUNZIONA.md](COME_FUNZIONA.md).

## 1. Site structure

```mermaid
flowchart TB
  html[index.html] --> vendor["js/vendor/ (Chart.js, geotiff.js, proj4)<br/>+ Leaflet (CDN)"]
  html --> config[config.js<br/>public Supabase settings]
  html --> i18n[i18n.js<br/>EN/IT texts, CORINE classes]
  html --> crop[croplayer.js<br/>COG rasters: crops, soil, CLMS]
  html --> layers[layers.js<br/>layer catalogue]
  html --> seg[segment.js<br/>fields from NDVI series]
  html --> del[delineate.js<br/>Delineate Anything, AGPL]
  html --> live[live.js<br/>Sentinel-2 live + field panel]
  html --> adv[advice.js<br/>crop disease / weather models]
  html --> reg[regions.js<br/>Regions tab]
  html --> acc[account.js<br/>Supabase accounts]
  html --> tools[tools.js<br/>draw, upload, export, my fields]
  html --> app[app.js<br/>map, layers panel, click, search, language]
  seg -.uses.-> del
  live -.uses.-> seg
  live -.uses.-> adv
  tools -.uses.-> acc
  app -.uses.-> layers & crop & live & tools & reg
```

Scripts are loaded in this order by `index.html` and share globals (`LANG`, `Live`, `Tools`, `Account`, …).
The `?v=NN` suffix on each script forces browsers to reload after a change.

## 2. Data flow

```mermaid
flowchart LR
  subgraph Browser
    map[Leaflet map]
    field[Field panel<br/>time series, crop, soil, yield, advice]
  end
  subgraph "Official services (read live)"
    ade[Agenzia delle Entrate<br/>cadastre WMS]
    eea[EEA / CLMS<br/>ArcGIS REST]
    pc[Microsoft Planetary Computer<br/>Sentinel-1/2, DEM]
    om[Open-Meteo<br/>ERA5 + forecast]
    isric[ISRIC SoilGrids]
    osm[OSM / Nominatim / Photon]
  end
  subgraph "Prepared by GitHub Actions"
    hf[(Hugging Face dataset<br/>COG: crop types, CLMS, ETA, soil;<br/>ONNX + JSON models)]
    repo[(repo data/<br/>riepiloghi, rese, comuni,<br/>clms_indice, monteith)]
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

### Cadastre
`layers.js` (`type: "catasto"`) → WMS INSPIRE of Agenzia delle Entrate, tiles requested in EPSG:4258. Parcels are drawn only at
large scales; a click opens the parcel sheet in a new window (the service has no CORS).

### Copernicus
- **CLMS / EEA layers** (CORINE, CLC+, tree cover, grassland, phenology…): `layers.js` → ArcGIS `export`/`exportImage`, `identify`, `legend`.
- **Biogeophysical variables and ETA** (NDVI, LAI, FAPAR, ET…): `pipeline/16_clms_italia.py` clips them on Italy as COG → Hugging Face;
  `17_indice_clms.py` writes `data/clms_indice.json` (available dates); `croplayer.js` reads only the needed bytes (HTTP range) with geotiff.js.
- **HRL Crop Types**: `01`→`02` build one COG per year (`crop_types/cty_YYYY_italia_3035.tif`), drawn by `CropLayer`.
- **Sentinel-2 live**: `live.js` registers a mosaic on Planetary Computer (last 10–90 days, clouds < 20 %) for natural/false colours and indices.

### Weather
Open-Meteo (ERA5 archive + 7-day forecast) is called directly from the browser for the selected field (`live.js`, `advice.js`).
Regional summaries come from `04_meteo_celle.py` → `05_bilancio_regioni.py` → `data/riepiloghi.json` (`regions.js`).

### Fields and crop models

```mermaid
flowchart LR
  click[Click / draw] --> seg{Field boundary}
  seg -->|1st choice| da[Delineate Anything S<br/>ONNX in browser]
  seg -->|fallback| fz[Felzenszwalb on NDVI series]
  seg -->|user| drawn[Drawn / uploaded polygon]
  da & fz & drawn --> poly[Field polygon]
  poly --> ts[Field-mean time series<br/>NDVI/NDRE/NDMI…, S1, weather]
  poly --> cls[Crop classifier<br/>3 MLP vote, weights JSON from 18_modello_web.py]
  poly --> soil[Soil texture<br/>SoilGrids]
  poly --> yld[Yield: ISTAT 07 + Monteith 12]
  poly --> adv[Advice: disease/weather models]
```

Values are always **means over the whole field** (clouds and shadows masked with the Sentinel-2 SCL class).
The crop classifier is trained offline (`13_dataset_v2.py` → `14_addestra_v2.py` → `18_modello_web.py`).

## 3. Supabase (optional accounts)

```mermaid
sequenceDiagram
  participant U as Browser (account.js)
  participant S as Supabase Auth
  participant DB as Postgres (table campi, RLS)
  U->>S: sign up / sign in (email + password, PKCE)
  S-->>U: session (stored in localStorage)
  U->>DB: select/insert/update/delete campi (anon key + user JWT)
  DB-->>U: only rows where user_id = auth.uid()
  U->>DB: rpc elimina_il_mio_account()
  Note over DB: view campi_condivisi readable only with the service key (GitHub Secrets)
```

- `js/config.js` holds only the **public** URL and anon key; if empty, accounts are off and fields stay in `localStorage`.
- Security is in `supabase/schema.sql` (Row Level Security). Setup: `SUPABASE.md`. Privacy notice: `privacy.html`.

## 4. File → what it does

| File | What it does |
|---|---|
| `index.html` | Page skeleton, loads scripts in order |
| `css/style.css` | Styles |
| `js/config.js` | Public Supabase settings (URL, anon key) |
| `js/i18n.js` | EN/IT interface texts, CORINE class names, "coming soon" catalogue |
| `js/layers.js` | Layer catalogue (groups, URLs, texts, sources) |
| `js/app.js` | Map, base maps, layer panel and styles, point click, search, language, shareable URL |
| `js/croplayer.js` | COG raster layers in the browser: Crop Types, soil, CLMS; colour ramps |
| `js/live.js` | Live Sentinel-2/1 layers, field panel: time series, crop, soil, yield, water balance, CSV |
| `js/segment.js` | Field segmentation from the Sentinel-2 NDVI series (fallback) |
| `js/delineate.js` | Field boundaries with Delineate Anything S (ONNX, AGPL-3.0, downloaded at use time) |
| `js/advice.js` | Agronomic alerts per crop from hourly weather |
| `js/regions.js` | "Regions" tab: summaries by region, crop and period; Monteith vs ISTAT |
| `js/tools.js` | Draw/upload fields and maps, export area, "my fields", lawn tool, welcome |
| `js/account.js` | Supabase accounts, saved fields, export and deletion |
| `supabase/schema.sql` | Table `campi`, RLS policies, account deletion, shared view |
| `pipeline/00`–`02` | Crop Types: download from CDSE, Italy COG, upload to HF |
| `pipeline/03`–`05` | Crop areas per 1 km block, weather cells, regional balances → `data/riepiloghi.json` |
| `pipeline/06` | Copernicus actual ET per region and crop |
| `pipeline/07` | ISTAT yields per province → `data/rese.json` |
| `pipeline/10`, `12` | Province NDVI and Monteith yield model vs ISTAT |
| `pipeline/11` | Export Delineate Anything S to ONNX (AGPL-3.0) |
| `pipeline/13`, `14`, `18` | Crop classifier: dataset, training, browser weights |
| `pipeline/15` | Municipality index for search → `data/comuni.json` |
| `pipeline/16`, `17` | CLMS variables on Italy (COG) and date index |
| `pipeline/19` | SoilGrids soil maps for Italy (COG) |
| `pipeline/classi.py` | Crop Types classes and crop coefficients |
| `pipeline/hf_sync.py` | Sync working folders with the Hugging Face dataset |
| `.github/workflows/*.yml` | GitHub Actions that run the pipeline, collect contributions, test the site |
