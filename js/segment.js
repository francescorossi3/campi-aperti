// Campi Aperti — divisione in campi dalla serie temporale Sentinel-2
// Field segmentation from the Sentinel-2 time series
//
// Idea: due campi vicini si distinguono perché hanno colture o lavorazioni diverse, quindi una
// curva NDVI diversa nel corso dell'anno. Per ogni pixel (10 m) si costruisce il vettore NDVI di
// ~8 date serene distribuite su 12 mesi e si segmenta l'immagine con l'algoritmo a grafo di
// Felzenszwalb & Huttenlocher (2004): pixel vicini con curve simili finiscono nello stesso campo.

const Segment = (() => {
  const PC_API = "https://planetarycomputer.microsoft.com/api";
  const NDVI = "(B08-B04)/(B08+B04-2000)";
  let result = null;   // { bounds:[w,s,e,n], W, H, labels:Int32Array, feat:Float32Array, K, dates, overlay }
  let overlay = null;

  // --- lettura file .npy (float64/float32, C order) ---
  function parseNpy(ab) {
    const dv = new DataView(ab);
    const hl = dv.getUint16(8, true);
    const hdr = new TextDecoder().decode(new Uint8Array(ab, 10, hl));
    const shape = hdr.match(/'shape':\s*\(([^)]*)\)/)[1].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    const descr = hdr.match(/'descr':\s*'([^']+)'/)[1];
    const off = 10 + hl;
    const n = shape.reduce((a, b) => a * b, 1);
    let data;
    if (descr === "<f8") data = new Float64Array(ab.slice(off, off + n * 8));
    else if (descr === "<f4") data = new Float32Array(ab.slice(off, off + n * 4));
    else if (descr === "|u1" || descr === "<u1") data = new Uint8Array(ab.slice(off, off + n));
    else if (descr === "<u2") data = new Uint16Array(ab.slice(off, off + n * 2));
    else throw new Error("npy dtype " + descr);
    return { shape, data };
  }

  async function searchItems(bbox, start, end) {
    const body = { collections: ["sentinel-2-l2a"], bbox, datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
      query: { "eo:cloud_cover": { lt: 15 } }, limit: 300, sortby: [{ field: "properties.eo:cloud_cover", direction: "asc" }] };
    const j = await fetch(`${PC_API}/stac/v1/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    return j.features || [];
  }

  // sceglie fino a K date serene ben distribuite nei 12 mesi
  function pickDates(items, K) {
    const byDate = {};
    items.forEach((it) => { const d = it.properties.datetime.slice(0, 10); (byDate[d] = byDate[d] || []).push(it); });
    const dates = Object.keys(byDate).sort();
    if (dates.length <= K) return dates.map((d) => ({ date: d, items: byDate[d] }));
    const t0 = Date.parse(dates[0]), t1 = Date.parse(dates[dates.length - 1]);
    const out = [], used = new Set();
    for (let k = 0; k < K; k++) {
      const target = t0 + ((k + 0.5) / K) * (t1 - t0);
      let best = null, bd = Infinity;
      dates.forEach((d) => {
        if (used.has(d)) return;
        // privilegia date vicine al target e con poche nuvole
        const cc = Math.min(...byDate[d].map((i) => i.properties["eo:cloud_cover"]));
        const dist = Math.abs(Date.parse(d) - target) / 86400000 + cc * 0.8;
        if (dist < bd) { bd = dist; best = d; }
      });
      if (best) { used.add(best); out.push({ date: best, items: byDate[best] }); }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  async function ndviArray(bbox, items, size) {
    // unisce i tasselli MGRS della stessa data (dove uno non copre, usa l'altro)
    let arr = null, W = 0, H = 0;
    for (const it of items) {
      const u = `${PC_API}/data/v1/item/bbox/${bbox.join(",")}.npy?collection=sentinel-2-l2a&item=${encodeURIComponent(it.id)}` +
        `&expression=${encodeURIComponent(NDVI)}&asset_as_band=true&coord_crs=epsg:4326&dst_crs=epsg:4326&width=${size[0]}&height=${size[1]}`;
      const r = await fetch(u);
      if (!r.ok) continue;
      const { shape, data } = parseNpy(await r.arrayBuffer());
      const [, h, w] = shape.length === 3 ? shape : [1, shape[0], shape[1]];
      if (!arr) { W = w; H = h; arr = new Float32Array(W * H).fill(NaN); }
      const hasMask = shape.length === 3 && shape[0] > 1;
      for (let i = 0; i < W * H; i++) {
        if (!isNaN(arr[i])) continue;
        const v = data[i], m = hasMask ? data[W * H + i] : 255;
        if (m > 0 && isFinite(v) && v > -1 && v <= 1) arr[i] = v;
      }
      if (!arr.some((v) => isNaN(v))) break;
    }
    return arr ? { arr, W, H } : null;
  }

  // --- Felzenszwalb–Huttenlocher su griglia 8-connessa ---
  function felzenszwalb(feat, W, H, K, k, minSize) {
    const N = W * H;
    const edges = [];
    const dist = (a, b) => {
      let s = 0, n = 0;
      for (let d = 0; d < K; d++) {
        const x = feat[a * K + d], y = feat[b * K + d];
        if (isNaN(x) || isNaN(y)) continue;
        s += (x - y) * (x - y); n++;
      }
      return n ? Math.sqrt((s * K) / n) : 1;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x + 1 < W) edges.push([dist(i, i + 1), i, i + 1]);
      if (y + 1 < H) edges.push([dist(i, i + W), i, i + W]);
      if (x + 1 < W && y + 1 < H) edges.push([dist(i, i + W + 1) * 1.15, i, i + W + 1]);
      if (x > 0 && y + 1 < H) edges.push([dist(i, i + W - 1) * 1.15, i, i + W - 1]);
    }
    edges.sort((a, b) => a[0] - b[0]);
    const parent = new Int32Array(N), size = new Int32Array(N).fill(1), thr = new Float64Array(N).fill(k);
    for (let i = 0; i < N; i++) parent[i] = i;
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (const [w, a, b] of edges) {
      let ra = find(a), rb = find(b);
      if (ra === rb) continue;
      if (w <= thr[ra] && w <= thr[rb]) {
        if (size[ra] < size[rb]) [ra, rb] = [rb, ra];
        parent[rb] = ra; size[ra] += size[rb]; thr[ra] = w + k / size[ra];
      }
    }
    for (const [, a, b] of edges) {
      const ra = find(a), rb = find(b);
      if (ra !== rb && (size[ra] < minSize || size[rb] < minSize)) {
        if (size[ra] < size[rb]) { parent[ra] = rb; size[rb] += size[ra]; } else { parent[rb] = ra; size[ra] += size[rb]; }
      }
    }
    const labels = new Int32Array(N);
    for (let i = 0; i < N; i++) labels[i] = find(i);
    return labels;
  }

  // --- disegno dei confini come immagine sovrapposta ---
  function drawOverlay() {
    const { W, H, labels, bounds, nonAgri } = result;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"), img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, l = labels[i];
      const edge = (x + 1 < W && labels[i + 1] !== l) || (y + 1 < H && labels[i + W] !== l);
      const o = i * 4;
      if (edge) { img.data[o] = 0; img.data[o + 1] = 229; img.data[o + 2] = 255; img.data[o + 3] = 235; }
      else if (nonAgri.has(l)) { img.data[o] = 30; img.data[o + 1] = 30; img.data[o + 2] = 30; img.data[o + 3] = 70; }
    }
    ctx.putImageData(img, 0, 0);
    if (overlay) map.removeLayer(overlay);
    const [w, s, e, n] = bounds;
    overlay = L.imageOverlay(c.toDataURL(), [[s, w], [n, e]], { className: "seg-overlay", interactive: false, zIndex: 450 }).addTo(map);
    result.overlay = overlay;
  }

  async function run(bounds, endDate, onProgress) {
    const end = endDate || new Date();
    const start = new Date(end.getTime() - 365 * 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    const bbox = bounds.map((v) => +v.toFixed(5));
    const latMid = (bbox[1] + bbox[3]) / 2;
    const wM = (bbox[2] - bbox[0]) * 111320 * Math.cos((latMid * Math.PI) / 180), hM = (bbox[3] - bbox[1]) * 110540;
    const size = [Math.min(600, Math.round(wM / 10)), Math.min(600, Math.round(hM / 10))];
    onProgress && onProgress(0, 1);
    const items = await searchItems(bbox, iso(start), iso(end));
    const picks = pickDates(items, 8);
    if (picks.length < 3) throw new Error("poche immagini serene");
    const stacks = new Array(picks.length);
    let done = 0;
    await Promise.all(picks.map(async (p, k) => {
      stacks[k] = await ndviArray(bbox, p.items, size).catch(() => null);
      onProgress && onProgress(++done, picks.length);
    }));
    const good = stacks.map((s, k) => (s ? k : -1)).filter((k) => k >= 0);
    if (good.length < 3) throw new Error("dati insufficienti");
    const { W, H } = stacks[good[0]];
    const K = good.length, feat = new Float32Array(W * H * K);
    good.forEach((k, d) => { const a = stacks[k].arr; for (let i = 0; i < W * H; i++) feat[i * K + d] = a[i]; });
    // leggero filtro 3x3 (mediana per data) per togliere il rumore dei singoli pixel
    const sm = new Float32Array(feat.length), buf = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let d = 0; d < K; d++) {
      buf.length = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const v = feat[(yy * W + xx) * K + d]; if (!isNaN(v)) buf.push(v);
      }
      buf.sort((a, b) => a - b);
      sm[(y * W + x) * K + d] = buf.length ? buf[buf.length >> 1] : NaN;
    }
    const labels = felzenszwalb(sm, W, H, K, 1.2, 25);
    // segmenti non agricoli: NDVI sempre basso (edifici, strade, acqua)
    const maxBy = new Map();
    for (let i = 0; i < W * H; i++) {
      let m = -1; for (let d = 0; d < K; d++) { const v = sm[i * K + d]; if (v > m) m = v; }
      const l = labels[i], cur = maxBy.get(l) || { s: 0, n: 0 }; cur.s += m; cur.n++; maxBy.set(l, cur);
    }
    const nonAgri = new Set([...maxBy].filter(([, v]) => v.s / v.n < 0.3).map(([l]) => l));
    result = { bounds: bbox, W, H, labels, feat: sm, K, dates: good.map((k) => picks[k].date), nonAgri, nSeg: maxBy.size };
    drawOverlay();
    return result;
  }

  // --- poligono del segmento che contiene il punto ---
  function fieldAt(ll, bb) {
    if (!result) return null;
    const { bounds: [w, s, e, n], W, H, labels } = result;
    if (ll.lng < w || ll.lng > e || ll.lat < s || ll.lat > n) return null;
    const px = Math.min(W - 1, Math.floor(((ll.lng - w) / (e - w)) * W));
    const py = Math.min(H - 1, Math.floor(((n - ll.lat) / (n - s)) * H));
    const lab = labels[py * W + px];
    if (result.bgZero && lab === 0 && !bb) return null;
    const inR = (x, y) => x >= 0 && y >= 0 && x < W && y < H && labels[y * W + x] === lab;
    // spigoli di contorno orientati (regione a sinistra), vertici agli angoli dei pixel
    const next = new Map(); let count = 0;
    const key = (x, y) => y * (W + 1) + x;
    const add = (x1, y1, x2, y2) => { const k = key(x1, y1); (next.get(k) || next.set(k, []).get(k)).push([x2, y2]); count++; };
    const ya = bb ? bb.y0 : 0, yb = bb ? bb.y1 : H - 1, xa = bb ? bb.x0 : 0, xb = bb ? bb.x1 : W - 1;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      if (labels[y * W + x] !== lab) continue;
      if (!inR(x, y - 1)) add(x + 1, y, x, y);         // lato superiore
      if (!inR(x - 1, y)) add(x, y, x, y + 1);         // lato sinistro
      if (!inR(x, y + 1)) add(x, y + 1, x + 1, y + 1); // lato inferiore
      if (!inR(x + 1, y)) add(x + 1, y + 1, x + 1, y); // lato destro
    }
    const rings = [];
    for (const [k0, list] of next) {
      while (list.length) {
        const ring = [];
        let x = k0 % (W + 1), y = Math.floor(k0 / (W + 1));
        const sx = x, sy = y;
        let guard = 0;
        do {
          ring.push([x, y]);
          const l = next.get(key(x, y));
          if (!l || !l.length) break;
          const [nx, ny] = l.pop();
          x = nx; y = ny;
        } while ((x !== sx || y !== sy) && ++guard < 200000);
        ring.push([sx, sy]);
        // rimuove i vertici allineati
        const simp = ring.filter((p, i) => {
          if (i === 0 || i === ring.length - 1) return true;
          const a = ring[i - 1], b = ring[i + 1];
          return (b[0] - a[0]) * (p[1] - a[1]) !== (b[1] - a[1]) * (p[0] - a[0]);
        });
        if (simp.length >= 4) rings.push(simp);
      }
    }
    const area = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; };
    rings.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
    const toLL = (r) => r.map(([x, y]) => [w + (x / W) * (e - w), n - (y / H) * (n - s)]);
    let npx = bb ? bb.n : 0; if (!bb) for (let i = 0; i < labels.length; i++) if (labels[i] === lab) npx++;
    return { type: "Feature", properties: { _seg: true, _px: npx, _nonAgri: result.nonAgri.has(lab) },
      geometry: { type: "Polygon", coordinates: rings.map(toLL) } };
  }

  // --- tutti i campi della segmentazione corrente come GeoJSON (per lo scaricamento), con NDVI medio per data
  function allFields(minPx = 20) {
    if (!result) return null;
    const { W, H, labels, feat, K, dates, nonAgri } = result;
    const fs = result.method === "ai" ? 4 : 1;                 // pixel da 5 m: soglia di superficie equivalente
    const box = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const l = labels[y * W + x];
      let b = box.get(l);
      if (!b) box.set(l, (b = { x0: x, y0: y, x1: x, y1: y, n: 0, s: new Float64Array(K), c: new Uint32Array(K), px: [x, y] }));
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      b.n++;
      for (let d = 0; d < K; d++) { const v = feat[(y * W + x) * K + d]; if (!isNaN(v)) { b.s[d] += v; b.c[d]++; } }
    }
    const [w, s, e, n] = result.bounds, feats = [];
    let id = 0;
    for (const [l, b] of box) {
      if (b.n < minPx * fs || nonAgri.has(l)) continue;
      const f = fieldAt({ lng: w + ((b.px[0] + 0.5) / W) * (e - w), lat: n - ((b.px[1] + 0.5) / H) * (n - s) }, b);
      if (!f) continue;
      const props = { id: ++id, metodo: result.method === "ai" ? "Delineate Anything" : "Felzenszwalb NDVI" };
      dates.forEach((d, k) => (props["ndvi_" + d] = b.c[k] ? +(b.s[k] / b.c[k]).toFixed(3) : null));
      f.properties = props;
      feats.push(f);
    }
    return { type: "FeatureCollection", features: feats, dates };
  }

  // --- etichette prodotte da un altro metodo (Delineate Anything): 0 = non campo
  function useLabels(bounds, W, H, labels, meta = {}) {
    result = { bounds, W, H, labels, feat: null, K: 0, dates: meta.dates || [], nonAgri: new Set([0]), nSeg: meta.n || 0, bgZero: true, method: meta.method || "ai" };
    drawOverlay();
    return result;
  }
  // prima il modello Delineate Anything, se non va la segmentazione a grafo sulla serie NDVI
  async function smart(bounds, endDate, onProgress) {
    if (typeof Delineate !== "undefined") {
      try { return await Delineate.run(bounds, endDate, onProgress); }
      catch (e) { console.warn("Delineate Anything non disponibile, uso Felzenszwalb:", e.message || e); }
    }
    return run(bounds, endDate, onProgress);
  }
  const method = () => result && (result.method || "graph");

  function clear() { if (overlay) map.removeLayer(overlay); overlay = null; result = null; }
  const has = () => !!result;
  const info = () => result && { dates: result.dates, nSeg: result.nSeg, bounds: result.bounds };
  return { run, smart, useLabels, method, fieldAt, allFields, clear, has, info };
})();
