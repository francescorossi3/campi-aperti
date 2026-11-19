// Columella – regions.js
// IT: tab "Province" e "Regioni".
//     Province (#provPanel): rese per provincia, ISTAT contro modello di Monteith. Fonte dei campi a scelta: mappa
//     Copernicus Crop Types (data/monteith_province.json, script 10+12) o classificatore delle colture
//     (data/monteith_province_cls.json, script 20+12, con le superfici stimate).
//     Regioni (#regionsPanel): due viste: (1) acqua per regione, coltura e periodo da data/riepiloghi.json
//     (superfici Copernicus HRL Crop Types; pioggia ed ET0 ERA5; ET coltura Kc FAO-56 × ET0); (2) rese per regione,
//     ISTAT contro Monteith, aggregando le province (medie pesate sulla superficie ISTAT; regione da data/province.json).
//     Espone il globale Regions { showProvince, showRegions, render, taratura } (usato da app.js e live.js).
//     Dipendenze: LANG (app.js), Chart.js (js/vendor), elementi #provPanel e #regionsPanel.
// EN: "Provinces" and "Regions" tabs: province and region yields (ISTAT vs Monteith) and regional water balance.

const Regions = (() => {
  const RT = {
    it: {
      region: "Regione", crop: "Coltura", year: "Anno", period: "Periodo", all: "Tutte le colture",
      q1: "1° trimestre (gen–mar)", q2: "2° trimestre (apr–giu)", q3: "3° trimestre (lug–set)", q4: "4° trimestre (ott–dic)",
      annata: "Annata agraria (nov – ott)", solare: "Anno solare",
      months: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
      th: ["Coltura", "Superficie (ha)", "Pioggia (mm)", "ET0 (mm)", "ET coltura FAO-56 (mm)", "ET reale Copernicus (mm)", "di cui traspirazione (mm)", "Pioggia − ET (mm)", "Acqua evapotraspirata (milioni m³)"],
      eta_s: " Secondo il satellite (Copernicus ETa) hanno evapotraspirato {eta} mm, di cui {tra} mm traspirati dalle piante.",
      carta: "Superfici dalla mappa colture Copernicus {c} (l'anno {y} non è ancora pubblicato).",
      eta_na: "ET reale Copernicus disponibile da novembre 2025.",
      total: "Totale / media pesata",
      loading: "Carico i riepiloghi…",
      missing: "I riepiloghi regionali sono in preparazione: la prima elaborazione dei dati Copernicus (2017–2024) e del meteo richiede alcuni giorni. Torna più tardi.",
      sentence: "Nel periodo {p} {y} i campi di {c} in {r} ({ha} ha) hanno ricevuto {rain} mm di pioggia ({vr} milioni di m³) e hanno evapotraspirato circa {etc} mm ({ve} milioni di m³): bilancio {bal} mm.",
      chart: "Pioggia ed evapotraspirazione mese per mese",
      rain: "Pioggia (mm)", etc: "ET coltura FAO-56 (mm)", et0: "ET0 (mm)", eta: "ET reale Copernicus (mm)",
      note: "Superfici: Copernicus HRL Croplands – Crop Types (10 m). Pioggia ed ET0: ERA5 (Copernicus C3S) via Open-Meteo, media pesata sulle superfici della coltura. ET coltura FAO-56 = Kc mensile × ET0 (stima da tabelle). ET reale Copernicus: CLMS Evapotranspiration 300 m da Sentinel-3 (modello ensemble TSEB-PT + ETLook), misura da satellite, dal novembre 2025. Le due fonti sono indipendenti: il confronto mostra quanto la coltura consuma davvero rispetto al fabbisogno teorico.",
      upd: "Aggiornato",
      v_acqua: "Acqua per regione", v_rese: "Rese per regione: ISTAT e modello",
      prov: "Provincia", all_prov: "Tutte le province", reg: "Regione",
      sc_rr: "Tutte le regioni, annata {y}: ISTAT (verticale) e modello tarato (orizzontale)",
      reg_note: "Resa regionale = media delle province pesata sulla superficie ISTAT della coltura (solo province con dati ISTAT e del modello).",
      src: "Campi della coltura individuati con", src_cop: "Mappa Copernicus HRL Crop Types (pixel 200 m puri)",
      src_cls: "Classificatore delle colture (3 reti neurali MLP, pixel 200 m sicuri)", th_hs: "Superficie stimata dal classificatore (ha)",
      src_missing: "Il confronto con il classificatore non è ancora stato calcolato. Si calcola provincia per provincia con il workflow GitHub «Rese per provincia con il classificatore delle colture» (annata e sigle, es. 2024 e RM); le regioni sommano le province calcolate.",
      th_r: ["Annata", "ISTAT (t/ha)", "Modello (t/ha)", "Modello tarato (t/ha)", "Scarto", "Superficie ISTAT (ha)", "Pixel 200 m usati"],
      ch_r: "Resa per annata: ISTAT e modello di Monteith (tarato)",
      sc_r: "Tutte le province, annata {y}: ISTAT (verticale) e modello tarato (orizzontale)",
      istat: "ISTAT", mod: "Modello tarato", modraw: "Modello non tarato",
      tar: "Taratura su ISTAT per {c}: fattore {f} su {n} coppie provincia×annata; R² {r2}; errore tipico dopo la taratura {e}%.",
      r_missing: "Il confronto per provincia è in preparazione (l'elaborazione delle immagini Sentinel-2 di tutta Italia richiede alcune ore). Torna più tardi.",
      r_note: "Modello di Monteith: radiazione solare ERA5 × frazione assorbita dalla coltura (dall'NDVI Sentinel-2 medio dei pixel da 200 m occupati per almeno l'80% dalla coltura secondo Copernicus) × efficienza d'uso della radiazione × indice di raccolto. Il fattore di taratura è la mediana del rapporto ISTAT / modello: lo stesso fattore viene applicato alla resa stimata del singolo campo. Le rese ISTAT degli ultimi anni sono provvisorie.",
    },
    en: {
      region: "Region", crop: "Crop", year: "Year", period: "Period", all: "All crops",
      q1: "Q1 (Jan–Mar)", q2: "Q2 (Apr–Jun)", q3: "Q3 (Jul–Sep)", q4: "Q4 (Oct–Dec)",
      annata: "Agricultural year (Nov – Oct)", solare: "Calendar year",
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      th: ["Crop", "Area (ha)", "Rain (mm)", "ET0 (mm)", "Crop ET FAO-56 (mm)", "Actual ET Copernicus (mm)", "of which transpiration (mm)", "Rain − ET (mm)", "Water evapotranspired (million m³)"],
      eta_s: " According to the satellite (Copernicus ETa) they evapotranspired {eta} mm, of which {tra} mm transpired by plants.",
      carta: "Areas from the Copernicus crop map {c} ({y} not yet published).",
      eta_na: "Copernicus actual ET available from November 2025.",
      total: "Total / weighted mean",
      loading: "Loading summaries…",
      missing: "Regional summaries are being prepared: the first processing of the Copernicus data (2017–2024) and weather takes a few days. Please come back later.",
      sentence: "In {p} {y}, {c} fields in {r} ({ha} ha) received {rain} mm of rain ({vr} million m³) and evapotranspired about {etc} mm ({ve} million m³): balance {bal} mm.",
      chart: "Rain and evapotranspiration month by month",
      rain: "Rain (mm)", etc: "Crop ET FAO-56 (mm)", et0: "ET0 (mm)", eta: "Actual ET Copernicus (mm)",
      note: "Areas: Copernicus HRL Croplands – Crop Types (10 m). Rain and ET0: ERA5 (Copernicus C3S) via Open-Meteo, weighted by crop area. FAO-56 crop ET = monthly Kc × ET0 (table-based estimate). Copernicus actual ET: CLMS Evapotranspiration 300 m from Sentinel-3 (TSEB-PT + ETLook ensemble), satellite-based, from November 2025. The two sources are independent: comparing them shows actual crop water use versus theoretical demand.",
      upd: "Updated",
      v_acqua: "Water by region", v_rese: "Yields by region: ISTAT and model",
      prov: "Province", all_prov: "All provinces", reg: "Region",
      sc_rr: "All regions, season {y}: ISTAT (vertical) vs calibrated model (horizontal)",
      reg_note: "Regional yield = mean of the provinces weighted by the ISTAT crop area (only provinces with both ISTAT and model data).",
      src: "Crop fields found with", src_cop: "Copernicus HRL Crop Types map (pure 200 m pixels)",
      src_cls: "Crop classifier (3 MLP neural networks, confident 200 m pixels)", th_hs: "Area estimated by the classifier (ha)",
      src_missing: "The comparison with the classifier has not been computed yet. It is computed province by province with the GitHub workflow “Yields by province with the crop classifier” (season and codes, e.g. 2024 and RM); regions add up the computed provinces.",
      th_r: ["Season", "ISTAT (t/ha)", "Model (t/ha)", "Calibrated model (t/ha)", "Difference", "ISTAT area (ha)", "200 m pixels used"],
      ch_r: "Yield by season: ISTAT and Monteith model (calibrated)",
      sc_r: "All provinces, season {y}: ISTAT (vertical) vs calibrated model (horizontal)",
      istat: "ISTAT", mod: "Calibrated model", modraw: "Uncalibrated model",
      tar: "Calibration on ISTAT for {c}: factor {f} over {n} province×season pairs; R² {r2}; typical error after calibration {e}%.",
      r_missing: "The province comparison is being prepared (processing Sentinel-2 imagery for all of Italy takes a few hours). Please come back later.",
      r_note: "Monteith model: ERA5 solar radiation × fraction absorbed by the crop (from the mean Sentinel-2 NDVI of 200 m pixels at least 80% covered by the crop according to Copernicus) × radiation use efficiency × harvest index. The calibration factor is the median ISTAT / model ratio; the same factor is applied to the estimated yield of a single field. Recent ISTAT yields are provisional.",
    },
  };
  const rt = (k) => (RT[LANG] || RT.it)[k];
  const locale = () => (LANG === "it" ? "it-IT" : "en-GB");
  const opt = (v, l, s) => `<option value="${v}" ${v == s ? "selected" : ""}>${l}</option>`;
  const seasonLabel = (y) => `${y - 1}/${String(y).slice(2)}`;   // annata agraria, es. 2024 -> "2023/24"

  // D/rows: riepiloghi regionali; M: rese per provincia (M.rows) e per regione (M.regRows); charts: grafici Chart.js attivi
  let D = null, rows = null, loaded = false;
  let M = null, mLoaded = false;
  const charts = {};                 // grafici Chart.js attivi per riquadro
  const sel = { regione: "Italia", classe: "all", anno: null, periodo: "q1", vista: "acqua", rcl: 1, ranno: null, pick: { prov: null, reg: null }, src: "copernicus" };

  // ---------- Vista "rese per provincia" ----------
  // fonte dei campi: "copernicus" (pixel puri Crop Types, script 10) o "classificatore" (classificatore delle colture, script 20)
  const FILES = { copernicus: "data/monteith_province.json", classificatore: "data/monteith_province_cls.json" };
  const cacheM = {};
  async function loadM() {
    if (sel.src in cacheM) { M = cacheM[sel.src]; return M; }
    mLoaded = true;
    try {
      const r = await fetch(FILES[sel.src] + "?ts=" + Date.now());
      if (!r.ok) throw new Error(r.status);
      M = await r.json();
      const ix = Object.fromEntries(M.colonne.map((c, i) => [c, i]));
      M.rows = M.righe.map((r) => ({ prov: r[ix.provincia], nuts: r[ix.nuts], cl: r[ix.classe], y: r[ix.anno], mod: r[ix.modello], ist: r[ix.istat], ha: r[ix.ha_istat], px: r[ix.pixel],
        hs: ix.ha_stimati != null ? r[ix.ha_stimati] : null }));
      sel.ranno = Math.max(...M.rows.filter((r) => r.ist != null).map((r) => r.y));
      // regioni: medie delle province pesate sulla superficie ISTAT (nome della regione da data/province.json)
      const P = await fetch("data/province.json").then((r) => r.json()).catch(() => null);
      const regOf = Object.fromEntries(((P && P.features) || []).map((f) => [f.properties.nuts, f.properties.reg_name]));
      const g = {};
      M.rows.forEach((r) => {
        const reg = regOf[r.nuts];
        if (!reg || r.ist == null || r.mod == null || !r.ha) return;
        const o = g[reg + "|" + r.cl + "|" + r.y] || (g[reg + "|" + r.cl + "|" + r.y] = { prov: reg, cl: r.cl, y: r.y, si: 0, sm: 0, ha: 0, px: 0, hs: null });
        o.si += r.ist * r.ha; o.sm += r.mod * r.ha; o.ha += r.ha; o.px += r.px;
        if (r.hs != null) o.hs = (o.hs || 0) + r.hs;
      });
      M.regRows = Object.values(g).map((o) => ({ prov: o.prov, cl: o.cl, y: o.y, ist: o.si / o.ha, mod: o.sm / o.ha, ha: o.ha, px: o.px, hs: o.hs }));
    } catch (e) { M = null; }
    cacheM[sel.src] = M;
    return M;
  }
  const CL_NAMES = { 1: ["Frumento", "Wheat"], 2: ["Orzo", "Barley"], 3: ["Mais", "Maize"], 4: ["Riso", "Rice"], 5: ["Altri cereali", "Other cereals"],
    7: ["Legumi", "Pulses"], 8: ["Patate", "Potatoes"], 9: ["Barbabietola", "Sugar beet"], 10: ["Girasole", "Sunflower"], 11: ["Soia", "Soybean"], 12: ["Colza", "Rapeseed"] };
  const clName = (c) => (CL_NAMES[c] || [c, c])[LANG === "it" ? 0 : 1];
  function viewTabs() {
    return `<div class="seg-group reg-views"><button class="seg ${sel.vista === "acqua" ? "active" : ""}" data-v="acqua">${rt("v_acqua")}</button>` +
      `<button class="seg ${sel.vista === "rese" ? "active" : ""}" data-v="rese">${rt("v_rese")}</button></div>`;
  }
  function bindViews() {
    document.querySelectorAll(".reg-views .seg").forEach((b) => (b.onclick = async () => { sel.vista = b.dataset.v; await showRegions(); }));
  }
  // rese ISTAT contro modello di Monteith per provincia (level "prov", tab Province) o per regione (level "reg", tab Regioni)
  function renderRese(level) {
    const isReg = level === "reg", box = document.getElementById(isReg ? "regionsPanel" : "provPanel");
    if (!box) return;
    const head = (isReg ? viewTabs() : "") + `<div class="reg-form"><label>${rt("src")}<select id="${isReg ? "Rr" : "Rp"}Src">
      <option value="copernicus"${sel.src === "copernicus" ? " selected" : ""}>${rt("src_cop")}</option>
      <option value="classificatore"${sel.src === "classificatore" ? " selected" : ""}>${rt("src_cls")}</option></select></label></div>`;
    const bindSrc = () => (document.getElementById((isReg ? "Rr" : "Rp") + "Src").onchange = async (e) => { sel.src = e.target.value; await loadM(); renderRese(level); });
    if (!M) { box.innerHTML = head + `<p class="hint">${rt(sel.src === "classificatore" ? "src_missing" : "r_missing")}</p>`; if (isReg) bindViews(); bindSrc(); return; }
    const ROWS = isReg ? M.regRows : M.rows, P = isReg ? "Rr" : "Rp";
    // fattore di taratura della fonte; se il classificatore non ha abbastanza province, quello di Copernicus
    const tarOf = (c) => M.taratura[c] || (cacheM.copernicus && cacheM.copernicus.taratura[c]) || null;
    const fat = (c) => (tarOf(c) ? tarOf(c).fattore : 1);
    const provs = [...new Set(ROWS.map((r) => r.prov))].sort();
    const cls = [...new Set(ROWS.map((r) => r.cl))].sort((a, b) => a - b);
    if (!cls.includes(sel.rcl)) sel.rcl = cls[0];
    let cur = sel.pick[level];
    if (!cur || !provs.includes(cur)) {
      const cnt = {}; ROWS.forEach((r) => { if (r.cl === sel.rcl && r.ist != null) cnt[r.prov] = (cnt[r.prov] || 0) + (r.ha || 0); });
      cur = sel.pick[level] = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || provs[0];
    }
    const anni = [...new Set(ROWS.map((r) => r.y))].sort((a, b) => b - a);
    const mine = ROWS.filter((r) => r.prov === cur && r.cl === sel.rcl).sort((a, b) => a.y - b.y);
    const f = fat(sel.rcl), T = tarOf(sel.rcl);
    const f2 = (x) => (x == null ? "—" : f1(x));
    const cls_ = sel.src === "classificatore", TH = rt("th_r").slice();
    if (cls_) TH.splice(6, 0, rt("th_hs"));
    const righe = mine.map((r) => {
      const t = r.mod * f;
      // scarto % del modello tarato rispetto a ISTAT: "bad" oltre ±25 %
      let scClass = "", scText = "—";
      if (r.ist) {
        const sc = Math.round((t / r.ist - 1) * 100);
        scClass = Math.abs(sc) > 25 ? "bad" : "good";
        scText = (sc > 0 ? "+" : "") + sc + "%";
      }
      return `<tr><td>${seasonLabel(r.y)}</td><td>${f2(r.ist)}</td><td>${f2(r.mod)}</td><td><b>${f2(t)}</b></td>` +
        `<td class="${scClass}">${scText}</td><td>${r.ha ? Math.round(r.ha).toLocaleString() : "—"}</td>` +
        (cls_ ? `<td>${r.hs != null ? Math.round(r.hs).toLocaleString() : "—"}</td>` : "") + `<td>${r.px}</td></tr>`;
    }).join("");
    box.innerHTML = head + `
      <div class="reg-form">
        <label>${rt(isReg ? "reg" : "prov")}<select id="${P}P">${provs.map((p) => opt(p, p, cur)).join("")}</select></label>
        <label>${rt("crop")}<select id="${P}C">${cls.map((c) => opt(c, clName(c), sel.rcl)).join("")}</select></label>
        <label>${rt("year")} (${LANG === "it" ? "grafico a dispersione" : "scatter chart"})<select id="${P}Y">${anni.map((y) => opt(y, y, sel.ranno)).join("")}</select></label>
      </div>
      ${T ? `<p class="reg-sentence">${rt("tar").replace("{c}", clName(sel.rcl).toLowerCase()).replace("{f}", T.fattore.toFixed(2)).replace("{n}", T.n).replace("{r2}", T.r2.toFixed(2)).replace("{e}", Math.round(T.errore_rel_tarato * 100))}</p>` : ""}
      <div class="reg-table-wrap"><table class="reg-table"><thead><tr>${TH.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${righe}</tbody></table></div>
      <figure class="reg-fig"><figcaption>${rt("ch_r")}</figcaption><div class="cbox"><canvas id="${P}Chart"></canvas></div></figure>
      <figure class="reg-fig"><figcaption>${rt(isReg ? "sc_rr" : "sc_r").replace("{y}", seasonLabel(sel.ranno))}</figcaption><div class="cbox"><canvas id="${P}Scatter"></canvas></div></figure>
      <p class="hint small">${rt("r_note")}${isReg ? " " + rt("reg_note") : ""} ${rt("upd")}: ${new Date(M.generato).toLocaleDateString(locale())}.</p>`;
    if (isReg) bindViews();
    bindSrc();
    document.getElementById(P + "P").onchange = (e) => { sel.pick[level] = e.target.value; renderRese(level); };
    document.getElementById(P + "C").onchange = (e) => { sel.rcl = +e.target.value; sel.pick[level] = null; renderRese(level); };
    document.getElementById(P + "Y").onchange = (e) => { sel.ranno = +e.target.value; renderRese(level); };
    [P + "1", P + "2"].forEach((k) => { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
    charts[P + "1"] = new Chart(document.getElementById(P + "Chart"), {
      type: "line",
      data: { labels: mine.map((r) => seasonLabel(r.y)), datasets: [
        { label: rt("istat"), data: mine.map((r) => r.ist), borderColor: "#2b6cb0", backgroundColor: "#2b6cb0", tension: 0.2 },
        { label: rt("mod"), data: mine.map((r) => r.mod * f), borderColor: "#2f8f3a", backgroundColor: "#2f8f3a", tension: 0.2 },
        { label: rt("modraw"), data: mine.map((r) => r.mod), borderColor: "#2f8f3a77", borderDash: [4, 3], pointRadius: 0, tension: 0.2 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: { y: { title: { display: true, text: "t/ha" }, beginAtZero: true } } },
    });
    const pts = ROWS.filter((r) => r.cl === sel.rcl && r.y === sel.ranno && r.ist != null);
    const mx = Math.max(1, ...pts.map((r) => Math.max(r.ist, r.mod * f))) * 1.1;
    charts[P + "2"] = new Chart(document.getElementById(P + "Scatter"), {
      type: "scatter",
      data: { datasets: [
        { label: rt(isReg ? "reg" : "prov"), data: pts.map((r) => ({ x: r.mod * f, y: r.ist, p: r.prov })), backgroundColor: pts.map((r) => (r.prov === cur ? "#d0572b" : "#2f8f3a99")),
          pointRadius: pts.map((r) => (r.prov === cur ? 6 : 3.5)) },
        { type: "line", label: "1:1", data: [{ x: 0, y: 0 }, { x: mx, y: mx }], borderColor: "#999", borderDash: [4, 3], pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw.p ? `${c.raw.p}: ISTAT ${c.raw.y.toFixed(1)} · mod. ${c.raw.x.toFixed(1)} t/ha` : "" } } },
        onClick: (e, els) => { const el = els.find((x) => x.datasetIndex === 0); if (el) { sel.pick[level] = pts[el.index].prov; renderRese(level); } },
        scales: { x: { min: 0, max: mx, title: { display: true, text: rt("mod") + " (t/ha)" } }, y: { min: 0, max: mx, title: { display: true, text: "ISTAT (t/ha)" } } } },
    });
  }

  // ---------- Vista "acqua per regione" ----------
  async function load() {
    if (loaded) return D;
    loaded = true;
    try {
      const r = await fetch("data/riepiloghi.json?ts=" + Date.now());
      if (!r.ok) throw new Error(r.status);
      D = await r.json();
      const ix = Object.fromEntries(D.colonne.map((c, i) => [c, i]));
      rows = D.righe.map((r) => ({ am: r[ix.anno_mappa], reg: r[ix.regione], cl: r[ix.classe], y: r[ix.anno], m: r[ix.mese], ha: r[ix.ha], p: r[ix.pioggia], e0: r[ix.et0], etc: r[ix.etc],
        eta: ix.eta != null ? r[ix.eta] : null, tra: ix.tra != null ? r[ix.tra] : null }));
      sel.anno = Math.max(...D.anni);
    } catch (e) { D = null; }
    return D;
  }

  // mesi (anno, mese) e anno della mappa colture da usare per il periodo scelto
  function months() {
    const Y = sel.anno, p = sel.periodo;
    if (p === "annata") return { am: Y, list: [[Y - 1, 11], [Y - 1, 12], ...Array.from({ length: 10 }, (_, i) => [Y, i + 1])] };
    if (p === "solare") return { am: Y, list: Array.from({ length: 12 }, (_, i) => [Y, i + 1]) };
    if (p[0] === "q") { const q = +p[1]; return { am: Y, list: [0, 1, 2].map((k) => [Y, (q - 1) * 3 + k + 1]) }; }
    return { am: Y, list: [[Y, +p.slice(1)]] };
  }
  const periodName = () => (sel.periodo[0] === "m" ? rt("months")[+sel.periodo.slice(1) - 1] : rt(sel.periodo).replace(/\s*\(.*\)/, ""));

  function aggregate() {
    const { am, list } = months();
    const want = new Set(list.map(([y, m]) => y * 100 + m));
    const by = {};
    rows.forEach((r) => {
      if (r.am !== am || r.reg !== sel.regione || !want.has(r.y * 100 + r.m)) return;
      const o = by[r.cl] || (by[r.cl] = { cl: r.cl, ha: r.ha, p: 0, e0: 0, etc: 0, eta: 0, tra: 0, n: 0, ne: 0 });
      o.p += r.p; o.e0 += r.e0; o.etc += r.etc; o.n++;
      if (r.eta != null) { o.eta += r.eta; o.tra += r.tra || 0; o.ne++; }
    });
    return Object.values(by).filter((o) => o.n === list.length).map((o) => (o.ne === list.length ? o : { ...o, eta: null, tra: null }))
      .sort((a, b) => b.ha - a.ha);
  }

  const f0 = (x) => Math.round(x).toLocaleString(locale());
  const f1 = (x) => x.toLocaleString(locale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const cname = (cl) => D.classi[cl] ? D.classi[cl][LANG] : cl;

  function render() {
    const box = document.getElementById("regionsPanel");
    if (!box) return;
    if (!D) { box.innerHTML = viewTabs() + `<p class="hint">${rt("missing")}</p>`; bindViews(); return; }
    const regs = ["Italia", ...[...new Set(rows.map((r) => r.reg))].filter((r) => r !== "Italia").sort()];
    const periods = ["q1", "q2", "q3", "q4", "annata", "solare", ...Array.from({ length: 12 }, (_, i) => "m" + (i + 1))];
    const data = aggregate();
    const shown = sel.classe === "all" ? data : data.filter((o) => String(o.cl) === String(sel.classe));
    const hasEta = shown.length && shown.every((o) => o.eta != null);
    const tot = shown.reduce((a, o) => ({ ha: a.ha + o.ha, p: a.p + o.p * o.ha, e0: a.e0 + o.e0 * o.ha, etc: a.etc + o.etc * o.ha,
      eta: a.eta + (o.eta || 0) * o.ha, tra: a.tra + (o.tra || 0) * o.ha }), { ha: 0, p: 0, e0: 0, etc: 0, eta: 0, tra: 0 });
    const vol = (mm, ha) => (mm * ha * 10) / 1e6;   // mm × ha -> milioni di m³
    const nd = (x) => (x == null ? "—" : f0(x));
    const etUse = (o) => (o.eta != null ? o.eta : o.etc);   // per bilancio e volume: misura satellitare se c'è
    const row = (name, o, cls = "") => `<tr class="${cls}"><td>${name}</td><td>${f0(o.ha)}</td><td>${f0(o.p)}</td><td>${f0(o.e0)}</td><td>${f0(o.etc)}</td>` +
      `<td>${nd(o.eta)}</td><td>${nd(o.tra)}</td><td>${f0(o.p - etUse(o))}</td><td>${f1(vol(etUse(o), o.ha))}</td></tr>`;
    const T = tot.ha ? { ha: tot.ha, p: tot.p / tot.ha, e0: tot.e0 / tot.ha, etc: tot.etc / tot.ha, eta: hasEta ? tot.eta / tot.ha : null, tra: hasEta ? tot.tra / tot.ha : null } : null;
    const lead = sel.classe === "all" ? null : shown[0];
    const sentence = lead ? rt("sentence").replace("{p}", periodName()).replace("{y}", sel.periodo === "annata" ? seasonLabel(sel.anno) : sel.anno).replace("{c}", cname(lead.cl).toLowerCase())
      .replace("{r}", sel.regione).replace("{ha}", f0(lead.ha)).replace("{rain}", f0(lead.p)).replace("{vr}", f1(vol(lead.p, lead.ha)))
      .replace("{etc}", f0(lead.etc)).replace("{ve}", f1(vol(lead.etc, lead.ha))).replace("{bal}", (lead.p - lead.etc >= 0 ? "+" : "") + f0(lead.p - lead.etc))
      + (lead.eta != null ? rt("eta_s").replace("{eta}", f0(lead.eta)).replace("{tra}", f0(lead.tra)) : "") : "";
    const carta = D.carte && D.carte[sel.anno] && +D.carte[sel.anno] !== +sel.anno ? rt("carta").replace("{c}", D.carte[sel.anno]).replace("{y}", sel.anno) : "";
    box.innerHTML = viewTabs() + `
      <div class="reg-form">
        <label>${rt("region")}<select id="rgReg">${regs.map((r) => opt(r, r, sel.regione)).join("")}</select></label>
        <label>${rt("crop")}<select id="rgCl">${opt("all", rt("all"), sel.classe)}${Object.keys(D.classi).map((k) => opt(k, cname(k), sel.classe)).join("")}</select></label>
        <label>${rt("year")}<select id="rgY">${D.anni.slice().sort((a, b) => b - a).map((y) => opt(y, y, sel.anno)).join("")}</select></label>
        <label>${rt("period")}<select id="rgP">${periods.map((p) => opt(p, p[0] === "m" ? rt("months")[+p.slice(1) - 1] : rt(p), sel.periodo)).join("")}</select></label>
      </div>
      ${sentence ? `<p class="reg-sentence">${sentence}</p>` : ""}
      ${carta ? `<p class="hint small">${carta}</p>` : ""}${!hasEta ? `<p class="hint small">${rt("eta_na")}</p>` : ""}
      <div class="reg-table-wrap"><table class="reg-table"><thead><tr>${rt("th").map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${shown.map((o) => row(cname(o.cl), o)).join("")}${T && shown.length > 1 ? row(rt("total"), T, "tot") : ""}</tbody></table></div>
      <figure class="reg-fig"><figcaption>${rt("chart")}</figcaption><div class="cbox"><canvas id="rgChart"></canvas></div></figure>
      <p class="hint small">${rt("note")} ${rt("upd")}: ${new Date(D.generato).toLocaleDateString(locale())}.</p>`;
    bindViews();
    document.getElementById("rgReg").onchange = (e) => { sel.regione = e.target.value; render(); };
    document.getElementById("rgCl").onchange = (e) => { sel.classe = e.target.value; render(); };
    document.getElementById("rgY").onchange = (e) => { sel.anno = +e.target.value; render(); };
    document.getElementById("rgP").onchange = (e) => { sel.periodo = e.target.value; render(); };
    drawChart();
  }

  function drawChart() {
    const el = document.getElementById("rgChart");
    if (!el) return;
    const { am, list } = months();
    const full = sel.periodo[0] === "m" || sel.periodo[0] === "q" ? Array.from({ length: 12 }, (_, i) => [sel.anno, i + 1]) : list;
    const pick = (y, m) => rows.filter((r) => r.am === am && r.reg === sel.regione && r.y === y && r.m === m && (sel.classe === "all" || String(r.cl) === String(sel.classe)));
    const agg = full.map(([y, m]) => {
      const rs = pick(y, m), ha = rs.reduce((a, r) => a + r.ha, 0) || 1;
      const he = rs.filter((r) => r.eta != null), hae = he.reduce((a, r) => a + r.ha, 0);
      return { lab: `${rt("months")[m - 1].slice(0, 3)} ${String(y).slice(2)}`, p: rs.reduce((a, r) => a + r.p * r.ha, 0) / ha,
        eta: hae ? he.reduce((a, r) => a + r.eta * r.ha, 0) / hae : null,
        etc: rs.reduce((a, r) => a + r.etc * r.ha, 0) / ha, e0: rs.reduce((a, r) => a + r.e0 * r.ha, 0) / ha, inP: list.some(([a, b]) => a === y && b === m) };
    });
    if (charts.water) charts.water.destroy();
    charts.water = new Chart(el, {
      data: { labels: agg.map((a) => a.lab), datasets: [
        { type: "bar", label: rt("rain"), data: agg.map((a) => a.p), backgroundColor: agg.map((a) => (a.inP ? "#2b6cb0" : "#2b6cb055")) },
        { type: "bar", label: rt("etc"), data: agg.map((a) => a.etc), backgroundColor: agg.map((a) => (a.inP ? "#d0572b" : "#d0572b55")) },
        { type: "bar", label: rt("eta"), data: agg.map((a) => a.eta), backgroundColor: agg.map((a) => (a.inP ? "#2f8f3a" : "#2f8f3a55")) },
        { type: "line", label: rt("et0"), data: agg.map((a) => a.e0), borderColor: "#8a5b10", borderDash: [4, 3], pointRadius: 0, borderWidth: 1.3 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: { x: { ticks: { font: { size: 10 } } }, y: { title: { display: true, text: "mm", font: { size: 10 } }, ticks: { font: { size: 10 } } } } },
    });
  }

  async function showProvince() {
    const box = document.getElementById("provPanel");
    if (box && !M) box.innerHTML = `<p class="hint">${rt("loading")}</p>`;
    await loadM();
    renderRese("prov");
  }
  async function showRegions() {
    const box = document.getElementById("regionsPanel");
    if (box && !D) box.innerHTML = `<p class="hint">${rt("loading")}</p>`;
    if (sel.vista === "rese") { await loadM(); renderRese("reg"); return; }
    await load();
    render();
  }
  // ridisegna i riquadri già aperti (cambio lingua)
  function renderAll() {
    if (mLoaded && document.getElementById("provPanel")?.childElementCount) renderRese("prov");
    if (document.getElementById("regionsPanel")?.childElementCount) { if (sel.vista === "rese") renderRese("reg"); else if (D) render(); }
  }
  // taratura per la resa dei singoli campi: sempre quella di Copernicus
  async function taratura() {
    const keep = sel.src;
    sel.src = "copernicus";
    const m = await loadM();
    sel.src = keep; M = cacheM[keep] !== undefined ? cacheM[keep] : M;
    return (m || {}).taratura || null;
  }
  return { showProvince, showRegions, render: renderAll, taratura };
})();
