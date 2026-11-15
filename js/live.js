// Campi Aperti — dati in tempo reale e serie temporali per campo
// Real-time data and per-field time series
//
// Fonti (tutte gratuite, senza chiavi, lette dal browser):
//  - Sentinel-2 L2A e Sentinel-1 RTC (Copernicus) tramite Microsoft Planetary Computer (STAC + titiler)
//  - Confini dei campi 2025: Fields of The World (Taylor Geospatial, CC BY 4.0), PMTiles su Source Cooperative
//  - Meteo: ERA5 / ERA5-Land (Copernicus C3S) e previsioni, tramite Open-Meteo

const PC = "https://planetarycomputer.microsoft.com/api";
const FTW_ITALY = "https://data.source.coop/ftw/global-data/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=IT/Italy.pmtiles";
const FTW_LAYER = "2025";

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
  cloud: "((SCL==3)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==0)|(SCL==1))*1.0",
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
    field_src: "Confine: Fields of The World 2025 (valori = media su tutto il campo)",
    area: "Superficie",
    from_sm: "Da San Martino",
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
    s2_src: "Satellite: Sentinel-2 L2A (Copernicus) via Microsoft Planetary Computer; nuvole e ombre escluse con la classificazione SCL.",
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
    field_src: "Boundary: Fields of The World 2025 (values = mean over the whole field)",
    area: "Area",
    from_sm: "Since St Martin's Day",
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
    s2_src: "Satellite: Sentinel-2 L2A (Copernicus) via Microsoft Planetary Computer; clouds and shadows removed with the SCL classification.",
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
      const r = await Segment.run(bounds, periodRange().end, (n, t) => msg && (msg.textContent = lt("seg_prog", { n, t })));
      if (msg) msg.textContent = lt("seg_done", { n: r.nSeg, d: r.dates.length, a: r.dates[0], b: r.dates[r.dates.length - 1] });
    } catch (e) { if (msg) msg.textContent = lt("err", { e: e.message }); }
    if (btn) btn.disabled = false;
  }

  // ================================================================== confini dei campi (PMTiles)
  const pm = new pmtiles.PMTiles(FTW_ITALY);
  let pmHeader = null;
  const headerP = pm.getHeader().then((h) => (pmHeader = h)).catch((e) => console.warn("PMTiles", e));

  function makeFieldsLayer(def) {
    return protomapsL.leafletLayer({
      url: FTW_ITALY,
      maxDataZoom: 13, // zoom massimo dell'archivio PMTiles FTW Italia
      paintRules: [{ dataLayer: FTW_LAYER, symbolizer: new protomapsL.LineSymbolizer({ color: "#ffd84a", width: 1.3 }) }],
      labelRules: [],
      minZoom: def.minZoom || 12,
      pane: "overlayPane",
      attribution: "Campi: Fields of The World 2025 (CC BY 4.0)",
    });
  }

  // --- decodifica Mapbox Vector Tile (minimale) ---
  function PB(buf) { this.b = buf; this.p = 0; }
  PB.prototype.varint = function () { let r = 0, s = 1, b; do { b = this.b[this.p++]; r += (b & 0x7f) * s; s *= 128; } while (b >= 0x80); return r; };
  PB.prototype.skip = function (wt) { if (wt === 0) this.varint(); else if (wt === 1) this.p += 8; else if (wt === 2) { const l = this.varint(); this.p += l; } else if (wt === 5) this.p += 4; };
  const zz = (n) => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

  function decodeTile(buf) {
    const pb = new PB(new Uint8Array(buf)), layers = {};
    while (pb.p < pb.b.length) {
      const tag = pb.varint(), f = tag >> 3, wt = tag & 7;
      if (f === 3) { const len = pb.varint(), end = pb.p + len; const ly = decodeLayer(pb, end); layers[ly.name] = ly; pb.p = end; }
      else pb.skip(wt);
    }
    return layers;
  }
  function decodeLayer(pb, end) {
    const ly = { name: "", extent: 4096, keys: [], values: [], features: [] };
    while (pb.p < end) {
      const tag = pb.varint(), f = tag >> 3, wt = tag & 7;
      if (f === 1) { const l = pb.varint(); ly.name = new TextDecoder().decode(pb.b.subarray(pb.p, pb.p + l)); pb.p += l; }
      else if (f === 2) { const l = pb.varint(), e = pb.p + l; ly.features.push(decodeFeature(pb, e)); pb.p = e; }
      else if (f === 3) { const l = pb.varint(); ly.keys.push(new TextDecoder().decode(pb.b.subarray(pb.p, pb.p + l))); pb.p += l; }
      else if (f === 4) { const l = pb.varint(), e = pb.p + l; ly.values.push(decodeValue(pb, e)); pb.p = e; }
      else if (f === 5) ly.extent = pb.varint();
      else pb.skip(wt);
    }
    ly.features.forEach((ft) => { ft.props = {}; for (let i = 0; i < ft.tags.length; i += 2) ft.props[ly.keys[ft.tags[i]]] = ly.values[ft.tags[i + 1]]; });
    return ly;
  }
  function decodeValue(pb, end) {
    let v = null;
    while (pb.p < end) {
      const tag = pb.varint(), f = tag >> 3;
      if (f === 1) { const l = pb.varint(); v = new TextDecoder().decode(pb.b.subarray(pb.p, pb.p + l)); pb.p += l; }
      else if (f === 2) { v = new DataView(pb.b.buffer, pb.b.byteOffset + pb.p, 4).getFloat32(0, true); pb.p += 4; }
      else if (f === 3) { v = new DataView(pb.b.buffer, pb.b.byteOffset + pb.p, 8).getFloat64(0, true); pb.p += 8; }
      else if (f === 4 || f === 5) v = pb.varint();
      else if (f === 6) v = zz(pb.varint());
      else if (f === 7) v = !!pb.varint();
      else pb.skip(tag & 7);
    }
    return v;
  }
  function decodeFeature(pb, end) {
    const ft = { id: null, type: 0, tags: [], geom: [] };
    while (pb.p < end) {
      const tag = pb.varint(), f = tag >> 3, wt = tag & 7;
      if (f === 1) ft.id = pb.varint();
      else if (f === 2) { const l = pb.varint(), e = pb.p + l; while (pb.p < e) ft.tags.push(pb.varint()); }
      else if (f === 3) ft.type = pb.varint();
      else if (f === 4) { const l = pb.varint(), e = pb.p + l; while (pb.p < e) ft.geom.push(pb.varint()); }
      else pb.skip(wt);
    }
    return ft;
  }
  // geometria -> anelli in coordinate tassello, poi poligoni (esterno + buchi)
  function featureRings(ft) {
    const rings = []; let x = 0, y = 0, ring = null, i = 0;
    while (i < ft.geom.length) {
      const c = ft.geom[i++], cmd = c & 7, n = c >> 3;
      if (cmd === 1 || cmd === 2) {
        for (let k = 0; k < n; k++) {
          x += zz(ft.geom[i++]); y += zz(ft.geom[i++]);
          if (cmd === 1) { ring = [[x, y]]; rings.push(ring); } else ring.push([x, y]);
        }
      } else if (cmd === 7 && ring) ring.push([ring[0][0], ring[0][1]]);
    }
    const polys = [];
    rings.forEach((r) => {
      let a = 0; for (let j = 0; j < r.length - 1; j++) a += r[j][0] * r[j + 1][1] - r[j + 1][0] * r[j][1];
      if (a > 0 || !polys.length) polys.push([r]); else polys[polys.length - 1].push(r);
    });
    return polys;
  }
  function inRing(pt, r) {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
    }
    return c;
  }
  const inPoly = (pt, poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h));

  // ritaglio di un anello al quadrato [0,E] (Sutherland–Hodgman), per unire pezzi di tasselli vicini
  function clipRing(ring, E) {
    let out = ring.slice(0, -1);
    const edges = [[(p) => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + t * (b[1] - a[1])]; }],
      [(p) => p[0] <= E, (a, b) => { const t = (E - a[0]) / (b[0] - a[0]); return [E, a[1] + t * (b[1] - a[1])]; }],
      [(p) => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), 0]; }],
      [(p) => p[1] <= E, (a, b) => { const t = (E - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), E]; }]];
    for (const [inside, cut] of edges) {
      const inp = out; out = [];
      if (!inp.length) break;
      for (let i = 0; i < inp.length; i++) {
        const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
        if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
        else if (inside(prev)) out.push(cut(prev, cur));
      }
    }
    if (out.length < 3) return null;
    out.push(out[0]);
    return out;
  }

  const n2 = (z) => Math.pow(2, z);
  function lonLatToTile(lon, lat, z) {
    const n = n2(z), r = (lat * Math.PI) / 180;
    return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
  }
  function tileToLonLat(x, y, px, py, E, z) {
    const n = n2(z), X = x + px / E, Y = y + py / E;
    return [(X / n) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / n))) * 180) / Math.PI];
  }
  const tileCache = {};
  async function getTileLayer(z, x, y) {
    const k = `${z}/${x}/${y}`;
    if (!tileCache[k]) tileCache[k] = pm.getZxy(z, x, y).then((r) => (r && r.data ? decodeTile(r.data)[FTW_LAYER] : null));
    return tileCache[k];
  }
  // i tasselli FTW non hanno un id: uso la superficie totale del campo (metrics:area), identica in tutti i pezzi
const fid = (ft) => (ft.props && (ft.props.id ?? ft.props["metrics:area"])) ?? ft.id;

  // trova il campo che contiene il punto; restituisce un GeoJSON MultiPolygon in lon/lat
  async function findField(ll) {
    await headerP;
    if (!pmHeader) return null;
    const z = pmHeader.maxZoom;
    const [tx, ty] = lonLatToTile(ll.lng, ll.lat, z);
    const x = Math.floor(tx), y = Math.floor(ty);
    const ly = await getTileLayer(z, x, y);
    if (!ly) return null;
    const E = ly.extent, pt = [(tx - x) * E, (ty - y) * E];
    let hit = null, hitPoly = null;
    for (const ft of ly.features) {
      if (ft.type !== 3) continue;
      const polys = featureRings(ft);
      const p = polys.find((pp) => inPoly(pt, pp));
      if (p) { hit = ft; hitPoly = p; break; }
    }
    if (!hit) return null;
    const id = fid(hit);
    // pezzi del campo nei tasselli vicini (i campi grandi sono tagliati ai bordi del tassello)
    const pieces = [];
    const touches = { l: false, r: false, t: false, b: false };
    const addFrom = (ly2, dx, dy, onlyHit) => {
      (onlyHit ? [hit] : ly2.features.filter((f) => f.type === 3 && id != null && fid(f) === id)).forEach((ft) => {
        featureRings(ft).forEach((poly) => {
          if (onlyHit && poly !== hitPoly && !featureRings(hit).length) return;
          const clipped = poly.map((r) => clipRing(r, ly2.extent)).filter(Boolean);
          if (!clipped.length) return;
          poly[0].forEach(([px, py]) => { if (px <= 0) touches.l = true; if (px >= ly2.extent) touches.r = true; if (py <= 0) touches.t = true; if (py >= ly2.extent) touches.b = true; });
          pieces.push(clipped.map((r) => r.map(([px, py]) => tileToLonLat(x + dx, y + dy, px, py, ly2.extent, z))));
        });
      });
    };
    // solo il poligono colpito (non tutte le parti multiple del feature), poi i vicini con lo stesso id
    const clippedHit = hitPoly.map((r) => clipRing(r, E)).filter(Boolean);
    hitPoly[0].forEach(([px, py]) => { if (px <= 0) touches.l = true; if (px >= E) touches.r = true; if (py <= 0) touches.t = true; if (py >= E) touches.b = true; });
    pieces.push(clippedHit.map((r) => r.map(([px, py]) => tileToLonLat(x, y, px, py, E, z))));
    if (id != null && (touches.l || touches.r || touches.t || touches.b)) {
      const nb = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        if ((dx === -1 && !touches.l) || (dx === 1 && !touches.r) || (dy === -1 && !touches.t) || (dy === 1 && !touches.b)) continue;
        nb.push(getTileLayer(z, x + dx, y + dy).then((l2) => l2 && addFrom(l2, dx, dy, false)));
      }
      await Promise.all(nb);
    }
    return { type: "Feature", properties: { ...hit.props, _id: id }, geometry: { type: "MultiPolygon", coordinates: pieces } };
  }

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
    current.cty = h;
    el.innerHTML = h.length ? `<b>${lt("cty_title")}:</b> ` + h.slice().reverse().map((r) =>
      `<span class="cty-chip cty${r.cls}">${r.year} ${CTY_NOMI[r.cls] ? CTY_NOMI[r.cls][LANG === "it" ? 0 : 1] : r.cls} <small>${Math.round(r.share * 100)}%</small></span>`).join(" ")
      : `<span class="hint small">${lt("cty_none")}</span>`;
  }

  // ================================================================== serie temporali
  let current = null; // { feature, ll, s2:[], s1:[], meteo:{}, range }
  let range = "sm";
  let year = null; // annata scelta (null = automatica)
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
    if (r === "12m") return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
    const Y = selYear();
    return r === "jan" ? new Date(Date.UTC(Y, 0, 1)) : new Date(Date.UTC(Y, 10, 11));
  }
  function endDate(r) {
    const now = new Date();
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
    const keys = ["ndvi", "ndre", "ndmi", "evi", "savi", "cire", "ndwi", "nbr", "cloud"];
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
        if (cl > 0.05) { cloudy++; break; }
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
    setStatus(lt("done", { ok: current.s2.length, t: dates.length, c: cloudy }));
    drawIndex(); drawSummary();
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
    drawRadar();
  }

  async function loadMeteo(my) {
    const ll = current.ll, start = startDate(range), end = endDate(range);
    const recent = new Date(Date.now() - 6 * 86400000);
    const archEnd = end < recent ? end : recent;
    const vars = "precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration";
    const out = {};
    const add = (j, fc) => {
      if (!j || !j.daily) return;
      j.daily.time.forEach((d, i) => {
        if (out[d] && !fc) return;
        out[d] = { date: d, t: Date.parse(d), rain: j.daily.precipitation_sum[i], tmean: j.daily.temperature_2m_mean[i],
          tmax: j.daily.temperature_2m_max[i], tmin: j.daily.temperature_2m_min[i], et0: j.daily.et0_fao_evapotranspiration[i], fc: false };
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
    drawMeteo(); drawSummary();
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
          <span class="fp-src">${f.properties._square ? lt("no_field") : f.properties._seg ? lt("field_seg") : lt("field_src")}</span></div>
        <div class="fp-ctrl">
          ${["sm", "jan", "12m"].map((r) => `<button class="seg ${r === range ? "active" : ""}" data-r="${r}">${lt(r === "sm" ? "from_sm" : r === "jan" ? "from_jan" : "last12")}</button>`).join("")}
          ${range !== "12m" ? `<select id="fpYear" class="seg">${yearOptions()}</select>` : ""}
          <button id="fpRadar" class="small-btn">${lt("radar")}</button>
          <button id="fpCsv" class="small-btn">${lt("csv")}</button>
          <button id="fpClose" class="icon-x" title="${lt("close")}">×</button>
        </div>
      </div>
      <div id="fpStatus" class="fp-status"></div>
      <div id="fpCty" class="fp-cty"></div>
      <div id="fpCrop" class="fp-crop"></div>
      <div id="fpSummary" class="fp-summary"></div>
      <div class="chips">${INDEX_DEF.map(([k, c]) => `<label class="chip"><input type="checkbox" data-k="${k}" ${shown.has(k) ? "checked" : ""}><i style="background:${c}"></i>${lt("idx_" + k)}</label>`).join("")}</div>
      <div class="fp-charts">
        <figure><figcaption>${lt("ch_index")}</figcaption><div class="cbox"><canvas id="chIndex"></canvas></div></figure>
        <figure><figcaption>${lt("ch_meteo")}</figcaption><div class="cbox"><canvas id="chMeteo"></canvas></div></figure>
        <figure id="radarFig" hidden><figcaption>${lt("ch_radar")}</figcaption><div class="cbox"><canvas id="chRadar"></canvas></div>
          <p class="hint small">${lt("radar_hint")}</p></figure>
      </div>
      <p class="hint small fp-foot">${lt("s2_src")} ${lt("meteo_src")} ${lt("et_note")}</p>`;
    panel().hidden = false;
    document.body.classList.add("fp-open");
    setTimeout(() => map.invalidateSize(), 50);
    panel().querySelectorAll("button.seg").forEach((b) => (b.onclick = () => { range = b.dataset.r; year = null; run(); }));
    const ys = document.getElementById("fpYear");
    if (ys) ys.onchange = () => { year = +ys.value; run(); };
    document.getElementById("fpClose").onclick = close;
    panel().querySelectorAll(".chip input").forEach((c) => (c.onchange = () => { c.checked ? shown.add(c.dataset.k) : shown.delete(c.dataset.k); drawIndex(); }));
    document.getElementById("fpCsv").onclick = exportCsv;
    document.getElementById("fpRadar").onclick = () => { document.getElementById("radarFig").hidden = false; loadS1(); };
    Object.values(charts).forEach((c) => c.destroy());
    charts = {};
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
    plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } },
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
    const d = (current.s2 || []).slice().sort((a, b) => a.t - b.t);
    const sets = INDEX_DEF.filter(([k]) => shown.has(k)).map(([k, color, axis]) => ({ type: "line", label: lt("idx_" + k), yAxisID: axis,
      data: d.map((r) => ({ x: r.t, y: r[k] })), borderColor: color, backgroundColor: color, pointRadius: 2.2, borderWidth: 1.6, tension: 0.25 }));
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
  function waterBalance() {
    const m = (current.meteo || []).filter((r) => !r.fc), s2 = (current.s2 || []).slice().sort((a, b) => a.t - b.t);
    if (!m.length) return null;
    const kcAt = (t) => {
      if (!s2.length) return null;
      if (t <= s2[0].t) return s2[0].kc;
      if (t >= s2[s2.length - 1].t) return s2[s2.length - 1].kc;
      let i = 0; while (s2[i + 1].t < t) i++;
      const a = s2[i], b = s2[i + 1], w = (t - a.t) / (b.t - a.t);
      return a.kc + w * (b.kc - a.kc);
    };
    let rain = 0, et0 = 0, etc = 0, gdd = 0;
    m.forEach((r) => {
      rain += r.rain || 0; et0 += r.et0 || 0;
      const kc = kcAt(r.t); if (kc != null) etc += kc * (r.et0 || 0);
      gdd += Math.max(0, (r.tmax + r.tmin) / 2 - 10);
    });
    return { rain, et0, etc: s2.length ? etc : null, gdd };
  }

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
    const el = document.getElementById("fpSummary");
    if (!el) return;
    const s2 = current.s2 || [];
    const wb = waterBalance();
    const last = s2[s2.length - 1], max = s2.reduce((a, r) => (!a || r.ndvi > a.ndvi ? r : a), null);
    const mean = s2.length ? s2.reduce((a, r) => a + r.ndvi, 0) / s2.length : null;
    const d0 = startDate(range).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
    el.innerHTML = [
      wb ? `<span><em>${lt("sum_rain", { d: d0 })}</em><b>${wb.rain.toFixed(0)} mm</b></span>` : "",
      wb ? `<span><em>${lt("et0")}</em><b>${wb.et0.toFixed(0)} mm</b></span>` : "",
      wb && wb.etc != null ? `<span><em>${lt("etc")}</em><b>${wb.etc.toFixed(0)} mm</b></span>` : "",
      wb && wb.etc != null ? `<span><em>${lt("balance")}</em><b>${(wb.rain - wb.etc).toFixed(0)} mm</b></span>` : "",
      wb ? `<span><em>${lt("sum_gdd")}</em><b>${wb.gdd.toFixed(0)}</b></span>` : "",
      mean != null ? `<span><em>${lt("ndvi_mean")}</em><b>${mean.toFixed(2)}</b></span>` : "",
      last ? `<span><em>${lt("sum_last")}</em><b>${last.ndvi.toFixed(2)}</b> <small>${fmtDate(last.t)}</small></span>` : "",
      max ? `<span><em>${lt("sum_max")}</em><b>${max.ndvi.toFixed(2)}</b> <small>${fmtDate(max.t)}</small></span>` : "",
    ].join("");
    const cb = document.getElementById("fpCrop");
    if (cb) {
      const c = classifyCrop(s2);
      current.crop = c;
      cb.innerHTML = c ? `<b>${lt("crop")}:</b> ${c.label} <small>(${c.why}${c.conf && c.conf !== "—" ? `; ${LANG === "it" ? "affidabilità" : "confidence"} ${c.conf}` : ""})</small><div class="hint small">${lt("crop_note")}</div>`
        : (s2.length ? `<span class="hint small">${lt("crop_short")}</span>` : "");
    }
  }

  function exportCsv() {
    if (!current) return;
    const IK = INDEX_DEF.map((x) => x[0]);
    const E = (n) => Array(n).fill("");
    const ctyHead = (current.cty || []).map((r) => `${r.year}:${CTY_NOMI[r.cls] ? CTY_NOMI[r.cls][0] : r.cls}(${Math.round(r.share * 100)}%)`).join(" ");
    const rows = [["source", "date", ...IK, "pixels", "vv_db", "vh_db", "orbit", "rain_mm", "tmean_c", "tmin_c", "tmax_c", "et0_mm", "forecast"]];
    (current.s2 || []).forEach((r) => rows.push(["sentinel-2", r.date, ...IK.map((k) => (isFinite(r[k]) ? r[k].toFixed(4) : "")), r.npx, ...E(9)]));
    (current.s1 || []).forEach((r) => rows.push(["sentinel-1", r.date, ...E(IK.length + 1), r.vv.toFixed(2), r.vh.toFixed(2), r.orbit, ...E(6)]));
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
  function close() {
    runId++;
    panel().hidden = true;
    document.body.classList.remove("fp-open");
    if (highlight) { map.removeLayer(highlight); highlight = null; }
    current = null;
    setTimeout(() => map.invalidateSize(), 50);
  }

  function run() {
    const my = ++runId;
    current.s2 = []; current.s1 = []; current.meteo = [];
    renderPanel();
    setStatus(lt("loading_meteo"));
    loadMeteo(my).catch((e) => setStatus(lt("err", { e: e.message })));
    loadS2(my).catch((e) => setStatus(lt("err", { e: e.message })));
    showCropHistory(my).catch(() => {});
  }

  async function onMapClick(ll) {
    let feature = Segment.fieldAt(ll);
    if (!feature) { try { feature = await findField(ll); } catch (e) { console.warn("field lookup", e); } }
    if (!feature) feature = squareAround(ll);
    if (highlight) map.removeLayer(highlight);
    highlight = L.geoJSON(feature, { style: { color: "#ffd84a", weight: 3, fillColor: "#ffd84a", fillOpacity: 0.12 }, interactive: false }).addTo(map);
    current = { feature, ll };
    run();
    return feature;
  }

  return { cropHistory, makeS2Layer, makeFieldsLayer, windowControl, bindWindowControl, segControl, periodRange, onMapClick, findField, refreshLang: () => current && run(), _debug: () => current };
})();
