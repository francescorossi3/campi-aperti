// Columella — js/mapstyle.js
// IT: simbologia dei livelli "come QGIS" (adattata da Prognostica): scala di colori (COLORMAPS di croplayer.js),
//     inversione, limiti (predefiniti, min–max, percentili 2–98 %, media ± 2 dev. std., manuali) calcolati sui
//     valori del campo selezionato, classi continue / intervalli uguali / quantili, trasparenza, colore per
//     "nessun dato", istogramma con i limiti, legenda. Lo stile di ogni livello è salvato nel browser.
//     Lo stile cambia solo la visualizzazione: i valori non vengono modificati.
// EN: QGIS-like layer symbology (ramp, invert, min/max modes, classes, opacity, no-data colour, histogram,
//     legend), stored per layer in localStorage.
//
// Globale esposto / exposed global: MapStyle { get, save, reset, classify, stats, legend, panel, RANGE_MODES }
// Dipende da / depends on: croplayer.js (COLORMAPS, hexRgb), app.js (t, LANG) al momento dell'uso.

const MapStyle = (() => {
  const KEY = "columella.style.";
  const RANGE_MODES = ["default", "minmax", "p2_98", "mean2sd", "manual"];
  const CLASS_MODES = ["continuous", "equal", "quantile"];

  // stile di partenza di un livello: scala, limiti predefiniti [min, max] e unità
  const create = (cmap, min, max, unit = "") => ({ cmap, rev: false, range: "default", min, max, dmin: min, dmax: max,
    classes: "continuous", n: 5, opacity: 0.85, nodata: "", unit });

  function get(id, base) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY + id) || "null"); } catch (e) { /* stile salvato illeggibile */ }
    const st = { ...base, ...(saved || {}) };
    st.dmin = base.dmin; st.dmax = base.dmax; st.unit = base.unit;   // predefiniti sempre dal codice
    if (!COLORMAPS[st.cmap]) st.cmap = base.cmap;
    return st;
  }
  function save(id, st) { try { localStorage.setItem(KEY + id, JSON.stringify(st)); } catch (e) { /* spazio esaurito */ } }
  function reset(id) { try { localStorage.removeItem(KEY + id); } catch (e) { /* */ } }

  const stopsOf = (st) => { const s = COLORMAPS[st.cmap] || COLORMAPS.viridis; return st.rev ? s.slice().reverse() : s; };
  function rampAt(stops, u) {
    const x = Math.max(0, Math.min(1, u)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
    const a = hexRgb(stops[i]), b = hexRgb(stops[i + 1]);
    return a.map((v, k) => Math.round(v + f * (b[k] - v)));
  }
  const digits = (span) => (span >= 50 ? 0 : span >= 5 ? 1 : span >= 0.5 ? 2 : 3);
  const num = (x, d) => (Number.isFinite(x) ? (+x).toFixed(d) : "–");

  // statistiche dei valori validi (media, dev. std., quantili)
  function stats(vals) {
    if (!vals) return null;
    const v = [];
    for (const x of vals) if (x != null && Number.isFinite(x)) v.push(x);
    const n = v.length;
    if (!n) return null;
    v.sort((a, b) => a - b);
    const mean = v.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    const q = (p) => v[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
    return { v, n, min: v[0], max: v[n - 1], mean, sd, q };
  }

  // limiti della scala; senza valori del campo valgono i limiti predefiniti o manuali
  function limits(st, S) {
    let lo, hi;
    if (st.range === "manual") [lo, hi] = [+st.min, +st.max];
    else if (S && st.range === "minmax") [lo, hi] = [S.min, S.max];
    else if (S && st.range === "p2_98") [lo, hi] = [S.q(0.02), S.q(0.98)];
    else if (S && st.range === "mean2sd") [lo, hi] = [S.mean - 2 * S.sd, S.mean + 2 * S.sd];
    else [lo, hi] = [st.dmin, st.dmax];
    if (!(hi > lo)) hi = lo + 1e-6;
    return [lo, hi];
  }

  // funzione colore v -> [r, g, b] | null, con limiti, classi e statistiche (S)
  function classify(st, S) {
    const [lo, hi] = limits(st, S), stops = stopsOf(st);
    let edges = null;
    if (st.classes !== "continuous") {
      const n = Math.max(2, Math.min(12, +st.n || 5));
      if (st.classes === "quantile" && S) {
        const inside = S.v.filter((x) => x >= lo && x <= hi), m = inside.length;
        edges = Array.from({ length: n + 1 }, (_, i) => (m ? inside[Math.min(m - 1, Math.round((i * (m - 1)) / n))] : lo + ((hi - lo) * i) / n));
        edges[0] = lo; edges[n] = hi;
      } else edges = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
    }
    const classColor = edges ? edges.slice(0, -1).map((_, i) => rampAt(stops, i / Math.max(1, edges.length - 2))) : null;
    const nd = /^#[0-9a-f]{6}$/i.test(st.nodata || "") ? hexRgb(st.nodata) : null;
    function color(v) {
      if (v == null || !Number.isFinite(v) || v <= -9000) return nd;
      if (!edges) return rampAt(stops, (v - lo) / (hi - lo));
      let i = 0;
      while (i < edges.length - 2 && v > edges[i + 1]) i++;
      return classColor[i];
    }
    return { color, lo, hi, edges, classColor, stops, S, nodata: nd };
  }

  const css = (c) => `rgb(${c.join(",")})`;
  // legenda: barra continua oppure una riga per classe
  function legend(title, st, C) {
    const d = digits(C.hi - C.lo), u = st.unit ? ` <small>(${st.unit})</small>` : "";
    const nd = C.nodata ? `<div class="lg-row"><i style="background:${css(C.nodata)}"></i>${t("st_nodata")}</div>` : "";
    if (C.edges) {
      const rows = C.classColor.map((c, i) => `<div class="lg-row"><i style="background:${css(c)}"></i>${num(C.edges[i], d)} – ${num(C.edges[i + 1], d)}</div>`);
      return `<div class="lg"><b>${title}</b>${u}${rows.reverse().join("")}${nd}</div>`;
    }
    const ticks = [0, 0.5, 1].map((k) => `<span>${num(C.lo + k * (C.hi - C.lo), d)}</span>`).join("");
    return `<div class="lg"><b>${title}</b>${u}<div class="lg-bar" style="background:linear-gradient(90deg,${C.stops.join(",")})"></div><div class="lg-ticks">${ticks}</div>${nd}</div>`;
  }

  // istogramma dei valori del campo con le linee dei limiti
  function histogram(cv, C) {
    const dpr = window.devicePixelRatio || 1, W = (cv.width = (cv.clientWidth || 260) * dpr), H = (cv.height = 72 * dpr);
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H);
    if (!C.S) return;
    const S = C.S, a = Math.min(S.min, C.lo), b = Math.max(S.max, C.hi), nb = 32, w = (b - a) / nb || 1, cnt = new Array(nb).fill(0);
    for (const x of S.v) cnt[Math.min(nb - 1, Math.floor((x - a) / w))]++;
    const mx = Math.max(...cnt, 1), bw = W / nb, base = H - 13 * dpr, X = (x) => ((x - a) / (b - a || 1)) * W;
    cnt.forEach((c, i) => {
      const col = C.color(a + (i + 0.5) * w);
      g.fillStyle = col ? css(col) : "#cfd5c8";
      const h = (c / mx) * (base - 4 * dpr);
      g.fillRect(i * bw + 0.5, base - h, Math.max(1, bw - 1), h);
    });
    g.fillStyle = "#26301f";
    [C.lo, C.hi].forEach((x) => g.fillRect(X(x) - dpr, 0, 2 * dpr, base));
    g.font = `${10 * dpr}px system-ui, sans-serif`;
    const d = digits(b - a);
    g.textAlign = "left"; g.fillText(num(a, d), 0, H - 2);
    g.textAlign = "right"; g.fillText(num(b, d), W, H - 2);
  }

  const opt = (keys, v, label) => keys.map((k) => `<option value="${k}"${k === v ? " selected" : ""}>${label(k)}</option>`).join("");

  // pannello Style. o = { st, S (statistiche del campo o null), limited (solo scala/limiti manuali/opacità),
  //   onChange(st) (ridisegna), onSave(st) (salva), onReset() }
  function panel(box, o) {
    const st = o.st, C = classify(st, o.S), d = digits(C.hi - C.lo);
    const lim = o.limited;
    const ranges = lim ? ["default", "manual"] : RANGE_MODES;
    const fieldStats = o.S ? `<p class="st-stats">${t("st_field")}: ${t("st_mean")} <b>${num(o.S.mean, d + 1)}</b> · min ${num(o.S.min, d + 1)} · max ${num(o.S.max, d + 1)} · ${t("st_sd")} ${num(o.S.sd, d + 1)} <small>(${o.S.n} px)</small></p>` : "";
    box.innerHTML = `${fieldStats}
      <div class="st-grid">
        <label>${t("st_ramp")} <select data-k="cmap">${opt(Object.keys(COLORMAPS), st.cmap, (k) => k)}</select></label>
        <label class="chk"><input type="checkbox" data-k="rev"${st.rev ? " checked" : ""}> ${t("st_rev")}</label>
        <div class="st-ramp" style="background:linear-gradient(90deg,${C.stops.join(",")})"></div>
        <label>${t("st_range")} <select data-k="range">${opt(ranges, st.range, (k) => t("st_r_" + k))}</select></label>
        <div class="st-minmax"><label>min <input type="number" step="any" data-k="min" value="${num(C.lo, d + 1)}"></label>
          <label>max <input type="number" step="any" data-k="max" value="${num(C.hi, d + 1)}"></label></div>
        ${lim ? "" : `<label>${t("st_classes")} <select data-k="classes">${opt(CLASS_MODES, st.classes, (k) => t("st_c_" + k))}</select></label>
        <label${st.classes === "continuous" ? " hidden" : ""}>${t("st_n")} <input type="number" min="2" max="12" step="1" data-k="n" value="${st.n}"></label>`}
        <label>${t("opacity")} <input type="range" min="0" max="100" data-k="opacity" value="${Math.round(100 * st.opacity)}"></label>
        ${lim ? "" : `<label class="chk">${t("st_nodata")} <input type="checkbox" data-k="ndOn"${st.nodata ? " checked" : ""}> <input type="color" data-k="nodata" value="${st.nodata || "#9e9e9e"}"${st.nodata ? "" : " disabled"}></label>`}
      </div>
      ${lim ? `<p class="hint small">${t("st_limited")}</p>` : `<div class="st-histo"><canvas></canvas><p class="hint small">${o.S ? t("st_histo") : t("st_nofield")}</p></div>`}
      <div class="st-legend">${legend(o.title || "", st, C)}</div>
      <button class="small-btn st-reset">${t("st_reset")}</button>`;
    const cv = box.querySelector("canvas");
    if (cv) histogram(cv, C);
    box.querySelectorAll("[data-k]").forEach((el) => {
      const k = el.dataset.k, live = el.type === "range" || el.type === "number";
      el[live ? "oninput" : "onchange"] = () => {
        if (k === "rev") st.rev = el.checked;
        else if (k === "ndOn") st.nodata = el.checked ? box.querySelector('[data-k="nodata"]').value : "";
        else if (k === "nodata") st.nodata = el.value;
        else if (k === "opacity") st.opacity = el.value / 100;
        else if (k === "min" || k === "max") {
          if (el.value === "" || !Number.isFinite(+el.value)) return;
          const [lo, hi] = limits(st, o.S); st.min = lo; st.max = hi; st[k] = +el.value; st.range = "manual";
          box.querySelector('[data-k="range"]').value = "manual";
        } else if (k === "n") st.n = Math.max(2, Math.min(12, +el.value || 5));
        else st[k] = el.value;
        o.onSave(st);
        o.onChange(st);
        if (k === "min" || k === "max" || k === "opacity") {          // aggiornamento leggero: niente ridisegno del pannello
          const C2 = classify(st, o.S);
          if (cv) histogram(cv, C2);
          box.querySelector(".st-legend").innerHTML = legend(o.title || "", st, C2);
        } else panel(box, o);
      };
    });
    box.querySelector(".st-reset").onclick = () => { o.onReset(); };
  }

  return { create, get, save, reset, classify, stats, legend, panel, limits, RANGE_MODES };
})();
