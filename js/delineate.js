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
    const b = [lon(gx0), lat(gy1 - ny * T), lon(gx0 + nx * T), lat(gy1)];
    return Segment.useLabels(b, W, H, labels, { dates: [...dates].sort(), n: off, method: "ai" });
  }
  return { run, warmup: () => getSession().catch(() => null) };
})();
