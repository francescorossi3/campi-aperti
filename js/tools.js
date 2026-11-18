// Columella — js/tools.js
// IT: strumenti della sezione "Ricerca e campi" della barra laterale (testi IT/EN propri, tabella TT):
//  ✏️ disegna un campo (coltura, filari, alberi, resa…) e, se l'utente vuole, lo condivide su GitHub per i modelli
//  ▭  scarica i campi di un'area (GeoJSON / KML / CSV), divisi automaticamente da Sentinel-2
//  📂 carica una propria mappa (GeoTIFF, GeoJSON, KML) e sceglie la legenda — il file non lascia il computer
//  🏡 il mio prato: quanta acqua dare, quando tagliare (meteo Open-Meteo)
//  ⭐ i miei campi (nel browser, oppure nell'account Supabase se l'utente ha fatto l'accesso)
// EN: field tools in the sidebar: draw a field, download the fields of an area, load your own maps, lawn advice, saved fields.
//
// Globale esposto / exposed global: Tools { init, busy, refreshLang, startDraw, welcome }
//   (app.js usa init, busy, refreshLang).
// Dipende da / depends on: Leaflet (L), app.js (LANG, map — usati solo dopo Tools.init()), croplayer.js (COLORMAPS),
//   live.js (Live), segment.js (Segment), account.js (Account, facoltativo), vendor GeoTIFF + proj4,
//   servizi esterni: Open-Meteo, epsg.io, GitHub issues.

const Tools = (() => {
  const REPO = "francescorossi3/columella";
  const TT = {
    it: {
      draw: "Disegna un campo", rect: "Scarica i campi di un'area", upload: "Carica una tua mappa", lawn: "Il mio prato", mine: "I miei campi",
      h_poly: "Clicca sulla mappa per mettere i vertici del campo. Doppio clic (o clic sul primo punto) per chiudere · Canc toglie l'ultimo punto · Esc annulla.",
      h_rect: "Clicca due angoli opposti dell'area (al massimo 6 × 6 km) · Esc annulla.",
      h_lawn: "Disegna il contorno del prato: clic per i vertici, doppio clic per chiudere · Esc annulla.",
      cancel: "Annulla",
      f_title: "Il tuo campo", f_name: "Nome", f_crop: "Coltura", f_var: "Varietà", f_year: "Anno d'impianto (colture permanenti)",
      f_rows: "Numero di filari", f_trees: "Numero di piante / alberi", f_dr: "Distanza tra i filari (m)", f_dp: "Distanza sulla fila (m)",
      f_irr: "Irrigazione", irr: ["non so", "nessuna", "a goccia", "ad aspersione", "a scorrimento", "pivot / rotolone"],
      f_sow: "Data di semina / germogliamento", f_harv: "Data di raccolta", f_yield: "Resa misurata (t/ha)", f_yyear: "Annata della resa",
      f_n: "Azoto distribuito (kg N/ha)", f_water: "Acqua irrigata nella stagione (mm)", f_bio: "Biologico", f_note: "Note",
      f_density: "Densità calcolata: {d} piante/ha", f_area: "Superficie {a} ha",
      save: "Salva nei miei campi", geojson: "Scarica GeoJSON", share: "Condividi per migliorare i modelli",
      share_info: "Si apre GitHub con i dati del campo già compilati (serve un account gratuito): pubblicando il messaggio il campo entra nel dataset aperto usato per addestrare il riconoscimento delle colture e tarare le rese. Non inserire dati personali.",
      saved: "Salvato nel browser (solo su questo computer).", analyze: "Analizza con il satellite",
      too_long: "Il campo ha troppi vertici per l'invio automatico: ho scaricato il file, allegalo al messaggio su GitHub.",
      mine_empty: "Nessun campo salvato. Usa «Disegna un campo».", del: "Elimina", open: "Apri", export_all: "Scarica tutti (GeoJSON)",
      r_big: "Area troppo grande: al massimo 6 × 6 km.", r_seg: "Divido l'area in campi… {n}/{t} immagini", r_crop: "Coltura dei campi… {n}/{t}",
      r_done: "{n} campi trovati nell'area ({a} ha).", r_title: "Campi dell'area", r_fail: "Divisione in campi non riuscita (poche immagini serene?).",
      r_note: "Confini stimati automaticamente da Sentinel-2 (10 m): NDVI medio per data, coltura Copernicus 2024. Licenza dei dati: CC BY-NC 4.0, citare Columella, Copernicus, ESA.",
      kml: "Scarica KML", csv: "Scarica tabella CSV",
      u_title: "Le mie mappe", u_hint: "GeoTIFF (anche PRISMA, EnMAP, droni, mappe di prescrizione), GeoJSON o KML. Il file resta sul tuo computer: non viene caricato su nessun server.",
      u_band: "Banda", u_rgb: "Composizione RGB (R, G, B)", u_cmap: "Scala colori", u_min: "Min", u_max: "Max", u_auto: "Automatico (2–98%)",
      u_op: "Trasparenza", u_name: "Titolo legenda", u_unit: "Unità", u_classes: "Classi (una per riga: valore o min-max = colore = etichetta)",
      u_nodata: "Valore nullo", u_remove: "Rimuovi", u_zoom: "Vai alla mappa", u_err: "File non leggibile: {e}", u_crs: "Sistema di riferimento EPSG:{c} sconosciuto. Inserisci il codice EPSG o la stringa proj4:",
      u_reading: "Leggo {f}…", u_value: "Valore", u_hdf: "I file PRISMA/EnMAP originali (HDF5) vanno prima esportati in GeoTIFF (es. con QGIS, SNAP o il PRISMA Toolbox).",
      cm: { viridis: "Viridis", rdylgn: "Rosso-giallo-verde", magma: "Magma", blues: "Blu", brbg: "Marrone-verde (suolo)", gray: "Grigi", classes: "Classi personalizzate" },
      l_title: "Il mio prato", l_type: "Tipo di erba", l_cool: "Microterme (festuca, loietto, poa) — la maggior parte dei prati del centro-nord",
      l_warm: "Macroterme (gramigna, zoysia, paspalum) — prati del sud e al mare", l_loading: "Carico meteo e previsioni…",
      l_area: "Superficie del prato: {a} m²", l_last7: "Ultimi 7 giorni: pioggia {p} mm, consumo del prato {c} mm",
      l_next: "Prossimi 7 giorni: pioggia prevista {p} mm, consumo previsto {c} mm",
      l_water: "Da dare ora: circa {mm} mm, cioè {l} litri sul prato, {n} (mattino presto).", l_n1: "in un'unica irrigazione profonda", l_n2: "divisi in due irrigazioni a 3–4 giorni di distanza",
      l_nowater: "Non serve irrigare: la pioggia recente o prevista copre il fabbisogno.",
      l_grow: "Crescita stimata dell'erba: {g}% del massimo", l_mow0: "L'erba è quasi ferma: taglia solo se serve, non sotto i 6 cm.",
      l_mow1: "Crescita moderata: un taglio ogni 7–10 giorni.", l_mow2: "Crescita forte: taglia ogni 4–6 giorni, togliendo al massimo 1/3 dell'altezza.",
      l_heat: "Caldo: tieni l'erba più alta (7–8 cm) e irriga presto al mattino.", l_frost: "Gelate previste: non calpestare il prato gelato.",
      l_feed: "Concimazione consigliata in questo periodo: {f}", l_sat: "Vedi il prato dal satellite (NDVI 10 m, solo prati grandi)",
      feed: ["no (riposo invernale)", "no", "leggera, a fine mese", "sì: azoto a lenta cessione", "sì, leggera", "solo macroterme", "solo macroterme", "no (caldo)", "sì: concimazione autunnale", "sì: concime autunnale ricco di potassio", "leggera, prima del freddo", "no (riposo invernale)"],
      w_title: "Benvenuto in Columella", w_go: "Inizia",
      w_steps: ["🔎 <b>Cerca</b> il tuo comune, un indirizzo o incolla le coordinate.", "🖱️ <b>Clicca su un campo</b>: il sito ne trova i confini e mostra coltura, indici satellitari, meteo, acqua, suolo e resa stimata.",
        "✏️ Se il confine non è giusto, <b>disegnalo</b> tu e aggiungi coltura, filari, piante, resa.", "📂 <b>Carica le tue mappe</b> (PRISMA, droni…) o <b>scarica i campi</b> di un'area come file vettoriale.",
        "🏡 Per il giardino: <b>Il mio prato</b> ti dice quanta acqua dare e quando tagliare."],
      w_note: "Tutto gratuito e basato su dati aperti (Copernicus, ERA5, ISTAT, Agenzia delle Entrate, SoilGrids).",
      l_src: "Meteo: ERA5 e previsioni Open-Meteo. Coefficiente colturale del tappeto erboso FAO-56: 0,85 microterme, 0,65 macroterme. Crescita: modello di potenziale di crescita (Gelernter & Stowell).",
    },
    en: {
      draw: "Draw a field", rect: "Download fields of an area", upload: "Upload your own map", lawn: "My lawn", mine: "My fields",
      h_poly: "Click on the map to place the field vertices. Double-click (or click the first point) to close · Delete removes the last point · Esc cancels.",
      h_rect: "Click two opposite corners of the area (max 6 × 6 km) · Esc cancels.",
      h_lawn: "Draw the lawn outline: click for vertices, double-click to close · Esc cancels.",
      cancel: "Cancel",
      f_title: "Your field", f_name: "Name", f_crop: "Crop", f_var: "Variety", f_year: "Planting year (permanent crops)",
      f_rows: "Number of rows", f_trees: "Number of plants / trees", f_dr: "Row spacing (m)", f_dp: "In-row spacing (m)",
      f_irr: "Irrigation", irr: ["don't know", "none", "drip", "sprinkler", "furrow / flood", "pivot / hose reel"],
      f_sow: "Sowing / bud-break date", f_harv: "Harvest date", f_yield: "Measured yield (t/ha)", f_yyear: "Season of the yield",
      f_n: "Nitrogen applied (kg N/ha)", f_water: "Irrigation water in the season (mm)", f_bio: "Organic", f_note: "Notes",
      f_density: "Computed density: {d} plants/ha", f_area: "Area {a} ha",
      save: "Save to my fields", geojson: "Download GeoJSON", share: "Share to improve the models",
      share_info: "GitHub opens with the field data already filled in (a free account is needed): once posted, the field joins the open dataset used to train crop recognition and calibrate yields. Do not include personal data.",
      saved: "Saved in the browser (this computer only).", analyze: "Analyse with the satellite",
      too_long: "The field has too many vertices for automatic sending: the file has been downloaded, attach it to the GitHub message.",
      mine_empty: "No saved fields. Use “Draw a field”.", del: "Delete", open: "Open", export_all: "Download all (GeoJSON)",
      r_big: "Area too large: max 6 × 6 km.", r_seg: "Splitting the area into fields… {n}/{t} images", r_crop: "Crop of the fields… {n}/{t}",
      r_done: "{n} fields found in the area ({a} ha).", r_title: "Fields of the area", r_fail: "Field splitting failed (too few clear images?).",
      r_note: "Boundaries estimated automatically from Sentinel-2 (10 m): mean NDVI per date, Copernicus crop 2024. Data licence: CC BY-NC 4.0, credit Columella, Copernicus, ESA.",
      kml: "Download KML", csv: "Download CSV table",
      u_title: "My maps", u_hint: "GeoTIFF (including PRISMA, EnMAP, drones, prescription maps), GeoJSON or KML. The file stays on your computer: it is not uploaded to any server.",
      u_band: "Band", u_rgb: "RGB composite (R, G, B)", u_cmap: "Colour scale", u_min: "Min", u_max: "Max", u_auto: "Automatic (2–98%)",
      u_op: "Opacity", u_name: "Legend title", u_unit: "Unit", u_classes: "Classes (one per line: value or min-max = colour = label)",
      u_nodata: "No-data value", u_remove: "Remove", u_zoom: "Zoom to map", u_err: "Cannot read the file: {e}", u_crs: "Unknown reference system EPSG:{c}. Enter the EPSG code or proj4 string:",
      u_reading: "Reading {f}…", u_value: "Value", u_hdf: "Original PRISMA/EnMAP files (HDF5) must first be exported to GeoTIFF (e.g. with QGIS, SNAP or the PRISMA Toolbox).",
      cm: { viridis: "Viridis", rdylgn: "Red-yellow-green", magma: "Magma", blues: "Blues", brbg: "Brown-green (soil)", gray: "Greys", classes: "Custom classes" },
      l_title: "My lawn", l_type: "Grass type", l_cool: "Cool-season (fescue, ryegrass, bluegrass) — most lawns in central/northern Italy",
      l_warm: "Warm-season (bermuda, zoysia, paspalum) — southern and coastal lawns", l_loading: "Loading weather and forecast…",
      l_area: "Lawn area: {a} m²", l_last7: "Last 7 days: rain {p} mm, lawn water use {c} mm",
      l_next: "Next 7 days: forecast rain {p} mm, expected use {c} mm",
      l_water: "Give now: about {mm} mm, i.e. {l} litres over the lawn, {n} (early morning).", l_n1: "in a single deep watering", l_n2: "split into two waterings 3–4 days apart",
      l_nowater: "No need to water: recent or forecast rain covers the demand.",
      l_grow: "Estimated grass growth: {g}% of maximum", l_mow0: "Grass is almost dormant: mow only if needed, never below 6 cm.",
      l_mow1: "Moderate growth: mow every 7–10 days.", l_mow2: "Strong growth: mow every 4–6 days, removing at most 1/3 of the height.",
      l_heat: "Hot weather: keep the grass taller (7–8 cm) and water early in the morning.", l_frost: "Frost forecast: do not walk on frozen grass.",
      l_feed: "Fertilising in this period: {f}", l_sat: "See the lawn from the satellite (NDVI 10 m, large lawns only)",
      feed: ["no (winter rest)", "no", "light, at month end", "yes: slow-release nitrogen", "yes, light", "warm-season only", "warm-season only", "no (heat)", "yes: autumn feed", "yes: potassium-rich autumn feed", "light, before the cold", "no (winter rest)"],
      w_title: "Welcome to Columella", w_go: "Start",
      w_steps: ["🔎 <b>Search</b> your town, an address or paste coordinates.", "🖱️ <b>Click a field</b>: the site finds its boundary and shows crop, satellite indices, weather, water, soil and estimated yield.",
        "✏️ If the boundary is wrong, <b>draw it</b> yourself and add crop, rows, plants, yield.", "📂 <b>Upload your own maps</b> (PRISMA, drones…) or <b>download the fields</b> of an area as a vector file.",
        "🏡 For the garden: <b>My lawn</b> tells you how much to water and when to mow."],
      w_note: "All free and based on open data (Copernicus, ERA5, ISTAT, Italian Revenue Agency, SoilGrids).",
      l_src: "Weather: ERA5 and Open-Meteo forecast. Turfgrass crop coefficient FAO-56: 0.85 cool-season, 0.65 warm-season. Growth: growth potential model (Gelernter & Stowell).",
    },
  };
  // testo tradotto; i segnaposto {nome} vengono sostituiti con i valori di vars
  const tt = (k, vars) => {
    let s = (TT[LANG] || TT.it)[k] ?? TT.it[k] ?? k;
    if (vars && typeof s === "string") Object.entries(vars).forEach(([name, val]) => (s = s.replace("{" + name + "}", val)));
    return s;
  };
  const CROPS = {
    it: ["Frumento tenero", "Frumento duro", "Orzo", "Mais", "Riso", "Altri cereali", "Legumi", "Patate", "Barbabietola", "Girasole", "Soia", "Colza",
      "Pomodoro da industria", "Ortaggi", "Erba medica", "Prato / pascolo", "Vite da vino", "Uva da tavola", "Olivo", "Melo", "Pero", "Pesco / nettarina",
      "Albicocco", "Ciliegio", "Susino", "Kiwi", "Agrumi", "Nocciolo", "Mandorlo", "Noce", "Castagno", "Pistacchio", "Altro"],
    en: ["Soft wheat", "Durum wheat", "Barley", "Maize", "Rice", "Other cereals", "Pulses", "Potatoes", "Sugar beet", "Sunflower", "Soybean", "Rapeseed",
      "Processing tomato", "Vegetables", "Lucerne", "Grassland / pasture", "Wine grapes", "Table grapes", "Olive", "Apple", "Pear", "Peach / nectarine",
      "Apricot", "Cherry", "Plum", "Kiwi", "Citrus", "Hazelnut", "Almond", "Walnut", "Chestnut", "Pistachio", "Other"],
  };
  const loc = () => (LANG === "it" ? "it-IT" : "en-GB");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const download = (name, text, type = "application/json") => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  // area geodetica (sfera) di un Polygon/MultiPolygon GeoJSON, in ettari; i buchi vengono sottratti
  const areaHa = (geom) => {
    const ring = (r) => {
      const R = 6378137;
      let a = 0;
      for (let i = 0; i < r.length - 1; i++) {
        const [x1, y1] = r[i], [x2, y2] = r[i + 1];
        a += ((x2 - x1) * Math.PI / 180) * (2 + Math.sin(y1 * Math.PI / 180) + Math.sin(y2 * Math.PI / 180));
      }
      return Math.abs((a * R * R) / 2);
    };
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    return polys.reduce((s, p) => s + ring(p[0]) - p.slice(1).reduce((q, h) => q + ring(h), 0), 0) / 10000;
  };

  // ================================================================== disegno
  let drawing = null;
  const busy = () => !!drawing;
  function hint(text) {
    const el = document.getElementById("drawHint");          // riga nella sezione "Ricerca e campi"
    document.body.classList.toggle("drawing", !!text);           // su telefono il foglio si abbassa e lascia la mappa
    el.innerHTML = text ? `${text} <button class="small-btn" id="drawCancel">${tt("cancel")}</button>` : "";
    el.hidden = !text;
    if (text) document.getElementById("drawCancel").onclick = stopDraw;
  }
  function stopDraw() {
    if (!drawing) return;
    drawing.layers.forEach((l) => map.removeLayer(l));
    map.off("click", drawing.onClick);
    map.off("mousemove", drawing.onMove);
    map.off("dblclick", drawing.onDbl);
    document.removeEventListener("keydown", drawing.onKey);
    map.doubleClickZoom.enable();
    map.getContainer().classList.remove("drawing");
    drawing = null;
    hint("");
  }
  // kind "poly": poligono, done(feature GeoJSON); kind "rect": due angoli, done(L.LatLngBounds)
  function startDraw(kind, done, hintKey) {
    stopDraw();
    const pts = [];
    const line = L.polyline([], { color: "#ffd84a", weight: 3 }).addTo(map);
    const ghost = L.polyline([], { color: "#ffd84a", weight: 2, dashArray: "4 4" }).addTo(map);
    const rect = L.rectangle([[0, 0], [0, 0]], { color: "#ffd84a", weight: 2, fillOpacity: 0.1 });
    const dots = L.layerGroup().addTo(map);
    const addDot = (latlng) => L.circleMarker(latlng, { radius: 4, color: "#333", weight: 1, fillColor: "#ffd84a", fillOpacity: 1 }).addTo(dots);
    drawing = { layers: [line, ghost, rect, dots] };
    map.doubleClickZoom.disable();
    map.getContainer().classList.add("drawing");
    const finish = () => {
      if (kind === "rect" || pts.length < 3) return;
      const ring = pts.map((p) => [+p.lng.toFixed(6), +p.lat.toFixed(6)]);
      ring.push(ring[0]);
      stopDraw();
      done({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
    };
    drawing.onClick = (e) => {
      if (kind === "rect") {
        pts.push(e.latlng);
        if (pts.length === 2) {
          const bounds = L.latLngBounds(pts);
          stopDraw();
          done(bounds);
        } else {
          rect.setBounds(L.latLngBounds([e.latlng, e.latlng])).addTo(map);
        }
        return;
      }
      // clic vicino al primo punto (entro 10 px): chiude il poligono
      if (pts.length >= 3 && map.latLngToContainerPoint(pts[0]).distanceTo(e.containerPoint) < 10) return finish();
      pts.push(e.latlng);
      addDot(e.latlng);
      line.setLatLngs(pts);
    };
    drawing.onMove = (e) => {
      if (kind === "rect") { if (pts.length === 1) rect.setBounds(L.latLngBounds([pts[0], e.latlng])); return; }
      if (pts.length) ghost.setLatLngs([pts[pts.length - 1], e.latlng, pts[0]]);
    };
    drawing.onDbl = (e) => {
      L.DomEvent.stop(e);
      // il doppio clic ha già aggiunto un punto con il primo clic: lo tolgo
      if (pts.length && pts[pts.length - 1].equals(e.latlng)) pts.pop();
      finish();
    };
    drawing.onKey = (e) => {
      if (e.key === "Escape") stopDraw();
      else if ((e.key === "Backspace" || e.key === "Delete") && pts.length && !/input|textarea|select/i.test(e.target.tagName)) {
        pts.pop();
        line.setLatLngs(pts);
        dots.clearLayers();
        pts.forEach(addDot);
      }
    };
    map.on("click", drawing.onClick);
    map.on("mousemove", drawing.onMove);
    map.on("dblclick", drawing.onDbl);
    document.addEventListener("keydown", drawing.onKey);
    hint(tt(hintKey));
  }

  // ================================================================== schede degli strumenti (sezione "Ricerca e campi")
  function card(id, title, html, cls = "") {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement("section"); el.id = id; document.getElementById("toolCards").prepend(el); }
    if (typeof openSection === "function") openSection("fields");
    el.className = "tool-card " + cls;
    el.innerHTML = `<div class="tc-head"><b>${title}</b><button class="icon-x" title="×">×</button></div><div class="tc-body">${html}</div>`;
    el.querySelector(".icon-x").onclick = () => el.remove();
    return el;
  }

  // ================================================================== ✏️ campo disegnato dall'utente
  const STORE = "campiAperti.mieiCampi";   // chiave storica di localStorage: non rinominare
  // senza account i campi stanno nel browser; con l'account nel database (cache in memoria per la mappa)
  let cloud = null;
  const loggedIn = () => typeof Account !== "undefined" && Account.utente();
  const loadMine = () => {
    if (loggedIn() && cloud) return cloud;
    try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; }
  };
  const saveMine = (list) => {
    try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch (e) { return false; }
  };

  function fieldForm(feature) {
    const p = feature.properties || {};
    const ha = areaHa(feature.geometry);
    const opt = (v, l, s) => `<option value="${esc(v)}" ${String(v) === String(s ?? "") ? "selected" : ""}>${esc(l)}</option>`;
    const crops = CROPS[LANG] || CROPS.it;
    const el = card("toolField", tt("f_title"), `
      <p class="hint small">${tt("f_area", { a: ha.toFixed(2) })}</p>
      <form class="tf-form" id="tfForm">
        <label>${tt("f_name")}<input name="nome" value="${esc(p.nome)}"></label>
        <label>${tt("f_crop")}<select name="coltura"><option value=""></option>${crops.map((c, i) => opt(CROPS.it[i], c, p.coltura)).join("")}</select></label>
        <label>${tt("f_var")}<input name="varieta" value="${esc(p.varieta)}"></label>
        <label>${tt("f_year")}<input name="anno_impianto" type="number" min="1900" max="2030" value="${esc(p.anno_impianto)}"></label>
        <label>${tt("f_rows")}<input name="filari" type="number" min="0" value="${esc(p.filari)}"></label>
        <label>${tt("f_trees")}<input name="piante" type="number" min="0" value="${esc(p.piante)}"></label>
        <label>${tt("f_dr")}<input name="dist_filari_m" type="number" step="0.1" min="0" value="${esc(p.dist_filari_m)}"></label>
        <label>${tt("f_dp")}<input name="dist_fila_m" type="number" step="0.1" min="0" value="${esc(p.dist_fila_m)}"></label>
        <label>${tt("f_irr")}<select name="irrigazione">${tt("irr").map((x, i) => opt(TT.it.irr[i], x, p.irrigazione)).join("")}</select></label>
        <label>${tt("f_sow")}<input name="semina" type="date" value="${esc(p.semina)}"></label>
        <label>${tt("f_harv")}<input name="raccolta" type="date" value="${esc(p.raccolta)}"></label>
        <label>${tt("f_yield")}<input name="resa_t_ha" type="number" step="0.01" min="0" value="${esc(p.resa_t_ha)}"></label>
        <label>${tt("f_yyear")}<input name="anno_resa" type="number" min="2000" max="2030" value="${esc(p.anno_resa)}"></label>
        <label>${tt("f_n")}<input name="azoto_kg_ha" type="number" min="0" value="${esc(p.azoto_kg_ha)}"></label>
        <label>${tt("f_water")}<input name="irrigazione_mm" type="number" min="0" value="${esc(p.irrigazione_mm)}"></label>
        <label class="chk"><input name="biologico" type="checkbox" ${p.biologico ? "checked" : ""}> ${tt("f_bio")}</label>
        ${loggedIn() ? `<label class="chk wide"><input name="condividi" type="checkbox" ${p.condividi ? "checked" : ""}> ${Account.at("share")}</label>` : ""}
        <label class="wide">${tt("f_note")}<textarea name="note" rows="2">${esc(p.note)}</textarea></label>
      </form>
      <p class="hint small" id="tfDensity"></p>
      <div class="tc-actions">
        <button class="btn-primary" id="tfAnalyze">${tt("analyze")}</button>
        <button class="small-btn" id="tfSave">${tt("save")}</button>
        <button class="small-btn" id="tfGeo">${tt("geojson")}</button>
        <button class="small-btn" id="tfShare">${tt("share")}</button>
      </div>
      <p class="hint small">${tt("share_info")}</p><p class="hint small" id="tfMsg"></p>`, "tc-field");
    const form = el.querySelector("#tfForm");
    // proprietà del campo lette dal modulo: i campi numerici diventano numeri, quelli vuoti vengono tolti
    const read = () => {
      const o = { ...feature.properties };
      new FormData(form).forEach((v, k) => {
        if (v === "") delete o[k];
        else o[k] = isNaN(+v) || /semina|raccolta|nome|varieta|note|coltura|irrigazione/.test(k) ? v : +v;
      });
      o.biologico = form.biologico.checked;
      if (form.condividi) o.condividi = form.condividi.checked;
      o.superficie_ha = +ha.toFixed(4);
      if (o.dist_filari_m && o.dist_fila_m) o.densita_piante_ha = Math.round(10000 / (o.dist_filari_m * o.dist_fila_m));
      else if (o.piante) o.densita_piante_ha = Math.round(o.piante / ha);
      return o;
    };
    const showDensity = () => {
      const o = read();
      document.getElementById("tfDensity").textContent = o.densita_piante_ha ? tt("f_density", { d: o.densita_piante_ha }) : "";
    };
    form.oninput = showDensity;
    showDensity();
    const feat = () => ({ type: "Feature", properties: read(), geometry: feature.geometry });
    const msg = (text) => (el.querySelector("#tfMsg").textContent = text);
    el.querySelector("#tfAnalyze").onclick = () => Live.analyze(feat(), { userField: true });
    el.querySelector("#tfSave").onclick = () => {
      const f = feat();
      f.properties.id = f.properties.id || "c" + Date.now();
      feature.properties.id = f.properties.id;
      if (loggedIn()) {
        Account.save(f).then((id) => {
          f.properties.id = feature.properties.id = id;
          cloud = (cloud || []).filter((x) => x.properties.id !== id).concat([f]);
          msg(Account.at("sync"));
          refreshMine();
        }).catch((e) => msg(e.message));
        return;
      }
      const all = loadMine().filter((x) => x.properties.id !== f.properties.id);
      all.push(f);
      saveMine(all);
      msg(tt("saved"));
      refreshMine();
    };
    el.querySelector("#tfGeo").onclick = () => download(`campo_${(read().nome || "campi-aperti").replace(/\W+/g, "_")}.geojson`, JSON.stringify(feat()));
    el.querySelector("#tfShare").onclick = () => share(feat());
    Live.analyze(feat(), { userField: true });
  }
  function share(f) {
    const g = JSON.parse(JSON.stringify(f));
    delete g.properties.nome;                         // niente dati personali nel dataset pubblico
    const body = "Contributo inviato dal sito Columella. Licenza: CC BY 4.0.\n\n```json\n" + JSON.stringify(g) + "\n```\n";
    const title = `[contributo] ${g.properties.coltura || "campo"} ${g.properties.superficie_ha || ""} ha`;
    const issueUrl = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}`;
    const url = `${issueUrl}&body=${encodeURIComponent(body)}`;
    if (url.length > 7500) { // URL troppo lungo per GitHub: scarico il file da allegare a mano
      download("contributo_campo.geojson", JSON.stringify(g));
      alert(tt("too_long"));
      window.open(issueUrl, "_blank", "noopener");
      return;
    }
    window.open(url, "_blank", "noopener");
  }
  let mineLayer = null;
  function refreshMine() {
    const all = loadMine();
    if (mineLayer) map.removeLayer(mineLayer);
    mineLayer = L.geoJSON({ type: "FeatureCollection", features: all }, {
      style: { color: "#e8b84a", weight: 2, dashArray: "5 3", fillOpacity: 0.05 },
      onEachFeature: (f, l) => l.bindTooltip(esc(f.properties.nome || f.properties.coltura || "")),
    }).addTo(map);
    mineLayer.on("click", (e) => { L.DomEvent.stop(e); fieldForm(e.layer.feature); });
  }
  function showMine() {
    const all = loadMine();
    const el = card("toolMine", tt("mine"), all.length ? `<ul class="mine-list">${all.map((f, i) =>
      `<li><b>${esc(f.properties.nome || f.properties.coltura || "—")}</b> <small>${esc(f.properties.superficie_ha ?? "")} ha</small>
        <button class="small-btn" data-o="${i}">${tt("open")}</button><button class="small-btn" data-d="${i}">${tt("del")}</button></li>`).join("")}</ul>
        <button class="small-btn" id="mineAll">${tt("export_all")}</button>` : `<p class="hint">${tt("mine_empty")}</p>`);
    el.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => {
      const f = all[+b.dataset.o];
      map.fitBounds(L.geoJSON(f).getBounds(), { maxZoom: 17 });
      fieldForm(f);
    }));
    el.querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => {
      const [f] = all.splice(+b.dataset.d, 1);
      if (loggedIn()) {
        try { await Account.remove(f.properties.id); } catch (e) { alert(e.message || e); return; }
      } else saveMine(all);
      refreshMine();
      showMine();
    }));
    const exportAll = el.querySelector("#mineAll");
    if (exportAll) exportAll.onclick = () => download("miei_campi.geojson", JSON.stringify({ type: "FeatureCollection", features: all }));
  }

  // ================================================================== ▭ campi di un'area
  async function areaFields(b) {
    const w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
    const wM = (e - w) * 111320 * Math.cos(((s + n) / 2) * Math.PI / 180), hM = (n - s) * 110540;
    const el = card("toolArea", tt("r_title"), `<p class="hint" id="raMsg"></p>`);
    const msg = (text) => (el.querySelector("#raMsg").textContent = text);
    if (wM > 6100 || hM > 6100) { msg(tt("r_big")); return; }  // 6 × 6 km più un piccolo margine
    try { await Segment.smart([w, s, e, n], Live.periodRange().end, (k, t) => msg(tt("r_seg", { n: k, t }))); }
    catch (err) { msg(tt("r_fail")); return; }
    const fc = Segment.allFields();
    if (!fc || !fc.features.length) { msg(tt("r_fail")); return; }
    const nomi = Live.CTY_NOMI();
    // coltura Copernicus 2024 di ogni campo, 4 richieste alla volta
    let k = 0;
    const queue = fc.features.slice();
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const f = queue.shift();
        f.properties.superficie_ha = +areaHa(f.geometry).toFixed(3);
        const c = await Live.cropOfField(f, 2024);
        if (c) { f.properties.coltura_copernicus_2024 = (nomi[c.cls] || [c.cls])[0]; f.properties.quota_coltura = +c.share.toFixed(2); }
        msg(tt("r_crop", { n: ++k, t: fc.features.length }));
      }
    }));
    const tot = fc.features.reduce((a, f) => a + f.properties.superficie_ha, 0);
    const out = { type: "FeatureCollection", features: fc.features, metadata: { fonte: "Columella — https://francescorossi3.github.io/columella/", licenza: "CC BY-NC 4.0", date_ndvi: fc.dates } };
    el.querySelector(".tc-body").innerHTML = `<p>${tt("r_done", { n: fc.features.length, a: tot.toFixed(1) })}</p>
      <div class="tc-actions"><button class="btn-primary" id="raGeo">${tt("geojson")}</button><button class="small-btn" id="raKml">${tt("kml")}</button>
      <button class="small-btn" id="raCsv">${tt("csv")}</button></div><p class="hint small">${tt("r_note")}</p>`;
    const stamp = new Date().toISOString().slice(0, 10);
    el.querySelector("#raGeo").onclick = () => download(`campi_${stamp}.geojson`, JSON.stringify(out));
    el.querySelector("#raKml").onclick = () => download(`campi_${stamp}.kml`, toKml(out), "application/vnd.google-earth.kml+xml");
    el.querySelector("#raCsv").onclick = () => download(`campi_${stamp}.csv`, toCsv(out), "text/csv");
  }
  function toKml(fc) {
    const ring = (r) => `<LinearRing><coordinates>${r.map((p) => p.join(",")).join(" ")}</coordinates></LinearRing>`;
    const pm = fc.features.map((f) => {
      const g = f.geometry.coordinates;
      const data = Object.entries(f.properties).map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`).join("");
      return `<Placemark><name>${esc(f.properties.id)}</name><ExtendedData>${data}</ExtendedData><Polygon><outerBoundaryIs>${ring(g[0])}</outerBoundaryIs>` +
        g.slice(1).map((h) => `<innerBoundaryIs>${ring(h)}</innerBoundaryIs>`).join("") + `</Polygon></Placemark>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Columella</name>${pm}</Document></kml>`;
  }
  function toCsv(fc) {
    const keys = [...new Set(fc.features.flatMap((f) => Object.keys(f.properties)))];
    const lines = [keys.concat(["lon_centro", "lat_centro"]).join(";")];
    fc.features.forEach((f) => {
      const c = L.geoJSON(f).getBounds().getCenter();
      lines.push(keys.map((k) => f.properties[k] ?? "").concat([c.lng.toFixed(6), c.lat.toFixed(6)]).join(";"));
    });
    return lines.join("\n");
  }

  // ================================================================== 📂 mappe dell'utente
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const userMaps = [];
  let legendCtl = null, hoverCtl = null;

  async function crsDef(code) {
    const c = +code;
    if (!c || c === 4326 || c === 4258 || c === 6706) return "EPSG:4326";
    if (c === 3857 || c === 900913) return "EPSG:3857";
    const key = "EPSG:" + c;
    if (proj4.defs(key)) return key;
    const utm = (z, south, ellps = "WGS84") => `+proj=utm +zone=${z} ${south ? "+south " : ""}+ellps=${ellps} +units=m +no_defs`;
    if (c > 32600 && c < 32661) proj4.defs(key, utm(c - 32600));
    else if (c > 32700 && c < 32761) proj4.defs(key, utm(c - 32700, true));
    else if (c > 25800 && c < 25861) proj4.defs(key, utm(c - 25800, false, "GRS80"));
    else if (c === 6707 || c === 7791) proj4.defs(key, utm(32, false, "GRS80"));
    else if (c === 6708 || c === 7792) proj4.defs(key, utm(33, false, "GRS80"));
    else if (c === 3003) proj4.defs(key, "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs");
    else if (c === 3004) proj4.defs(key, "+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9996 +x_0=2520000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs");
    else {
      try { const r = await fetch(`https://epsg.io/${c}.proj4`); if (r.ok) proj4.defs(key, (await r.text()).trim()); } catch (e) { /* sotto */ }
      if (!proj4.defs(key)) {
        const s = prompt(tt("u_crs", { c }));
        if (!s) throw new Error("EPSG " + c);
        if (/^\d+$/.test(s.trim())) return crsDef(+s.trim());
        proj4.defs(key, s.trim());
      }
    }
    return key;
  }

  async function loadFile(file) {
    const name = file.name, low = name.toLowerCase();
    const panelEl = card("toolMaps", tt("u_title"), `<p class="hint">${tt("u_reading", { f: esc(name) })}</p>`);
    try {
      if (/\.(h5|he5|hdf|hdf5|nc)$/.test(low)) throw new Error(tt("u_hdf"));
      if (/\.(geo)?json$/.test(low)) addVector(name, JSON.parse(await file.text()));
      else if (/\.kml$/.test(low)) addVector(name, kmlToGeoJSON(await file.text()));
      else await addRaster(name, file);
    } catch (e) {
      panelEl.querySelector(".tc-body").innerHTML = `<p class="hint">${tt("u_err", { e: esc(e.message || e) })}</p>`;
      return;
    }
    renderMaps();
  }
  function kmlToGeoJSON(txt) {
    const doc = new DOMParser().parseFromString(txt, "text/xml"), feats = [];
    const coords = (el) => el.textContent.trim().split(/\s+/).map((c) => c.split(",").slice(0, 2).map(Number));
    doc.querySelectorAll("Placemark").forEach((pm) => {
      const props = { nome: pm.querySelector("name")?.textContent };
      pm.querySelectorAll("Data").forEach((d) => (props[d.getAttribute("name")] = d.querySelector("value")?.textContent));
      pm.querySelectorAll("Polygon").forEach((pg) => {
        const rings = [...pg.querySelectorAll("LinearRing coordinates")].map(coords);
        feats.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: rings } });
      });
      pm.querySelectorAll("LineString coordinates").forEach((c) => feats.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: coords(c) } }));
      pm.querySelectorAll("Point coordinates").forEach((c) => feats.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: coords(c)[0] } }));
    });
    return { type: "FeatureCollection", features: feats };
  }
  function addVector(name, gj) {
    const layer = L.geoJSON(gj, {
      style: { color: "#d0572b", weight: 2, fillOpacity: 0.08 },
      onEachFeature: (f, l) => l.bindPopup(`<table class="mini">${Object.entries(f.properties || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>` +
        (f.geometry && /Polygon/.test(f.geometry.type) ? `<button class="small-btn tf-an">${tt("analyze")}</button>` : "")),
    }).addTo(map);
    layer.on("popupopen", (e) => { const b = e.popup.getElement().querySelector(".tf-an"); if (b) b.onclick = () => { map.closePopup(); fieldForm(e.layer.feature); }; });
    map.fitBounds(layer.getBounds(), { maxZoom: 17 });
    userMaps.push({ name, kind: "vector", layer });
  }

  async function addRaster(name, file) {
    const tiff = await GeoTIFF.fromBlob(file);
    const img = await tiff.getImage();
    const W0 = img.getWidth(), H0 = img.getHeight(), nb = img.getSamplesPerPixel();
    const gk = img.getGeoKeys() || {};
    const code = gk.ProjectedCSTypeGeoKey || gk.GeographicTypeGeoKey || 4326;
    const crs = await crsDef(code);
    const [ox, oy] = img.getOrigin(), [rx, ry] = img.getResolution();
    const nd = img.getGDALNoData();
    // lettura ridotta (al massimo 1600 px sul lato lungo)
    const sc = Math.min(1, 1600 / Math.max(W0, H0)), W = Math.max(1, Math.round(W0 * sc)), H = Math.max(1, Math.round(H0 * sc));
    const sx = (rx * W0) / W, sy = (ry * H0) / H;
    // contorno in gradi e griglia di uscita in Web Mercator
    const toLL = (x, y) => (crs === "EPSG:4326" ? [x, y] : proj4(crs, "EPSG:4326", [x, y]));
    const edge = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20;
      edge.push(toLL(ox + t * W0 * rx, oy), toLL(ox + t * W0 * rx, oy + H0 * ry), toLL(ox, oy + t * H0 * ry), toLL(ox + W0 * rx, oy + t * H0 * ry)); }
    const lons = edge.map((p) => p[0]), lats = edge.map((p) => p[1]);
    const b = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    const merc = (lo, la) => [lo * 20037508.34 / 180, Math.log(Math.tan((90 + la) * Math.PI / 360)) * 6378137];
    const [MX0, MY0] = merc(b[0], b[1]), [MX1, MY1] = merc(b[2], b[3]);
    const OW = Math.min(2000, Math.round(W * 1.15)), OH = Math.max(1, Math.round(OW * (MY1 - MY0) / (MX1 - MX0)));
    // corrispondenza pixel di uscita -> pixel sorgente, calcolata su una griglia ogni 8 px e interpolata
    const G = 8, gw = Math.ceil(OW / G) + 1, gh = Math.ceil(OH / G) + 1, gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const mx = MX0 + ((i * G) / OW) * (MX1 - MX0), my = MY1 - ((j * G) / OH) * (MY1 - MY0);
      const lo = (mx / 20037508.34) * 180, la = (360 / Math.PI) * Math.atan(Math.exp(my / 6378137)) - 90;
      const [x, y] = crs === "EPSG:4326" ? [lo, la] : proj4("EPSG:4326", crs, [lo, la]);
      gx[j * gw + i] = (x - ox) / sx; gy[j * gw + i] = (y - oy) / sy;
    }
    const idx = new Int32Array(OW * OH);
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
      const fi = x / G, fj = y / G, i0 = Math.min(gw - 2, Math.floor(fi)), j0 = Math.min(gh - 2, Math.floor(fj)), u = fi - i0, v = fj - j0;
      const at = (a) => (a[j0 * gw + i0] * (1 - u) + a[j0 * gw + i0 + 1] * u) * (1 - v) + (a[(j0 + 1) * gw + i0] * (1 - u) + a[(j0 + 1) * gw + i0 + 1] * u) * v;
      const c = Math.floor(at(gx)), r = Math.floor(at(gy));
      idx[y * OW + x] = c >= 0 && r >= 0 && c < W && r < H ? r * W + c : -1;
    }
    const m = { name, kind: "raster", img, nb, W, H, OW, OH, idx, nd, bounds: [[b[1], b[0]], [b[3], b[2]]], bands: {}, crs: "EPSG:" + code,
      cfg: { mode: "single", band: 0, rgb: [Math.min(2, nb - 1), Math.min(1, nb - 1), 0], cmap: nb === 1 ? "viridis" : "rdylgn", auto: true, min: 0, max: 1, op: 0.85,
        title: name.replace(/\.\w+$/, ""), unit: "", classes: "", nodata: nd ?? "" } };
    if (nb >= 3 && nb <= 4) m.cfg.mode = "rgb";
    if (nb > 50) { m.cfg.rgb = [Math.round(nb * 0.28), Math.round(nb * 0.18), Math.round(nb * 0.1)]; }   // iperspettrale: ~650/550/470 nm circa
    userMaps.push(m);
    await drawRaster(m);
    map.fitBounds(m.bounds);
  }
  async function band(m, k) {
    if (!m.bands[k]) m.bands[k] = (await m.img.readRasters({ samples: [k], width: m.W, height: m.H, resampleMethod: "nearest" }))[0];
    return m.bands[k];
  }
  // percentili p (es. [0.02, 0.98]) dei pixel visibili, campionando 1 pixel di uscita ogni 7
  const pct = (arr, idx, nd, p) => {
    const v = [];
    for (let i = 0; i < idx.length; i += 7) {
      const k = idx[i];
      if (k < 0) continue;
      const x = arr[k];
      if (isFinite(x) && x !== nd) v.push(x);
    }
    v.sort((a, b) => a - b);
    return v.length ? p.map((q) => v[Math.floor(q * (v.length - 1))]) : [0, 1];
  };
  function parseClasses(txt) {
    return txt.split("\n").map((l) => l.split("=").map((s) => s.trim())).filter((p) => p.length >= 2 && p[1]).map(([v, c, lab]) => {
      const mm = v.match(/^(-?[\d.]+)\s*[-–:]\s*(-?[\d.]+)$/);
      return { a: mm ? +mm[1] : +v, b: mm ? +mm[2] : +v, c: /^#/.test(c) ? c : "#" + c, lab: lab || v };
    }).filter((k) => isFinite(k.a));
  }
  async function drawRaster(m) {
    const c = m.cfg, nd = c.nodata === "" ? null : +c.nodata, n = m.OW * m.OH;
    const out = new ImageData(m.OW, m.OH);
    if (c.mode === "rgb") {
      const bs = await Promise.all(c.rgb.map((k) => band(m, k)));
      const rng = bs.map((a) => pct(a, m.idx, nd, [0.02, 0.98]));
      for (let i = 0; i < n; i++) {
        const k = m.idx[i];
        if (k < 0) continue;
        if (bs.some((a) => a[k] === nd || !isFinite(a[k]))) continue;
        const rgb = [0, 1, 2].map((j) => Math.max(0, Math.min(255, ((bs[j][k] - rng[j][0]) / (rng[j][1] - rng[j][0] || 1)) * 255)));
        out.data.set(rgb.concat(255), i * 4);
      }
      m.legend = null;
    } else {
      const a = await band(m, c.band);
      if (c.auto) [c.min, c.max] = pct(a, m.idx, nd, [0.02, 0.98]);
      const cls = c.cmap === "classes" ? parseClasses(c.classes) : null;
      const colors = COLORMAPS[c.cmap] || COLORMAPS.viridis;   // scale colori comuni (croplayer.js)
      const ramp = colors.map(hex);
      for (let i = 0; i < n; i++) {
        const k = m.idx[i];
        if (k < 0) continue;
        const v = a[k];
        if (!isFinite(v) || v === nd) continue;
        let col;
        if (cls) {
          const hit = cls.find((q) => v >= q.a && v <= q.b);
          if (!hit) continue;
          col = hex(hit.c);
        } else { // interpolazione lineare tra i colori della scala
          const u = Math.max(0, Math.min(1, (v - c.min) / (c.max - c.min || 1))) * (ramp.length - 1);
          const j = Math.min(ramp.length - 2, Math.floor(u)), f = u - j;
          col = ramp[j].map((x, q) => x + f * (ramp[j + 1][q] - x));
        }
        out.data.set([col[0], col[1], col[2], 255], i * 4);
      }
      m.legend = cls ? { classes: cls } : { ramp: colors, min: c.min, max: c.max };
    }
    const cv = document.createElement("canvas");
    cv.width = m.OW;
    cv.height = m.OH;
    cv.getContext("2d").putImageData(out, 0, 0);
    if (m.layer) map.removeLayer(m.layer);
    m.layer = L.imageOverlay(cv.toDataURL(), m.bounds, { opacity: c.op, className: "seg-overlay", interactive: false, zIndex: 460 }).addTo(map);
    drawLegend();
  }
  function drawLegend() {
    if (!legendCtl) {
      legendCtl = L.control({ position: "bottomleft" });
      legendCtl.onAdd = () => L.DomUtil.create("div", "user-legend");
      legendCtl.addTo(map);
    }
    const box = legendCtl.getContainer();
    const fmt = (x) => {
      if (Math.abs(x) >= 100) return x.toFixed(0);
      if (Math.abs(x) >= 1) return x.toFixed(2);
      return x.toPrecision(3);
    };
    box.innerHTML = userMaps.filter((m) => m.kind === "raster" && m.legend).map((m) => `<div class="ul-item"><b>${esc(m.cfg.title)}</b>${m.cfg.unit ? ` <small>(${esc(m.cfg.unit)})</small>` : ""}<br>` +
      (m.legend.classes ? m.legend.classes.map((k) => `<span class="ul-cls"><i style="background:${esc(k.c)}"></i>${esc(k.lab)}</span>`).join("")
        : `<span class="ul-bar" style="background:linear-gradient(90deg,${m.legend.ramp.join(",")})"></span><span class="ul-lim"><span>${fmt(m.legend.min)}</span><span>${fmt(m.legend.max)}</span></span>`) + `</div>`).join("");
    box.hidden = !box.innerHTML;
  }
  function renderMaps() {
    const el = card("toolMaps", tt("u_title"), `
      <p class="hint small">${tt("u_hint")}</p>
      <label class="file-drop"><input type="file" id="umFile" accept=".tif,.tiff,.geotiff,.json,.geojson,.kml" multiple> 📂 ${tt("upload")}</label>
      <div id="umList">${userMaps.map((m, i) => m.kind === "vector" ? `<div class="um"><b>${esc(m.name)}</b> <button class="small-btn" data-z="${i}">${tt("u_zoom")}</button> <button class="small-btn" data-x="${i}">${tt("u_remove")}</button></div>` : `
        <div class="um" data-i="${i}"><b>${esc(m.name)}</b> <small>${m.W}×${m.H} px · ${m.nb} ${LANG === "it" ? "bande" : "bands"} · ${esc(m.crs)}</small>
          <div class="um-grid">
            ${m.nb >= 3 ? `<label><input type="radio" name="md${i}" value="rgb" ${m.cfg.mode === "rgb" ? "checked" : ""}> ${tt("u_rgb")}
              ${[0, 1, 2].map((j) => `<input type="number" class="um-rgb" data-j="${j}" min="1" max="${m.nb}" value="${m.cfg.rgb[j] + 1}">`).join("")}</label>
              <label><input type="radio" name="md${i}" value="single" ${m.cfg.mode === "single" ? "checked" : ""}> ${tt("u_band")}</label>` : ""}
            <label>${tt("u_band")} <input type="number" class="um-band" min="1" max="${m.nb}" value="${m.cfg.band + 1}"></label>
            <label>${tt("u_cmap")} <select class="um-cmap">${[...Object.keys(COLORMAPS), "classes"].map((k) => `<option value="${k}" ${k === m.cfg.cmap ? "selected" : ""}>${tt("cm")[k] || k}</option>`).join("")}</select></label>
            <label><input type="checkbox" class="um-auto" ${m.cfg.auto ? "checked" : ""}> ${tt("u_auto")}</label>
            <label>${tt("u_min")} <input type="number" step="any" class="um-min" value="${+m.cfg.min.toPrecision(4)}"></label>
            <label>${tt("u_max")} <input type="number" step="any" class="um-max" value="${+m.cfg.max.toPrecision(4)}"></label>
            <label>${tt("u_nodata")} <input type="number" step="any" class="um-nd" value="${esc(m.cfg.nodata)}"></label>
            <label>${tt("u_op")} <input type="range" min="0" max="1" step="0.05" class="um-op" value="${m.cfg.op}"></label>
            <label>${tt("u_name")} <input class="um-title" value="${esc(m.cfg.title)}"></label>
            <label>${tt("u_unit")} <input class="um-unit" value="${esc(m.cfg.unit)}"></label>
            <label class="wide" ${m.cfg.cmap === "classes" ? "" : "hidden"}>${tt("u_classes")}<textarea class="um-cls" rows="4" placeholder="0-0.3 = #d73027 = basso&#10;0.3-0.6 = #fee08b = medio&#10;0.6-1 = #1a9850 = alto">${esc(m.cfg.classes)}</textarea></label>
          </div>
          <button class="small-btn" data-z="${i}">${tt("u_zoom")}</button> <button class="small-btn" data-x="${i}">${tt("u_remove")}</button>
        </div>`).join("")}</div>`);
    el.querySelector("#umFile").onchange = (e) => [...e.target.files].forEach(loadFile);
    el.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => { const m = userMaps[+b.dataset.z]; map.fitBounds(m.kind === "vector" ? m.layer.getBounds() : m.bounds); }));
    el.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { const m = userMaps.splice(+b.dataset.x, 1)[0]; map.removeLayer(m.layer); drawLegend(); renderMaps(); }));
    el.querySelectorAll(".um[data-i]").forEach((box) => {
      const m = userMaps[+box.dataset.i], c = m.cfg, q = (s) => box.querySelector(s);
      const apply = async (full) => {
        const r = box.querySelector(`input[name=md${box.dataset.i}]:checked`); if (r) c.mode = r.value;
        c.rgb = [...box.querySelectorAll(".um-rgb")].map((x) => Math.max(0, Math.min(m.nb - 1, +x.value - 1)));
        c.band = Math.max(0, Math.min(m.nb - 1, +q(".um-band").value - 1)); c.cmap = q(".um-cmap").value; c.auto = q(".um-auto").checked;
        c.min = +q(".um-min").value; c.max = +q(".um-max").value; c.nodata = q(".um-nd").value; c.op = +q(".um-op").value;
        c.title = q(".um-title").value; c.unit = q(".um-unit").value; c.classes = q(".um-cls").value;
        if (!full) { m.layer.setOpacity(c.op); drawLegend(); return; }
        await drawRaster(m);
        if (c.auto) { q(".um-min").value = +c.min.toPrecision(4); q(".um-max").value = +c.max.toPrecision(4); }
        q(".um-cls").parentElement.hidden = c.cmap !== "classes";
      };
      box.querySelectorAll("input,select,textarea").forEach((inp) => {
        const light = inp.classList.contains("um-op") || inp.classList.contains("um-title") || inp.classList.contains("um-unit");
        inp.addEventListener(light ? "input" : "change", () => {
          if (inp.classList.contains("um-min") || inp.classList.contains("um-max")) q(".um-auto").checked = false;
          const rs = box.querySelector(`input[name=md${box.dataset.i}][value=single]`);
          if (rs && /um-(band|cmap|min|max|auto|cls)/.test(inp.className)) rs.checked = true;
          const rr = box.querySelector(`input[name=md${box.dataset.i}][value=rgb]`);
          if (rr && inp.classList.contains("um-rgb")) rr.checked = true;
          apply(!light);
        });
      });
    });
  }
  // valore della mappa caricata sotto il mouse
  function onHover(e) {
    const ms = userMaps.filter((m) => m.kind === "raster");
    if (!ms.length) { if (hoverCtl) hoverCtl.getContainer().hidden = true; return; }
    if (!hoverCtl) {
      hoverCtl = L.control({ position: "bottomright" });
      hoverCtl.onAdd = () => L.DomUtil.create("div", "user-hover");
      hoverCtl.addTo(map);
    }
    const txt = ms.map((m) => {
      const [[s, w], [n, east]] = m.bounds;
      if (e.latlng.lat < s || e.latlng.lat > n || e.latlng.lng < w || e.latlng.lng > east) return null;
      // pixel dell'immagine di uscita (griglia Web Mercator)
      const merc = (la) => Math.log(Math.tan((90 + la) * Math.PI / 360));
      const x = Math.floor(((e.latlng.lng - w) / (east - w)) * m.OW), y = Math.floor(((merc(n) - merc(e.latlng.lat)) / (merc(n) - merc(s))) * m.OH);
      const k = m.idx[y * m.OW + x];
      if (k == null || k < 0) return null;
      const bnd = m.cfg.mode === "rgb" ? null : m.bands[m.cfg.band];
      if (!bnd) return null;
      const v = bnd[k];
      return `${esc(m.cfg.title)}: <b>${(+v).toPrecision(4)}</b> ${esc(m.cfg.unit)}`;
    }).filter(Boolean);
    hoverCtl.getContainer().innerHTML = txt.join("<br>");
    hoverCtl.getContainer().hidden = !txt.length;
  }

  // ================================================================== 🏡 prato di casa
  async function lawn(feature) {
    const m2 = areaHa(feature.geometry) * 10000;
    const c = L.geoJSON(feature).getBounds().getCenter();
    let tipo = "cool";
    const el = card("toolLawn", "🏡 " + tt("l_title"), `
      <label>${tt("l_type")}<select id="lwType"><option value="cool">${tt("l_cool")}</option><option value="warm">${tt("l_warm")}</option></select></label>
      <div id="lwOut"><p class="hint">${tt("l_loading")}</p></div>
      <button class="small-btn" id="lwSat">${tt("l_sat")}</button>
      <p class="hint small">${tt("l_src")}</p>`, "tc-lawn");
    L.geoJSON(feature, { style: { color: "#3aa655", weight: 2, fillOpacity: 0.15 } }).addTo(map);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean&past_days=7&forecast_days=7&timezone=auto`;
    let d;
    try { d = (await fetch(url).then((r) => r.json())).daily; } catch (e) { el.querySelector("#lwOut").textContent = "—"; return; }
    const today = new Date().toISOString().slice(0, 10);
    const render = () => {
      const kc = tipo === "cool" ? 0.85 : 0.65;
      const days = d.time.map((_, i) => i);
      const past = days.filter((i) => d.time[i] < today), next = days.filter((i) => d.time[i] >= today);
      const sum = (ix, a) => ix.reduce((s, i) => s + (a[i] || 0), 0);
      // pioggia efficace: si contano solo i giorni con più di 2 mm, all'80%
      const eff = (ix) => ix.reduce((s, i) => s + ((d.precipitation_sum[i] || 0) > 2 ? 0.8 * d.precipitation_sum[i] : 0), 0);
      const cP = kc * sum(past, d.et0_fao_evapotranspiration), cN = kc * sum(next, d.et0_fao_evapotranspiration);
      const rP = sum(past, d.precipitation_sum), rN = sum(next, d.precipitation_sum);
      const next3 = next.slice(0, 3), r3 = eff(next3);
      const deficit = Math.max(0, cP - eff(past) - r3 * 0.7);
      // potenziale di crescita (Gelernter & Stowell): gaussiana della temperatura media attorno all'ottimo
      const Topt = tipo === "cool" ? 20 : 31, sd = tipo === "cool" ? 5.5 : 7;
      const tm = next.map((i) => d.temperature_2m_mean[i]), gp = tm.reduce((s, t) => s + Math.exp(-0.5 * ((t - Topt) / sd) ** 2), 0) / (tm.length || 1);
      const tmax = Math.max(...next.map((i) => d.temperature_2m_max[i])), tmin = Math.min(...next.map((i) => d.temperature_2m_min[i]));
      const mese = new Date().getMonth();
      let feed = tt("feed")[mese];
      if (tipo === "warm" && (mese === 5 || mese === 6)) feed = LANG === "it" ? "sì: azoto per le macroterme" : "yes: nitrogen for warm-season grass";
      const nIrr = deficit > 20 ? 2 : 1;
      let mowKey;
      if (gp < 0.25) mowKey = "l_mow0";
      else if (gp < 0.6) mowKey = "l_mow1";
      else mowKey = "l_mow2";
      el.querySelector("#lwOut").innerHTML = `
        <p>${tt("l_area", { a: Math.round(m2).toLocaleString(loc()) })}</p>
        <p>${tt("l_last7", { p: rP.toFixed(0), c: cP.toFixed(0) })}<br>${tt("l_next", { p: rN.toFixed(0), c: cN.toFixed(0) })}</p>
        <p class="lw-big">${deficit >= 4 ? tt("l_water", { mm: Math.round(deficit), l: Math.round(deficit * m2).toLocaleString(loc()), n: tt(nIrr > 1 ? "l_n2" : "l_n1") }) : tt("l_nowater")}</p>
        <p>${tt("l_grow", { g: Math.round(gp * 100) })} — ${tt(mowKey)}</p>
        ${tmax > 30 ? `<p>☀️ ${tt("l_heat")}</p>` : ""}${tmin < 0 ? `<p>❄️ ${tt("l_frost")}</p>` : ""}
        <p>${tt("l_feed", { f: feed })}</p>`;
    };
    el.querySelector("#lwType").onchange = (e) => { tipo = e.target.value; render(); };
    el.querySelector("#lwSat").onclick = () => Live.analyze(feature, { lawn: true });
    render();
  }

  // ================================================================== barra degli strumenti
  function init() {
    // pulsanti degli strumenti nella sezione "Ricerca e campi" della barra laterale
    const d = document.getElementById("toolBar");
    d.innerHTML = [["draw", "✏️"], ["rect", "⬚"], ["upload", "📂"], ["lawn", "🏡"], ["mine", "⭐"]]
      .map(([k, ic]) => `<button type="button" class="tool-btn" data-t="${k}"><span aria-hidden="true">${ic}</span><em>${tt(k)}</em></button>`).join("");
    d.querySelectorAll("button").forEach((a) => (a.onclick = () => {
      switch (a.dataset.t) {
        case "draw": startDraw("poly", (f) => fieldForm(f), "h_poly"); break;
        case "rect": startDraw("rect", (b) => areaFields(b), "h_rect"); break;
        case "lawn": startDraw("poly", (f) => lawn(f), "h_lawn"); break;
        case "upload": renderMaps(); break;
        case "mine": showMine(); break;
      }
    }));
    map.on("mousemove", onHover);
    welcome();
    refreshMine();
    if (typeof Account !== "undefined") Account.onChange(async (u) => {
      cloud = null;
      if (u) {
        cloud = await Account.list().catch(() => []);
        // i campi salvati prima nel browser passano nell'account
        let local = [];
        try { local = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { /* dati locali illeggibili */ }
        const rimasti = [];   // quelli non salvati restano nel browser
        for (const f of Array.isArray(local) ? local : []) {
          try {
            f.properties.id = await Account.save({ ...f, properties: { ...f.properties, id: null } });
            cloud.push(f);
          } catch (e) { rimasti.push(f); }
        }
        if (local.length) saveMine(rimasti);
      }
      refreshMine();
    });
    // trascina un file sulla mappa
    const mc = map.getContainer();
    mc.addEventListener("dragover", (e) => { e.preventDefault(); mc.classList.add("drop"); });
    mc.addEventListener("dragleave", () => mc.classList.remove("drop"));
    mc.addEventListener("drop", (e) => { e.preventDefault(); mc.classList.remove("drop"); [...e.dataTransfer.files].forEach(loadFile); });
  }
  const WELCOME_KEY = "campiAperti.benvenuto";   // chiave storica: non rinominare (gli utenti l'hanno già salvata)
  function welcome(force) {
    try { if (!force && localStorage.getItem(WELCOME_KEY)) return; } catch (e) { /* */ }
    const el = card("toolWelcome", tt("w_title"), `<ol class="welcome">${tt("w_steps").map((x) => `<li>${x}</li>`).join("")}</ol>
      <p class="hint small">${tt("w_note")}</p><div class="tc-actions"><button class="btn-primary" id="wGo">${tt("w_go")}</button></div>`, "tc-welcome");
    const done = () => {
      try { localStorage.setItem(WELCOME_KEY, "1"); } catch (e) { /* */ }
      el.remove();
    };
    el.querySelector("#wGo").onclick = done;
    el.querySelector(".icon-x").onclick = done;
  }
  function refreshLang() {
    document.querySelectorAll("#toolBar .tool-btn").forEach((a) => (a.querySelector("em").textContent = tt(a.dataset.t)));
  }
  return { init, busy, refreshLang, startDraw, welcome };
})();
