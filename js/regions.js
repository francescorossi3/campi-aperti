// Campi Aperti — tab "Regioni": riepiloghi per regione, coltura e periodo
// Dati: data/riepiloghi.json, prodotto ogni giorno dalla GitHub Action "Meteo e riepiloghi regionali"
// (superfici: Copernicus HRL Crop Types; pioggia ed ET0: ERA5; ET coltura: Kc FAO-56 × ET0)

const Regions = (() => {
  const RT = {
    it: {
      region: "Regione", crop: "Coltura", year: "Anno", period: "Periodo", all: "Tutte le colture",
      q1: "1° trimestre (gen–mar)", q2: "2° trimestre (apr–giu)", q3: "3° trimestre (lug–set)", q4: "4° trimestre (ott–dic)",
      annata: "Annata agraria (nov – ott)", solare: "Anno solare",
      months: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
      th: ["Coltura", "Superficie (ha)", "Pioggia (mm)", "ET0 (mm)", "ET coltura (mm)", "Pioggia − ET (mm)", "Acqua evapotraspirata (milioni m³)"],
      total: "Totale / media pesata",
      loading: "Carico i riepiloghi…",
      missing: "I riepiloghi regionali sono in preparazione: la prima elaborazione dei dati Copernicus (2017–2024) e del meteo richiede alcuni giorni. Torna più tardi.",
      sentence: "Nel periodo {p} {y} i campi di {c} in {r} ({ha} ha) hanno ricevuto {rain} mm di pioggia ({vr} milioni di m³) e hanno evapotraspirato circa {etc} mm ({ve} milioni di m³): bilancio {bal} mm.",
      chart: "Pioggia ed ET coltura mese per mese",
      rain: "Pioggia (mm)", etc: "ET coltura (mm)", et0: "ET0 (mm)",
      note: "Superfici: Copernicus HRL Croplands – Crop Types (10 m). Pioggia ed ET0: ERA5 (Copernicus C3S) via Open-Meteo, media pesata sulle superfici della coltura. ET coltura = Kc mensile FAO-56 × ET0: stima indicativa, non misura.",
      upd: "Aggiornato",
    },
    en: {
      region: "Region", crop: "Crop", year: "Year", period: "Period", all: "All crops",
      q1: "Q1 (Jan–Mar)", q2: "Q2 (Apr–Jun)", q3: "Q3 (Jul–Sep)", q4: "Q4 (Oct–Dec)",
      annata: "Agricultural year (Nov – Oct)", solare: "Calendar year",
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      th: ["Crop", "Area (ha)", "Rain (mm)", "ET0 (mm)", "Crop ET (mm)", "Rain − ET (mm)", "Water evapotranspired (million m³)"],
      total: "Total / weighted mean",
      loading: "Loading summaries…",
      missing: "Regional summaries are being prepared: the first processing of the Copernicus data (2017–2024) and weather takes a few days. Please come back later.",
      sentence: "In {p} {y}, {c} fields in {r} ({ha} ha) received {rain} mm of rain ({vr} million m³) and evapotranspired about {etc} mm ({ve} million m³): balance {bal} mm.",
      chart: "Rain and crop ET month by month",
      rain: "Rain (mm)", etc: "Crop ET (mm)", et0: "ET0 (mm)",
      note: "Areas: Copernicus HRL Croplands – Crop Types (10 m). Rain and ET0: ERA5 (Copernicus C3S) via Open-Meteo, weighted by crop area. Crop ET = monthly FAO-56 Kc × ET0: indicative estimate, not a measurement.",
      upd: "Updated",
    },
  };
  const rt = (k) => (RT[LANG] || RT.it)[k];
  let D = null, rows = null, loaded = false, chart = null;
  const sel = { regione: "Italia", classe: "all", anno: null, periodo: "q1" };

  async function load() {
    if (loaded) return D;
    loaded = true;
    try {
      const r = await fetch("data/riepiloghi.json?ts=" + Date.now());
      if (!r.ok) throw new Error(r.status);
      D = await r.json();
      const ix = Object.fromEntries(D.colonne.map((c, i) => [c, i]));
      rows = D.righe.map((r) => ({ am: r[ix.anno_mappa], reg: r[ix.regione], cl: r[ix.classe], y: r[ix.anno], m: r[ix.mese], ha: r[ix.ha], p: r[ix.pioggia], e0: r[ix.et0], etc: r[ix.etc] }));
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
      const o = by[r.cl] || (by[r.cl] = { cl: r.cl, ha: r.ha, p: 0, e0: 0, etc: 0, n: 0 });
      o.p += r.p; o.e0 += r.e0; o.etc += r.etc; o.n++;
    });
    return Object.values(by).filter((o) => o.n === list.length).sort((a, b) => b.ha - a.ha);
  }

  const f0 = (x) => Math.round(x).toLocaleString(LANG === "it" ? "it-IT" : "en-GB");
  const f1 = (x) => x.toLocaleString(LANG === "it" ? "it-IT" : "en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const cname = (cl) => D.classi[cl] ? D.classi[cl][LANG] : cl;

  function render() {
    const box = document.getElementById("regionsPanel");
    if (!box) return;
    if (!D) { box.innerHTML = `<p class="hint">${rt("missing")}</p>`; return; }
    const regs = ["Italia", ...[...new Set(rows.map((r) => r.reg))].filter((r) => r !== "Italia").sort()];
    const periods = ["q1", "q2", "q3", "q4", "annata", "solare", ...Array.from({ length: 12 }, (_, i) => "m" + (i + 1))];
    const opt = (v, l, s) => `<option value="${v}" ${v == s ? "selected" : ""}>${l}</option>`;
    const data = aggregate();
    const shown = sel.classe === "all" ? data : data.filter((o) => String(o.cl) === String(sel.classe));
    const tot = shown.reduce((a, o) => ({ ha: a.ha + o.ha, p: a.p + o.p * o.ha, e0: a.e0 + o.e0 * o.ha, etc: a.etc + o.etc * o.ha }), { ha: 0, p: 0, e0: 0, etc: 0 });
    const vol = (mm, ha) => (mm * ha * 10) / 1e6;
    const row = (name, o, cls = "") => `<tr class="${cls}"><td>${name}</td><td>${f0(o.ha)}</td><td>${f0(o.p)}</td><td>${f0(o.e0)}</td><td>${f0(o.etc)}</td><td>${f0(o.p - o.etc)}</td><td>${f1(vol(o.etc, o.ha))}</td></tr>`;
    const T = tot.ha ? { ha: tot.ha, p: tot.p / tot.ha, e0: tot.e0 / tot.ha, etc: tot.etc / tot.ha } : null;
    const lead = sel.classe === "all" ? null : shown[0];
    const sentence = lead ? rt("sentence").replace("{p}", periodName()).replace("{y}", sel.periodo === "annata" ? `${sel.anno - 1}/${String(sel.anno).slice(2)}` : sel.anno).replace("{c}", cname(lead.cl).toLowerCase())
      .replace("{r}", sel.regione).replace("{ha}", f0(lead.ha)).replace("{rain}", f0(lead.p)).replace("{vr}", f1(vol(lead.p, lead.ha)))
      .replace("{etc}", f0(lead.etc)).replace("{ve}", f1(vol(lead.etc, lead.ha))).replace("{bal}", (lead.p - lead.etc >= 0 ? "+" : "") + f0(lead.p - lead.etc)) : "";
    box.innerHTML = `
      <div class="reg-form">
        <label>${rt("region")}<select id="rgReg">${regs.map((r) => opt(r, r, sel.regione)).join("")}</select></label>
        <label>${rt("crop")}<select id="rgCl">${opt("all", rt("all"), sel.classe)}${Object.keys(D.classi).map((k) => opt(k, cname(k), sel.classe)).join("")}</select></label>
        <label>${rt("year")}<select id="rgY">${D.anni.slice().sort((a, b) => b - a).map((y) => opt(y, y, sel.anno)).join("")}</select></label>
        <label>${rt("period")}<select id="rgP">${periods.map((p) => opt(p, p[0] === "m" ? rt("months")[+p.slice(1) - 1] : rt(p), sel.periodo)).join("")}</select></label>
      </div>
      ${sentence ? `<p class="reg-sentence">${sentence}</p>` : ""}
      <div class="reg-table-wrap"><table class="reg-table"><thead><tr>${rt("th").map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${shown.map((o) => row(cname(o.cl), o)).join("")}${T && shown.length > 1 ? row(rt("total"), T, "tot") : ""}</tbody></table></div>
      <figure class="reg-fig"><figcaption>${rt("chart")}</figcaption><div class="cbox"><canvas id="rgChart"></canvas></div></figure>
      <p class="hint small">${rt("note")} ${rt("upd")}: ${new Date(D.generato).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB")}.</p>`;
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
      return { lab: `${rt("months")[m - 1].slice(0, 3)} ${String(y).slice(2)}`, p: rs.reduce((a, r) => a + r.p * r.ha, 0) / ha,
        etc: rs.reduce((a, r) => a + r.etc * r.ha, 0) / ha, e0: rs.reduce((a, r) => a + r.e0 * r.ha, 0) / ha, inP: list.some(([a, b]) => a === y && b === m) };
    });
    if (chart) chart.destroy();
    chart = new Chart(el, {
      data: { labels: agg.map((a) => a.lab), datasets: [
        { type: "bar", label: rt("rain"), data: agg.map((a) => a.p), backgroundColor: agg.map((a) => (a.inP ? "#2b6cb0" : "#2b6cb055")) },
        { type: "bar", label: rt("etc"), data: agg.map((a) => a.etc), backgroundColor: agg.map((a) => (a.inP ? "#d0572b" : "#d0572b55")) },
        { type: "line", label: rt("et0"), data: agg.map((a) => a.e0), borderColor: "#8a5b10", borderDash: [4, 3], pointRadius: 0, borderWidth: 1.3 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: { x: { ticks: { font: { size: 10 } } }, y: { title: { display: true, text: "mm", font: { size: 10 } }, ticks: { font: { size: 10 } } } } },
    });
  }

  async function show() {
    const box = document.getElementById("regionsPanel");
    if (box && !D) box.innerHTML = `<p class="hint">${rt("loading")}</p>`;
    await load();
    render();
  }
  return { show, render };
})();
