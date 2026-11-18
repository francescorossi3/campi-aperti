// Columella – croplayer.js
// IT: strati raster letti da Cloud Optimized GeoTIFF (COG) su Hugging Face con geotiff.js (letture HTTP
//     parziali) e colorati nel browser. Globali principali:
//       CogLayer  livello Leaflet generico (EPSG:3035 o EPSG:4326) con funzione di colore per valore
//       Suolo     SoilGrids 0–30 cm (tessitura, sabbia, limo, argilla, SOC, azoto, pH…) e valori sul campo
//       CropLayer colture Copernicus HRL Crop Types (classi 1..19)
//       Clms      variabili biogeofisiche Copernicus (LAI, FAPAR, FCOVER, NDVI 300 m, GDMP, SWI, SSM, ETa)
//       COLORMAPS, rampFn, rampBar, cmapCols, CROP_COLORS: scale colori condivise con app.js, live.js, tools.js, mapstyle.js
//       fieldValues / fieldMean: valori (o media) di un COG dentro il poligono di un campo
//     Dipendenze: Leaflet (L), GeoTIFF e proj4 (js/vendor), LANG (app.js), data/clms_indice.json.
//     Va caricato prima di layers.js, che usa Suolo.P e Clms.P.
// EN: COG raster layers from Hugging Face drawn in the browser (CogLayer, Suolo, CropLayer, Clms) plus
//     shared colour ramps. Needs Leaflet, GeoTIFF, proj4, LANG; must load before layers.js.

const HF_RAW = "https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/";
const CROP_COLORS = {
  1: "#e6b422", 2: "#f2d16b", 3: "#f08a24", 4: "#5bc0de", 5: "#d9c27a", 6: "#7fc97f", 7: "#b5651d", 8: "#c49a6c",
  9: "#c0398f", 10: "#ffe600", 11: "#9acd32", 12: "#fff176", 13: "#4db6ac", 14: "#8e44ad", 15: "#556b2f",
  16: "#e74c3c", 17: "#a0522d", 18: "#bdbdbd", 19: "#7f8c8d",
};
const CROP_NAMES = { 1: ["Frumento", "Wheat"], 2: ["Orzo", "Barley"], 3: ["Mais", "Maize"], 4: ["Riso", "Rice"], 5: ["Altri cereali", "Other cereals"],
  6: ["Ortaggi", "Vegetables"], 7: ["Legumi secchi", "Dry pulses"], 8: ["Patate", "Potatoes"], 9: ["Barbabietola", "Sugar beet"], 10: ["Girasole", "Sunflower"],
  11: ["Soia", "Soybeans"], 12: ["Colza", "Rapeseed"], 13: ["Lino/cotone/canapa", "Flax/cotton/hemp"], 14: ["Vite", "Grapes"], 15: ["Olivo", "Olives"],
  16: ["Frutta", "Fruits"], 17: ["Frutta a guscio", "Nuts"], 18: ["Seminativo n.c.", "Unclassified annual"], 19: ["Permanente n.c.", "Unclassified permanent"] };
// [r, g, b] da "#rrggbb"
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// scale colori comuni a tutte le mappe (nomi = colormap di titiler/matplotlib, così valgono anche per i tasselli Sentinel-2)
const COLORMAPS = {
  rdylgn: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
  viridis: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
  magma: ["#000004", "#180f3d", "#440f76", "#721f81", "#9e2f7f", "#cd4071", "#f1605d", "#fd9668", "#feca8d", "#fcfdbf"],
  spectral: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
  ylgn: ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#006837", "#004529", "#00301c"],
  ylorbr: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#993404", "#662506", "#3d1503"],
  blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b", "#041c3f"],
  rdbu: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
  brbg: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
  purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d", "#2a0054"],
  greys: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#3b3b3b", "#252525", "#000000"],
};
const cmapCols = (st) => (st.rev ? COLORMAPS[st.cmap].slice().reverse() : COLORMAPS[st.cmap]);
// funzione valore -> [r,g,b] (interpolazione lineare nella scala); null per nodata (≤ -9000)
function rampFn(st) {          // st = { cmap, min, max, rev }
  const rr = cmapCols(st).map(hexRgb), a = +st.min, b = +st.max;
  return (v) => {
    if (!isFinite(v) || v <= -9000) return null;
    const u = Math.max(0, Math.min(1, (v - a) / (b - a || 1))) * (rr.length - 1);
    const i = Math.min(rr.length - 2, Math.floor(u)), f = u - i;
    return rr[i].map((c, k) => c + f * (rr[i + 1][k] - c));
  };
}
const rampBar = (st) => `<div class="fm-legend"><span>${st.min}</span><b class="fm-bar" style="background:linear-gradient(90deg,${cmapCols(st).join(",")})"></b><span>${st.max}${st.unit ? " " + st.unit : ""}</span></div>`;

// ---------------------------------------------------------------- livello COG generico
// livelli (overview) di un COG, con risoluzione e origine; una sola apertura per URL
const cogCache = {};
function cogImages(url) {
  if (!cogCache[url]) cogCache[url] = GeoTIFF.fromUrl(url).then(async (t) => {
    const n = await t.getImageCount(), list = [];
    for (let i = 0; i < n; i++) list.push(await t.getImage(i));
    const base = list[0], [ox, oy] = base.getOrigin(), [rx, ry] = base.getResolution();
    return list.map((im) => ({ im, rx: rx * (base.getWidth() / im.getWidth()), ry: -ry * (base.getHeight() / im.getHeight()), ox, oy, W: im.getWidth(), H: im.getHeight() }));
  });
  return cogCache[url];
}
const CogLayer = L.GridLayer.extend({
  // opts: url, crs ("EPSG:3035" | "EPSG:4326"), color(v) -> [r,g,b] | null
  setUrl(url) { this.options.url = url; this.redraw(); },
  setColor(fn) { this.options.color = fn; this.redraw(); },
  createTile(coords, done) {
    const tile = document.createElement("canvas"), size = this.getTileSize();
    tile.width = size.x; tile.height = size.y;
    this._draw(tile, coords).then(() => done(null, tile)).catch((e) => done(e, tile));
    return tile;
  },
  async _draw(tile, coords) {
    const ims = await cogImages(this.options.url), geo = this.options.crs === "EPSG:4326";
    const S = tile.width, n = Math.pow(2, coords.z);
    const latOf = (Y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / n))) * 180) / Math.PI;
    const mpp = (40075016 * Math.cos((latOf(coords.y + 0.5) * Math.PI) / 180)) / (n * S);
    // overview più grossolana con risoluzione ancora ≤ 1,5 × quella del tassello
    let lev = ims[0];
    for (const l of ims) if ((geo ? l.rx * 111320 : l.rx) <= mpp * 1.5) lev = l;
    // coordinate di ogni pixel su una griglia 16×16 interpolata
    const G = 16, step = S / G, pts = [];
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const lon = ((coords.x + (i * step) / S) / n) * 360 - 180, la = latOf(coords.y + (j * step) / S);
      pts.push(geo ? [lon, la] : proj4("EPSG:4326", "EPSG:3035", [lon, la]));
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - lev.ox) / lev.rx)), c1 = Math.min(lev.W, Math.ceil((Math.max(...xs) - lev.ox) / lev.rx));
    const r0 = Math.max(0, Math.floor((lev.oy - Math.max(...ys)) / lev.ry)), r1 = Math.min(lev.H, Math.ceil((lev.oy - Math.min(...ys)) / lev.ry));
    if (c1 <= c0 || r1 <= r0) return;
    const [band] = await lev.im.readRasters({ window: [c0, r0, c1, r1], samples: [0] });
    const W = c1 - c0, ctx = tile.getContext("2d"), img = ctx.createImageData(S, S), color = this.options.color;
    for (let py = 0; py < S; py++) {
      const gj = py / step, j0 = Math.min(G - 1, Math.floor(gj)), fj = gj - j0;
      for (let px = 0; px < S; px++) {
        const gi = px / step, i0 = Math.min(G - 1, Math.floor(gi)), fi = gi - i0;
        const a = pts[j0 * (G + 1) + i0], b = pts[j0 * (G + 1) + i0 + 1], c = pts[(j0 + 1) * (G + 1) + i0], d = pts[(j0 + 1) * (G + 1) + i0 + 1];
        const x = (a[0] * (1 - fi) + b[0] * fi) * (1 - fj) + (c[0] * (1 - fi) + d[0] * fi) * fj;
        const y = (a[1] * (1 - fi) + b[1] * fi) * (1 - fj) + (c[1] * (1 - fi) + d[1] * fi) * fj;
        const cc = Math.floor((x - lev.ox) / lev.rx) - c0, rr = Math.floor((lev.oy - y) / lev.ry) - r0;
        if (cc < 0 || rr < 0 || cc >= W || rr >= r1 - r0) continue;
        const col = color(band[rr * W + cc]);
        if (!col) continue;
        img.data.set([col[0], col[1], col[2], 230], (py * S + px) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
  },
});

// valori di un COG geografico (EPSG:4326) sul poligono: pixel col centro dentro il campo, altrimenti quello del centro
async function fieldValues(url, feature, categorical = false) {
  const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const all = polys.flat(2), lo0 = Math.min(...all.map((q) => q[0])), lo1 = Math.max(...all.map((q) => q[0])), la0 = Math.min(...all.map((q) => q[1])), la1 = Math.max(...all.map((q) => q[1]));
  const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
  const inside = (x, y) => polys.some((pl) => inRing(x, y, pl[0]) && !pl.slice(1).some((h) => inRing(x, y, h)));
  const [lev] = await cogImages(url);
  const c0 = Math.floor((lo0 - lev.ox) / lev.rx), c1 = Math.floor((lo1 - lev.ox) / lev.rx) + 1;
  const r0 = Math.floor((lev.oy - la1) / lev.ry), r1 = Math.floor((lev.oy - la0) / lev.ry) + 1;
  const [b] = await lev.im.readRasters({ window: [c0, r0, c1, r1], samples: [0] });
  const W = c1 - c0, nd = lev.im.getGDALNoData(), vals = [];
  const ok = (v) => isFinite(v) && v !== nd && v > -9000 && !(categorical && v === 0);
  for (let r = 0; r < r1 - r0; r++) for (let c = 0; c < W; c++) {
    const v = b[r * W + c];
    if (ok(v) && inside(lev.ox + (c0 + c + 0.5) * lev.rx, lev.oy - (r0 + r + 0.5) * lev.ry)) vals.push(v);
  }
  if (!vals.length) { const v = b[Math.floor((r1 - r0) / 2) * W + Math.floor(W / 2)]; if (ok(v)) vals.push(v); }
  return vals;
}
// media sul campo (classe più frequente se categorico)
async function fieldMean(url, feature, categorical = false) {
  const vals = await fieldValues(url, feature, categorical);
  if (!vals || !vals.length) return null;
  if (categorical) {   // classe più frequente
    const cnt = {};
    vals.forEach((v) => (cnt[v] = (cnt[v] || 0) + 1));
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    return { mean: +top, n: vals.length };
  }
  return { mean: vals.reduce((a, v) => a + v, 0) / vals.length, n: vals.length };
}

// ---------------------------------------------------------------- suolo (SoilGrids 0–30 cm, COG Italia)
const Suolo = (() => {
  const URL = (n) => `${HF_RAW}suolo/${n}.tif`;
  // [min, max, unità, it, en, scala colori]
  const P = {
    tessitura: [1, 12, "", "Classe tessiturale (USDA)", "Texture class (USDA)"],
    sabbia: [5, 80, "%", "Sabbia", "Sand", "ylorbr"], limo: [10, 65, "%", "Limo", "Silt", "ylgn"], argilla: [5, 55, "%", "Argilla", "Clay", "purples"],
    soc: [5, 40, "g/kg", "Carbonio organico", "Organic carbon", "ylorbr"], stock_soc: [20, 120, "t C/ha", "Stock di carbonio 0–30 cm", "Carbon stock 0–30 cm", "ylorbr"],
    azoto: [0.5, 3, "g/kg", "Azoto totale", "Total nitrogen", "blues"], ph: [5, 8.5, "", "pH", "pH", "rdbu"],
  };
  const style0 = (n) => ({ cmap: P[n][5], min: P[n][0], max: P[n][1], rev: false, unit: P[n][2] });
  const TEX = { 1: ["#f4e04d", "sabbioso", "sand"], 2: ["#e8c547", "sabbioso-franco", "loamy sand"], 3: ["#d9a441", "franco-sabbioso", "sandy loam"],
    4: ["#a3b86c", "franco", "loam"], 5: ["#7fbf7b", "franco-limoso", "silt loam"], 6: ["#4aa564", "limoso", "silt"],
    7: ["#c97b42", "franco-sabbioso-argilloso", "sandy clay loam"], 8: ["#a6611a", "franco-argilloso", "clay loam"], 9: ["#6a8f9c", "franco-limoso-argilloso", "silty clay loam"],
    10: ["#b2453b", "argilloso-sabbioso", "sandy clay"], 11: ["#5e6fa3", "argilloso-limoso", "silty clay"], 12: ["#6b3a7d", "argilloso", "clay"] };
  const texRgb = Object.fromEntries(Object.entries(TEX).map(([k, v]) => [k, hexRgb(v[0])]));
  // opts.color (facoltativo): funzione colore dello stile scelto dall'utente
  const layer = (n, opts) => new CogLayer({ url: URL(n), crs: "EPSG:4326", color: n === "tessitura" ? (v) => texRgb[v] || null : rampFn(style0(n)), ...opts });
  const texLegend = () => `<div class="crop-legend">${Object.values(TEX).map((t) => `<span><i style="background:${t[0]}"></i>${t[LANG === "it" ? 1 : 2]}</span>`).join("")}</div>`;
  // tutti i valori del campo
  async function field(feature) {
    const names = ["sabbia", "limo", "argilla", "soc", "azoto", "ph", "densita", "stock_soc", "tessitura"];
    const res = await Promise.all(names.map((n) => fieldMean(URL(n), feature, n === "tessitura").catch(() => null)));
    const o = {}; names.forEach((n, i) => (o[n] = res[i] ? res[i].mean : null));
    o.texName = o.tessitura && TEX[o.tessitura] ? TEX[o.tessitura][LANG === "it" ? 1 : 2] : null;
    return o;
  }
  return { P, layer, texLegend, style0, field, TEX, url: URL };
})();

// ---------------------------------------------------------------- colture Copernicus
const CropLayer = (() => {
  const URL = (y) => `${HF_RAW}crop_types/cty_${y}_italia_3035.tif`;
  const rgb = Object.fromEntries(Object.entries(CROP_COLORS).map(([k, h]) => [k, hexRgb(h)]));
  const Layer = CogLayer.extend({
    initialize(year, opts) { CogLayer.prototype.initialize.call(this, { ...opts, url: URL(year), crs: "EPSG:3035", color: (v) => rgb[v] }); },
    setYear(y) { this.setUrl(URL(y)); },
  });
  const legendHtml = () => `<div class="crop-legend">${Object.keys(CROP_NAMES).map((k) =>
    `<span><i style="background:${CROP_COLORS[k]}"></i>${CROP_NAMES[k][LANG === "it" ? 0 : 1]}</span>`).join("")}</div>`;
  return { Layer, legendHtml };
})();

// ---------------------------------------------------------------- variabili biogeofisiche Copernicus
const Clms = (() => {
  // prodotto: [min, max, unità, scala, etichetta it, etichetta en]
  const P = {
    LAI: [0, 5, "m²/m²", "rdylgn", "LAI — area fogliare", "LAI — leaf area index"],
    FAPAR: [0, 0.9, "", "rdylgn", "FAPAR — radiazione assorbita", "FAPAR — absorbed radiation"],
    FCOVER: [0, 1, "", "rdylgn", "FCOVER — copertura verde", "FCOVER — green cover"],
    NDVI: [0, 0.9, "", "rdylgn", "NDVI 300 m", "NDVI 300 m"],
    GDMP: [0, 150, "kg/ha/giorno", "ylgn", "GDMP — produttività (sostanza secca)", "GDMP — productivity (dry matter)"],
    SWI: [0, 100, "%", "blues", "SWI — umidità del suolo (radici)", "SWI — soil water index"],
    SSM: [0, 100, "%", "blues", "SSM — umidità superficiale del suolo (1 km)", "SSM — surface soil moisture (1 km)"],
    ETA: [0, 6, "mm/giorno", "blues", "ET reale (evapotraspirazione)", "Actual evapotranspiration"],
  };
  const url = (p, d) => (p === "ETA" ? `${HF_RAW}eta/italia/ETA300_${d}_ET-ENSEMBLE.tif` : `${HF_RAW}clms/${p}/${d}.tif`);
  let index = null;
  const loadIndex = () => (index ||= fetch("data/clms_indice.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  const style0 = (p) => ({ cmap: P[p][3], min: P[p][0], max: P[p][1], rev: false, unit: P[p][2] });
  const layer = (p, d, opts) => new CogLayer({ url: url(p, d), crs: "EPSG:4326", color: rampFn(style0(p)), ...opts });
  const label = (p) => P[p][LANG === "it" ? 4 : 5];
  // serie temporale della media sul campo, 4 letture in parallelo
  async function series(p, feature, dates, onStep) {
    const out = []; let k = 0;
    const queue = dates.slice();
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const d = queue.shift();
        const m = await fieldMean(url(p, d), feature).catch(() => null);
        if (m) out.push({ x: Date.parse(d), y: m.mean, n: m.n });
        onStep && onStep(++k, dates.length);
      }
    }));
    return out.sort((a, b) => a.x - b.x);
  }
  return { P, loadIndex, layer, label, style0, series, url };
})();
