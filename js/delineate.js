// Campi Aperti — confini dei campi con Delineate Anything S (YOLO11n-seg, Lavreniuk et al. 2025, AGPL-3.0)
// Field boundaries with the Delineate Anything S instance-segmentation model, run in the browser (onnxruntime-web).
//
// Immagine: Sentinel-2 a colori reali (asset "visual") di una data serena della stagione vegetativa,
// ricampionata a 5 m (tasselli di 2,56 × 2,56 km = 512 × 512 pixel): a questa scala il modello riconosce
// molto meglio i campi piccoli che a 10 m. Ogni campo è un'istanza con la sua maschera; dove due maschere si
// sovrappongono vince quella con confidenza più alta.

const Delineate = (() => {
  const PC = "https://planetarycomputer.microsoft.com/api";
  const MODEL = "https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/modelli/delineate_anything_s.onnx";
  const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  const SZ = 512, TILE_M = 2560, CONF = 0.1, IOU = 0.5, MAX_TILES = 9;
  let session = null, loading = null;

  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("script " + src)); document.head.appendChild(s); });
  }
  async function getSession() {
    if (session) return session;
    if (!loading) loading = (async () => {
      if (!window.ort) await loadScript(ORT + "ort.min.js");
      ort.env.wasm.wasmPaths = ORT;
      ort.env.wasm.numThreads = self.crossOriginIsolated ? 4 : 1;
      session = await ort.InferenceSession.create(MODEL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return session;
    })().catch((e) => { loading = null; throw e; });
    return loading;
  }

  const mx = (lon) => (lon * 20037508.34) / 180;
  const my = (lat) => Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 6378137;
  const lon = (x) => (x / 20037508.34) * 180;
  const lat = (y) => (360 / Math.PI) * Math.atan(Math.exp(y / 6378137)) - 90;

  // date serene, preferendo aprile–settembre (campi ben distinti), con l'area tutta coperta
  async function candidates(bbox, end) {
    const start = new Date(end.getTime() - 365 * 86400000);
    const body = { collections: ["sentinel-2-l2a"], bbox, datetime: `${start.toISOString().slice(0, 10)}T00:00:00Z/${end.toISOString().slice(0, 10)}T23:59:59Z`,
      query: { "eo:cloud_cover": { lt: 8 } }, limit: 100 };
    const j = await fetch(`${PC}/stac/v1/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    const its = (j.features || []).filter((it) => (it.properties["s2:nodata_pixel_percentage"] ?? 0) < 60);
    const score = (it) => { const m = +it.properties.datetime.slice(5, 7); return (m >= 4 && m <= 9 ? 0 : 20) + it.properties["eo:cloud_cover"] + (it.properties["s2:nodata_pixel_percentage"] || 0) / 5; };
    return its.sort((a, b) => score(a) - score(b));
  }

  async function tileImage(X0, Y0, X1, Y1, items) {
    for (const it of items.slice(0, 5)) {
      const url = `${PC}/data/v1/item/bbox/${X0},${Y0},${X1},${Y1}/${SZ}x${SZ}.png?collection=sentinel-2-l2a&item=${it.id}&assets=visual&coord_crs=epsg:3857&dst_crs=epsg:3857`;
      const r = await fetch(url).catch(() => null);
      if (!r || !r.ok) continue;
      const bmp = await createImageBitmap(await r.blob());
      const c = document.createElement("canvas"); c.width = SZ; c.height = SZ;
      const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, SZ, SZ);
      const d = ctx.getImageData(0, 0, SZ, SZ).data;
      let empty = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 0 || (d[i] + d[i + 1] + d[i + 2]) === 0) empty++;
      if (empty / (SZ * SZ) > 0.03) continue;
      return { data: d, date: it.properties.datetime.slice(0, 10) };
    }
    return null;
  }

  // inferenza e post-elaborazione YOLO-seg: box (cx, cy, w, h), 1 classe, 32 coefficienti di maschera, prototipi 32×128×128
  async function infer(rgba) {
    const s = await getSession();
    const x = new Float32Array(3 * SZ * SZ);
    for (let i = 0; i < SZ * SZ; i++) { x[i] = rgba[i * 4] / 255; x[SZ * SZ + i] = rgba[i * 4 + 1] / 255; x[2 * SZ * SZ + i] = rgba[i * 4 + 2] / 255; }
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", x, [1, 3, SZ, SZ]) });
    const o0 = out[s.outputNames[0]], o1 = out[s.outputNames[1]];
    const [, C, N] = o0.dims, P = o1.dims[2], pd = o1.data, od = o0.data;
    const nm = C - 5;
    let cand = [];
    for (let i = 0; i < N; i++) {
      const cf = od[4 * N + i];
      if (cf < CONF) continue;
      const cx = od[i], cy = od[N + i], w = od[2 * N + i], h = od[3 * N + i];
      cand.push({ cf, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, i });
    }
    cand.sort((a, b) => b.cf - a.cf);
    const keep = [];
    const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const I = ix * iy; return I / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - I); };
    for (const c of cand) { if (keep.length >= 300) break; if (keep.every((k) => iou(k, c) < IOU)) keep.push(c); }
    // maschere: logit = Σ coeff_k · proto_k ; si dipinge dalla meno alla più sicura
    const lab = new Int32Array(SZ * SZ), sc = P / SZ, area = [];
    keep.reverse().forEach((k, j) => {
      const coef = new Float32Array(nm);
      for (let m = 0; m < nm; m++) coef[m] = od[(5 + m) * N + k.i];
      const px0 = Math.max(0, Math.floor(k.x0 * sc) - 1), px1 = Math.min(P - 1, Math.ceil(k.x1 * sc) + 1);
      const py0 = Math.max(0, Math.floor(k.y0 * sc) - 1), py1 = Math.min(P - 1, Math.ceil(k.y1 * sc) + 1);
      const bw = px1 - px0 + 1, bh = py1 - py0 + 1, lg = new Float32Array(bw * bh);
      for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
        let v = 0; const o = (py0 + yy) * P + px0 + xx;
        for (let m = 0; m < nm; m++) v += coef[m] * pd[m * P * P + o];
        lg[yy * bw + xx] = v;
      }
      let n = 0;
      const X0 = Math.max(0, Math.floor(k.x0)), X1 = Math.min(SZ - 1, Math.ceil(k.x1)), Y0 = Math.max(0, Math.floor(k.y0)), Y1 = Math.min(SZ - 1, Math.ceil(k.y1));
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        const fx = Math.min(bw - 1.001, Math.max(0, (x + 0.5) * sc - 0.5 - px0)), fy = Math.min(bh - 1.001, Math.max(0, (y + 0.5) * sc - 0.5 - py0));
        const ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
        const val = (lg[iy * bw + ix] * (1 - u) + lg[iy * bw + ix + 1] * u) * (1 - v) + (lg[(iy + 1) * bw + ix] * (1 - u) + lg[(iy + 1) * bw + ix + 1] * u) * v;
        if (val > 0) { lab[y * SZ + x] = j + 1; n++; }
      }
      area[j + 1] = n;
    });
    // via i frammenti: istanze ridotte a meno del 35% dalla sovrapposizione o sotto ~1000 m² (40 pixel da 5 m)
    const now = new Int32Array(keep.length + 1);
    for (let i = 0; i < lab.length; i++) now[lab[i]]++;
    for (let i = 0; i < lab.length; i++) { const l = lab[i]; if (l && (now[l] < 40 || now[l] < 0.35 * area[l])) lab[i] = 0; }
    return { lab, n: keep.length };
  }

  // ---- divisione dei campi che contengono colture diverse
  // Il modello vede i confini su una sola immagine: due appezzamenti contigui di proprietari diversi possono sembrare uno.
  // Per ogni campo si confrontano le curve NDVI di ~6 date serene dell'anno (10 m): se i pixel formano due gruppi
  // ben distinti (es. grano e terreno lavorato), compatti nello spazio e ciascuno di almeno il 15% del campo, il campo
  // viene diviso; il controllo si ripete sulle parti (fino a 4 colture per campo).
  async function ndviStack(X0, Y0, X1, Y1, W2, H2, end) {
    const start = new Date(end.getTime() - 365 * 86400000);
    const bb = [lon(X0), lat(Y0), lon(X1), lat(Y1)];
    const body = { collections: ["sentinel-2-l2a"], bbox: bb, datetime: `${start.toISOString().slice(0, 10)}T00:00:00Z/${end.toISOString().slice(0, 10)}T23:59:59Z`,
      query: { "eo:cloud_cover": { lt: 25 } }, limit: 200 };
    const j = await fetch(`${PC}/stac/v1/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    const perMese = {};
    (j.features || []).sort((a, b) => a.properties["eo:cloud_cover"] - b.properties["eo:cloud_cover"])
      .forEach((it) => { const m = it.properties.datetime.slice(0, 7); (perMese[m] = perMese[m] || []).push(it); });
    const mesi = Object.keys(perMese).sort();
    const pick = []; const step = Math.max(1, mesi.length / 7);
    for (let k = 0; k < mesi.length && pick.length < 7; k += step) pick.push(perMese[mesi[Math.floor(k)]][0]);
    const expr = encodeURIComponent("(B08-B04)/(B08+B04-2000);((SCL==0)|(SCL==1)|(SCL==3)|(SCL==7)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==11))*1.0");
    const arrs = await Promise.all(pick.map(async (it) => {
      try {
        const ab = await fetch(`${PC}/data/v1/item/bbox/${X0},${Y0},${X1},${Y1}.npy?collection=sentinel-2-l2a&item=${it.id}&expression=${expr}&asset_as_band=true` +
          `&coord_crs=epsg:3857&dst_crs=epsg:3857&width=${W2}&height=${H2}&resampling=average`).then((r) => { if (!r.ok) throw 0; return r.arrayBuffer(); });
        const dv = new DataView(ab), hl = dv.getUint16(8, true), hdr = new TextDecoder().decode(new Uint8Array(ab, 10, hl));
        const raw = hdr.includes("<f8") ? new Float64Array(ab.slice(10 + hl)) : new Float32Array(ab.slice(10 + hl));
        const n = W2 * H2, out = new Float32Array(n);
        let ok = 0;
        for (let i = 0; i < n; i++) { const v = raw[i], c = raw[n + i]; if (isFinite(v) && Math.abs(v) <= 1 && c < 0.5) { out[i] = v; ok++; } else out[i] = NaN; }
        return ok > 0.4 * n ? out : null;
      } catch (e) { return null; }
    }));
    return arrs.filter(Boolean);
  }
  function splitByNdvi(labels, W, H, stack, f) {
    const K = stack.length;
    if (K < 3) return 0;
    const W2 = Math.round(W / f);
    const vec = (i) => { const x = Math.min(W2 - 1, Math.floor((i % W) / f)), y = Math.floor(Math.floor(i / W) / f), j = y * W2 + x; return stack.map((a) => a[j]); };
    const dist = (a, b) => { let s = 0, n = 0; for (let k = 0; k < K; k++) if (isFinite(a[k]) && isFinite(b[k])) { s += (a[k] - b[k]) ** 2; n++; } return n >= 2 ? Math.sqrt(s / n) : 0; };
    let nextId = 0; for (let i = 0; i < labels.length; i++) if (labels[i] > nextId) nextId = labels[i];
    let nSplit = 0;
    const queue = [...new Set(labels)].filter((l) => l > 0).map((l) => [l, 0]);
    while (queue.length) {
      const [lab, depth] = queue.shift();
      const px = []; for (let i = 0; i < labels.length; i++) if (labels[i] === lab) px.push(i);
      if (px.length < 160 || depth >= 3) continue;
      const V = px.map(vec);
      // k-medie con 2 gruppi: semi = pixel più lontano dalla media e il più lontano da quello
      const mean = new Array(K).fill(0).map((_, k) => { let s = 0, n = 0; V.forEach((v) => { if (isFinite(v[k])) { s += v[k]; n++; } }); return n ? s / n : NaN; });
      let a = V[0], d0 = -1; V.forEach((v) => { const d = dist(v, mean); if (d > d0) { d0 = d; a = v; } });
      let b = V[0]; d0 = -1; V.forEach((v) => { const d = dist(v, a); if (d > d0) { d0 = d; b = v; } });
      let c = [a.slice(), b.slice()], asg = new Uint8Array(V.length);
      for (let it = 0; it < 12; it++) {
        V.forEach((v, i) => (asg[i] = dist(v, c[0]) <= dist(v, c[1]) ? 0 : 1));
        c = [0, 1].map((g) => new Array(K).fill(0).map((_, k) => { let s = 0, n = 0; V.forEach((v, i) => { if (asg[i] === g && isFinite(v[k])) { s += v[k]; n++; } }); return n ? s / n : NaN; }));
      }
      const sep = dist(c[0], c[1]);
      let n1 = 0; asg.forEach((g) => (n1 += g));
      const share = Math.min(n1, V.length - n1) / V.length;
      if (sep < 0.12 || share < 0.15) continue;
      // pulizia: maggioranza su 5×5 pixel (25 m) dentro il campo
      const g = new Int8Array(labels.length).fill(-1);
      px.forEach((i, k) => (g[i] = asg[k]));
      const g2 = new Int8Array(g);
      px.forEach((i) => {
        const x = i % W, y = Math.floor(i / W); let s0 = 0, s1 = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = g[yy * W + xx]; if (q === 0) s0++; else if (q === 1) s1++;
        }
        g2[i] = s1 > s0 ? 1 : 0;
      });
      // componenti connesse; i pezzi piccoli (< 15% del campo o < 60 pixel) restano al gruppo più grande
      const comp = new Int32Array(labels.length).fill(-1), comps = [];
      px.forEach((i0) => {
        if (comp[i0] >= 0) return;
        const id = comps.length, st = [i0], mem = []; comp[i0] = id;
        while (st.length) { const i = st.pop(); mem.push(i); const x = i % W;
          for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= labels.length || (Math.abs((j % W) - x) > 1)) continue;
            if (comp[j] < 0 && labels[j] === lab && g2[j] === g2[i0]) { comp[j] = id; st.push(j); } } }
        comps.push({ g: g2[i0], mem });
      });
      const big = comps.filter((q) => q.mem.length >= Math.max(60, 0.15 * px.length));
      if (big.length < 2 || new Set(big.map((q) => q.g)).size < 2) continue;
      big.sort((p, q) => q.mem.length - p.mem.length);
      const keepId = big[0];
      comps.forEach((q) => { if (q === keepId || !big.includes(q)) return; const id = ++nextId; q.mem.forEach((i) => (labels[i] = id)); queue.push([id, depth + 1]); });
      queue.push([lab, depth + 1]);
      nSplit++;
    }
    return nSplit;
  }

  async function run(bounds, endDate, onProgress) {
    const [w, s, e, n] = bounds;
    const cosl = Math.cos((((s + n) / 2) * Math.PI) / 180), T = TILE_M / cosl;          // lato del tassello in metri Mercatore
    const X0 = mx(w), X1 = mx(e), Y0 = my(s), Y1 = my(n);
    const nx = Math.max(1, Math.ceil((X1 - X0) / T)), ny = Math.max(1, Math.ceil((Y1 - Y0) / T));
    if (nx * ny > MAX_TILES) throw new Error("area troppo grande per il modello");
    const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, gx0 = cx - (nx * T) / 2, gy1 = cy + (ny * T) / 2;
    const W = nx * SZ, H = ny * SZ, labels = new Int32Array(W * H);
    onProgress && onProgress(0, nx * ny);
    const [items] = await Promise.all([candidates([lon(gx0), lat(gy1 - ny * T), lon(gx0 + nx * T), lat(gy1)], endDate || new Date()), getSession()]);
    if (!items.length) throw new Error("nessuna immagine serena");
    let off = 0, done = 0;
    const dates = new Set();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const tx0 = gx0 + i * T, ty1 = gy1 - j * T;
      const img = await tileImage(tx0, ty1 - T, tx0 + T, ty1, items);
      onProgress && onProgress(++done, nx * ny);
      if (!img) continue;
      dates.add(img.date);
      const { lab, n: k } = await infer(img.data);
      for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) { const l = lab[y * SZ + x]; if (l) labels[(j * SZ + y) * W + i * SZ + x] = l + off; }
      off += k + 1;
    }
    if (!dates.size) throw new Error("immagini non disponibili");
    // controllo con le curve NDVI dell'anno: divide i campi con colture diverse
    try {
      const f = 2, W2 = Math.round(W / f), H2 = Math.round(H / f);
      const stack = await ndviStack(gx0, gy1 - ny * T, gx0 + nx * T, gy1, W2, H2, endDate || new Date());
      const ns = splitByNdvi(labels, W, H, stack, f);
      if (ns) console.info("Campi divisi per colture diverse:", ns);
    } catch (e) { console.warn("controllo NDVI non riuscito", e); }
    const b = [lon(gx0), lat(gy1 - ny * T), lon(gx0 + nx * T), lat(gy1)];
    return Segment.useLabels(b, W, H, labels, { dates: [...dates].sort(), n: off, method: "ai" });
  }
  return { run, warmup: () => getSession().catch(() => null), _split: splitByNdvi };
})();
