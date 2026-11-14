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
  cloud: "((SCL==3)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==0)|(SCL==1))*1.0",
};

const LT = {
  it: {
    window: "Immagini degli ultimi",
    days: "giorni",
    live_note: "Mosaico delle immagini Sentinel-2 più recenti con meno del 20% di nuvole. Visibile da zoom 10.",
    panel_title: "Campo",
    no_field: "Nessun campo rilevato qui: uso un quadrato di 40 m attorno al punto.",
    field_src: "Confine: Fields of The World 2025",
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
    window: "Images from the last",
    days: "days",
    live_note: "Mosaic of the most recent Sentinel-2 images with less than 20% clouds. Visible from zoom 10.",
    panel_title: "Field",
    no_field: "No field detected here: using a 40 m square around the point.",
    field_src: "Boundary: Fields of The World 2025",
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
  // ================================================================== mappe Sentinel-2 in tempo reale
  let windowDays = 20;
  let searchId = null, searchPromise = null;
  const liveLayers = new Set();

  function registerMosaic() {
    const end = new Date(), start = new Date(Date.now() - windowDays * 86400000);
    const body = {
      collections: ["sentinel-2-l2a"],
      "filter-lang": "cql2-json",
      filter: { op: "and", args: [
        { op: "<=", args: [{ property: "eo:cloud_cover" }, 20] },
        { op: "anyinteracts", args: [{ property: "datetime" }, { interval: [start.toISOString(), end.toISOString()] }] },
      ] },
      sortby: [{ field: "datetime", direction: "desc" }],
    };
    searchPromise = fetch(`${PC}/data/v1/mosaic/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json()).then((j) => (searchId = j.searchid || j.id));
    return searchPromise;
  }

  function s2Url(def) {
    let q = `collection=sentinel-2-l2a&nodata=0`;
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

  function setWindow(days) {
    windowDays = days;
    searchId = null;
    registerMosaic().then(() => liveLayers.forEach(({ def, layer }) => layer.setUrl(s2Url(def))));
  }

  function windowControl() {
    return `<div class="live-window">${lt("window")}
      <select id="liveWindow">${[10, 20, 45, 90].map((d) => `<option value="${d}" ${d === windowDays ? "selected" : ""}>${d}</option>`).join("")}</select>
      ${lt("days")}</div><p class="hint small">${lt("live_note")}</p>`;
  }
  function bindWindowControl() {
    const sel = document.getElementById("liveWindow");
    if (sel) sel.onchange = () => setWindow(+sel.value);
  }

  // ================================================================== confini dei campi (PMTiles)
  const pm = new pmtiles.PMTiles(FTW_ITALY);
  let pmHeader = null;
  const headerP = pm.getHeader().then((h) => (pmHeader = h)).catch((e) => console.warn("PMTiles", e));

  function makeFieldsLayer(def) {
    return protomapsL.leafletLayer({
      url: FTW_ITALY,
      maxDataZoom: pmHeader ? pmHeader.maxZoom : 14,
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
  const fid = (ft) => (ft.props && (ft.props.id ?? ft.props["id"])) ?? ft.id;

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

  // ================================================================== serie temporali
  let current = null; // { feature, ll, s2:[], s1:[], meteo:{}, range }
  let range = "sm";
  let charts = {};
  let runId = 0;

  function startDate(r) {
    const now = new Date(), y = now.getFullYear();
    if (r === "jan") return new Date(Date.UTC(y, 0, 1));
    if (r === "12m") return new Date(Date.UTC(y - 1, now.getMonth(), now.getDate()));
    const sm = new Date(Date.UTC(y, 10, 11));
    return now >= sm ? sm : new Date(Date.UTC(y - 1, 10, 11));
  }
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
    const f = current.feature, start = iso(startDate(range)), end = iso(new Date());
    const items = await stacSearch("sentinel-2-l2a", f.geometry, start, end, { query: { "eo:cloud_cover": { lt: 85 } } });
    if (my !== runId) return;
    const byDate = {};
    items.forEach((it) => { const d = it.properties.datetime.slice(0, 10); (byDate[d] = byDate[d] || []).push(it); });
    const dates = Object.keys(byDate).sort();
    const exprs = [S2_INDEX.ndvi, S2_INDEX.ndre, S2_INDEX.ndmi, S2_INDEX.cloud];
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
        const cl = v[3].mean;
        if (cl > 0.05) { cloudy++; break; }
        current.s2.push({ date: d, t: Date.parse(d), ndvi: v[0].mean, ndre: v[1].mean, ndmi: v[2].mean, ndvi_sd: v[0].std, cloud: cl, item: it.id });
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
    const my = runId, f = current.feature, start = iso(startDate(range)), end = iso(new Date());
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
    const ll = current.ll, start = startDate(range);
    const archEnd = new Date(Date.now() - 6 * 86400000);
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
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_days=10&forecast_days=7&daily=${vars}&timezone=Europe%2FRome`).then((r) => r.json()).catch(() => null),
    ]);
    if (my !== runId) return;
    add(a, false); add(b, true);
    const today = iso(new Date());
    Object.values(out).forEach((r) => (r.fc = r.date > today));
    current.meteo = Object.values(out).filter((r) => r.date >= iso(start) && r.tmean != null).sort((x, y) => x.t - y.t);
    drawMeteo(); drawSummary();
  }

  // ================================================================== pannello e grafici
  const panel = () => document.getElementById("fieldPanel");
  function setStatus(s) { const el = document.getElementById("fpStatus"); if (el) el.textContent = s; }

  function renderPanel() {
    const f = current.feature;
    const ha = areaHa(f.geometry);
    panel().innerHTML = `
      <div class="fp-head">
        <div class="fp-title"><b>${lt("panel_title")}</b> · ${lt("area")} ${ha < 1 ? (ha * 10000).toFixed(0) + " m²" : ha.toFixed(2) + " ha"}
          <span class="fp-src">${f.properties._square ? lt("no_field") : lt("field_src")}</span></div>
        <div class="fp-ctrl">
          ${["sm", "jan", "12m"].map((r) => `<button class="seg ${r === range ? "active" : ""}" data-r="${r}">${lt(r === "sm" ? "from_sm" : r === "jan" ? "from_jan" : "last12")}</button>`).join("")}
          <button id="fpRadar" class="small-btn">${lt("radar")}</button>
          <button id="fpCsv" class="small-btn">${lt("csv")}</button>
          <button id="fpClose" class="icon-x" title="${lt("close")}">×</button>
        </div>
      </div>
      <div id="fpStatus" class="fp-status"></div>
      <div id="fpSummary" class="fp-summary"></div>
      <div class="fp-charts">
        <figure><figcaption>${lt("ch_index")}</figcaption><div class="cbox"><canvas id="chIndex"></canvas></div></figure>
        <figure><figcaption>${lt("ch_meteo")}</figcaption><div class="cbox"><canvas id="chMeteo"></canvas></div></figure>
        <figure id="radarFig" hidden><figcaption>${lt("ch_radar")}</figcaption><div class="cbox"><canvas id="chRadar"></canvas></div>
          <p class="hint small">${lt("radar_hint")}</p></figure>
      </div>
      <p class="hint small fp-foot">${lt("s2_src")} ${lt("meteo_src")}</p>`;
    panel().hidden = false;
    document.body.classList.add("fp-open");
    setTimeout(() => map.invalidateSize(), 50);
    panel().querySelectorAll(".seg").forEach((b) => (b.onclick = () => { range = b.dataset.r; run(); }));
    document.getElementById("fpClose").onclick = close;
    document.getElementById("fpCsv").onclick = exportCsv;
    document.getElementById("fpRadar").onclick = () => { document.getElementById("radarFig").hidden = false; loadS1(); };
    Object.values(charts).forEach((c) => c.destroy());
    charts = {};
  }

  const fmtDate = (t) => new Date(t).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { day: "2-digit", month: "short" });
  const xScale = () => ({ type: "linear", min: startDate(range).getTime(), max: Date.now() + 8 * 86400000,
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

  function drawIndex() {
    const d = (current.s2 || []).slice().sort((a, b) => a.t - b.t);
    const ds = (k, label, color) => ({ type: "line", label, data: d.map((r) => ({ x: r.t, y: r[k] })), borderColor: color, backgroundColor: color,
      pointRadius: 2.5, borderWidth: 1.6, tension: 0.25 });
    upsert("chIndex", { data: { datasets: [ds("ndvi", lt("ndvi_d"), "#2f8f3a"), ds("ndre", lt("ndre_d"), "#a3812c"), ds("ndmi", lt("ndmi_d"), "#2b6cb0")] },
      options: baseOpts({ y: { min: -0.2, max: 1, ticks: { font: { size: 10 } } } }) });
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

  function drawSummary() {
    const el = document.getElementById("fpSummary");
    if (!el) return;
    const m = (current.meteo || []).filter((r) => !r.fc), s2 = current.s2 || [];
    const rain = m.reduce((a, r) => a + (r.rain || 0), 0);
    const gdd = m.reduce((a, r) => a + Math.max(0, ((r.tmax + r.tmin) / 2) - 10), 0);
    const last = s2[s2.length - 1], max = s2.reduce((a, r) => (!a || r.ndvi > a.ndvi ? r : a), null);
    const d0 = startDate(range).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
    el.innerHTML = [
      m.length ? `<span><em>${lt("sum_rain", { d: d0 })}</em><b>${rain.toFixed(0)} mm</b></span>` : "",
      m.length ? `<span><em>${lt("sum_gdd")}</em><b>${gdd.toFixed(0)}</b></span>` : "",
      last ? `<span><em>${lt("sum_last")}</em><b>${last.ndvi.toFixed(2)}</b> <small>${fmtDate(last.t)}</small></span>` : "",
      max ? `<span><em>${lt("sum_max")}</em><b>${max.ndvi.toFixed(2)}</b> <small>${fmtDate(max.t)}</small></span>` : "",
    ].join("");
  }

  function exportCsv() {
    if (!current) return;
    const rows = [["source", "date", "ndvi", "ndre", "ndmi", "vv_db", "vh_db", "orbit", "rain_mm", "tmean_c", "tmin_c", "tmax_c", "et0_mm", "forecast"]];
    (current.s2 || []).forEach((r) => rows.push(["sentinel-2", r.date, r.ndvi.toFixed(4), r.ndre.toFixed(4), r.ndmi.toFixed(4), "", "", "", "", "", "", "", "", ""]));
    (current.s1 || []).forEach((r) => rows.push(["sentinel-1", r.date, "", "", "", r.vv.toFixed(2), r.vh.toFixed(2), r.orbit, "", "", "", "", "", ""]));
    (current.meteo || []).forEach((r) => rows.push(["open-meteo", r.date, "", "", "", "", "", "", r.rain, r.tmean, r.tmin, r.tmax, r.et0, r.fc ? 1 : 0]));
    const head = `# Campi Aperti — lat ${current.ll.lat.toFixed(6)}, lon ${current.ll.lng.toFixed(6)}, ${areaHa(current.feature.geometry).toFixed(3)} ha\n`;
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
  }

  async function onMapClick(ll) {
    let feature = null;
    try { feature = await findField(ll); } catch (e) { console.warn("field lookup", e); }
    if (!feature) feature = squareAround(ll);
    if (highlight) map.removeLayer(highlight);
    highlight = L.geoJSON(feature, { style: { color: "#ffd84a", weight: 3, fillColor: "#ffd84a", fillOpacity: 0.12 }, interactive: false }).addTo(map);
    current = { feature, ll };
    run();
    return feature;
  }

  return { makeS2Layer, makeFieldsLayer, windowControl, bindWindowControl, onMapClick, findField, refreshLang: () => current && run(), _debug: () => current };
})();
