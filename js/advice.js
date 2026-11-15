// Campi Aperti — modelli agronomici per coltura (avvisi per piccoli agricoltori)
// Meteo orario del punto (Open-Meteo: ultimi 92 giorni + previsioni a 7 giorni). Modelli semplici e pubblicati:
//  vite: peronospora (regola dei tre dieci), oidio (indice di Gubler-Thomas), indice di Winkler
//  olivo: mosca dell'olivo (condizioni favorevoli), occhio di pavone (bagnatura e temperatura), gelo
//  cereali: septoria e fusariosi della spiga (pioggia, umidità e temperatura nel periodo sensibile)
//  pomodoro e patata: peronospora (periodi di Smith)
//  frutteti e frutta a guscio: ore di freddo dal 1° novembre, gelate tardive
//  mais: gradi giorno; colture legnose: gelo nei prossimi giorni
// Sono indicazioni di rischio dal meteo, non diagnosi: vanno sempre verificate in campo e con i bollettini fitosanitari regionali.

const Advice = (() => {
  const AT = {
    it: {
      title: "Avvisi per la coltura", crop: "Coltura", loading: "Calcolo gli avvisi dal meteo…", err: "Meteo non disponibile.",
      note: "Rischi stimati solo dal meteo (Open-Meteo, ERA5 e previsioni) con modelli pubblicati: non sono diagnosi. Verifica in campo e segui i bollettini fitosanitari della tua regione.",
      lv: ["basso", "medio", "alto"], none: "coltura del campo non determinata: disegna il campo (✏️) e indica la coltura per avere gli avvisi.", nothing: "Nessun avviso per questa coltura in questo periodo.",
      crops: { vite: "Vite", olivo: "Olivo", cereali: "Frumento / orzo / cereali", mais: "Mais", pomodoro: "Pomodoro", patata: "Patata", frutteto: "Frutteto (pomacee, drupacee, actinidia, agrumi)", guscio: "Nocciolo / mandorlo / noce", altro: "Altra coltura" },
      pero: "Peronospora della vite (regola dei tre dieci)", pero_d: "Ultime 48 h: {r} mm di pioggia, temperatura media {t} °C. Previsti {f} mm nei prossimi 3 giorni.",
      oidio: "Oidio della vite (indice di Gubler-Thomas)", oidio_d: "Indice {i}/100: sopra 60 conviene accorciare gli intervalli tra i trattamenti.",
      winkler: "Somma termica della vite (indice di Winkler, dal 1° aprile)", winkler_d: "{g} gradi giorno base 10 °C.",
      mosca: "Mosca dell'olivo", mosca_d: "{n} giorni (ultima settimana e prossima) con temperatura media tra 20 e 30 °C; {c} giorni oltre 33 °C (il caldo la frena). Controlla le trappole.",
      pavone: "Occhio di pavone dell'olivo", pavone_d: "{h} ore di foglie bagnate con temperatura 10–20 °C negli ultimi 10 giorni.",
      septoria: "Septoria del frumento", septoria_d: "{n} giorni piovosi (≥ 2 mm) con 10–25 °C negli ultimi 14 giorni.",
      fusario: "Fusariosi della spiga (in fioritura, maggio–giugno)", fusario_d: "{n} giorni con pioggia e umidità > 85% a 15–30 °C negli ultimi 7 giorni.",
      smith: "Peronospora (periodi di Smith)", smith_d: "{n} periodi di Smith negli ultimi 7 giorni (2 giorni con minima ≥ 10 °C e almeno 11 ore di umidità ≥ 90%).",
      chill: "Ore di freddo dal 1° novembre (sotto 7,2 °C)", chill_d: "{h} ore: molte varietà di pesco e melo ne chiedono 400–1000 per fiorire bene.",
      gelo: "Gelo nei prossimi 7 giorni", gelo_d: "Minima prevista {t} °C il {d}.",
      gdd: "Gradi giorno dal 1° aprile (base 10 °C)", gdd_d: "{g} °C·giorno: un mais classe 500–600 FAO ne chiede circa 1500–1700 dalla semina alla maturazione.",
    },
    en: {
      title: "Crop alerts", crop: "Crop", loading: "Computing alerts from the weather…", err: "Weather not available.",
      note: "Risks estimated from weather only (Open-Meteo, ERA5 and forecast) with published models: not a diagnosis. Check in the field and follow your regional plant-protection bulletins.",
      lv: ["low", "medium", "high"], none: "the field's crop is unknown: draw the field (✏️) and set the crop to get alerts.", nothing: "No alerts for this crop in this period.",
      crops: { vite: "Grapevine", olivo: "Olive", cereali: "Wheat / barley / cereals", mais: "Maize", pomodoro: "Tomato", patata: "Potato", frutteto: "Orchard (pome, stone fruit, kiwi, citrus)", guscio: "Hazelnut / almond / walnut", altro: "Other crop" },
      pero: "Grapevine downy mildew (three-tens rule)", pero_d: "Last 48 h: {r} mm of rain, mean temperature {t} °C. {f} mm forecast in the next 3 days.",
      oidio: "Grapevine powdery mildew (Gubler-Thomas index)", oidio_d: "Index {i}/100: above 60 shorten the spray intervals.",
      winkler: "Grapevine heat sum (Winkler index, since 1 April)", winkler_d: "{g} degree days base 10 °C.",
      mosca: "Olive fruit fly", mosca_d: "{n} days (last week and next) with mean temperature 20–30 °C; {c} days above 33 °C (heat slows it). Check the traps.",
      pavone: "Olive leaf spot (peacock eye)", pavone_d: "{h} hours of wet leaves at 10–20 °C in the last 10 days.",
      septoria: "Wheat septoria", septoria_d: "{n} rainy days (≥ 2 mm) at 10–25 °C in the last 14 days.",
      fusario: "Fusarium head blight (at flowering, May–June)", fusario_d: "{n} days with rain and humidity > 85% at 15–30 °C in the last 7 days.",
      smith: "Late blight (Smith periods)", smith_d: "{n} Smith periods in the last 7 days (2 days with minimum ≥ 10 °C and at least 11 hours at humidity ≥ 90%).",
      chill: "Chill hours since 1 November (below 7.2 °C)", chill_d: "{h} hours: many peach and apple varieties need 400–1000 to flower well.",
      gelo: "Frost in the next 7 days", gelo_d: "Forecast minimum {t} °C on {d}.",
      gdd: "Degree days since 1 April (base 10 °C)", gdd_d: "{g} °C·days: a FAO 500–600 maize needs about 1500–1700 from sowing to maturity.",
    },
  };
  const at = (k, v) => { let s = (AT[LANG] || AT.it)[k] ?? AT.it[k]; if (v && typeof s === "string") Object.entries(v).forEach(([a, b]) => (s = s.replace("{" + a + "}", b))); return s; };
  const cache = {};

  // coltura dell'utente o classe Copernicus -> chiave del modello
  function cropKey(userCrop, cls) {
    const u = (userCrop || "").toLowerCase();
    if (/vite|uva/.test(u)) return "vite";
    if (/olivo/.test(u)) return "olivo";
    if (/pomodoro/.test(u)) return "pomodoro";
    if (/patat/.test(u)) return "patata";
    if (/mais|maize|corn/.test(u)) return "mais";
    if (/frumento|orzo|cereal|avena|segale|wheat|barley|winter/.test(u)) return "cereali";
    if (/nocciol|mandorl|noce|castagn|pistacch/.test(u)) return "guscio";
    if (/melo|pero|pesco|albicocc|ciliegi|susin|kiwi|agrum/.test(u)) return "frutteto";
    return { 14: "vite", 15: "olivo", 16: "frutteto", 17: "guscio" }[cls] || null;
  }

  async function meteo(lat, lon) {
    const k = lat.toFixed(2) + "," + lon.toFixed(2);
    if (!cache[k]) cache[k] = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
      `&hourly=temperature_2m,relative_humidity_2m,precipitation,leaf_wetness_probability&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,et0_fao_evapotranspiration` +
      `&past_days=92&forecast_days=7&timezone=auto`).then((r) => r.json());
    return cache[k];
  }

  function models(key, j) {
    const H = j.hourly, D = j.daily, now = new Date(), today = now.toISOString().slice(0, 10);
    const hIdx = H.time.map((t, i) => i), dIdx = D.time.map((t, i) => i);
    const past = (days) => dIdx.filter((i) => D.time[i] < today && (Date.parse(today) - Date.parse(D.time[i])) / 864e5 <= days);
    const next = (days) => dIdx.filter((i) => D.time[i] >= today && (Date.parse(D.time[i]) - Date.parse(today)) / 864e5 < days);
    const hPast = (days) => hIdx.filter((i) => H.time[i] < now.toISOString().slice(0, 13) && (now - Date.parse(H.time[i])) / 36e5 <= days * 24);
    const sum = (ix, a) => ix.reduce((s, i) => s + (a[i] || 0), 0);
    const mean = (ix, a) => (ix.length ? sum(ix, a) / ix.length : NaN);
    const fmtD = (i) => new Date(D.time[i]).toLocaleDateString(LANG === "it" ? "it-IT" : "en-GB", { weekday: "short", day: "numeric" });
    const m = now.getMonth() + 1, out = [];
    const add = (name, lv, desc) => out.push({ name, lv, desc });
    const wet = (i) => (H.leaf_wetness_probability && H.leaf_wetness_probability[i] != null ? H.leaf_wetness_probability[i] > 50 : H.relative_humidity_2m[i] >= 90 || H.precipitation[i] > 0.1);
    // gradi giorno dal 1° aprile (solo se siamo in stagione)
    const gddSince = () => { const y = now.getFullYear(), ix = dIdx.filter((i) => D.time[i] >= `${y}-04-01` && D.time[i] < today); return ix.length > 20 ? Math.round(ix.reduce((s, i) => s + Math.max(0, D.temperature_2m_mean[i] - 10), 0)) : null; };

    if (key === "vite") {
      const p48 = past(2), r = sum(p48, D.precipitation_sum), t = mean(p48, D.temperature_2m_mean), f = sum(next(3), D.precipitation_sum);
      const stag = m >= 4 && m <= 8;
      add(at("pero"), !stag ? 0 : r >= 10 && t >= 10 ? 2 : f >= 10 && t >= 10 ? 1 : 0, at("pero_d", { r: r.toFixed(0), t: t.toFixed(1), f: f.toFixed(0) }));
      // Gubler-Thomas sugli ultimi 15 giorni
      let gi = 0;
      past(15).forEach((d) => {
        const hs = hIdx.filter((i) => H.time[i].slice(0, 10) === D.time[d]);
        let run = 0, best = 0; hs.forEach((i) => { const T = H.temperature_2m[i]; run = T >= 21 && T <= 30 ? run + 1 : 0; best = Math.max(best, run); });
        gi = Math.max(0, Math.min(100, gi + (best >= 6 ? 20 : -10) - (hs.some((i) => H.temperature_2m[i] > 35) ? 10 : 0)));
      });
      add(at("oidio"), !stag ? 0 : gi > 60 ? 2 : gi > 30 ? 1 : 0, at("oidio_d", { i: gi }));
      const g = gddSince(); if (g != null) add(at("winkler"), -1, at("winkler_d", { g }));
    }
    if (key === "olivo") {
      const ix = [...past(7), ...next(7)];
      const fav = ix.filter((i) => D.temperature_2m_max[i] <= 32 && D.temperature_2m_mean[i] >= 20 && D.temperature_2m_mean[i] <= 30).length;
      const hot = ix.filter((i) => D.temperature_2m_max[i] > 33).length;
      const stag = m >= 6 && m <= 11;
      add(at("mosca"), !stag ? 0 : fav >= 8 && hot < 3 ? 2 : fav >= 4 ? 1 : 0, at("mosca_d", { n: fav, c: hot }));
      const hw = hPast(10).filter((i) => wet(i) && H.temperature_2m[i] >= 10 && H.temperature_2m[i] <= 20).length;
      add(at("pavone"), hw > 60 ? 2 : hw > 25 ? 1 : 0, at("pavone_d", { h: hw }));
    }
    if (key === "cereali") {
      const n14 = past(14).filter((i) => D.precipitation_sum[i] >= 2 && D.temperature_2m_mean[i] >= 10 && D.temperature_2m_mean[i] <= 25).length;
      add(at("septoria"), m < 3 || m > 6 ? 0 : n14 >= 5 ? 2 : n14 >= 3 ? 1 : 0, at("septoria_d", { n: n14 }));
      const n7 = past(7).filter((d) => {
        const hs = hIdx.filter((i) => H.time[i].slice(0, 10) === D.time[d]);
        return D.precipitation_sum[d] >= 1 && mean(hs, H.relative_humidity_2m) > 85 && D.temperature_2m_mean[d] >= 15 && D.temperature_2m_mean[d] <= 30;
      }).length;
      add(at("fusario"), m < 5 || m > 6 ? 0 : n7 >= 3 ? 2 : n7 >= 1 ? 1 : 0, at("fusario_d", { n: n7 }));
    }
    if (key === "pomodoro" || key === "patata") {
      let n = 0; const p = past(8);
      for (let k = 1; k < p.length; k++) {
        const ok = [p[k - 1], p[k]].every((d) => D.temperature_2m_min[d] >= 10 && hIdx.filter((i) => H.time[i].slice(0, 10) === D.time[d] && H.relative_humidity_2m[i] >= 90).length >= 11);
        if (ok) n++;
      }
      add(at("smith"), m < 4 || m > 10 ? 0 : n >= 2 ? 2 : n >= 1 ? 1 : 0, at("smith_d", { n }));
    }
    if (key === "frutteto" || key === "guscio") {
      const y = m >= 11 ? now.getFullYear() : now.getFullYear() - 1;
      const ch = hIdx.filter((i) => H.time[i] >= `${y}-11-01` && H.time[i] < now.toISOString().slice(0, 13) && H.temperature_2m[i] < 7.2 && H.temperature_2m[i] > 0).length;
      if (m >= 11 || m <= 3) add(at("chill"), -1, at("chill_d", { h: ch }));
    }
    if (key === "mais") { const g = gddSince(); if (g != null) add(at("gdd"), -1, at("gdd_d", { g })); }
    // gelo solo per le colture legnose sensibili (fioritura e germogli)
    const nx = next(7);
    if (nx.length && ["vite", "olivo", "frutteto", "guscio"].includes(key)) {
      const iMin = nx.reduce((a, i) => (D.temperature_2m_min[i] < D.temperature_2m_min[a] ? i : a), nx[0]), tmin = D.temperature_2m_min[iMin];
      if (tmin < 1) add(at("gelo"), tmin < -2 && ((m >= 3 && m <= 5) || key === "olivo") ? 2 : 1, at("gelo_d", { t: tmin.toFixed(1), d: fmtD(iMin) }));
    }
    return out;
  }

  async function render(el, lat, lon, userCrop, cls) {
    const key = cropKey(userCrop, cls);
    if (!key) { el.innerHTML = `<b>${at("title")}</b> <span class="hint small">${at("none")}</span>`; return; }
    el.innerHTML = `<b>${at("title")}: ${at("crops")[key]}</b><div class="adv-list"><span class="hint small">${at("loading")}</span></div>`;
    let j;
    try { j = await meteo(lat, lon); } catch (e) { j = null; }
    const list = el.querySelector(".adv-list");
    if (!list) return;
    if (!j || !j.hourly) { list.innerHTML = `<span class="hint small">${at("err")}</span>`; return; }
    const ms = models(key, j);
    list.innerHTML = (ms.length ? ms.map((x) => `<div class="adv lv${x.lv}"><span class="adv-dot"></span><div><b>${x.name}</b>` +
      `${x.lv >= 0 ? ` <span class="adv-lv">${at("lv")[x.lv]}</span>` : ""}<br><small>${x.desc}</small></div></div>`).join("") : `<span class="hint small">${at("nothing")}</span>`) +
      `<p class="hint small">${at("note")}</p>`;
  }
  return { render, cropKey };
})();
