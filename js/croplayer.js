// Campi Aperti — mappa delle colture Copernicus HRL Crop Types colorata per classe
// Legge i COG (EPSG:3035, classi 0..19) da Hugging Face a pezzi con geotiff.js e li riproietta nel browser.

const CROP_COLORS = {
  1: "#e6b422", 2: "#f2d16b", 3: "#f08a24", 4: "#5bc0de", 5: "#d9c27a", 6: "#7fc97f", 7: "#b5651d", 8: "#c49a6c",
  9: "#c0398f", 10: "#ffe600", 11: "#9acd32", 12: "#fff176", 13: "#4db6ac", 14: "#8e44ad", 15: "#556b2f",
  16: "#e74c3c", 17: "#a0522d", 18: "#bdbdbd", 19: "#7f8c8d",
};
const CROP_NAMES = { 1: ["Frumento", "Wheat"], 2: ["Orzo", "Barley"], 3: ["Mais", "Maize"], 4: ["Riso", "Rice"], 5: ["Altri cereali", "Other cereals"],
  6: ["Ortaggi", "Vegetables"], 7: ["Legumi secchi", "Dry pulses"], 8: ["Patate", "Potatoes"], 9: ["Barbabietola", "Sugar beet"], 10: ["Girasole", "Sunflower"],
  11: ["Soia", "Soybeans"], 12: ["Colza", "Rapeseed"], 13: ["Lino/cotone/canapa", "Flax/cotton/hemp"], 14: ["Vite", "Grapes"], 15: ["Olivo", "Olives"],
  16: ["Frutta", "Fruits"], 17: ["Frutta a guscio", "Nuts"], 18: ["Seminativo n.c.", "Unclassified annual"], 19: ["Permanente n.c.", "Unclassified permanent"] };

const CropLayer = (() => {
  const URL = (y) => `https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/crop_types/cty_${y}_italia_3035.tif`;
  const rgb = {};
  Object.entries(CROP_COLORS).forEach(([k, h]) => (rgb[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]));
  const tiffs = {};
  async function images(y) {
    if (!tiffs[y]) tiffs[y] = GeoTIFF.fromUrl(URL(y)).then(async (t) => {
      const n = await t.getImageCount(), list = [];
      for (let i = 0; i < n; i++) list.push(await t.getImage(i));
      const base = list[0], [ox, oy] = base.getOrigin(), [rx] = base.getResolution();
      return list.map((im) => ({ im, res: rx * (base.getWidth() / im.getWidth()), ox, oy, W: im.getWidth(), H: im.getHeight() }));
    });
    return tiffs[y];
  }

  const Layer = L.GridLayer.extend({
    initialize(year, opts) { this.year = year; L.GridLayer.prototype.initialize.call(this, opts); },
    setYear(y) { this.year = y; this.redraw(); },
    createTile(coords, done) {
      const tile = document.createElement("canvas");
      const size = this.getTileSize(); tile.width = size.x; tile.height = size.y;
      this._draw(tile, coords).then(() => done(null, tile)).catch((e) => done(e, tile));
      return tile;
    },
    async _draw(tile, coords) {
      const ims = await images(this.year);
      const S = tile.width, n = Math.pow(2, coords.z);
      // risoluzione del tassello in metri (circa) per scegliere la panoramica giusta
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (coords.y + 0.5)) / n))) * 180) / Math.PI;
      const mpp = (40075016 * Math.cos((lat * Math.PI) / 180)) / (n * S);
      let lev = ims[0];
      for (const l of ims) if (l.res <= mpp * 1.5) lev = l;
      // coordinate 3035 di ogni pixel (griglia 64×64 interpolata per velocità)
      const G = 16, step = S / G, pts = [];
      for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
        const X = coords.x + (i * step) / S, Y = coords.y + (j * step) / S;
        const lon = (X / n) * 360 - 180, la = (Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / n))) * 180) / Math.PI;
        pts.push(proj4("EPSG:4326", "EPSG:3035", [lon, la]));
      }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const c0 = Math.max(0, Math.floor((Math.min(...xs) - lev.ox) / lev.res)), c1 = Math.min(lev.W, Math.ceil((Math.max(...xs) - lev.ox) / lev.res));
      const r0 = Math.max(0, Math.floor((lev.oy - Math.max(...ys)) / lev.res)), r1 = Math.min(lev.H, Math.ceil((lev.oy - Math.min(...ys)) / lev.res));
      if (c1 <= c0 || r1 <= r0) return;
      const [band] = await lev.im.readRasters({ window: [c0, r0, c1, r1], samples: [0] });
      const W = c1 - c0, ctx = tile.getContext("2d"), img = ctx.createImageData(S, S);
      for (let py = 0; py < S; py++) {
        const gj = py / step, j0 = Math.min(G - 1, Math.floor(gj)), fj = gj - j0;
        for (let px = 0; px < S; px++) {
          const gi = px / step, i0 = Math.min(G - 1, Math.floor(gi)), fi = gi - i0;
          const a = pts[j0 * (G + 1) + i0], b = pts[j0 * (G + 1) + i0 + 1], c = pts[(j0 + 1) * (G + 1) + i0], d = pts[(j0 + 1) * (G + 1) + i0 + 1];
          const x = (a[0] * (1 - fi) + b[0] * fi) * (1 - fj) + (c[0] * (1 - fi) + d[0] * fi) * fj;
          const y = (a[1] * (1 - fi) + b[1] * fi) * (1 - fj) + (c[1] * (1 - fi) + d[1] * fi) * fj;
          const cc = Math.floor((x - lev.ox) / lev.res) - c0, rr = Math.floor((lev.oy - y) / lev.res) - r0;
          if (cc < 0 || rr < 0 || cc >= W || rr >= r1 - r0) continue;
          const v = band[rr * W + cc], col = rgb[v];
          if (!col) continue;
          const o = (py * S + px) * 4;
          img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 230;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
  });

  function legendHtml() {
    return `<div class="crop-legend">${Object.keys(CROP_NAMES).map((k) =>
      `<span><i style="background:${CROP_COLORS[k]}"></i>${CROP_NAMES[k][LANG === "it" ? 0 : 1]}</span>`).join("")}</div>`;
  }
  return { Layer, legendHtml };
})();
