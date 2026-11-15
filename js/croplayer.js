// Campi Aperti — strati raster letti da COG su Hugging Face con geotiff.js (letture parziali HTTP) e disegnati nel browser
//  CogLayer: livello generico (EPSG:3035 o EPSG:4326) con funzione di colore per valore
//  CropLayer: colture Copernicus HRL Crop Types (classi 1..19)
//  Clms: variabili biogeofisiche Copernicus (LAI, FAPAR, FCOVER, NDVI 300 m, GDMP, SWI, SSM, ETa) con scala colori e serie sul campo

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
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---------------------------------------------------------------- livello COG generico
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
  initialize(opts) { L.GridLayer.prototype.initialize.call(this, opts); },
  setUrl(url) { this.options.url = url; this.redraw(); },
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

// ---------------------------------------------------------------- colture Copernicus
const CropLayer = (() => {
  const URL = (y) => `${HF_RAW}crop_types/cty_${y}_italia_3035.tif`;
  const rgb = {};
  Object.entries(CROP_COLORS).forEach(([k, h]) => (rgb[k] = hexRgb(h)));
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
  const RAMP = ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"].map(hexRgb);
  const BLUE = ["#fff7ec", "#fee8c8", "#d9f0a3", "#addd8e", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"].map(hexRgb);
  // prodotto: [min, max, unità, scala, etichetta it, etichetta en, percorso]
  const P = {
    LAI: [0, 5, "m²/m²", RAMP, "LAI — area fogliare", "LAI — leaf area index"],
    FAPAR: [0, 0.9, "", RAMP, "FAPAR — radiazione assorbita", "FAPAR — absorbed radiation"],
    FCOVER: [0, 1, "", RAMP, "FCOVER — copertura verde", "FCOVER — green cover"],
    NDVI: [0, 0.9, "", RAMP, "NDVI 300 m", "NDVI 300 m"],
    GDMP: [0, 150, "kg/ha/giorno", RAMP, "GDMP — produttività (sostanza secca)", "GDMP — productivity (dry matter)"],
    SWI: [0, 100, "%", BLUE, "SWI — umidità del suolo (radici)", "SWI — soil water index"],
    SSM: [0, 100, "%", BLUE, "SSM — umidità superficiale del suolo (1 km)", "SSM — surface soil moisture (1 km)"],
    ETA: [0, 6, "mm/giorno", BLUE, "ET reale (evapotraspirazione)", "Actual evapotranspiration"],
  };
  const url = (p, d) => (p === "ETA" ? `${HF_RAW}eta/italia/ETA300_${d}_ET-ENSEMBLE.tif` : `${HF_RAW}clms/${p}/${d}.tif`);
  let index = null;
  const loadIndex = () => (index ||= fetch("data/clms_indice.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  const colorFn = (p) => { const [a, b, , ramp] = P[p]; return (v) => {
    if (!(v > -9000) || !isFinite(v)) return null;
    let u = Math.max(0, Math.min(1, (v - a) / (b - a))) * (ramp.length - 1); const i = Math.min(ramp.length - 2, Math.floor(u)), f = u - i;
    return ramp[i].map((c, k) => c + f * (ramp[i + 1][k] - c)); }; };
  const layer = (p, d, opts) => new CogLayer({ ...opts, url: url(p, d), crs: "EPSG:4326", color: colorFn(p) });
  const label = (p) => P[p][LANG === "it" ? 4 : 5];
  const legendHtml = (p) => { const [a, b, u, ramp] = P[p];
    return `<div class="fm-legend"><span>${a}</span><b class="fm-bar" style="background:linear-gradient(90deg,${ramp.map((c) => `rgb(${c})`).join(",")})"></b><span>${b} ${u}</span></div>`; };
  // media sul campo per ogni data (pixel il cui centro cade nel poligono; se nessuno, il pixel che contiene il centro)
  async function series(p, feature, dates, onStep) {
    const polys = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const all = polys.flat(2), lo0 = Math.min(...all.map((q) => q[0])), lo1 = Math.max(...all.map((q) => q[0])), la0 = Math.min(...all.map((q) => q[1])), la1 = Math.max(...all.map((q) => q[1]));
    const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
    const inside = (x, y) => polys.some((pl) => inRing(x, y, pl[0]) && !pl.slice(1).some((h) => inRing(x, y, h)));
    const out = [];
    let k = 0;
    const queue = dates.slice();
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const d = queue.shift();
        try {
          const [lev] = await cogImages(url(p, d));
          const c0 = Math.floor((lo0 - lev.ox) / lev.rx), c1 = Math.floor((lo1 - lev.ox) / lev.rx) + 1;
          const r0 = Math.floor((lev.oy - la1) / lev.ry), r1 = Math.floor((lev.oy - la0) / lev.ry) + 1;
          const [b] = await lev.im.readRasters({ window: [c0, r0, c1, r1], samples: [0] });
          const W = c1 - c0; let s = 0, n = 0;
          for (let r = 0; r < r1 - r0; r++) for (let c = 0; c < W; c++) {
            const v = b[r * W + c];
            if (v > -9000 && isFinite(v) && inside(lev.ox + (c0 + c + 0.5) * lev.rx, lev.oy - (r0 + r + 0.5) * lev.ry)) { s += v; n++; }
          }
          if (!n) { const v = b[Math.floor((r1 - r0) / 2) * W + Math.floor(W / 2)]; if (v > -9000 && isFinite(v)) { s = v; n = 1; } }
          if (n) out.push({ x: Date.parse(d), y: s / n, n });
        } catch (e) { /* data non leggibile */ }
        onStep && onStep(++k, dates.length);
      }
    }));
    return out.sort((a, b) => a.x - b.x);
  }
  return { P, loadIndex, layer, label, legendHtml, series, url };
})();
