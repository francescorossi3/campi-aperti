// Campi Aperti — dati in tempo reale e serie temporali per campo
// Real-time data and per-field time series
//
// Fonti (tutte gratuite, senza chiavi, lette dal browser):
//  - Sentinel-2 L2A e Sentinel-1 RTC (Copernicus) tramite Microsoft Planetary Computer (STAC + titiler)
//  - Confini dei campi 2025: Fields of The World (Taylor Geospatial, CC BY 4.0), PMTiles su Source Cooperative
//  - Meteo: ERA5 / ERA5-Land (Copernicus C3S) e previsioni, tramite Open-Meteo

const PC = "https://planetarycomputer.microsoft.com/api";

// Indici Sentinel-2. Le immagini L2A dal 2022 hanno un offset di +1000 sulla riflettanza:
// (a-1000)-(b-1000) = a-b ; (a-1000)+(b-1000) = a+b-2000
const S2_INDEX = {
  ndvi: "(B08-B04)/(B08+B04-2000)",
  ndre: "(B8A-B05)/(B8A+B05-2000)",
  ndmi: "(B8A-B11)/(B8A+B11-2000)",
  evi: "2.5*(B08-B04)/(B08+6*B04-7.5*B02+10500)",
  savi: "1.5*(B08-B04)/(B08+B04+3000)",
  cire: "(B07-1000)/(B05-1000)-1",
  ndwi: "(B03-B08)/(B03+B08-2000)",
  nbr: "(B08-B12)/(B08+B12-2000)",
  cloud: "((SCL==0)|(SCL==1)|(SCL==3)|(SCL==7)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==11))*1.0",
  aot: "AOT/1000",
};

// indici mostrati nella scheda campo: chiave, colore, asse (y = 0..1, y4 = scala libera), acceso di default
const INDEX_DEF = [
  ["ndvi", "#2f8f3a", "y", true], ["ndre", "#a3812c", "y", true], ["ndmi", "#2b6cb0", "y", true],
  ["evi", "#5aa02c", "y", false], ["savi", "#8bbf3f", "y", false], ["ndwi", "#1fa3c4", "y", false],
  ["nbr", "#7a4b2a", "y", false], ["cire", "#c0392b", "y4", false], ["lai", "#145a32", "y4", false], ["kc", "#6c3483", "y", false],
];

const LT = {
  it: {
    p_week: "Settimana", p_month: "Mese", p_3m: "3 mesi", p_6m: "6 mesi", p_year: "Anno",
    live_note: "Settimana: immagine più recente. Periodi più lunghi: mediana di tutte le immagini con poche nuvole (toglie nuvole residue). Visibile da zoom 10.",
    seg_btn: "Dividi in campi la zona visibile",
    seg_hint: "Usa 8 immagini Sentinel-2 serene degli ultimi 12 mesi: pixel vicini con la stessa curva di crescita formano un campo. Ingrandisci almeno a zoom 14.",
    seg_zoom: "Ingrandisci almeno a zoom 14 e riprova.",
    seg_prog: "Scarico le immagini: {n}/{t}…",
    seg_done: "{n} campi individuati da {d} date ({a} → {b}). Clicca su un campo.",
    crop: "Coltura stimata",
    cty_title: "Coltura ufficiale Copernicus (HRL Crop Types)",
    cty_loading: "Leggo la coltura Copernicus 2017–2024…",
    cty_none: "Nessuna coltura Copernicus registrata qui (2017–2024).",
    cty_dubbio: "Probabile errore di classificazione",
    y_title: "Resa media ISTAT in provincia di {p}:",
    fy_title: "Resa stimata di questo campo ({c}, {y})",
    fy_range: "intervallo plausibile",
    soil_title: "Suolo (0–30 cm)", soil_loading: "Carico i dati del suolo…", soil_slow: "Il servizio SoilGrids è lento, riprovo…", soil_err: "Dati del suolo non raggiungibili ora (SoilGrids).", soil_na: "Nessun dato di suolo qui.",
    soil_sand: "Sabbia", soil_silt: "Limo", soil_clay: "Argilla", soil_soc: "Carbonio organico", soil_n: "Azoto totale", soil_paw: "Acqua disponibile",
    soil_note: "ISRIC SoilGrids 2.0 (250 m, stima da modelli: indicativa, non sostituisce un'analisi del terreno). Acqua disponibile per le piante tra capacità di campo e punto di appassimento, dalla tessitura e dalla sostanza organica (Saxton & Rawls 2006).",
    fw_title: "Modello idrico FAO-33", fw_det: "(acqua disponibile nelle radici {taw} mm; consumo reale {r}% del potenziale; {s} giorni di stress; resa raggiungibile in provincia {ym} t/ha)",
    fw_irr: "Campo irrigato: nessuno stress idrico.",
    fm_title: "Mappa del campo a 10 m",
    ch_clms: "Copernicus 300 m", clms_var: "Variabile", clms_none: "Nessun dato Copernicus in questo intervallo (le mappe coprono gli ultimi 14 mesi).",
    clms_load: "Leggo {n}/{t} date…", clms_ok: "{n} date, media di circa {px} pixel Copernicus sul campo.", fm_lai: "LAI (indice di area fogliare)",
    dl_title: "Scarica:", dl_one: "mappa della data (GeoTIFF)", dl_all: "tutte le date (GeoTIFF multibanda)", dl_csv: "serie temporale media (CSV)",
    dl_prog: "Scarico {n}/{t} date…", dl_done: "File pronto: {n} date, valori a 10 m, EPSG:3857, nullo = −9999.", dl_noidx: "Scegli un indice (non colori reali o zone).",
    fl_title: "Campo selezionato: mappe a 10 m", fl_map: "Mappa", fl_date: "Data", fl_op: "Trasparenza", fl_hide: "Togli la mappa del campo",
    fl_soil: "Suolo:", fl_sg_clay: "argilla", fl_sg_sand: "sabbia", fl_sg_soc: "carbonio", fl_sg_nitrogen: "azoto", fl_sg_phh2o: "pH", fl_sg_cec: "CSC",
    fl_pheno: "Fenologia Copernicus:", fl_hv_sosd: "inizio stagione", fl_hv_eosd: "fine stagione", fl_hv_length: "durata", fl_hv_tprod: "produttività", fm_ndvi: "NDVI (vigore)", fm_ndre: "NDRE (clorofilla)", fm_ndmi: "NDMI (acqua nelle foglie)", fm_evi: "EVI",
    fm_savi: "SAVI", fm_rgb: "Colori reali", fm_zone: "Zone di vigore (bassa / media / alta)", fm_auto: "scala adattata al campo",
    fm_onmap: "Mostra / togli sulla mappa", fm_nodate: "nessuna data serena", fm_loading: "Carico la mappa…", fm_err: "Mappa non disponibile per questa data.",
    fm_stats: "{n} pixel da 10 m · media {m} · deviazione standard {sd} · variabilità {cv}%",
    fm_z1: "vigore basso", fm_z2: "medio", fm_z3: "alto",
    fy_cal: "tarata sulle rese ISTAT, fattore {f}",
    fy_vs: "media provinciale ISTAT {r} t/ha: questo campo {x}%",
    fy_none: "Resa del campo non stimabile per questa coltura o annata (serve un seminativo con stagione intera nell'intervallo scelto).",
    fy_note: "Modello a efficienza d'uso della radiazione (Monteith): radiazione solare ERA5 × frazione assorbita dalla coltura (dall'NDVI del campo) × efficienza e indice di raccolto tipici della coltura, su {d} giorni di stagione ({a} → {b}); coltura da {f}. Non è una misura: l'errore tipico è del 20–30%.",
    y_year: "Anno",
    y_species: "Frutteti in provincia di {p} (quota di superficie, indica la specie più probabile):",
    y_note: "Rese provinciali ISTAT (produzione raccolta / superficie in produzione); gli ultimi anni sono provvisori. Non è la resa di questo campo.",
    cty_perm_note: "Il campo è una coltura permanente ({c}) nella maggior parte degli anni: gli anni segnati sono probabili errori della mappa Copernicus (bordi, campi misti o pixel incerti).",
    cty_ann_note: "Gli anni segnati sono incoerenti con la rotazione (permanente isolato o meno del 50% dei pixel d'accordo): probabili errori.",
    seg_auto: "Divido in campi la zona attorno al punto (immagini Sentinel-2 degli ultimi 12 mesi)…",
    outliers: "date scartate (rumore)",
    ch_et: "Evapotraspirazione nel tempo",
    ch_yield: "Rese: ISTAT in provincia e stima del campo", yc_grown: "Resa ISTAT della coltura di quell'anno", yc_ref: "Serie ISTAT {c}", yc_monteith: "Campo: modello Monteith", yc_fao: "Campo: modello idrico FAO-33",
    et0d: "ET0 riferimento (mm/g)", etcd: "ET coltura FAO-56 con Kc da NDVI (mm/g)", etad: "ET reale Copernicus 300 m (mm/g)",
    etc_cum: "ET coltura cumulata", eta_cum: "ET reale cumulata",
    ch_cmp: "Confronta le forme delle curve (max 4)",
    cmp_norm: "normalizza 0–1",
    c_rain7: "Pioggia 7 giorni", c_tmean: "T media", c_et0: "ET0", c_etc: "ET coltura", c_eta: "ET reale Copernicus", c_ndvi: "NDVI",
    c_lai: "LAI", c_evi: "EVI", c_ndmi: "NDMI", c_ndre: "NDRE", c_kc: "Kc", c_vh: "Radar VH",
    crop_note: "Stima automatica dalla curva NDVI del campo (regole fenologiche), non verificata a terra.",
    crop_short: "Serie troppo corta per stimare la coltura: scegli un'annata intera.",
    et0: "ET0 di riferimento",
    etc: "ET coltura stimata",
    balance: "Pioggia − ET coltura",
    ndvi_mean: "NDVI medio",
    idx_ndvi: "NDVI", idx_ndre: "NDRE", idx_ndmi: "NDMI", idx_evi: "EVI", idx_savi: "SAVI", idx_ndwi: "NDWI (acqua)", idx_nbr: "NBR",
    idx_cire: "CIre (clorofilla)", idx_lai: "LAI stimato", idx_kc: "Kc (coeff. colturale)",
    et_note: "ET coltura = Kc × ET0 (FAO-56), con Kc ricavato dall'NDVI del campo (Kc = 1,457·NDVI − 0,173) e interpolato giorno per giorno. LAI stimato da EVI (LAI = 3,618·EVI − 0,118).",
    panel_title: "Campo",
    no_field: "Nessun campo rilevato qui: uso un quadrato di 40 m attorno al punto. Usa “Dividi in campi la zona visibile”.",
    field_seg: "Confine: segmentazione Sentinel-2 di questa zona (valori = media su tutto il campo)",
    field_ai: "Confine: modello Delineate Anything (YOLO) su Sentinel-2 (valori = media su tutto il campo)",
    field_user: "Confine disegnato da te (valori = media su tutto il campo)",
    field_src: "Confine: Fields of The World 2025 (valori = media su tutto il campo)",
    area: "Superficie",
    from_sm: "Da San Martino",
    from: "dal", to: "al", apply: "Applica",
    from_jan: "Dal 1° gennaio",
    last12: "Ultimi 12 mesi",
    radar: "Aggiungi radar Sentinel-1",
    csv: "Scarica CSV",
    close: "Chiudi",
    loading_s2: "Sentinel-2: {n}/{t} date analizzate…",
    loading_s1: "Sentinel-1: {n}/{t} passaggi…",
    loading_meteo: "Meteo in caricamento…",
    done: "{ok} immagini serene su {t} date ({c} scartate per nuvole).",
    err: "Errore nel caricamento: {e}",
    ch_index: "Indici di vegetazione (media del campo)",
    ch_meteo: "Pioggia e temperatura",
    ch_radar: "Radar Sentinel-1 (dB)",
    rain: "Pioggia (mm/giorno)",
    rain_cum: "Pioggia cumulata (mm)",
    tmean: "T media (°C)",
    tmin: "T min",
    tmax: "T max",
    forecast: "previsione",
    sum_rain: "Pioggia dal {d}",
    sum_gdd: "Gradi giorno (base 10 °C)",
    sum_last: "Ultimo NDVI",
    sum_max: "NDVI massimo",
    ndvi_d: "NDVI: vigore e biomassa",
    ndre_d: "NDRE: clorofilla e azoto",
    ndmi_d: "NDMI: acqua nelle foglie",
    radar_hint: "Il radar vede anche con le nuvole: VH sale con la biomassa, VV risponde a umidità e rugosità del suolo.",
    meteo_src: "Meteo: ERA5/ERA5-Land (Copernicus C3S) e previsioni a 7 giorni, via Open-Meteo.",
    s2_src: "Satellite: Sentinel-2 L2A (Copernicus) via Microsoft Planetary Computer. Scartate le date con più del 2% del campo coperto da nuvole, ombre, cirri, neve o pixel non classificati (SCL), quelle con foschia (AOT > 0,3) e i valori anomali isolati (filtro di Hampel); le curve sono smussate (media pesata ±20 giorni), i punti sono le singole date.",
  },
  en: {
    p_week: "Week", p_month: "Month", p_3m: "3 months", p_6m: "6 months", p_year: "Year",
    live_note: "Week: most recent image. Longer periods: median of all low-cloud images (removes residual clouds). Visible from zoom 10.",
    seg_btn: "Split the visible area into fields",
    seg_hint: "Uses 8 clear Sentinel-2 images from the last 12 months: neighbouring pixels with the same growth curve form a field. Zoom in to at least 14.",
    seg_zoom: "Zoom in to at least level 14 and try again.",
    seg_prog: "Downloading images: {n}/{t}…",
    seg_done: "{n} fields found from {d} dates ({a} → {b}). Click a field.",
    crop: "Estimated crop",
    cty_title: "Official Copernicus crop (HRL Crop Types)",
    cty_loading: "Reading the Copernicus crop 2017–2024…",
    cty_none: "No Copernicus crop recorded here (2017–2024).",
    cty_dubbio: "Likely classification error",
    y_title: "ISTAT average yield in the province of {p}:",
    fy_title: "Estimated yield of this field ({c}, {y})",
    fy_range: "plausible range",
    soil_title: "Soil (0–30 cm)", soil_loading: "Loading soil data…", soil_slow: "SoilGrids is slow, retrying…", soil_err: "Soil data not reachable right now (SoilGrids).", soil_na: "No soil data here.",
    soil_sand: "Sand", soil_silt: "Silt", soil_clay: "Clay", soil_soc: "Organic carbon", soil_n: "Total nitrogen", soil_paw: "Available water",
    soil_note: "ISRIC SoilGrids 2.0 (250 m, model-based estimate: indicative, not a substitute for a soil test). Plant-available water between field capacity and wilting point, from texture and organic matter (Saxton & Rawls 2006).",
    fw_title: "FAO-33 water model", fw_det: "(available water in the root zone {taw} mm; actual use {r}% of potential; {s} stress days; attainable yield in the province {ym} t/ha)",
    fw_irr: "Irrigated field: no water stress.",
    fm_title: "Field map at 10 m",
    ch_clms: "Copernicus 300 m", clms_var: "Variable", clms_none: "No Copernicus data in this interval (maps cover the last 14 months).",
    clms_load: "Reading {n}/{t} dates…", clms_ok: "{n} dates, mean of about {px} Copernicus pixels over the field.", fm_lai: "LAI (leaf area index)",
    dl_title: "Download:", dl_one: "map of the date (GeoTIFF)", dl_all: "all dates (multi-band GeoTIFF)", dl_csv: "mean time series (CSV)",
    dl_prog: "Downloading {n}/{t} dates…", dl_done: "File ready: {n} dates, 10 m values, EPSG:3857, no-data = −9999.", dl_noidx: "Choose an index (not true colour or zones).",
    fl_title: "Selected field: 10 m maps", fl_map: "Map", fl_date: "Date", fl_op: "Opacity", fl_hide: "Remove the field map",
    fl_soil: "Soil:", fl_sg_clay: "clay", fl_sg_sand: "sand", fl_sg_soc: "carbon", fl_sg_nitrogen: "nitrogen", fl_sg_phh2o: "pH", fl_sg_cec: "CEC",
    fl_pheno: "Copernicus phenology:", fl_hv_sosd: "season start", fl_hv_eosd: "season end", fl_hv_length: "length", fl_hv_tprod: "productivity", fm_ndvi: "NDVI (vigour)", fm_ndre: "NDRE (chlorophyll)", fm_ndmi: "NDMI (leaf water)", fm_evi: "EVI",
    fm_savi: "SAVI", fm_rgb: "True colour", fm_zone: "Vigour zones (low / medium / high)", fm_auto: "scale fitted to the field",
    fm_onmap: "Show / hide on the map", fm_nodate: "no clear date", fm_loading: "Loading the map…", fm_err: "Map not available for this date.",
    fm_stats: "{n} pixels of 10 m · mean {m} · standard deviation {sd} · variability {cv}%",
    fm_z1: "low vigour", fm_z2: "medium", fm_z3: "high",
    fy_cal: "calibrated on ISTAT yields, factor {f}",
    fy_vs: "ISTAT provincial mean {r} t/ha: this field {x}%",
    fy_none: "Field yield cannot be estimated for this crop or season (needs an arable crop with a full season in the chosen interval).",
    fy_note: "Radiation-use-efficiency model (Monteith): ERA5 solar radiation × fraction absorbed by the crop (from the field NDVI) × typical crop efficiency and harvest index, over {d} season days ({a} → {b}); crop from {f}. Not a measurement: typical error 20–30%.",
    y_year: "Year",
    y_species: "Orchards in the province of {p} (share of area, indicates the most likely species):",
    y_note: "ISTAT provincial yields (harvested production / area in production); latest years are provisional. Not the yield of this field.",
    cty_perm_note: "The field is a permanent crop ({c}) in most years: flagged years are likely errors in the Copernicus map (edges, mixed fields or uncertain pixels).",
    cty_ann_note: "Flagged years are inconsistent with the rotation (isolated permanent crop or less than 50% of pixels agreeing): likely errors.",
    seg_auto: "Splitting the area around the point into fields (Sentinel-2 images of the last 12 months)…",
    outliers: "discarded dates (noise)",
    ch_et: "Evapotranspiration over time",
    ch_yield: "Yields: ISTAT in the province and field estimate", yc_grown: "ISTAT yield of that year's crop", yc_ref: "ISTAT series {c}", yc_monteith: "Field: Monteith model", yc_fao: "Field: FAO-33 water model",
    et0d: "Reference ET0 (mm/d)", etcd: "FAO-56 crop ET with NDVI Kc (mm/d)", etad: "Copernicus actual ET 300 m (mm/d)",
    etc_cum: "Cumulative crop ET", eta_cum: "Cumulative actual ET",
    ch_cmp: "Compare curve shapes (max 4)",
    cmp_norm: "normalise 0–1",
    c_rain7: "7-day rain", c_tmean: "Mean T", c_et0: "ET0", c_etc: "Crop ET", c_eta: "Copernicus actual ET", c_ndvi: "NDVI",
    c_lai: "LAI", c_evi: "EVI", c_ndmi: "NDMI", c_ndre: "NDRE", c_kc: "Kc", c_vh: "Radar VH",
    crop_note: "Automatic estimate from the field's NDVI curve (phenological rules), not ground-verified.",
    crop_short: "Series too short to estimate the crop: choose a full year.",
    et0: "Reference ET0",
    etc: "Estimated crop ET",
    balance: "Rain − crop ET",
    ndvi_mean: "Mean NDVI",
    idx_ndvi: "NDVI", idx_ndre: "NDRE", idx_ndmi: "NDMI", idx_evi: "EVI", idx_savi: "SAVI", idx_ndwi: "NDWI (water)", idx_nbr: "NBR",
    idx_cire: "CIre (chlorophyll)", idx_lai: "Estimated LAI", idx_kc: "Kc (crop coefficient)",
    et_note: "Crop ET = Kc × ET0 (FAO-56), with Kc derived from the field NDVI (Kc = 1.457·NDVI − 0.173) and interpolated day by day. LAI estimated from EVI (LAI = 3.618·EVI − 0.118).",
    panel_title: "Field",
    no_field: "No field detected here: using a 40 m square around the point. Use “Split the visible area into fields”.",
    field_seg: "Boundary: Sentinel-2 segmentation of this area (values = mean over the whole field)",
    field_ai: "Boundary: Delineate Anything model (YOLO) on Sentinel-2 (values = mean over the whole field)",
    field_user: "Boundary drawn by you (values = mean over the whole field)",
    field_src: "Boundary: Fields of The World 2025 (values = mean over the whole field)",
    area: "Area",
    from_sm: "Since St Martin's Day",
    from: "from", to: "to", apply: "Apply",
    from_jan: "Since 1 January",
    last12: "Last 12 months",
    radar: "Add Sentinel-1 radar",
    csv: "Download CSV",
    close: "Close",
    loading_s2: "Sentinel-2: {n}/{t} dates analysed…",
    loading_s1: "Sentinel-1: {n}/{t} passes…",
    loading_meteo: "Loading weather…",
    done: "{ok} clear images out of {t} dates ({c} discarded for clouds).",
    err: "Loading error: {e}",
    ch_index: "Vegetation indices (field mean)",
    ch_meteo: "Rainfall and temperature",
    ch_radar: "Sentinel-1 radar (dB)",
    rain: "Rain (mm/day)",
    rain_cum: "Cumulative rain (mm)",
    tmean: "Mean T (°C)",
    tmin: "Min T",
    tmax: "Max T",
    forecast: "forecast",
    sum_rain: "Rain since {d}",
    sum_gdd: "Growing degree days (base 10 °C)",
    sum_last: "Latest NDVI",
    sum_max: "Max NDVI",
    ndvi_d: "NDVI: vigour and biomass",
    ndre_d: "NDRE: chlorophyll and nitrogen",
    ndmi_d: "NDMI: leaf water",
    radar_hint: "Radar sees through clouds: VH rises with biomass, VV responds to soil moisture and roughness.",
    meteo_src: "Weather: ERA5/ERA5-Land (Copernicus C3S) and 7-day forecast, via Open-Meteo.",
    s2_src: "Satellite: Sentinel-2 L2A (Copernicus) via Microsoft Planetary Computer. Dates with more than 2% of the field covered by clouds, shadows, cirrus, snow or unclassified pixels (SCL), haze (AOT > 0.3) and isolated outliers (Hampel filter) are discarded; curves are smoothed (±20-day weighted mean), dots are single dates.",
  },
};
const lt = (k, vars) => {
  let s = (LT[LANG] && LT[LANG][k]) || LT.it[k] || k;
  if (vars) Object.entries(vars).forEach(([a, b]) => (s = s.replace("{" + a + "}", b)));
  return s;
};

const Live = (() => {
  // ================================================================== mappe Sentinel-2 per periodo
  // periodo: settimana, mese, 3 mesi, 6 mesi, anno; la data "anchor" è la fine del periodo
  let ptype = "month";
  let anchor = new Date();
  let searchId = null, searchPromise = null;
  const liveLayers = new Set();
  const PTYPES = ["week", "month", "3m", "6m", "year"];

  function periodRange() {
    const a = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
    let start, end;
    if (ptype === "week") { end = new Date(a.getTime() + 86399999); start = new Date(a.getTime() - 6 * 86400000); }
    else {
      const months = { month: 1, "3m": 3, "6m": 6, year: 12 }[ptype];
      end = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0, 23, 59, 59));
      start = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - months + 1, 1));
    }
    const now = new Date();
    if (end > now) end = now;
    return { start, end, pixel: ptype === "week" ? "first" : "median", cloudMax: ptype === "week" ? 60 : 35 };
  }
  function shiftPeriod(dir) {
    const a = anchor;
    if (ptype === "week") anchor = new Date(a.getTime() + dir * 7 * 86400000);
    else {
      const m = { month: 1, "3m": 3, "6m": 6, year: 12 }[ptype];
      anchor = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + dir * m + 1, 0));
    }
    if (anchor > new Date()) anchor = new Date();
    applyPeriod();
  }
  function periodLabel() {
    const { start, end } = periodRange();
    const f = (d, y) => d.toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}) });
    return `${f(start, start.getUTCFullYear() !== end.getUTCFullYear())} – ${f(end, true)}`;
  }

  function registerMosaic() {
    const { start, end, cloudMax } = periodRange();
    const body = {
      collections: ["sentinel-2-l2a"],
      "filter-lang": "cql2-json",
      filter: { op: "and", args: [
        { op: "<=", args: [{ property: "eo:cloud_cover" }, cloudMax] },
        { op: "anyinteracts", args: [{ property: "datetime" }, { interval: [start.toISOString(), end.toISOString()] }] },
      ] },
      sortby: [{ field: "datetime", direction: "desc" }],
    };
    searchPromise = fetch(`${PC}/data/v1/mosaic/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json()).then((j) => (searchId = j.searchid || j.id));
    return searchPromise;
  }

  function s2Url(def) {
    const { pixel } = periodRange();
    let q = `collection=sentinel-2-l2a&nodata=0&pixel_selection=${pixel}`;
    if (def.expr) q += `&expression=${encodeURIComponent(def.expr)}&asset_as_band=true&rescale=${def.rescale}&colormap_name=${def.colormap}`;
    else q += def.render;
    return `${PC}/data/v1/mosaic/${searchId}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?${q}`;
  }

  function makeS2Layer(def) {
    const layer = L.tileLayer("", { minZoom: def.minZoom || 10, maxZoom: 19, maxNativeZoom: 16, opacity: def.opacity ?? 1, zIndex: 20,
      attribution: "Sentinel-2 © Copernicus, via Microsoft Planetary Computer" });
    liveLayers.add({ def, layer });
    (searchId ? Promise.resolve() : (searchPromise || registerMosaic())).then(() => layer.setUrl(s2Url(def)));
    return layer;
  }

  function applyPeriod() {
    searchId = null;
    const lab = document.getElementById("periodLabel");
    if (lab) lab.textContent = periodLabel();
    const di = document.getElementById("periodDate");
    if (di) di.value = anchor.toISOString().slice(0, 10);
    registerMosaic().then(() => liveLayers.forEach(({ def, layer }) => layer.setUrl(s2Url(def))));
  }

  function windowControl() {
    return `<div class="period">
      <div class="period-types">${PTYPES.map((p) => `<button class="seg ${p === ptype ? "active" : ""}" data-p="${p}">${lt("p_" + p)}</button>`).join("")}</div>
      <div class="period-nav"><button class="small-btn" id="periodPrev">◀</button>
        <span id="periodLabel">${periodLabel()}</span>
        <button class="small-btn" id="periodNext">▶</button>
        <input type="date" id="periodDate" value="${anchor.toISOString().slice(0, 10)}" min="2017-04-01" max="${new Date().toISOString().slice(0, 10)}"></div>
      <p class="hint small">${lt("live_note")}</p></div>`;
  }
  function bindWindowControl() {
    document.querySelectorAll(".period-types .seg").forEach((b) => (b.onclick = () => {
      ptype = b.dataset.p;
      document.querySelectorAll(".period-types .seg").forEach((x) => x.classList.toggle("active", x === b));
      applyPeriod();
    }));
    const pv = document.getElementById("periodPrev"), nx = document.getElementById("periodNext"), di = document.getElementById("periodDate");
    if (pv) pv.onclick = () => shiftPeriod(-1);
    if (nx) nx.onclick = () => shiftPeriod(1);
    if (di) di.onchange = () => { if (di.value) { anchor = new Date(di.value + "T12:00:00Z"); applyPeriod(); } };
    const sb = document.getElementById("segBtn");
    if (sb) sb.onclick = runSegmentation;
  }

  // ================================================================== divisione in campi della zona visibile
  function segControl() {
    return `<div class="seg-box"><button id="segBtn" class="primary-btn">${lt("seg_btn")}</button>
      <p class="hint small" id="segMsg">${lt("seg_hint")}</p></div>`;
  }
  async function runSegmentation() {
    const msg = document.getElementById("segMsg");
    if (map.getZoom() < 14) { if (msg) msg.textContent = lt("seg_zoom"); return; }
    const b = map.getBounds();
    const bounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const btn = document.getElementById("segBtn");
    if (btn) btn.disabled = true;
    try {
      const r = await Segment.smart(bounds, periodRange().end, (n, t) => msg && (msg.textContent = lt("seg_prog", { n, t })));
      if (msg) msg.textContent = lt("seg_done", { n: r.nSeg, d: r.dates.length, a: r.dates[0], b: r.dates[r.dates.length - 1] });
    } catch (e) { if (msg) msg.textContent = lt("err", { e: e.message }); }
    if (btn) btn.disabled = false;
  }

  // ================================================================== confini dei campi (PMTiles)
  // punto nel poligono (anelli in coordinate qualsiasi)
  function inRing(pt, r) {
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inPoly = (pt, poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h));

  function squareAround(ll, half = 20) {
    const dLat = half / 111320, dLon = half / (111320 * Math.cos((ll.lat * Math.PI) / 180));
    return { type: "Feature", properties: { _square: true }, geometry: { type: "Polygon", coordinates: [[
      [ll.lng - dLon, ll.lat - dLat], [ll.lng + dLon, ll.lat - dLat], [ll.lng + dLon, ll.lat + dLat], [ll.lng - dLon, ll.lat + dLat], [ll.lng - dLon, ll.lat - dLat]]] } };
  }
  function areaHa(geom) {
    const R = 6378137, polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    let a = 0;
    polys.forEach((poly) => poly.forEach((ring, ri) => {
      let s = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [l1, p1] = ring[i], [l2, p2] = ring[i + 1];
        s += ((l2 - l1) * Math.PI / 180) * (2 + Math.sin(p1 * Math.PI / 180) + Math.sin(p2 * Math.PI / 180));
      }
      a += (ri === 0 ? 1 : -1) * Math.abs((s * R * R) / 2);
    }));
    return a / 10000;
  }
  function bboxOf(geom) {
    let w = 180, s = 90, e = -180, n = -90;
    JSON.stringify(geom.coordinates).match(/-?\d+\.?\d*,-?\d+\.?\d*/g).forEach((p) => {
      const [x, y] = p.split(",").map(Number); w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    });
    return [w, s, e, n];
  }

  // ================================================================== coltura ufficiale Copernicus (HRL Crop Types) per anno
  const CTY_ANNI = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const CTY_URL = (y) => `https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/crop_types/cty_${y}_italia_3035.tif`;
  const CTY_NOMI = { 1: ["Frumento", "Wheat"], 2: ["Orzo", "Barley"], 3: ["Mais", "Maize"], 4: ["Riso", "Rice"], 5: ["Altri cereali", "Other cereals"],
    6: ["Ortaggi", "Vegetables"], 7: ["Legumi secchi", "Dry pulses"], 8: ["Patate", "Potatoes"], 9: ["Barbabietola", "Sugar beet"], 10: ["Girasole", "Sunflower"],
    11: ["Soia", "Soybeans"], 12: ["Colza", "Rapeseed"], 13: ["Lino/cotone/canapa", "Flax/cotton/hemp"], 14: ["Vite", "Grapes"], 15: ["Olivo", "Olives"],
    16: ["Frutta", "Fruits"], 17: ["Frutta a guscio", "Nuts"], 18: ["Seminativo n.c.", "Unclassified annual"], 19: ["Permanente n.c.", "Unclassified permanent"], 0: ["Non agricolo", "No cropland"] };
  if (window.proj4) proj4.defs("EPSG:3035", "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs");
  const tiffCache = {};
  async function cropOfYear(y, rings3035, bb) {
    if (!tiffCache[y]) tiffCache[y] = GeoTIFF.fromUrl(CTY_URL(y), { allowFullFile: false }).then((t) => t.getImage());
    const img = await tiffCache[y];
    const [ox, oy] = img.getOrigin(), [rx, ry] = img.getResolution();
    const x0 = Math.floor((bb[0] - ox) / rx), x1 = Math.ceil((bb[2] - ox) / rx);
    const y0 = Math.floor((bb[3] - oy) / ry), y1 = Math.ceil((bb[1] - oy) / ry);
    if (x1 - x0 > 800 || y1 - y0 > 800 || x1 <= x0 || y1 <= y0) return null;
    const [band] = await img.readRasters({ window: [x0, y0, x1, y1], samples: [0] });
    const W = x1 - x0, cnt = {};
    let n = 0;
    for (let r = 0; r < y1 - y0; r++) for (let c = 0; c < W; c++) {
      const px = ox + (x0 + c + 0.5) * rx, py = oy + (y0 + r + 0.5) * ry;
      if (!rings3035.some((poly) => inPoly([px, py], poly))) continue;
      const v = band[r * W + c];
      if (v === 255) continue;
      cnt[v] = (cnt[v] || 0) + 1; n++;
    }
    if (!n) return null;
    const [cls, k] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    return { year: y, cls: +cls, share: k / n };
  }
  async function cropHistory(feature) {
    if (!window.GeoTIFF || !window.proj4) return [];
    const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const rings = polys.map((poly) => poly.map((ring) => ring.map(([lo, la]) => proj4("EPSG:4326", "EPSG:3035", [lo, la]))));
    const all = rings.flat(2);
    const bb = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
    const res = await Promise.all(CTY_ANNI.map((y) => cropOfYear(y, rings, bb).catch(() => null)));
    return res.filter(Boolean);
  }
  async function showCropHistory(my) {
    const el = document.getElementById("fpCty");
    if (!el) return;
    el.innerHTML = `<span class="hint small">${lt("cty_loading")}</span>`;
    const h = await cropHistory(current.feature);
    if (my !== runId) return;
    // coerenza: le colture permanenti (vite, olivo, frutta, frutta a guscio) non cambiano da un anno all'altro.
    // Se la maggioranza degli anni dice "permanente X", gli anni con una coltura annuale sono probabili errori,
    // e viceversa un permanente isolato in mezzo ad anni di seminativi è un errore.
    const PERM = new Set([14, 15, 16, 17, 19]);
    const permYears = h.filter((r) => PERM.has(r.cls));
    const votes = {}; permYears.forEach((r) => (votes[r.cls] = (votes[r.cls] || 0) + 1));
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    const isPerm = top && +top[1] >= Math.ceil(h.length / 2);
    h.forEach((r) => {
      r.dubbio = isPerm ? r.cls !== +top[0] : PERM.has(r.cls);
      if (r.share < 0.5) r.dubbio = true;
    });
    current.cty = h;
    current.ctyPerm = isPerm ? +top[0] : null;
    el.innerHTML = h.length ? `<b>${lt("cty_title")}:</b> ` + h.slice().reverse().map((r) =>
      `<span class="cty-chip cty${r.cls} ${r.dubbio ? "dubbio" : ""}" title="${r.dubbio ? lt("cty_dubbio") : ""}">${r.year} ${CTY_NOMI[r.cls] ? CTY_NOMI[r.cls][LANG === "it" ? 0 : 1] : r.cls} <small>${Math.round(r.share * 100)}%</small>${r.dubbio ? " ⚠" : ""}</span>`).join(" ") +
      (h.some((r) => r.dubbio) ? `<div class="hint small">⚠ ${isPerm ? lt("cty_perm_note").replace("{c}", CTY_NOMI[top[0]][LANG === "it" ? 0 : 1]) : lt("cty_ann_note")}</div>` : "")
      : `<span class="hint small">${lt("cty_none")}</span>`;
  }

  // ================================================================== rese ISTAT della provincia del campo
  let RESE = null, PROV = null;
  async function loadRese() {
    if (!RESE) RESE = Promise.all([fetch("data/rese.json?d=" + new Date().toISOString().slice(0, 13)).then((r) => r.json()), fetch("data/province.json?d=" + new Date().toISOString().slice(0, 10)).then((r) => r.json())])
      .then(([r, p]) => { PROV = p; return r; }).catch(() => null);
    return RESE;
  }
  function provinceAt(ll) {
    for (const f of PROV.features) {
      const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      if (polys.some((poly) => inRing([ll.lng, ll.lat], poly[0]) && !poly.slice(1).some((h) => inRing([ll.lng, ll.lat], h)))) return f.properties;
    }
    return null;
  }
  // resa media (pesata sulla superficie) delle colture ISTAT che corrispondono a una classe Copernicus
  function resaClasse(R, nuts, cls, anno) {
    const codici = Object.entries(R.colture).filter(([, v]) => v.cty === cls).map(([k]) => k);
    const rr = R.rows.filter((r) => r[0] === nuts && codici.includes(r[1]) && r[2] === anno);
    const ha = rr.reduce((a, r) => a + r[3], 0), t = rr.reduce((a, r) => a + r[4], 0);
    return ha ? { resa: t / ha, ha, dettaglio: rr.map((r) => ({ c: r[1], ha: r[3], resa: r[5] })).sort((a, b) => b.ha - a.ha) } : null;
  }
  // ---- resa stimata del campo: modello a efficienza d'uso della radiazione (Monteith)
  // biomassa = Σ RUE × fAPAR × PAR ; resa = biomassa × indice di raccolto / (1 − umidità commerciale)
  // fAPAR = 1,24·NDVI − 0,168 (Myneni & Williams 1994); PAR = 0,48 × radiazione globale (ERA5)
  // RUE (g di sostanza secca per MJ di PAR assorbita) e indice di raccolto: valori tipici di letteratura.
  const RESA_PAR = {
    1: { rue: 2.8, hi: 0.45, u: 0.13, n: ["frumento", "wheat"] }, 2: { rue: 2.7, hi: 0.45, u: 0.13, n: ["orzo", "barley"] },
    3: { rue: 3.8, hi: 0.50, u: 0.155, n: ["mais", "maize"] }, 4: { rue: 2.6, hi: 0.45, u: 0.14, n: ["riso", "rice"] },
    5: { rue: 2.6, hi: 0.40, u: 0.13, n: ["altri cereali", "other cereals"] }, 7: { rue: 2.0, hi: 0.35, u: 0.13, n: ["legumi", "pulses"] },
    8: { rue: 2.8, hi: 0.75, u: 0.78, n: ["patate (tuberi freschi)", "potatoes (fresh tubers)"] },
    9: { rue: 3.2, hi: 0.65, u: 0.77, n: ["barbabietola (radici fresche)", "sugar beet (fresh roots)"] },
    10: { rue: 2.4, hi: 0.33, u: 0.09, n: ["girasole", "sunflower"] }, 11: { rue: 2.0, hi: 0.40, u: 0.13, n: ["soia", "soybean"] },
    12: { rue: 2.3, hi: 0.30, u: 0.09, n: ["colza", "rapeseed"] },
  };
  function fieldYield(cls) {
    const P = RESA_PAR[cls];
    const sm = smooth("ndvi");
    const met = (current.meteo || []).filter((r) => !r.fc && r.rad != null);
    if (!P || sm.length < 10 || met.length < 60) return null;
    // stagione della coltura: tratto continuo attorno al picco con NDVI smussato > 0,3
    let ip = 0; sm.forEach((p, i) => { if (p.y > sm[ip].y) ip = i; });
    if (sm[ip].y < 0.45) return null;
    let a = ip, b = ip;
    while (a > 0 && sm[a - 1].y > 0.3) a--;
    while (b < sm.length - 1 && sm[b + 1].y > 0.3) b++;
    const t0 = sm[a].x, t1 = sm[b].x;
    const ndviAt = (t) => { let j = 0; while (j < sm.length - 1 && sm[j + 1].x < t) j++; const p = sm[j], q = sm[Math.min(j + 1, sm.length - 1)];
      return q.x > p.x ? p.y + ((t - p.x) / (q.x - p.x)) * (q.y - p.y) : p.y; };
    let bio = 0, giorni = 0;
    met.forEach((r) => { if (r.t >= t0 && r.t <= t1) { const fapar = Math.min(0.95, Math.max(0, 1.24 * ndviAt(r.t) - 0.168)); bio += P.rue * fapar * 0.48 * r.rad; giorni++; } });
    if (giorni < 40) return null;
    const resa = (bio * P.hi) / 100 / (1 - P.u);          // g/m² -> t/ha, a umidità commerciale
    return { resa, giorni, t0, t1, nome: P.n[LANG === "it" ? 0 : 1], bio: bio / 100 };
  }
  // classe della coltura per l'annata mostrata: Copernicus se esiste per quell'anno, altrimenti stima fenologica
  function classeAnnata() {
    const y = endDate(range).getUTCFullYear();
    const c = (current.cty || []).find((r) => r.year === y && !r.dubbio);
    if (c) return { cls: c.cls, fonte: "Copernicus", anno: y };
    const lab = current.crop && current.crop.label ? current.crop.label.toLowerCase() : "";
    const map = [[/frumento|wheat|cereale autunno|winter cereal/, 1], [/mais|maize/, 3], [/riso|rice/, 4], [/girasole|sunflower|soia|soy|estiva|summer/, 10]];
    const m = map.find(([re]) => re.test(lab));
    return m ? { cls: m[1], fonte: LANG === "it" ? "stima fenologica" : "phenology estimate", anno: y } : null;
  }
  // ---- suolo (ISRIC SoilGrids 250 m) e acqua disponibile per le piante (Saxton & Rawls 2006)
  async function loadSoil(my) {
    const el = document.getElementById("fpSoil");
    if (!el) return;
    el.innerHTML = `<span class="hint small">${lt("soil_loading")}</span>`;
    const ll = current.ll, props = ["clay", "sand", "silt", "soc", "nitrogen", "phh2o", "cec", "bdod"];
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${ll.lng.toFixed(5)}&lat=${ll.lat.toFixed(5)}&` +
      props.map((p) => "property=" + p).join("&") + "&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean";
    let j;
    for (let k = 0; k < 2 && !j; k++) {
      try { j = await fetch(url, { signal: AbortSignal.timeout(45000) }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }); }
      catch (e) { if (my !== runId) return; if (k === 0) { el.innerHTML = `<span class="hint small">${lt("soil_slow")}</span>`; await new Promise((ok) => setTimeout(ok, 4000)); } }
    }
    if (!j) { if (my === runId) el.innerHTML = `<span class="hint small">${lt("soil_err")}</span>`; return; }
    if (my !== runId) return;
    const W = { "0-5cm": 5, "5-15cm": 10, "15-30cm": 15 }, v = {};
    (j.properties.layers || []).forEach((L_) => {
      let sw = 0, sv = 0;
      L_.depths.forEach((d) => { const x = d.values.mean; if (x != null) { sw += W[d.label] || 0; sv += (W[d.label] || 0) * x; } });
      if (sw) v[L_.name] = sv / sw / (L_.unit_measure.d_factor || 1);
    });
    if (v.clay == null || v.sand == null) { el.innerHTML = `<span class="hint small">${lt("soil_na")}</span>`; return; }
    // unità dopo d_factor: clay/sand/silt %, soc g/kg, nitrogen g/kg, ph, cec cmol/kg, bdod kg/dm³
    const S = v.sand, C = v.clay, Si = v.silt != null ? v.silt : 100 - S - C;   // già in % dopo il d_factor
    const OM = (v.soc / 10) * 1.724;                         // sostanza organica % (Van Bemmelen)
    const s_ = S / 100, c_ = C / 100;
    const t15t = -0.024 * s_ + 0.487 * c_ + 0.006 * OM + 0.005 * s_ * OM - 0.013 * c_ * OM + 0.068 * s_ * c_ + 0.031;
    const t15 = t15t + (0.14 * t15t - 0.02);
    const t33t = -0.251 * s_ + 0.195 * c_ + 0.011 * OM + 0.006 * s_ * OM - 0.027 * c_ * OM + 0.452 * s_ * c_ + 0.299;
    const t33 = t33t + (1.283 * t33t * t33t - 0.374 * t33t - 0.015);
    const paw = Math.max(0.03, t33 - t15);                   // m³/m³
    current.soil = { sand: S, clay: C, silt: Si, soc: v.soc, n: v.nitrogen, ph: v.phh2o, cec: v.cec, bd: v.bdod, om: OM, fc: t33, wp: t15, paw, tex: usdaTexture(S, Si, C) };
    const cn = v.soc && v.nitrogen ? v.soc / v.nitrogen : null;
    el.innerHTML = `<b>${lt("soil_title")}</b> <span class="soil-tex">${current.soil.tex}</span>
      <div class="soil-grid">
        <span>${lt("soil_sand")} <b>${S.toFixed(0)}%</b></span><span>${lt("soil_silt")} <b>${Si.toFixed(0)}%</b></span><span>${lt("soil_clay")} <b>${C.toFixed(0)}%</b></span>
        <span>${lt("soil_soc")} <b>${v.soc.toFixed(1)} g/kg</b></span><span>${lt("soil_n")} <b>${v.nitrogen != null ? v.nitrogen.toFixed(2) + " g/kg" : "—"}</b></span>
        <span>C/N <b>${cn ? cn.toFixed(1) : "—"}</b></span><span>pH <b>${v.phh2o != null ? v.phh2o.toFixed(1) : "—"}</b></span>
        <span>CSC <b>${v.cec != null ? v.cec.toFixed(0) + " cmol/kg" : "—"}</b></span>
        <span>${lt("soil_paw")} <b>${Math.round(paw * 1000)} mm/m</b></span>
      </div>
      <div class="hint small">${lt("soil_note")}</div>`;
    drawFieldYield();
  }
  function usdaTexture(S, Si, C) {
    const it = LANG === "it";
    const n = (a, b) => (it ? a : b);
    if (Si + 1.5 * C < 15) return n("sabbioso", "sand");
    if (Si + 1.5 * C >= 15 && Si + 2 * C < 30) return n("sabbioso-franco", "loamy sand");
    if ((C >= 7 && C < 20 && S > 52 && Si + 2 * C >= 30) || (C < 7 && Si < 50 && Si + 2 * C >= 30)) return n("franco-sabbioso", "sandy loam");
    if (C >= 7 && C < 27 && Si >= 28 && Si < 50 && S <= 52) return n("franco", "loam");
    if ((Si >= 50 && C >= 12 && C < 27) || (Si >= 50 && Si < 80 && C < 12)) return n("franco-limoso", "silt loam");
    if (Si >= 80 && C < 12) return n("limoso", "silt");
    if (C >= 20 && C < 35 && Si < 28 && S > 45) return n("franco-sabbioso-argilloso", "sandy clay loam");
    if (C >= 27 && C < 40 && S > 20 && S <= 45) return n("franco-argilloso", "clay loam");
    if (C >= 27 && C < 40 && S <= 20) return n("franco-limoso-argilloso", "silty clay loam");
    if (C >= 35 && S > 45) return n("argilloso-sabbioso", "sandy clay");
    if (C >= 40 && Si >= 40) return n("argilloso-limoso", "silty clay");
    return n("argilloso", "clay");
  }
  // ---- secondo modello di resa: bilancio idrico del suolo (FAO-56) + risposta della resa all'acqua (FAO-33, Doorenbos & Kassam)
  // TAW = acqua disponibile (dalla tessitura) × profondità delle radici; Ks = stress idrico; ETa = Ks × Kc(NDVI) × ET0
  // Ya = Ym × [1 − Ky (1 − ΣETa/ΣETc)], Ym = resa raggiungibile in provincia (90° percentile delle rese ISTAT 2017–2026)
  const ACQUA = { 1: [1.2, 1.05, 0.55], 2: [1.1, 1.0, 0.55], 3: [1.2, 1.25, 0.55], 5: [1.1, 1.0, 0.55], 7: [0.8, 1.15, 0.45],
    8: [0.5, 1.1, 0.35], 9: [1.0, 1.0, 0.55], 10: [1.5, 0.95, 0.45], 11: [1.0, 0.85, 0.5], 12: [1.0, 1.0, 0.6] };   // radici m, Ky, p
  function waterYield(cls, y) {
    const A = ACQUA[cls], so = current.soil;
    if (!A || !so || !y || !RESE_DATA || !PROV) return null;
    const pv = provinceAt(current.ll);
    if (!pv || !pv.nuts) return null;
    const anni = []; for (let a = 2017; a <= 2026; a++) { const r = resaClasse(RESE_DATA, pv.nuts, cls, a); if (r) anni.push(r.resa); }
    if (anni.length < 3) return null;
    anni.sort((a, b) => a - b);
    const Ym = anni[Math.floor(0.9 * (anni.length - 1))];
    const sm = smooth("ndvi"), met = (current.meteo || []).filter((r) => !r.fc && r.et0 != null && r.t >= y.t0 && r.t <= y.t1);
    if (met.length < 40) return null;
    const ndviAt = (t) => { let j = 0; while (j < sm.length - 1 && sm[j + 1].x < t) j++; return sm[j].y; };
    const TAW = so.paw * A[0] * 1000, RAW = A[2] * TAW;
    const irrigato = current.feature.properties && /goccia|aspersione|scorrimento|pivot/.test(current.feature.properties.irrigazione || "");
    let Dr = 0, sEtc = 0, sEta = 0, stressDays = 0;
    met.forEach((r) => {
      const kc = Math.min(1.25, Math.max(0.15, 1.457 * ndviAt(r.t) - 0.1725)), etc = kc * r.et0;
      const pe = (r.rain || 0) > 2 ? 0.8 * r.rain : 0;
      const ks = irrigato || Dr <= RAW ? 1 : Math.max(0, (TAW - Dr) / (TAW - RAW));
      const eta = ks * etc;
      Dr = Math.min(TAW, Math.max(0, Dr - pe + eta));
      sEtc += etc; sEta += eta; if (ks < 0.8) stressDays++;
    });
    const rel = sEtc ? sEta / sEtc : 1;
    return { resa: Math.max(0, Ym * (1 - A[1] * (1 - rel))), Ym, rel, TAW, stressDays, irrigato };
  }

  function drawFieldYield() {
    const el = document.getElementById("fpFieldYield");
    if (!el) return;
    if (!taraturaChiesta && typeof Regions !== "undefined") {
      taraturaChiesta = true;
      Regions.taratura().then((t) => { if (t) { TARATURA = t; drawFieldYield(); } }).catch(() => {});
    }
    const ca = classeAnnata();
    const y = ca && fieldYield(ca.cls);
    if (!y) { el.innerHTML = ca ? `<span class="hint small">${lt("fy_none")}</span>` : ""; return; }
    let conf = "";
    if (RESE_DATA && PROV) {
      const pv = provinceAt(current.ll), ist = pv && pv.nuts && (resaClasse(RESE_DATA, pv.nuts, ca.cls, ca.anno) || resaClasse(RESE_DATA, pv.nuts, ca.cls, ca.anno - 1));
      if (ist) { const r = y.resa / ist.resa; conf = ` · ${lt("fy_vs").replace("{p}", pv.prov_name).replace("{r}", ist.resa.toFixed(1)).replace("{x}", (r >= 1 ? "+" : "") + Math.round((r - 1) * 100))}`; }
    }
    const T = TARATURA && TARATURA[ca.cls];
    if (T) { y.grezza = y.resa; y.resa *= T.fattore; }
    current.fieldYield = { ...y, classe: ca.cls };
    el.innerHTML = `<b>${lt("fy_title").replace("{c}", y.nome).replace("{y}", ca.anno)}:</b> <span class="big">${y.resa.toFixed(1)} t/ha</span>
      <small>(${lt("fy_range")} ${(y.resa * 0.7).toFixed(1)}–${(y.resa * 1.3).toFixed(1)}${T ? "; " + lt("fy_cal").replace("{f}", T.fattore.toFixed(2)) : ""})</small>${conf}
      ${(() => { const w = waterYield(ca.cls, y); if (w) current.fieldYield.acqua = w.resa; return w ? `<div class="fy-water"><b>${lt("fw_title")}:</b> <span class="big">${w.resa.toFixed(1)} t/ha</span>
        <small>${lt("fw_det").replace("{taw}", Math.round(w.TAW)).replace("{r}", Math.round(w.rel * 100)).replace("{s}", w.stressDays).replace("{ym}", w.Ym.toFixed(1))}${w.irrigato ? " " + lt("fw_irr") : ""}</small></div>` : ""; })()}
      <div class="hint small">${lt("fy_note").replace("{d}", y.giorni).replace("{a}", fmtDate(y.t0)).replace("{b}", fmtDate(y.t1)).replace("{f}", ca.fonte)}</div>`;
    if (current._yieldArgs) drawYieldChart(...current._yieldArgs);
  }
  let RESE_DATA = null, TARATURA = null, taraturaChiesta = false;

  // ---- grafico delle rese: ISTAT della coltura coltivata ogni anno (colore = coltura Copernicus), serie ISTAT della coltura
  // principale, e la resa stimata del campo con i due modelli
  function drawYieldChart(R, pv, ref) {
    const el = document.getElementById("chYield");
    if (!el || !R || !pv) return;
    const anni = [...new Set(R.rows.map((r) => r[2]))].sort();
    const per = Object.fromEntries((current.cty || []).filter((r) => !r.dubbio && r.cls > 0).map((r) => [r.year, r.cls]));
    const col = (c) => (typeof CROP_COLORS !== "undefined" && CROP_COLORS[c]) || "#7a9";
    const bars = anni.map((a) => { const c = per[a]; const y = c && resaClasse(R, pv.nuts, c, a); return y ? { y: y.resa, c } : null; });
    const sets = [{ type: "bar", label: lt("yc_grown"), data: bars.map((b) => (b ? b.y : null)), backgroundColor: bars.map((b) => (b ? col(b.c) + "cc" : "#0000")),
      nomi: bars.map((b) => (b ? CTY_NOMI[b.c][LANG === "it" ? 0 : 1] : "")) }];
    if (ref) sets.push({ type: "line", label: lt("yc_ref").replace("{c}", CTY_NOMI[ref][LANG === "it" ? 0 : 1]), data: anni.map((a) => { const y = resaClasse(R, pv.nuts, ref, a); return y ? y.resa : null; }),
      borderColor: "#555", borderDash: [5, 3], pointRadius: 2, spanGaps: true });
    const fy = current.fieldYield;
    if (fy) {
      const ai = anni.indexOf(new Date(fy.t1).getUTCFullYear());
      if (ai >= 0) {
        sets.push({ type: "scatter", label: lt("yc_monteith"), data: anni.map((a, i) => (i === ai ? fy.resa : null)), backgroundColor: "#2f8f3a", pointRadius: 7, pointStyle: "rectRot" });
        if (fy.acqua) sets.push({ type: "scatter", label: lt("yc_fao"), data: anni.map((a, i) => (i === ai ? fy.acqua : null)), backgroundColor: "#2b6cb0", pointRadius: 7, pointStyle: "triangle" });
      }
    }
    if (charts.chYield) { charts.chYield.destroy(); delete charts.chYield; }
    charts.chYield = new Chart(el, { data: { labels: anni, datasets: sets }, options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.nomi ? c.dataset.nomi[c.dataIndex] : c.dataset.label}: ${c.parsed.y?.toFixed(1)} t/ha` } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "t/ha" } } } } });
    const cap = document.getElementById("chYieldCap");
    if (cap) cap.textContent = lt("ch_yield") + " — " + pv.prov_name;
  }

  async function showYields(my) {
    const el = document.getElementById("fpYield");
    if (!el) return;
    const R = await loadRese();
    if (!R || my !== runId) return;
    if (!R.rows) R.rows = R.righe;
    RESE_DATA = R; drawFieldYield();
    const pv = provinceAt(current.ll);
    if (!pv || !pv.nuts) { el.innerHTML = ""; return; }
    const cname = (c) => (R.colture[c] ? R.colture[c][LANG] : c);
    // anni Copernicus + annata corrente stimata
    const h = (current.cty || []).filter((r) => !r.dubbio && r.cls > 0);
    const righe = h.map((r) => { const y = resaClasse(R, pv.nuts, r.cls, r.year); return y ? `<span class="cty-chip">${r.year} ${CTY_NOMI[r.cls][LANG === "it" ? 0 : 1]}: <b>${y.resa.toFixed(1)} t/ha</b></span>` : ""; }).join(" ");
    // coltura di riferimento: permanente dominante o ultima annata Copernicus
    const ref = current.ctyPerm || (h.length ? h[h.length - 1].cls : null);
    let serie = "", specie = "";
    if (ref) {
      const anni = [...new Set(R.rows.map((r) => r[2]))].sort();
      const vals = anni.map((a) => { const y = resaClasse(R, pv.nuts, ref, a); return y ? `<td>${y.resa.toFixed(1)}</td>` : "<td>—</td>"; });
      serie = `<table class="mini"><tr><th>${lt("y_year")}</th>${anni.map((a) => `<th>${a}</th>`).join("")}</tr><tr><td>${CTY_NOMI[ref][LANG === "it" ? 0 : 1]} t/ha</td>${vals.join("")}</tr></table>`;
      if ([14, 15, 16, 17].includes(ref)) {
        const last = anni[anni.length - 1], y = resaClasse(R, pv.nuts, ref, last) || resaClasse(R, pv.nuts, ref, last - 1);
        if (y && y.dettaglio.length > 1) {
          const tot = y.dettaglio.reduce((a, d) => a + d.ha, 0);
          specie = `<div class="hint small"><b>${lt("y_species").replace("{p}", pv.prov_name)}</b> ` +
            y.dettaglio.slice(0, 6).map((d) => `${cname(d.c)} ${Math.round((100 * d.ha) / tot)}%`).join(" · ") + `</div>`;
        }
      }
    }
    el.innerHTML = specie ? `${specie}` : "";
    drawYieldChart(R, pv, ref);
    current._yieldArgs = [R, pv, ref];
  }

  // ================================================================== serie temporali
  let current = null; // { feature, ll, s2:[], s1:[], meteo:{}, range }
  let range = "sm";
  let year = null; // annata scelta (null = automatica)
  let customStart = null, customEnd = null; // intervallo libero scelto dall'utente
  let charts = {};
  let runId = 0;

  // Annata agraria: da San Martino (11 novembre) al 10 novembre dell'anno dopo.
  // Se l'annata in corso è iniziata da meno di 45 giorni, di default si mostra quella appena chiusa.
  function defaultYear(r) {
    const now = new Date(), y = now.getUTCFullYear();
    if (r === "jan") return now < new Date(Date.UTC(y, 1, 15)) ? y - 1 : y;
    const sm = new Date(Date.UTC(y, 10, 11));
    const cur = now >= sm ? y : y - 1;
    return (now - new Date(Date.UTC(cur, 10, 11))) / 86400000 < 45 ? cur - 1 : cur;
  }
  const selYear = () => year ?? defaultYear(range);
  function startDate(r) {
    const now = new Date();
    if (r === "custom" && customStart) return customStart;
    if (r === "12m") return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
    const Y = selYear();
    return r === "jan" ? new Date(Date.UTC(Y, 0, 1)) : new Date(Date.UTC(Y, 10, 11));
  }
  function endDate(r) {
    const now = new Date();
    if (r === "custom" && customEnd) return customEnd < now ? customEnd : now;
    if (r === "12m") return now;
    const Y = selYear();
    const e = r === "jan" ? new Date(Date.UTC(Y, 11, 31)) : new Date(Date.UTC(Y + 1, 10, 10));
    return e < now ? e : now;
  }
  const isCurrent = () => endDate(range) >= new Date(Date.now() - 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);

  async function pool(items, n, fn) {
    let i = 0;
    const workers = Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } });
    await Promise.all(workers);
  }

  async function stacSearch(collection, geom, start, end, extra = {}) {
    const bb = bboxOf(geom);
    let body = { collections: [collection], bbox: bb, datetime: `${start}T00:00:00Z/${end}T23:59:59Z`, limit: 500, ...extra };
    let url = `${PC}/stac/v1/search`, feats = [];
    for (let page = 0; page < 6 && url; page++) {
      const j = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      feats = feats.concat(j.features || []);
      const next = (j.links || []).find((l) => l.rel === "next");
      if (next && next.body) { url = next.href; body = next.body; } else url = null;
    }
    return feats;
  }

  async function itemStats(collection, item, feature, params) {
    const r = await fetch(`${PC}/data/v1/item/statistics?collection=${collection}&item=${encodeURIComponent(item)}&${params}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feature) });
    if (!r.ok) return null;
    const j = await r.json();
    return j.properties && j.properties.statistics;
  }

  async function loadS2(my) {
    const f = current.feature, start = iso(startDate(range)), end = iso(endDate(range));
    const items = await stacSearch("sentinel-2-l2a", f.geometry, start, end, { query: { "eo:cloud_cover": { lt: 85 } } });
    if (my !== runId) return;
    const byDate = {};
    items.forEach((it) => { const d = it.properties.datetime.slice(0, 10); (byDate[d] = byDate[d] || []).push(it); });
    const dates = Object.keys(byDate).sort();
    const keys = ["ndvi", "ndre", "ndmi", "evi", "savi", "cire", "ndwi", "nbr", "aot", "cloud"];
    const exprs = keys.map((k) => S2_INDEX[k]);
    const params = `expression=${encodeURIComponent(exprs.join(";"))}&asset_as_band=true`;
    let done = 0, cloudy = 0;
    current.s2 = [];
    await pool(dates, 6, async (d) => {
      const cands = byDate[d].sort((a, b) => a.properties["eo:cloud_cover"] - b.properties["eo:cloud_cover"]);
      for (const it of cands) {
        if (my !== runId) return;
        const st = await itemStats("sentinel-2-l2a", it.id, f, params).catch(() => null);
        if (!st) continue;
        const v = exprs.map((e) => st[e]);
        if (!v[0] || !v[0].count) continue;
        const cl = v[keys.length - 1].mean;
        // scarto: più del 2% del campo con nuvole/ombre/neve/pixel dubbi (SCL), oppure aerosol alto (AOT > 0,3: foschia)
        if (cl > 0.02 || v[keys.length - 2].mean > 0.3) { cloudy++; break; }
        const row = { date: d, t: Date.parse(d), ndvi_sd: v[0].std, cloud: cl, item: it.id, npx: v[0].count };
        keys.slice(0, -1).forEach((k, i) => (row[k] = v[i].mean));
        row.lai = Math.max(0, 3.618 * row.evi - 0.118);
        row.kc = Math.min(1.25, Math.max(0.15, 1.457 * row.ndvi - 0.1725));
        current.s2.push(row);
        break;
      }
      done++;
      if (my === runId) { setStatus(lt("loading_s2", { n: done, t: dates.length })); if (done % 6 === 0) drawIndex(); }
    });
    if (my !== runId) return;
    current.s2.sort((a, b) => a.t - b.t);
    const nOut = despike(current.s2);
    setStatus(lt("done", { ok: current.s2.length - nOut, t: dates.length, c: cloudy + nOut }));
    drawIndex(); drawSummary(); drawEt(); drawCompare();
  }

  // ---- rumore residuo: nuvole sottili e foschia abbassano l'NDVI per una sola data.
  // Filtro di Hampel (finestra ±25 giorni, 3 MAD) + caduta isolata rispetto a entrambe le date vicine.
  function despike(arr) {
    let n = 0;
    arr.forEach((r, i) => {
      const win = arr.filter((q, j) => j !== i && Math.abs(q.t - r.t) <= 25 * 86400000 && !q.outlier).map((q) => q.ndvi).sort((a, b) => a - b);
      let out = false;
      if (win.length >= 3) {
        const med = win[win.length >> 1];
        const mad = win.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[win.length >> 1] * 1.4826;
        if (Math.abs(r.ndvi - med) > Math.max(0.08, 3 * mad)) out = true;
      }
      const a = arr[i - 1], b = arr[i + 1];
      if (a && b && b.t - a.t < 30 * 86400000 && r.ndvi < Math.min(a.ndvi, b.ndvi) - 0.1 && Math.abs(a.ndvi - b.ndvi) < 0.12) out = true;
      r.outlier = out; if (out) n++;
    });
    return n;
  }
  const clean = () => (current.s2 || []).filter((r) => !r.outlier);
  // curva smussata: media pesata (tricubica) delle date valide entro ±20 giorni, ogni 3 giorni
  function smooth(key, data = clean()) {
    if (data.length < 3) return [];
    const out = [], H = 20 * 86400000, t0 = data[0].t, t1 = data[data.length - 1].t;
    for (let t = t0; t <= t1; t += 3 * 86400000) {
      let sw = 0, sv = 0;
      data.forEach((r) => { const d = Math.abs(r.t - t) / H; if (d < 1 && isFinite(r[key])) { const w = Math.pow(1 - d * d * d, 3); sw += w; sv += w * r[key]; } });
      if (sw > 0.2) out.push({ x: t, y: sv / sw });
    }
    return out;
  }

  async function loadS1() {
    const my = runId, f = current.feature, start = iso(startDate(range)), end = iso(endDate(range));
    const items = await stacSearch("sentinel-1-rtc", f.geometry, start, end);
    if (my !== runId) return;
    let done = 0;
    current.s1 = [];
    const db = (x) => 10 * Math.log10(x);
    await pool(items, 6, async (it) => {
      const st = await itemStats("sentinel-1-rtc", it.id, f, "assets=vv&assets=vh").catch(() => null);
      done++;
      if (st) {
        const vv = st.vv_b1 || st.vv, vh = st.vh_b1 || st.vh;
        if (vv && vh && vv.count && vv.mean > 0 && vh.mean > 0)
          current.s1.push({ date: it.properties.datetime.slice(0, 10), t: Date.parse(it.properties.datetime), vv: db(vv.mean), vh: db(vh.mean),
            orbit: it.properties["sat:orbit_state"] });
      }
      if (my === runId) setStatus(lt("loading_s1", { n: done, t: items.length }));
    });
    if (my !== runId) return;
    current.s1.sort((a, b) => a.t - b.t);
    setStatus("");
    drawRadar(); if (!cmpSel.has("vh")) cmpSel.add("vh"); drawCompare();
  }

  async function loadMeteo(my) {
    const ll = current.ll, start = startDate(range), end = endDate(range);
    const recent = new Date(Date.now() - 6 * 86400000);
    const archEnd = end < recent ? end : recent;
    const vars = "precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,shortwave_radiation_sum";
    const out = {};
    const add = (j, fc) => {
      if (!j || !j.daily) return;
      j.daily.time.forEach((d, i) => {
        if (out[d] && !fc) return;
        out[d] = { date: d, t: Date.parse(d), rain: j.daily.precipitation_sum[i], tmean: j.daily.temperature_2m_mean[i],
          tmax: j.daily.temperature_2m_max[i], tmin: j.daily.temperature_2m_min[i], et0: j.daily.et0_fao_evapotranspiration[i],
          rad: j.daily.shortwave_radiation_sum ? j.daily.shortwave_radiation_sum[i] : null, fc: false };
      });
    };
    const lat = ll.lat.toFixed(4), lon = ll.lng.toFixed(4);
    const [a, b] = await Promise.all([
      archEnd > start ? fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${iso(start)}&end_date=${iso(archEnd)}&daily=${vars}&timezone=Europe%2FRome`).then((r) => r.json()).catch(() => null) : null,
      isCurrent() ? fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_days=10&forecast_days=7&daily=${vars}&timezone=Europe%2FRome`).then((r) => r.json()).catch(() => null) : null,
    ]);
    if (my !== runId) return;
    add(a, false); add(b, true);
    const today = iso(new Date());
    Object.values(out).forEach((r) => (r.fc = r.date > today));
    current.meteo = Object.values(out).filter((r) => r.date >= iso(start) && (r.fc || r.date <= iso(end)) && r.tmean != null).sort((x, y) => x.t - y.t);
    drawMeteo(); drawSummary(); drawEt(); drawCompare();
  }

  // ================================================================== pannello e grafici
  const panel = () => document.getElementById("fieldPanel");
  function setStatus(s) { const el = document.getElementById("fpStatus"); if (el) el.textContent = s; }

  function renderPanel() {
    const f = current.feature;
    const ha = f.properties["metrics:area"] ? f.properties["metrics:area"] / 10000 : areaHa(f.geometry);
    panel().innerHTML = `
      <div class="fp-head">
        <div class="fp-title"><b>${lt("panel_title")}</b> · ${lt("area")} ${ha < 1 ? (ha * 10000).toFixed(0) + " m²" : ha.toFixed(2) + " ha"}
          <span class="fp-src">${f.properties._square ? lt("no_field") : current.userField ? lt("field_user") : f.properties._seg ? lt(Segment.method() === "ai" ? "field_ai" : "field_seg") : lt("field_src")}</span></div>
        <div class="fp-ctrl">
          ${["sm", "jan", "12m"].map((r) => `<button class="seg ${r === range ? "active" : ""}" data-r="${r}">${lt(r === "sm" ? "from_sm" : r === "jan" ? "from_jan" : "last12")}</button>`).join("")}
          ${range === "sm" || range === "jan" ? `<select id="fpYear" class="seg">${yearOptions()}</select>` : ""}
          <span class="fp-dates">${lt("from")} <input type="date" id="fpFrom" min="2016-01-01" max="${iso(new Date())}" value="${iso(startDate(range))}">
            ${lt("to")} <input type="date" id="fpTo" min="2016-01-01" max="${iso(new Date())}" value="${iso(endDate(range))}">
            <button class="seg ${range === "custom" ? "active" : ""}" id="fpApply">${lt("apply")}</button></span>
          <button id="fpCsv" class="small-btn">${lt("csv")}</button>
          <button id="fpClose" class="icon-x" title="${lt("close")}">×</button>
        </div>
      </div>
      <div id="fpStatus" class="fp-status"></div>
      <div class="ch-tabs">${CHARTS.map(([id, key]) => `<button class="seg ${id === chartSel ? "active" : ""}" data-ch="${id}">${lt(key)}</button>`).join("")}
        <button class="small-btn ch-dl" id="fpCsv2">⬇ ${lt("csv")}</button></div>
      <figure class="ch-fig" data-ch="chIndex"><div class="chips">${INDEX_DEF.map(([k, c]) => `<label class="chip"><input type="checkbox" data-k="${k}" ${shown.has(k) ? "checked" : ""}><i style="background:${c}"></i>${lt("idx_" + k)}</label>`).join("")}</div>
        <div class="cbox"><canvas id="chIndex"></canvas></div></figure>
      <figure class="ch-fig" data-ch="chMeteo"><div class="cbox"><canvas id="chMeteo"></canvas></div></figure>
      <figure class="ch-fig" data-ch="chEt"><div class="cbox"><canvas id="chEt"></canvas></div></figure>
      <figure class="ch-fig" data-ch="chYield"><figcaption id="chYieldCap"></figcaption><div class="cbox"><canvas id="chYield"></canvas></div></figure>
      <figure class="ch-fig" data-ch="chCmp"><label class="norm"><input type="checkbox" id="cmpNorm" ${cmpNorm ? "checked" : ""}> ${lt("cmp_norm")}</label>
        <div class="chips cmp-chips">${CMP.map(([k, c]) => `<label class="chip"><input type="checkbox" data-c="${k}" ${cmpSel.has(k) ? "checked" : ""}><i style="background:${c}"></i>${lt("c_" + k)}</label>`).join("")}</div>
        <div class="cbox"><canvas id="chCmp"></canvas></div></figure>
      <figure class="ch-fig" data-ch="chClms"><label class="norm">${lt("clms_var")} <select id="clmsVar">${Object.keys(Clms.P).filter((k) => k !== "ETA").map((k) => `<option value="${k}" ${k === clmsSel ? "selected" : ""}>${Clms.label(k)}</option>`).join("")}</select></label>
        <span class="hint small" id="clmsSt"></span><div class="cbox"><canvas id="chClms"></canvas></div></figure>
      <figure class="ch-fig" data-ch="chRadar"><div class="cbox"><canvas id="chRadar"></canvas></div><p class="hint small">${lt("radar_hint")}</p></figure>
      <div id="fpCty" class="fp-cty"></div>
      <div id="fpCrop" class="fp-crop"></div>
      <div id="fpFieldYield" class="fp-fieldyield"></div>
      <div id="fpSoil" class="fp-soil"></div>
      <div id="fpAdvice" class="fp-advice"></div>
      <div id="fpYield" class="fp-yield"></div>
      <p class="hint small fp-foot">${lt("s2_src")} ${lt("meteo_src")} ${lt("et_note")}</p>`;
    panel().hidden = false;
    document.body.classList.add("fp-open");
    setTimeout(() => map.invalidateSize(), 50);
    panel().querySelectorAll("button.seg").forEach((b) => (b.onclick = () => { range = b.dataset.r; year = null; run(); }));
    document.getElementById("fpApply").onclick = () => {
      const a = document.getElementById("fpFrom").value, b = document.getElementById("fpTo").value;
      if (!a || !b || a >= b) return;
      customStart = new Date(a + "T00:00:00Z"); customEnd = new Date(b + "T23:59:59Z"); range = "custom"; run();
    };
    const ys = document.getElementById("fpYear");
    if (ys) ys.onchange = () => { year = +ys.value; run(); };
    document.getElementById("fpClose").onclick = close;
    panel().querySelectorAll(".chips:not(.cmp-chips) .chip input").forEach((c) => (c.onchange = () => { c.checked ? shown.add(c.dataset.k) : shown.delete(c.dataset.k); drawIndex(); }));
    panel().querySelectorAll(".cmp-chips .chip input").forEach((c) => (c.onchange = () => {
      if (c.checked) { if (cmpSel.size >= 4) { c.checked = false; return; } cmpSel.add(c.dataset.c); } else cmpSel.delete(c.dataset.c);
      drawCompare(); }));
    document.getElementById("cmpNorm").onchange = (e) => { cmpNorm = e.target.checked; drawCompare(); };
    document.getElementById("fpCsv").onclick = exportCsv;
    document.getElementById("fpCsv2").onclick = exportCsv;
    document.getElementById("clmsVar").onchange = (e) => { clmsSel = e.target.value; drawClms(); };
    panel().querySelectorAll(".ch-tabs .seg").forEach((b) => (b.onclick = () => showChart(b.dataset.ch)));
    showChart(chartSel);
    Object.values(charts).forEach((c) => c.destroy());
    charts = {};
    s1Loaded = false;
    if (current) current.clms = {};
    buildFieldLayerBox();
    fmDatesKey = "";
  }

  // ================================================================== mappa del campo a 10 m
  // NDVI & co. pixel per pixel (10 m) dentro il confine del campo, per una data serena a scelta, con valori al passaggio del mouse
  // e "zone di vigore" (terzili dell'NDVI) utili per concimazioni o irrigazioni a rateo variabile.
  let fmDatesKey = "", fmLast = null, fmOverlay = null;
  const RAMP = [[165, 0, 38], [215, 48, 39], [244, 109, 67], [253, 174, 97], [254, 224, 139], [217, 239, 139], [166, 217, 106], [102, 189, 99], [26, 152, 80], [0, 104, 55]];
  const ramp = (u) => { u = Math.min(1, Math.max(0, u)) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(u)), f = u - i;
    return RAMP[i].map((c, k) => Math.round(c + f * (RAMP[i + 1][k] - c))); };
  const FIX = { lai: [0, 6], ndvi: [0, 0.9], ndre: [0, 0.6], ndmi: [-0.3, 0.5], evi: [0, 0.8], savi: [0, 0.7] };
  const ZONE_COL = [[214, 64, 50], [240, 200, 60], [40, 150, 70]];
  const mercX = (lon) => (lon * 20037508.34) / 180;
  const mercY = (lat) => Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 6378137;
  const lonOf = (x) => (x / 20037508.34) * 180;
  const latOf = (y) => (360 / Math.PI) * Math.atan(Math.exp(y / 6378137)) - 90;
  // riquadro "Campo selezionato" in cima alla scheda Layer: le mappe del campo si sovrappongono alla mappa grande
  function buildFieldLayerBox() {
    let box = document.getElementById("fieldLayerBox");
    if (!box) {
      box = document.createElement("section"); box.id = "fieldLayerBox"; box.className = "field-layer-box";
      const tab = document.getElementById("tab-layers"); tab.insertBefore(box, tab.firstChild);
    }
    const prev = { idx: (document.getElementById("fmIdx") || {}).value || "ndvi", op: (document.getElementById("fmOp") || {}).value || 0.9 };
    box.hidden = false;
    box.innerHTML = `<h3>${lt("fl_title")}</h3>
      <label class="fl-row">${lt("fl_map")} <select id="fmIdx">${["ndvi", "lai", "ndre", "ndmi", "evi", "savi", "rgb", "zone"].map((k) => `<option value="${k}" ${k === prev.idx ? "selected" : ""}>${lt("fm_" + k)}</option>`).join("")}</select></label>
      <label class="fl-row">${lt("fl_date")} <select id="fmDate"><option>…</option></select></label>
      <label class="fl-row small"><input type="checkbox" id="fmAuto" checked> ${lt("fm_auto")}</label>
      <label class="fl-row small">${lt("fl_op")} <input type="range" id="fmOp" min="0" max="1" step="0.05" value="${prev.op}"></label>
      <div class="fm-legend" id="fmLegend"></div>
      <div class="hint small" id="fmStats"></div>
      <div class="fl-dl"><b>${lt("dl_title")}</b> <button class="small-btn" id="dlOne">${lt("dl_one")}</button>
        <button class="small-btn" id="dlAll">${lt("dl_all")}</button> <button class="small-btn" id="dlCsv">${lt("dl_csv")}</button></div>
      <div class="fl-soil"><b>${lt("fl_soil")}</b> ${["sg_clay", "sg_sand", "sg_soc", "sg_nitrogen", "sg_phh2o", "sg_cec"].map((id) =>
        `<button class="seg fl-sg" data-id="${id}">${lt("fl_" + id)}</button>`).join("")}</div>
      <div class="fl-soil"><b>${lt("fl_pheno")}</b> ${["hv_sosd", "hv_eosd", "hv_length", "hv_tprod"].map((id) =>
        `<button class="seg fl-sg" data-id="${id}">${lt("fl_" + id)}</button>`).join("")}</div>
      <button class="small-btn" id="fmHide">${lt("fl_hide")}</button>`;
    ["fmIdx", "fmDate", "fmAuto"].forEach((id) => (document.getElementById(id).onchange = () => drawFieldMap()));
    document.getElementById("fmOp").oninput = (e) => fmOverlay && fmOverlay.setOpacity(+e.target.value);
    document.getElementById("dlOne").onclick = () => downloadMaps(false);
    document.getElementById("dlAll").onclick = () => downloadMaps(true);
    document.getElementById("dlCsv").onclick = exportCsv;
    document.getElementById("fmHide").onclick = () => { if (fmOverlay) { map.removeLayer(fmOverlay); fmOverlay = null; } };
    box.querySelectorAll(".fl-sg").forEach((b) => {
      const on = () => document.querySelector(`.layer[data-id="${b.dataset.id}"] input[type=checkbox]`);
      b.classList.toggle("active", !!(on() && on().checked));
      b.onclick = () => { const c = on(); if (!c) return; c.checked = !c.checked; c.dispatchEvent(new Event("change", { bubbles: true })); b.classList.toggle("active", c.checked); };
    });
    if (typeof showTab === "function") showTab("layers");
  }
  function fillFieldDates() {
    const sel = document.getElementById("fmDate");
    if (!sel) return;
    const rows = clean().filter((r) => r.item).sort((a, b) => b.t - a.t);
    const key = rows.map((r) => r.date).join();
    if (key === fmDatesKey) return;
    const prev = sel.value;
    fmDatesKey = key;
    if (!rows.length) { sel.innerHTML = `<option value="">${lt("fm_nodate")}</option>`; return; }
    sel.innerHTML = rows.map((r) => `<option value="${r.date}">${new Date(r.t).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB")} · NDVI ${r.ndvi.toFixed(2)}</option>`).join("");
    if (rows.some((r) => r.date === prev)) sel.value = prev;
    drawFieldMap();
  }
  function ringsOf(g) { return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []; }
  // griglia a ~10 m (Web Mercator) attorno al campo, con maschera del poligono
  function fieldGrid() {
    const polys = ringsOf(current.feature.geometry);
    let lo0 = 180, la0 = 90, lo1 = -180, la1 = -90;
    polys.forEach((p) => p[0].forEach(([x, y]) => { lo0 = Math.min(lo0, x); lo1 = Math.max(lo1, x); la0 = Math.min(la0, y); la1 = Math.max(la1, y); }));
    const pad = 0.00015; lo0 -= pad; lo1 += pad; la0 -= pad; la1 += pad;
    const X0 = mercX(lo0), X1 = mercX(lo1), Y0 = mercY(la0), Y1 = mercY(la1);
    const k = Math.cos(((la0 + la1) / 2) * Math.PI / 180);          // metri veri per metro Mercatore
    let W = Math.max(4, Math.round(((X1 - X0) * k) / 10)), H = Math.max(4, Math.round(((Y1 - Y0) * k) / 10));
    const sc = Math.min(1, 600 / Math.max(W, H)); W = Math.round(W * sc); H = Math.round(H * sc);
    const mk = document.createElement("canvas"); mk.width = W; mk.height = H;
    const mc = mk.getContext("2d"); mc.fillStyle = "#000"; mc.beginPath();
    polys.forEach((p) => p.forEach((ring) => ring.forEach(([x, y], i) => {
      const px = ((mercX(x) - X0) / (X1 - X0)) * W, py = ((Y1 - mercY(y)) / (Y1 - Y0)) * H;
      i ? mc.lineTo(px, py) : mc.moveTo(px, py);
    })));
    mc.fill("evenodd");
    return { W, H, X0, X1, Y0, Y1, polys, inside: mc.getImageData(0, 0, W, H).data };
  }
  const EXPR_MAP = (idx) => (idx === "rgb" ? ["B04", "B03", "B02"] : idx === "lai" ? [`3.618*(${S2_INDEX.evi})-0.118`] : [S2_INDEX[idx === "zone" ? "ndvi" : idx]]);
  async function fetchIndex(item, idx, G) {
    const url = `${PC}/data/v1/item/bbox/${G.X0},${G.Y0},${G.X1},${G.Y1}.npy?collection=sentinel-2-l2a&item=${item}` +
      `&expression=${encodeURIComponent(EXPR_MAP(idx).join(";"))}&asset_as_band=true&coord_crs=epsg:3857&dst_crs=epsg:3857&width=${G.W}&height=${G.H}&resampling=nearest`;
    return parseNpy(await fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
  }
  // GeoTIFF float32 multibanda (una banda per data), EPSG:3857, valore nullo -9999, nomi delle bande = date
  function geotiff(bands, names, G) {
    const W = G.W, H = G.H, N = bands.length, n = W * H;
    const tags = [], extra = [];
    const put = (tag, type, vals) => tags.push({ tag, type, vals });
    const pixScale = [(G.X1 - G.X0) / W, (G.Y1 - G.Y0) / H, 0], tie = [0, 0, 0, G.X0, G.Y1, 0];
    const keys = [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 3857];
    const meta = `<GDALMetadata>${names.map((d, i) => `<Item name="DESCRIPTION" sample="${i}" role="description">${d}</Item>`).join("")}</GDALMetadata>\0`;
    const nod = "-9999\0";
    put(256, 4, [W]); put(257, 4, [H]); put(258, 3, Array(N).fill(32)); put(259, 3, [1]); put(262, 3, [1]);
    put(273, 4, [0]); put(277, 3, [N]); put(278, 4, [H]); put(279, 4, [n * N * 4]); put(284, 3, [1]);
    if (N > 1) put(338, 3, Array(N - 1).fill(0));
    put(339, 3, Array(N).fill(3)); put(33550, 12, pixScale); put(33922, 12, tie); put(34735, 3, keys);
    put(42112, 2, meta); put(42113, 2, nod);
    const size = { 2: 1, 3: 2, 4: 4, 12: 8 };
    const len = (t) => (t.type === 2 ? t.vals.length : t.vals.length) * size[t.type];
    const ifdLen = 2 + tags.length * 12 + 4;
    let off = 8 + ifdLen;
    tags.forEach((t) => { if (len(t) > 4) { t.off = off; off += len(t) + (len(t) % 2); } });
    const dataOff = off, buf = new ArrayBuffer(dataOff + n * N * 4), dv = new DataView(buf);
    tags.find((t) => t.tag === 273).vals = [dataOff];
    dv.setUint16(0, 0x4949); dv.setUint16(2, 42, true); dv.setUint32(4, 8, true); dv.setUint16(8, tags.length, true);
    const wr = (t, o) => (t.type === 2 ? [...t.vals].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0) & 255))
      : t.vals.forEach((v, i) => (t.type === 3 ? dv.setUint16(o + i * 2, v, true) : t.type === 4 ? dv.setUint32(o + i * 4, v, true) : dv.setFloat64(o + i * 8, v, true))));
    tags.forEach((t, i) => {
      const o = 10 + i * 12;
      dv.setUint16(o, t.tag, true); dv.setUint16(o + 2, t.type, true); dv.setUint32(o + 4, t.vals.length, true);
      if (len(t) > 4) { dv.setUint32(o + 8, t.off, true); wr(t, t.off); } else wr(t, o + 8);
    });
    dv.setUint32(10 + tags.length * 12, 0, true);
    for (let i = 0; i < n; i++) for (let b = 0; b < N; b++) {
      const v = bands[b][i];
      dv.setFloat32(dataOff + (i * N + b) * 4, G.inside[i * 4 + 3] > 127 && isFinite(v) ? v : -9999, true);
    }
    return new Blob([buf], { type: "image/tiff" });
  }
  function saveBlob(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function downloadMaps(all) {
    const idx = document.getElementById("fmIdx").value, st = document.getElementById("fmStats");
    if (idx === "rgb" || idx === "zone") { st.textContent = lt("dl_noidx"); return; }
    const rows = all ? clean().filter((r) => r.item) : clean().filter((r) => r.date === document.getElementById("fmDate").value);
    if (!rows.length) return;
    const G = fieldGrid(), bands = [], names = [];
    let k = 0;
    await pool(rows, 4, async (r) => {
      try { const a = await fetchIndex(r.item, idx, G); bands.push([r.date, a.data.slice(0, G.W * G.H)]); } catch (e) { /* data saltata */ }
      st.textContent = lt("dl_prog", { n: ++k, t: rows.length });
    });
    bands.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const tag = `${idx}_${current.ll.lat.toFixed(5)}_${current.ll.lng.toFixed(5)}`;
    saveBlob(geotiff(bands.map((b) => b[1]), bands.map((b) => `${idx} ${b[0]}`), G), all ? `${tag}_serie_${bands.length}date.tif` : `${tag}_${bands[0][0]}.tif`);
    st.textContent = lt("dl_done", { n: bands.length });
  }

  async function drawFieldMap() {
    if (!document.getElementById("fmIdx") || !current) return;
    const idx = document.getElementById("fmIdx").value, date = document.getElementById("fmDate").value, auto = document.getElementById("fmAuto").checked;
    const row = clean().find((r) => r.date === date);
    if (!row) return;
    const stats = document.getElementById("fmStats");
    stats.textContent = lt("fm_loading");
    const G = fieldGrid(), { W, H, X0, X1, Y0, Y1, inside, polys } = G;
    let arr;
    try { arr = await fetchIndex(row.item, idx, G); }
    catch (e) { stats.textContent = lt("fm_err"); return; }
    if (document.getElementById("fmDate").value !== date || document.getElementById("fmIdx").value !== idx) return;
    const n = W * H, band = (b) => arr.data.subarray(b * n, (b + 1) * n);
    const vals = [];
    for (let i = 0; i < n; i++) if (inside[i * 4 + 3] > 127 && isFinite(arr.data[i])) vals.push(arr.data[i]);
    const q = (p) => { const v = vals.slice().sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]; };
    let a, b;
    if (idx === "rgb") { a = 300; b = 2600; }
    else if (auto || idx === "zone") { a = q(0.02); b = q(0.98); if (b - a < 0.02) { a -= 0.01; b += 0.01; } }
    else [a, b] = FIX[idx];
    const t1 = q(1 / 3), t2 = q(2 / 3);
    const img = new ImageData(W, H);
    for (let i = 0; i < n; i++) {
      if (inside[i * 4 + 3] <= 127) continue;
      let c;
      if (idx === "rgb") c = [0, 1, 2].map((bb) => Math.max(0, Math.min(255, ((band(bb)[i] - 1000 - a) / (b - a)) * 255)));
      else { const v = arr.data[i]; if (!isFinite(v)) continue; c = idx === "zone" ? ZONE_COL[v < t1 ? 0 : v < t2 ? 1 : 2] : ramp((v - a) / (b - a)); }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; tmp.getContext("2d").putImageData(img, 0, 0);
    fmLast = { tmp, bounds: [[latOf(Y0), lonOf(X0)], [latOf(Y1), lonOf(X1)]], idx, date, arr, inside, W, H, X0, X1, Y0, Y1 };
    fieldMapOnMap(true);
    // legenda e statistiche
    const leg = document.getElementById("fmLegend");
    if (idx === "rgb") leg.innerHTML = "";
    else if (idx === "zone") leg.innerHTML = ["fm_z1", "fm_z2", "fm_z3"].map((z, i) => `<span><i style="background:rgb(${ZONE_COL[i]})"></i>${lt(z)}</span>`).join("") +
      ` <small>(NDVI &lt; ${t1.toFixed(2)} · ${t1.toFixed(2)}–${t2.toFixed(2)} · &gt; ${t2.toFixed(2)})</small>`;
    else leg.innerHTML = `<span>${a.toFixed(2)}</span><b class="fm-bar" style="background:linear-gradient(90deg,${RAMP.map((c) => `rgb(${c})`).join(",")})"></b><span>${b.toFixed(2)}</span>`;
    if (idx !== "rgb" && vals.length) {
      const m = vals.reduce((x, y) => x + y, 0) / vals.length, sd = Math.sqrt(vals.reduce((x, y) => x + (y - m) ** 2, 0) / vals.length);
      stats.textContent = lt("fm_stats", { n: vals.length, m: m.toFixed(3), sd: sd.toFixed(3), cv: Math.round((sd / Math.abs(m || 1)) * 100) });
    } else stats.textContent = "";
  }
  function fieldMapOnMap(refresh) {
    if (fmOverlay && !refresh) { map.removeLayer(fmOverlay); fmOverlay = null; return; }
    if (!fmLast) return;
    if (fmOverlay) map.removeLayer(fmOverlay);
    if (!fmHoverOn) { map.on("mousemove", fmHover); fmHoverOn = true; }
    const op = +((document.getElementById("fmOp") || {}).value || 0.9);
    fmOverlay = L.imageOverlay(fmLast.tmp.toDataURL(), fmLast.bounds, { opacity: op, className: "seg-overlay", interactive: false, zIndex: 470 }).addTo(map);
  }
  // valore del pixel sotto il mouse
  let fmTipCtl = null, fmHoverOn = false;
  const fmHover = (e) => {
    const F = fmLast;
    if (!fmOverlay || !F || F.idx === "rgb") { if (fmTipCtl) fmTipCtl.getContainer().hidden = true; return; }
    const x = Math.floor(((mercX(e.latlng.lng) - F.X0) / (F.X1 - F.X0)) * F.W), y = Math.floor(((F.Y1 - mercY(e.latlng.lat)) / (F.Y1 - F.Y0)) * F.H);
    const i = y * F.W + x, ok = x >= 0 && y >= 0 && x < F.W && y < F.H && F.inside[i * 4 + 3] > 127 && isFinite(F.arr.data[i]);
    if (!fmTipCtl) { fmTipCtl = L.control({ position: "bottomright" }); fmTipCtl.onAdd = () => L.DomUtil.create("div", "user-hover"); fmTipCtl.addTo(map); }
    fmTipCtl.getContainer().hidden = !ok;
    if (ok) fmTipCtl.getContainer().innerHTML = `${lt("fm_" + (F.idx === "zone" ? "ndvi" : F.idx))}: <b>${F.arr.data[i].toFixed(3)}</b>`;
  };
  const parseNpy = (buf) => { const r = Segment.parseNpy(buf); return { data: Float32Array.from(r.data) }; };


  // un grafico alla volta, a tutta larghezza e ridimensionabile (trascinando l'angolo in basso)
  const CHARTS = [["chIndex", "ch_index"], ["chMeteo", "ch_meteo"], ["chEt", "ch_et"], ["chYield", "ch_yield"], ["chCmp", "ch_cmp"], ["chClms", "ch_clms"], ["chRadar", "ch_radar"]];
  let chartSel = "chIndex", s1Loaded = false;
  function showChart(id) {
    chartSel = id;
    panel().querySelectorAll(".ch-tabs .seg").forEach((b) => b.classList.toggle("active", b.dataset.ch === id));
    panel().querySelectorAll(".ch-fig").forEach((f) => (f.hidden = f.dataset.ch !== id));
    if (id === "chRadar" && !s1Loaded) { s1Loaded = true; loadS1(); }
    if (id === "chClms" && !(current.clms && current.clms[clmsSel])) drawClms();
    if (charts[id]) charts[id].resize();
  }

  function yearOptions() {
    const now = new Date(), y0 = now.getUTCFullYear(), sel = selYear(), opts = [];
    for (let y = y0; y >= 2017; y--) {
      if (range === "sm" && new Date(Date.UTC(y, 10, 11)) > now) continue;
      const lab = range === "sm" ? `${y}/${String(y + 1).slice(2)}` : `${y}`;
      opts.push(`<option value="${y}" ${y === sel ? "selected" : ""}>${lab}</option>`);
    }
    return opts.join("");
  }
  const fmtDate = (t) => new Date(t).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "short" });
  const xScale = () => ({ type: "linear", min: startDate(range).getTime(), max: endDate(range).getTime() + (isCurrent() ? 8 * 86400000 : 0),
    ticks: { callback: (v) => fmtDate(v), maxTicksLimit: 8, font: { size: 10 } }, grid: { color: "#0000000d" } });
  const baseOpts = (extra = {}) => ({
    responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    interaction: { mode: "nearest", intersect: false },
    plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 }, filter: (it) => !!it.text } },
      tooltip: { callbacks: { title: (it) => new Date(it[0].parsed.x).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB") } } },
    scales: { x: xScale(), ...extra },
  });

  function upsert(id, cfg) {
    if (charts[id]) { charts[id].data = cfg.data; charts[id].options = cfg.options; charts[id].update("none"); return; }
    const el = document.getElementById(id);
    if (el) charts[id] = new Chart(el, cfg);
  }

  const shown = new Set(INDEX_DEF.filter((x) => x[3]).map((x) => x[0]));
  function drawIndex() {
    const d = clean();
    const sets = [];
    INDEX_DEF.filter(([k]) => shown.has(k)).forEach(([k, color, axis]) => {
      sets.push({ type: "line", label: lt("idx_" + k), yAxisID: axis, data: smooth(k), borderColor: color, backgroundColor: color, pointRadius: 0, borderWidth: 2, tension: 0.3 });
      sets.push({ type: "scatter", label: "", yAxisID: axis, data: d.map((r) => ({ x: r.t, y: r[k] })), backgroundColor: color + "88", pointRadius: 2, showLine: false });
    });
    const outl = (current.s2 || []).filter((r) => r.outlier);
    if (outl.length && shown.has("ndvi")) sets.push({ type: "scatter", label: lt("outliers"), data: outl.map((r) => ({ x: r.t, y: r.ndvi })), backgroundColor: "#99999988", pointStyle: "crossRot", pointRadius: 4, borderColor: "#888" });
    const free = INDEX_DEF.some(([k, , ax]) => ax === "y4" && shown.has(k));
    upsert("chIndex", { data: { datasets: sets },
      options: baseOpts({ y: { min: -0.4, max: 1, ticks: { font: { size: 10 } } },
        y4: { display: free, position: "right", grid: { display: false }, ticks: { font: { size: 10 } } } }) });
  }

  function drawMeteo() {
    const m = current.meteo || [];
    let cum = 0;
    const cumData = m.filter((r) => !r.fc).map((r) => ({ x: r.t, y: (cum += r.rain || 0) }));
    upsert("chMeteo", {
      data: { datasets: [
        { type: "bar", label: lt("rain"), data: m.map((r) => ({ x: r.t, y: r.rain })), yAxisID: "y",
          backgroundColor: m.map((r) => (r.fc ? "#7fb2e6" : "#2b6cb0")), barThickness: "flex", maxBarThickness: 6 },
        { type: "line", label: lt("rain_cum"), data: cumData, yAxisID: "y2", borderColor: "#1b3f6b", borderDash: [4, 3], pointRadius: 0, borderWidth: 1.4 },
        { type: "line", label: lt("tmean"), data: m.map((r) => ({ x: r.t, y: r.tmean })), yAxisID: "y3", borderColor: "#d0572b", pointRadius: 0, borderWidth: 1.4,
          segment: { borderDash: (c) => (m[c.p1DataIndex] && m[c.p1DataIndex].fc ? [3, 3] : undefined) } },
      ] },
      options: baseOpts({
        y: { position: "left", title: { display: true, text: "mm", font: { size: 10 } }, ticks: { font: { size: 10 } } },
        y2: { position: "right", grid: { display: false }, ticks: { font: { size: 10 } }, title: { display: true, text: "Σ mm", font: { size: 10 } } },
        y3: { position: "right", grid: { display: false }, ticks: { font: { size: 10 } }, title: { display: true, text: "°C", font: { size: 10 } } },
      }),
    });
  }

  // ---- evapotraspirazione nel tempo: ET0, ET coltura (Kc da NDVI), ET reale Copernicus, cumulate
  function kcSeries() {
    const s2 = clean();
    return (t) => {
      if (!s2.length) return null;
      if (t <= s2[0].t) return s2[0].kc;
      if (t >= s2[s2.length - 1].t) return s2[s2.length - 1].kc;
      let i = 0; while (s2[i + 1].t < t) i++;
      const a = s2[i], b = s2[i + 1], w = (t - a.t) / (b.t - a.t);
      return a.kc + w * (b.kc - a.kc);
    };
  }
  function etDaily() {
    const kc = kcSeries();
    return (current.meteo || []).map((r) => ({ t: r.t, fc: r.fc, et0: r.et0, etc: kc(r.t) != null ? kc(r.t) * r.et0 : null, rain: r.rain }));
  }
  function drawEt() {
    const d = etDaily();
    let ce = 0, cr = 0, ca = 0;
    const cumE = d.filter((r) => !r.fc && r.etc != null).map((r) => ({ x: r.t, y: (ce += r.etc) }));
    const cumR = d.filter((r) => !r.fc).map((r) => ({ x: r.t, y: (cr += r.rain || 0) }));
    const eta = current.eta || [];
    const cumA = eta.map((r) => ({ x: r.t + r.days * 43200000, y: (ca += r.et * r.days) }));
    const sets = [
      { type: "line", label: lt("et0d"), data: d.map((r) => ({ x: r.t, y: r.et0 })), borderColor: "#c9a66b", pointRadius: 0, borderWidth: 1, yAxisID: "y" },
      { type: "line", label: lt("etcd"), data: d.filter((r) => r.etc != null).map((r) => ({ x: r.t, y: r.etc })), borderColor: "#d0572b", pointRadius: 0, borderWidth: 1.6, yAxisID: "y" },
      { type: "line", label: lt("etc_cum"), data: cumE, borderColor: "#d0572b", borderDash: [5, 3], pointRadius: 0, borderWidth: 1.4, yAxisID: "y2" },
      { type: "line", label: lt("rain_cum"), data: cumR, borderColor: "#2b6cb0", borderDash: [5, 3], pointRadius: 0, borderWidth: 1.4, yAxisID: "y2" },
    ];
    if (eta.length) {
      sets.push({ type: "line", label: lt("etad"), data: eta.map((r) => ({ x: r.t + r.days * 43200000, y: r.et })), borderColor: "#2f8f3a", backgroundColor: "#2f8f3a",
        stepped: "middle", pointRadius: 2, borderWidth: 1.8, yAxisID: "y" });
      sets.push({ type: "line", label: lt("eta_cum"), data: cumA, borderColor: "#2f8f3a", borderDash: [5, 3], pointRadius: 0, borderWidth: 1.4, yAxisID: "y2" });
    }
    upsert("chEt", { data: { datasets: sets }, options: baseOpts({
      y: { title: { display: true, text: "mm/" + (LANG === "it" ? "giorno" : "day"), font: { size: 10 } }, ticks: { font: { size: 10 } }, min: 0 },
      y2: { position: "right", grid: { display: false }, title: { display: true, text: "Σ mm", font: { size: 10 } }, ticks: { font: { size: 10 } }, min: 0 } }) });
  }

  // ---- confronto delle forme: fino a 4 serie sullo stesso asse dei tempi, eventualmente normalizzate 0–1
  const CMP = [["rain7", "#2b6cb0"], ["tmean", "#d0572b"], ["et0", "#c9a66b"], ["etc", "#e67e22"], ["eta", "#2f8f3a"], ["ndvi", "#1e8449"],
    ["lai", "#145a32"], ["evi", "#5aa02c"], ["ndmi", "#1f77b4"], ["ndre", "#a3812c"], ["kc", "#6c3483"], ["vh", "#7a3fb0"]];
  const cmpSel = new Set(["rain7", "ndvi", "lai"]);
  let cmpNorm = true;
  function cmpSeries(k) {
    const m = (current.meteo || []).filter((r) => !r.fc);
    if (k === "rain7") return m.map((r, i) => ({ x: r.t, y: m.slice(Math.max(0, i - 6), i + 1).reduce((a, q) => a + (q.rain || 0), 0) }));
    if (k === "tmean") return m.map((r) => ({ x: r.t, y: r.tmean }));
    if (k === "et0") return m.map((r) => ({ x: r.t, y: r.et0 }));
    if (k === "etc") return etDaily().filter((r) => !r.fc && r.etc != null).map((r) => ({ x: r.t, y: r.etc }));
    if (k === "eta") return (current.eta || []).map((r) => ({ x: r.t + r.days * 43200000, y: r.et }));
    if (k === "vh") return (current.s1 || []).filter((r) => r.orbit === "descending").map((r) => ({ x: r.t, y: r.vh }));
    return smooth(k);
  }
  function drawCompare() {
    const sets = CMP.filter(([k]) => cmpSel.has(k)).map(([k, c]) => {
      let d = cmpSeries(k);
      if (cmpNorm && d.length) {
        const ys = d.map((p) => p.y).filter(isFinite), lo = Math.min(...ys), hi = Math.max(...ys);
        d = d.map((p) => ({ x: p.x, y: hi > lo ? (p.y - lo) / (hi - lo) : 0.5 }));
      }
      return { type: "line", label: lt("c_" + k), data: d, borderColor: c, backgroundColor: c, pointRadius: k === "eta" ? 2 : 0, borderWidth: 1.8, tension: 0.25,
        yAxisID: cmpNorm ? "y" : (["rain7", "et0", "etc", "eta"].includes(k) ? "y" : ["tmean", "vh"].includes(k) ? "y3" : "y2") };
    });
    upsert("chCmp", { data: { datasets: sets }, options: baseOpts(cmpNorm
      ? { y: { min: 0, max: 1, title: { display: true, text: lt("cmp_norm"), font: { size: 10 } }, ticks: { font: { size: 10 } } } }
      : { y: { title: { display: true, text: "mm", font: { size: 10 } }, ticks: { font: { size: 10 } } },
          y2: { position: "right", grid: { display: false }, ticks: { font: { size: 10 } } },
          y3: { position: "right", grid: { display: false }, ticks: { font: { size: 10 } } } }) });
  }

  // ---- ET reale Copernicus (CLMS ETA 300 m) per il campo, dai ritagli Italia su Hugging Face
  // ET reale Copernicus (300 m, decadale): media sul campo dalle mappe ritagliate sull'Italia
  async function loadEta(my) {
    const idx = await Clms.loadIndex(), start = iso(startDate(range)), end = iso(endDate(range));
    const dates = (idx.ETA || []).filter((d) => d >= start && d <= end);
    if (!dates.length) return;
    const ser = await Clms.series("ETA", current.feature, dates);
    if (my !== runId) return;
    current.eta = ser.map((r) => { const d0 = new Date(r.x); const days = d0.getUTCDate() < 21 ? 10 : new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 0)).getUTCDate() - 20;
      return { t: r.x, et: r.y, days }; });
    drawEt(); drawCompare();
  }
  // grafico "Copernicus": serie della variabile scelta, media sul campo
  let clmsSel = "LAI";
  async function drawClms() {
    const my = runId, el = document.getElementById("chClms"), st = document.getElementById("clmsSt");
    if (!el || !current) return;
    const idx = await Clms.loadIndex(), start = iso(startDate(range)), end = iso(endDate(range));
    const dates = (idx[clmsSel] || []).filter((d) => d >= start && d <= end);
    if (!dates.length) { st.textContent = lt("clms_none"); if (charts.chClms) { charts.chClms.destroy(); delete charts.chClms; } return; }
    const ser = await Clms.series(clmsSel, current.feature, dates, (k, t) => (st.textContent = lt("clms_load", { n: k, t })));
    if (my !== runId) return;
    (current.clms = current.clms || {})[clmsSel] = ser;
    st.textContent = lt("clms_ok", { n: ser.length, px: ser.length ? Math.round(ser.reduce((a, r) => a + r.n, 0) / ser.length) : 0 });
    const u = Clms.P[clmsSel][2];
    upsert("chClms", { type: "line", data: { datasets: [{ label: Clms.label(clmsSel), data: ser, borderColor: "#2f8f3a", backgroundColor: "#2f8f3a", pointRadius: 3, tension: 0.25 }] },
      options: baseOpts({ y: { title: { display: !!u, text: u } } }) });
  }


  function drawRadar() {
    const d = current.s1 || [];
    const ds = (k, label, color, orbit) => ({ type: "line", label: `${label} (${orbit === "ascending" ? "asc" : "desc"})`,
      data: d.filter((r) => r.orbit === orbit).map((r) => ({ x: r.t, y: r[k] })), borderColor: color, backgroundColor: color,
      pointRadius: 2, borderWidth: 1.2, borderDash: orbit === "ascending" ? [4, 3] : undefined });
    upsert("chRadar", { data: { datasets: [ds("vh", "VH", "#7a3fb0", "descending"), ds("vv", "VV", "#3b8c8c", "descending"),
      ds("vh", "VH", "#b38ad6", "ascending"), ds("vv", "VV", "#8cc4c4", "ascending")] },
      options: baseOpts({ y: { ticks: { font: { size: 10 } }, title: { display: true, text: "dB", font: { size: 10 } } } }) });
  }

  // ET coltura: Kc giornaliero interpolato dalle date Sentinel-2 serene


  // ---- stima della coltura dalla curva NDVI (regole fenologiche per l'Italia) ----
  function classifyCrop(s2) {
    const d = (s2 || []).filter((r) => isFinite(r.ndvi)).sort((a, b) => a.t - b.t);
    if (d.length < 8 || d[d.length - 1].t - d[0].t < 240 * 86400000) return null;
    const v = d.map((r) => r.ndvi).sort((a, b) => a - b);
    const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    const p10 = q(0.1), p90 = q(0.9), med = q(0.5), amp = p90 - p10;
    const byM = Array.from({ length: 12 }, () => []);
    d.forEach((r) => byM[new Date(r.t).getUTCMonth()].push(r.ndvi));
    const mm = (ms) => { const a = ms.flatMap((m) => byM[m]); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };
    const peak = d.reduce((a, r) => (r.ndvi > a.ndvi ? r : a));
    const pm = new Date(peak.t).getUTCMonth();
    const winter = mm([11, 0, 1]), spring = mm([2, 3, 4]), summer = mm([5, 6, 7]), jul_aug = mm([6, 7]), feb_apr = mm([1, 2, 3]), lateSum = mm([6, 7, 8]);
    const flooded = d.some((r) => { const mo = new Date(r.t).getUTCMonth(); return mo >= 3 && mo <= 5 && r.ndwi > 0.05 && r.ndvi < 0.25; });
    let drops = 0;
    for (let i = 1; i < d.length; i++) { const mo = new Date(d[i].t).getUTCMonth(); if (mo >= 3 && mo <= 9 && d[i - 1].ndvi - d[i].ndvi > 0.18 && d[i - 1].ndvi > 0.5) drops++; }
    const it = LANG === "it";
    const R = (l_it, l_en, why_it, why_en, conf) => ({ label: it ? l_it : l_en, why: it ? why_it : why_en, conf });
    const f2 = (x) => (isFinite(x) ? x.toFixed(2) : "–");
    if (p90 < 0.3) return R("Suolo nudo, incolto o area non agricola", "Bare soil, fallow or non-agricultural", `NDVI sempre basso (90° percentile ${f2(p90)})`, `NDVI always low (90th percentile ${f2(p90)})`, "alta");
    if (med > 0.7 && amp < 0.2) return R("Bosco o vegetazione naturale densa", "Forest or dense natural vegetation", `NDVI alto e stabile tutto l'anno (mediana ${f2(med)})`, `High, stable NDVI all year (median ${f2(med)})`, "media");
    if (flooded && pm >= 6 && pm <= 8) return R("Riso (probabile)", "Rice (likely)", "campo allagato in primavera (NDWI > 0) e picco estivo", "field flooded in spring (NDWI > 0) and summer peak", "media");
    if (spring > 0.55 && pm >= 1 && pm <= 4 && jul_aug < 0.4) {
      if (lateSum > 0.55) return R("Doppia coltura: cereale vernino + secondo raccolto estivo", "Double crop: winter cereal + summer second crop", `picco a ${monthName(pm)}, nuova crescita in estate (${f2(lateSum)})`, `peak in ${monthName(pm)}, regrowth in summer (${f2(lateSum)})`, "media");
      return R("Cereale autunno-vernino (frumento, orzo, avena) o colza", "Winter cereal (wheat, barley, oats) or rapeseed", `picco a ${monthName(pm)} (NDVI ${f2(peak.ndvi)}), raccolta prima di luglio (lug–ago ${f2(jul_aug)})`, `peak in ${monthName(pm)} (NDVI ${f2(peak.ndvi)}), harvested before July (Jul–Aug ${f2(jul_aug)})`, "alta");
    }
    if (feb_apr < 0.4 && pm >= 5 && pm <= 8 && peak.ndvi > 0.6) {
      if (pm >= 6 && peak.ndvi > 0.78) return R("Coltura estiva: mais (probabile) o sorgo", "Summer crop: maize (likely) or sorghum", `semina primaverile, picco alto a ${monthName(pm)} (NDVI ${f2(peak.ndvi)})`, `spring sowing, high peak in ${monthName(pm)} (NDVI ${f2(peak.ndvi)})`, "media");
      return R("Coltura estiva (girasole, soia, pomodoro, mais)", "Summer crop (sunflower, soybean, tomato, maize)", `suolo nudo fino ad aprile, picco a ${monthName(pm)}`, `bare until April, peak in ${monthName(pm)}`, "media");
    }
    if (med > 0.5 && drops >= 2) return R("Prato da sfalcio o erba medica", "Hay meadow or alfalfa", `verde quasi tutto l'anno con ${drops} tagli tra aprile e ottobre`, `green most of the year with ${drops} cuts between April and October`, "media");
    if (winter < 0.38 && summer > 0.42 && summer < 0.7 && amp < 0.4 && pm >= 5 && pm <= 8) return R("Vigneto (probabile)", "Vineyard (likely)", `inverno spoglio (${f2(winter)}), chioma estiva moderata (${f2(summer)})`, `bare winter (${f2(winter)}), moderate summer canopy (${f2(summer)})`, "bassa");
    if (amp < 0.22 && med >= 0.3 && med <= 0.7) return R("Coltura arborea permanente (oliveto, frutteto) o pascolo arborato", "Permanent tree crop (olive grove, orchard) or wooded pasture", `NDVI stabile tutto l'anno (mediana ${f2(med)}, escursione ${f2(amp)})`, `NDVI stable all year (median ${f2(med)}, range ${f2(amp)})`, "bassa");
    return R("Coltura non classificata (andamento irregolare)", "Unclassified crop (irregular pattern)", `picco a ${monthName(pm)}, escursione ${f2(amp)}`, `peak in ${monthName(pm)}, range ${f2(amp)}`, "—");
  }
  const monthName = (m) => new Date(Date.UTC(2020, m, 15)).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { month: "long" });

  function drawSummary() {
    if (!current) return;
    const s2 = clean();
    drawFieldYield();
    fillFieldDates();
    const cb = document.getElementById("fpCrop");
    if (cb) {
      const c = classifyCrop(s2);
      current.crop = c;
      cb.innerHTML = c ? `<b>${lt("crop")}:</b> ${c.label} <small>(${c.why}${c.conf && c.conf !== "—" ? `; ${LANG === "it" ? "affidabilità" : "confidence"} ${c.conf}` : ""})</small><div class="hint small">${lt("crop_note")}</div>`
        : (s2.length ? `<span class="hint small">${lt("crop_short")}</span>` : "");
    }
    renderAdvice();
    drawFieldYield();
  }

  function exportCsv() {
    if (!current) return;
    const IK = INDEX_DEF.map((x) => x[0]);
    const E = (n) => Array(n).fill("");
    const ctyHead = (current.cty || []).map((r) => `${r.year}:${CTY_NOMI[r.cls] ? CTY_NOMI[r.cls][0] : r.cls}(${Math.round(r.share * 100)}%)`).join(" ");
    const rows = [["source", "date", ...IK, "pixels", "vv_db", "vh_db", "orbit", "rain_mm", "tmean_c", "tmin_c", "tmax_c", "et0_mm", "forecast", "copernicus"]];
    (current.s2 || []).forEach((r) => rows.push(["sentinel-2", r.date, ...IK.map((k) => (isFinite(r[k]) ? r[k].toFixed(4) : "")), r.npx, ...E(9)]));
    (current.s1 || []).forEach((r) => rows.push(["sentinel-1", r.date, ...E(IK.length + 1), r.vv.toFixed(2), r.vh.toFixed(2), r.orbit, ...E(6)]));
    Object.entries(current.clms || {}).forEach(([p, ser]) => ser.forEach((r) => rows.push([`copernicus-${p}`, iso(new Date(r.x)), ...E(IK.length + 1 + 3 + 6), `${p}=${r.y.toFixed(4)}`])));
    (current.eta || []).forEach((r) => rows.push(["copernicus-ETA", iso(new Date(r.t)), ...E(IK.length + 1 + 3 + 6), `ETA_mm_giorno=${r.et.toFixed(3)}`]));
    (current.meteo || []).forEach((r) => rows.push(["open-meteo", r.date, ...E(IK.length + 4), r.rain, r.tmean, r.tmin, r.tmax, r.et0, r.fc ? 1 : 0]));
    const head = `# Campi Aperti — lat ${current.ll.lat.toFixed(6)}, lon ${current.ll.lng.toFixed(6)}, ${areaHa(current.feature.geometry).toFixed(3)} ha` +
      (current.crop ? `, coltura stimata: ${current.crop.label}` : "") + ` — valori Sentinel-2 = media sul campo\n` +
      (ctyHead ? `# Copernicus HRL Crop Types: ${ctyHead}\n` : "");
    const blob = new Blob([head + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `campo_${current.ll.lat.toFixed(5)}_${current.ll.lng.toFixed(5)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  let highlight = null;
  function showBusy(msg) {
    const p = panel();
    p.hidden = false; document.body.classList.add("fp-open");
    p.innerHTML = `<div class="fp-status">${msg}</div>`;
  }
  function close() {
    runId++;
    panel().hidden = true;
    document.body.classList.remove("fp-open");
    if (highlight) { map.removeLayer(highlight); highlight = null; }
    if (fmOverlay) { map.removeLayer(fmOverlay); fmOverlay = null; }
    const flb = document.getElementById("fieldLayerBox"); if (flb) flb.hidden = true;
    current = null;
    setTimeout(() => map.invalidateSize(), 50);
  }

  // avvisi per la coltura del campo: quella indicata dall'utente, la coltura permanente di Copernicus (olivo, vite, frutteti),
  // altrimenti quella stimata dalla curva NDVI dell'annata (le colture annuali ruotano: la mappa di anni passati non vale)
  let adviceKey = null;
  function renderAdvice() {
    const el = document.getElementById("fpAdvice");
    if (!el || typeof Advice === "undefined" || !current) return;
    const user = current.feature.properties && current.feature.properties.coltura;
    const lab = current.crop && current.crop.label;
    const k = Advice.cropKey(user || lab, current.ctyPerm);
    if (k === adviceKey && el.innerHTML) return;
    adviceKey = k;
    Advice.render(el, current.ll.lat, current.ll.lng, user || lab, current.ctyPerm);
  }

  function run() {
    const my = ++runId;
    adviceKey = null;
    current.s2 = []; current.s1 = []; current.meteo = []; current.eta = [];
    renderPanel();
    setStatus(lt("loading_meteo"));
    loadMeteo(my).catch((e) => setStatus(lt("err", { e: e.message })));
    loadS2(my).catch((e) => setStatus(lt("err", { e: e.message })));
    showCropHistory(my).then(() => { showYields(my); renderAdvice(); }).catch(() => {});
    loadEta(my);
    loadSoil(my);
  }

  // analisi di un poligono qualsiasi (disegnato dall'utente, importato, prato)
  function analyze(feature, extra = {}) {
    if (highlight) map.removeLayer(highlight);
    highlight = L.geoJSON(feature, { style: { color: "#ffd84a", weight: 3, fillColor: "#ffd84a", fillOpacity: 0.12 }, interactive: false }).addTo(map);
    const c = L.geoJSON(feature).getBounds().getCenter();
    current = { feature, ll: c, ...extra };
    run();
  }
  async function cropOfField(feature, y) {
    const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const rings = polys.map((poly) => poly.map((ring) => ring.map(([lo, la]) => proj4("EPSG:4326", "EPSG:3035", [lo, la]))));
    const all = rings.flat(2);
    const bb = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
    return cropOfYear(y, rings, bb).catch(() => null);
  }

  async function onMapClick(ll) {
    let feature = Segment.fieldAt(ll);
    if (!feature) {
      // nessuna divisione in campi qui: segmento automaticamente 2 km × 2 km attorno al punto
      const dLat = 1000 / 111320, dLon = 1000 / (111320 * Math.cos((ll.lat * Math.PI) / 180));
      showBusy(lt("seg_auto"));
      try { await Segment.smart([ll.lng - dLon, ll.lat - dLat, ll.lng + dLon, ll.lat + dLat], periodRange().end, (n, t) => showBusy(lt("seg_prog", { n, t }))); }
      catch (e) { console.warn("segmentazione", e); }
      feature = Segment.fieldAt(ll);
      if (!feature && Segment.method() === "ai") {
        // il modello non vede un campo qui (bosco, frutteto fitto, area mista): provo la segmentazione sulla serie NDVI
        try { await Segment.run([ll.lng - dLon, ll.lat - dLat, ll.lng + dLon, ll.lat + dLat], periodRange().end, (n, t) => showBusy(lt("seg_prog", { n, t }))); }
        catch (e) { console.warn("segmentazione", e); }
        feature = Segment.fieldAt(ll);
      }
    }
    if (!feature) feature = squareAround(ll);
    if (highlight) map.removeLayer(highlight);
    highlight = L.geoJSON(feature, { style: { color: "#ffd84a", weight: 3, fillColor: "#ffd84a", fillOpacity: 0.12 }, interactive: false }).addTo(map);
    current = { feature, ll };
    run();
    return feature;
  }

  return { analyze, cropOfField, CTY_NOMI: () => CTY_NOMI, current: () => current, cropHistory, makeS2Layer, windowControl, bindWindowControl, segControl, periodRange, onMapClick, refreshLang: () => current && run(), _debug: () => current };
})();
