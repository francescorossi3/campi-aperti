// Columella — js/app.js (caricato per ultimo / loaded last)
// IT: logica principale della mappa: lingua, mappe di base, layer (ArcGIS EEA, WMS, catasto, Copernicus, suolo,
//     colture), stile e legende, URL condivisibile (#z/lat/lon/base/layer), pannello layer e catalogo,
//     clic sulla mappa, ricerca luoghi (comuni locali + Photon + Nominatim), tab e cambio lingua, avvio.
//     Sito statico: i dati arrivano direttamente dai servizi pubblici (EEA, Agenzia delle Entrate, OSM).
// EN: main map logic: language, basemaps, layers, styles/legends, shareable URL hash, layer panel, catalogue,
//     map click, place search, tabs/language switch, start-up.
//
// Globali usati da altri file / globals used elsewhere: LANG, t(), map, openSection(), escapeHtml().
// Dipende da / depends on: Leaflet (L), i18n.js (I18N, CATALOG_EXTRA),
//   layers.js (LAYERS, LAYER_GROUPS, ARCHIVE_GROUPS, CATASTO_WMS), mapstyle.js (MapStyle), clip.js (Clip), croplayer.js (COLORMAPS, fieldValues,
//   Clms, Suolo, CropLayer), live.js (Live), regions.js (Regions), account.js (Account), tools.js (Tools),
//   data/comuni.json.

// ------------------------------------------------------------------ lingua / language
let LANG = (() => {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "it" || q === "en") return q;
  try { const s = localStorage.getItem("campi_lang"); if (s === "it" || s === "en") return s; } catch (e) {}
  return "en";                                   // lingua principale: inglese (italiano con il pulsante IT)
})();
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.it[k] || k;

// ------------------------------------------------------------------ mappa / map
const ITALY_BOUNDS = L.latLngBounds([35.0, 5.5], [47.5, 19.5]);
const map = L.map("map", {
  zoomControl: true, minZoom: 5, maxZoom: 19,
  maxBounds: ITALY_BOUNDS.pad(0.4),
}).fitBounds(ITALY_BOUNDS);
L.control.scale({ imperial: false }).addTo(map);
Clip.init(map);                                   // riquadro "rasters" ritagliato sul campo selezionato (clip.js)
// riquadro dedicato al catasto: il riempimento giallo delle particelle viene reso trasparente
// con un filtro + fusione "multiply", così restano solo i contorni sopra la mappa
map.createPane("labels");
map.getPane("labels").style.zIndex = 640;
map.getPane("labels").style.pointerEvents = "none";
map.createPane("catasto");
map.getPane("catasto").style.zIndex = 450;
map.getPane("catasto").classList.add("catasto-pane");

const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const BASEMAPS = {
  osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap contributors" }),
  sat: L.tileLayer(ESRI_IMAGERY, { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }),
  s2: L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg", {
    maxZoom: 17, maxNativeZoom: 15,
    attribution: 'Sentinel-2 cloudless 2023 by <a href="https://s2maps.eu">EOX</a> (Copernicus Sentinel data 2023), CC BY-NC-SA 4.0' }),
  hybrid: L.layerGroup([
    L.tileLayer(ESRI_IMAGERY, { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, pane: "labels", opacity: 0.8 }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, pane: "labels", attribution: "Etichette © Esri" }),
  ]),
  topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17, attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)" }),
  none: L.layerGroup([]),                       // mappa di base spenta
};
// mappa di base in scala di grigi (luminanza): filtro CSS sul riquadro delle mappe di base e delle etichette
let baseGray = false;
try { baseGray = localStorage.getItem("columella.baseGray") === "1"; } catch (e) { /* */ }
document.body.classList.toggle("bm-gray", baseGray);
let currentBase = "hybrid";

// --- base comune: tile layer che costruisce l'URL di ogni tassello dalla definizione del layer (def)
const DefTileLayer = L.TileLayer.extend({
  initialize(def, opts) { this.def = def; L.TileLayer.prototype.initialize.call(this, "", opts); },
});

// --- tile layer per ArcGIS (export / exportImage) in EPSG:3857
const ArcGISTiles = DefTileLayer.extend({
  getTileUrl(c) {
    const size = this.getTileSize();
    const nw = this._map.unproject(c.scaleBy(size), c.z);
    const se = this._map.unproject(c.scaleBy(size).add(size), c.z);
    const a = L.CRS.EPSG3857.project(nw), b = L.CRS.EPSG3857.project(se);
    const bbox = [a.x, b.y, b.x, a.y].map((v) => v.toFixed(2)).join(",");
    const common = `bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${size.x},${size.y}&transparent=true&f=image`;
    if (this.def.type === "arcgis-image") return `${this.def.url}/exportImage?${common}&format=png`;
    const show = this.def.showLayers ? `&layers=show:${this.def.showLayers}` : "";
    return `${this.def.url}/export?${common}&format=png32&dpi=96${show}`;
  },
});

// --- tile layer per il WMS catastale (accetta solo EPSG:6706/4258/UTM, non 3857):
//     chiediamo ogni tassello in EPSG:4258 (lon/lat). Alla scala del tassello la differenza
//     con Web Mercator è trascurabile.
const CatastoTiles = DefTileLayer.extend({
  getTileUrl(c) {
    const size = this.getTileSize();
    const nw = this._map.unproject(c.scaleBy(size), c.z);
    const se = this._map.unproject(c.scaleBy(size).add(size), c.z);
    const bbox = [nw.lng, se.lat, se.lng, nw.lat].map((v) => v.toFixed(7)).join(",");
    // Il server disegna le particelle solo a scala maggiore di ~1:5.000: chiedo più pixel
    // per tassello (fino a 512) e il browser li riduce a 256. Sotto lo zoom 16 le linee diventano invisibili.
    const widthM = 40075016 * Math.cos(((nw.lat + se.lat) / 2) * Math.PI / 180) / Math.pow(2, c.z);
    const scale256 = widthM / (size.x * 0.00028);
    const oversample = Math.min(2, Math.max(1, Math.pow(2, Math.ceil(Math.log2(scale256 / 3500)))));
    const px = this.def.hiRes ? size.x * oversample : size.x;
    return `${CATASTO_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${this.def.wmsLayers}&STYLES=` +
      `&SRS=EPSG:4258&BBOX=${bbox}&WIDTH=${px}&HEIGHT=${px}&FORMAT=image/png&TRANSPARENT=TRUE`;
  },
});

const leafletLayers = {};
let ctyYear = 2024, hvYear = 2024, clmsDate = null, clmsIdx = {};
// ---- stile dei livelli a valori continui (Copernicus, suolo, indici Sentinel-2): simbologia di mapstyle.js,
//      salvata nel browser per ogni livello; con un campo selezionato i limiti automatici usano i suoi valori
const fieldStats = {};             // id del livello -> statistiche dei valori dentro i campi selezionati
function styleBase(def) {
  if (def.type === "clms") { const st = Clms.style0(def.product); return MapStyle.create(st.cmap, st.min, st.max, st.unit); }
  if (def.type === "soil" && def.soil !== "tessitura") { const st = Suolo.style0(def.soil); return MapStyle.create(st.cmap, st.min, st.max, st.unit); }
  if (def.type === "s2live" && def.expr) {
    def._rescale0 = def._rescale0 || def.rescale; def._cmap0 = def._cmap0 || def.colormap;
    const [min, max] = def._rescale0.split(",").map(Number);
    return { ...MapStyle.create(def._cmap0.replace(/_r$/, ""), min, max), rev: /_r$/.test(def._cmap0), opacity: def.opacity ?? 1 };
  }
  return null;
}
const styleOf = (def) => { const b = styleBase(def); return b ? MapStyle.get(def.id, b) : null; };
const limitedStyle = (def) => def.type === "s2live";      // tasselli colorati dal server: niente classi né limiti automatici
// funzione colore per i livelli COG: fuori dai dati è trasparente, salvo il colore "nessun dato" dentro il campo
function cogColor(def, st) {
  const C = MapStyle.classify(st, fieldStats[def.id]);
  return (v) => (v == null || !Number.isFinite(v) || v <= -9000 ? (Clip.active() ? C.nodata : null) : C.color(v));
}
function applyStyle(def) {
  const layer = leafletLayers[def.id], st = styleOf(def);
  if (!layer || !st) return;
  layer.setOpacity(st.opacity);
  if (def.type === "s2live") {
    const [lo, hi] = MapStyle.limits(st, null);
    def.rescale = `${+lo.toPrecision(4)},${+hi.toPrecision(4)}`;
    def.colormap = st.cmap + (st.rev ? "_r" : "");
    Live.refreshLayer(def);
  } else layer.setColor(cogColor(def, st));
  renderLegendDock();
}
// pannello Style del livello (dentro la sua riga nella sezione Livelli)
function renderStyle(def, el) {
  const box = el.querySelector(".st-panel");
  if (!box) return;
  const st = styleOf(def);
  MapStyle.panel(box, {
    st, S: fieldStats[def.id] || null, limited: limitedStyle(def), title: def[LANG].name,
    onSave: (x) => MapStyle.save(def.id, x),
    onChange: () => applyStyle(def),
    onReset: () => { MapStyle.reset(def.id); applyStyle(def); renderStyle(def, el); },
  });
}
// URL del COG di un livello (per leggere i valori dentro il campo)
function cogUrl(def) {
  if (def.type === "clms") { const d = clmsPick(def.product); return d ? Clms.url(def.product, d) : null; }
  if (def.type === "soil" && def.soil !== "tessitura") return Suolo.url(def.soil);
  return null;
}
// statistiche dei campi selezionati (tutti i loro pixel insieme) per i livelli accesi con valori leggibili nel browser
async function updateFieldStats(def) {
  const fs = Clip.features(), url = cogUrl(def);
  if (!fs.length || !url) { delete fieldStats[def.id]; return; }
  const comb = def.type === "soil" ? Suolo.combine(def.soil) : null;
  const parts = await Promise.all(fs.map((f) => fieldValues(url, f, false, comb).catch(() => null)));
  if (Clip.features().length !== fs.length || Clip.features().some((f, i) => f !== fs[i])) return;
  fieldStats[def.id] = MapStyle.stats(parts.flatMap((v) => v || []));
  applyStyle(def);
  const el = document.querySelector(`.layer[data-id="${def.id}"]`);
  if (el && el.classList.contains("expanded")) renderStyle(def, el);
}
Clip.onChange(() => {
  Object.keys(fieldStats).forEach((k) => delete fieldStats[k]);
  [...state.on].forEach((id) => { const def = LAYERS.find((l) => l.id === id); if (def && styleBase(def)) { applyStyle(def); updateFieldStats(def); } });
  updateSummaries();
});
// legenda dei livelli accesi a valori continui, in basso a destra sulla mappa
let legendDock = null;
function renderLegendDock() {
  if (!legendDock) {
    legendDock = L.control({ position: "bottomright" });
    legendDock.onAdd = () => L.DomUtil.create("div", "legend-dock");
    legendDock.addTo(map);
  }
  const html = [...state.on].map((id) => LAYERS.find((l) => l.id === id)).filter((d) => d && styleBase(d)).map((d) => {
    const st = styleOf(d);
    return MapStyle.legend(d[LANG].name, st, MapStyle.classify(st, fieldStats[d.id]));
  }).join("");
  legendDock.getContainer().innerHTML = html;
  legendDock.getContainer().hidden = !html;
}
// data Copernicus più vicina (non successiva) a quella scelta, per ogni prodotto; senza scelta, la più recente
const clmsPick = (p) => {
  const dates = clmsIdx[p] || [];
  if (!dates.length) return null;
  if (!clmsDate) return dates[dates.length - 1];
  return dates.filter((d) => d <= clmsDate).pop() || dates[0];
};
const state = { on: new Set() };

// ---- finestra dei livelli sulla mappa (spostabile): livelli accesi dall'alto in basso, nascondi, sopra/sotto, togli
// l'ordine vale dentro lo stesso riquadro Leaflet (raster); il catasto resta sempre sopra ai raster
const layerOrder = [];                // id dei livelli accesi, il primo è quello più in alto
const hiddenLayers = new Set();
function applyOrder() {
  layerOrder.forEach((id, i) => { const l = leafletLayers[id]; if (l && l.setZIndex) l.setZIndex(100 + layerOrder.length - i); });
}
function setHidden(id, hide) {
  const l = leafletLayers[id], el = l && (l.getContainer ? l.getContainer() : l.getElement && l.getElement());
  if (hide) hiddenLayers.add(id); else hiddenLayers.delete(id);
  if (el) el.style.display = hide ? "none" : "";
}
function renderLayerWin() {
  const w = document.getElementById("layerWin");
  if (!w || w.hidden) return;
  const name = (id) => { const d = LAYERS.find((l) => l.id === id); return d ? d[LANG].name : id; };
  w.querySelector(".lw-body").innerHTML = layerOrder.length ? `<ol class="lw-list">${layerOrder.map((id, i) => `
    <li draggable="true" data-id="${id}" class="${hiddenLayers.has(id) ? "lw-hidden" : ""}">
      <span class="lw-grip" aria-hidden="true">⋮⋮</span>
      <label><input type="checkbox" data-a="vis" ${hiddenLayers.has(id) ? "" : "checked"} title="${t("lw_hide")}"> ${escapeHtml(name(id))}</label>
      <button type="button" data-a="up" title="${t("lw_up")}" aria-label="${t("lw_up")}"${i ? "" : " disabled"}>▲</button>
      <button type="button" data-a="down" title="${t("lw_down")}" aria-label="${t("lw_down")}"${i < layerOrder.length - 1 ? "" : " disabled"}>▼</button>
      <button type="button" data-a="off" title="${t("lw_off")}" aria-label="${t("lw_off")}">×</button></li>`).join("")}</ol>`
    : `<p class="hint small">${t("lw_empty")}</p>`;
  // campi selezionati: id e colore, mostra nel pannello, vai, togli; velo sul resto della mappa
  const fi = Live.fieldsInfo();
  w.querySelector(".lw-body").insertAdjacentHTML("beforeend", `<h4 class="lw-sub">${t("lw_fields")}</h4>` + (fi.length ? `<ol class="lw-list lw-fields">${fi.map((f) => `
    <li data-f="${f.id}"><i class="lw-dot" style="background:${Clip.colorOf(f.id)}"></i>
      <button type="button" class="lw-fid${f.active ? " active" : ""}" data-a="show">${f.id}</button><small>${f.ha.toFixed(2)} ha</small>
      <button type="button" data-a="zoom">${t("lw_zoom")}</button><button type="button" data-a="off" aria-label="${t("lw_off")}">×</button></li>`).join("")}</ol>
    <label class="chk lw-veil"><input type="checkbox" id="lwVeil" ${Clip.veil() ? "checked" : ""}> ${t("lw_veil")}</label>`
    : `<p class="hint small">${t("lw_nofields")}</p>`));
  w.querySelectorAll(".lw-fields li").forEach((li) => {
    const id = li.dataset.f;
    li.querySelector('[data-a="show"]').onclick = () => { Live.activate(id); openSection("series"); };
    li.querySelector('[data-a="zoom"]').onclick = () => Clip.zoomTo(id);
    li.querySelector('[data-a="off"]').onclick = () => Live.removeField(id);
  });
  const veil = w.querySelector("#lwVeil");
  if (veil) veil.onchange = (e) => Clip.setVeil(e.target.checked);
  const move = (id, to) => { const i = layerOrder.indexOf(id); layerOrder.splice(i, 1); layerOrder.splice(Math.max(0, Math.min(layerOrder.length, to)), 0, id); applyOrder(); renderLayerWin(); };
  w.querySelectorAll(".lw-list li[data-id]").forEach((li) => {
    const id = li.dataset.id;
    li.querySelector('[data-a="vis"]').onchange = (e) => { setHidden(id, !e.target.checked); renderLayerWin(); };
    li.querySelector('[data-a="up"]').onclick = () => move(id, layerOrder.indexOf(id) - 1);
    li.querySelector('[data-a="down"]').onclick = () => move(id, layerOrder.indexOf(id) + 1);
    li.querySelector('[data-a="off"]').onclick = () => setLayer(id, false);
    li.ondragstart = (e) => e.dataTransfer.setData("text/plain", id);
    li.ondragover = (e) => e.preventDefault();
    li.ondrop = (e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain"); if (from && from !== id) move(from, layerOrder.indexOf(id)); };
  });
}
function toggleLayerWin(show) {
  let w = document.getElementById("layerWin");
  if (!w) {
    w = document.createElement("section");
    w.id = "layerWin"; w.className = "layer-win"; w.hidden = true;
    w.innerHTML = `<header class="lw-head"><b>${t("lw_title")}</b><button type="button" class="icon-x" aria-label="×">×</button></header><div class="lw-body"></div>`;
    document.querySelector(".map-wrap").appendChild(w);
    L.DomEvent.disableClickPropagation(w); L.DomEvent.disableScrollPropagation(w);
    try { const p = JSON.parse(localStorage.getItem("columella.layerWin") || "null"); if (p) { w.style.left = p.x + "px"; w.style.top = p.y + "px"; } } catch (e) { /* */ }
    w.querySelector(".icon-x").onclick = () => toggleLayerWin(false);
    // trascinamento dalla barra del titolo
    const head = w.querySelector(".lw-head");
    head.onpointerdown = (e) => {
      if (e.target.closest("button")) return;
      const box = w.parentElement.getBoundingClientRect(), r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      head.setPointerCapture(e.pointerId);
      head.onpointermove = (ev) => {
        w.style.left = Math.max(0, Math.min(box.width - r.width, ev.clientX - box.left - dx)) + "px";
        w.style.top = Math.max(0, Math.min(box.height - 40, ev.clientY - box.top - dy)) + "px";
        w.style.right = "auto";
      };
      head.onpointerup = () => {
        head.onpointermove = head.onpointerup = null;
        try { localStorage.setItem("columella.layerWin", JSON.stringify({ x: parseInt(w.style.left), y: parseInt(w.style.top) })); } catch (err) { /* */ }
      };
    };
  }
  w.hidden = show === undefined ? !w.hidden : !show;
  w.querySelector(".lw-head b").textContent = t("lw_title");
  renderLayerWin();
}
const lwCtl = L.control({ position: "topright" });
lwCtl.onAdd = () => {
  const b = L.DomUtil.create("button", "lw-toggle leaflet-bar");
  b.type = "button"; b.textContent = "☰"; b.title = t("lw_title"); b.setAttribute("aria-label", t("lw_title"));
  L.DomEvent.disableClickPropagation(b);
  b.onclick = () => toggleLayerWin();
  return b;
};
lwCtl.addTo(map);
document.getElementById("openLayerWin").onclick = () => toggleLayerWin(true);

function makeLayer(def) {
  const pane = Clip.pane(), st = styleOf(def);
  if (def.type === "s2live") return Live.makeS2Layer(def);
  if (def.type === "clms") return Clms.layer(def.product, clmsPick(def.product), { pane, minZoom: def.minZoom, maxZoom: 19, opacity: st.opacity, zIndex: 25, color: cogColor(def, st) });
  if (def.type === "soil") return Suolo.layer(def.soil, { pane, minZoom: def.minZoom, maxZoom: 19, opacity: st ? st.opacity : def.opacity ?? 0.85, zIndex: 24, ...(st ? { color: cogColor(def, st) } : {}) });
  if (def.type === "cty") return new CropLayer.Layer(ctyYear, { pane, minZoom: def.minZoom, maxZoom: 19, opacity: def.opacity ?? 0.85, zIndex: 30 });
  const common = { pane, opacity: def.opacity ?? 0.7, zIndex: 10, crossOrigin: false };
  if (def.type === "wms") {
    const o = { pane, layers: def.wmsLayers, format: "image/png", transparent: true, version: def.wmsVersion || "1.3.0", opacity: def.opacity ?? 0.7,
      zIndex: 12, minZoom: def.minZoom || 0, maxZoom: 19, attribution: def.source, styles: "" };
    if (def.wmsTime === "hrvpp") o.time = `${hvYear}-01-01`;
    return L.tileLayer.wms(def.wmsUrl, o);
  }
  if (def.type === "catasto") {          // il catasto (linee) resta visibile anche fuori dal campo
    return new CatastoTiles(def, { ...common, pane: "catasto", minZoom: def.minZoom || 0, maxZoom: 19, tileSize: 256,
      attribution: "Catasto © Agenzia delle Entrate (CC BY 4.0)" });
  }
  // tasselli 512 px: un quarto delle richieste ai server EEA
  return new ArcGISTiles(def, { ...common, tileSize: 512, zoomOffset: -1, maxZoom: 19,
    attribution: "© Copernicus Land Monitoring Service / EEA" });
}

function setLayer(id, on) {
  const def = LAYERS.find((l) => l.id === id);
  if (!def) return;
  if (on) {
    if (!leafletLayers[id]) leafletLayers[id] = makeLayer(def);
    leafletLayers[id].addTo(map);
    state.on.add(id);
    if (!layerOrder.includes(id)) layerOrder.unshift(id);       // l'ultimo acceso va in cima
    setHidden(id, false);
    applyOrder();
    if (styleBase(def)) { applyStyle(def); updateFieldStats(def); }
  } else {
    if (leafletLayers[id]) map.removeLayer(leafletLayers[id]);
    state.on.delete(id);
    if (layerOrder.includes(id)) layerOrder.splice(layerOrder.indexOf(id), 1);
    hiddenLayers.delete(id);
  }
  const el = document.querySelector(`.layer[data-id="${id}"]`);
  if (el) { el.classList.toggle("on", on); el.querySelector("input[type=checkbox]").checked = on; if (on) loadLegend(def, el); }
  updateZoomNotes();
  renderLegendDock();
  renderLayerWin();
  updateSummaries();
  saveHash();
}

function setBase(key) {
  Object.values(BASEMAPS).forEach((l) => map.removeLayer(l));
  BASEMAPS[key].addTo(map);
  if (BASEMAPS[key].bringToBack) BASEMAPS[key].bringToBack();
  else BASEMAPS[key].eachLayer((l) => l.options.pane !== "labels" && l.bringToBack());
  currentBase = key;
  document.querySelectorAll("#basemaps button").forEach((b) => b.classList.toggle("active", b.dataset.key === key));
  saveHash();
}

function updateZoomNotes() {
  const z = map.getZoom();
  LAYERS.forEach((def) => {
    const el = document.querySelector(`.layer[data-id="${def.id}"]`);
    if (el) el.classList.toggle("toofar", !!def.minZoom && z < def.minZoom);
  });
}
map.on("zoomend", updateZoomNotes);

// ------------------------------------------------------------------ URL: vista condivisibile
// #6/42.5/12.5/sat/cat_particelle,clc2018
function saveHash() {
  const c = map.getCenter();
  const h = `#${map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}/${currentBase}/${[...state.on].join(",")}`;
  history.replaceState(null, "", location.pathname + location.search + h);
}
map.on("moveend", saveHash);

function readHash() {
  const p = location.hash.replace(/^#/, "").split("/");
  if (p.length < 3) return null;
  const [z, lat, lng, base, layers] = p;
  if (isNaN(+z) || isNaN(+lat) || isNaN(+lng)) return null;
  return { z: +z, lat: +lat, lng: +lng, base: BASEMAPS[base] ? base : null, layers: layers ? layers.split(",").filter(Boolean) : [] };
}

// ------------------------------------------------------------------ legenda / legend
const legendCache = {};
const legendTitle = () => `<div style="font-weight:600;margin-top:4px">${t("legend")}</div>`;
async function loadLegend(def, el) {
  const box = el.querySelector(".legend");
  if (!box) return;
  // mappe a valori continui: pannello Style (scala, limiti, classi, istogramma, legenda)
  if (styleBase(def)) {
    box.innerHTML = (def.type === "clms" ? `<div class="hint small">${t("hv_date")} ${clmsPick(def.product) || "—"}</div>` : "") +
      `<div class="st-panel"></div>`;
    renderStyle(def, el);
    return;
  }
  if (def.type === "soil") { box.innerHTML = Suolo.texLegend(); return; }
  if (def.type === "cty") { box.innerHTML = legendTitle() + CropLayer.legendHtml(); return; }
  if (def.legendHtml) { box.innerHTML = legendTitle() + (def.legendHtml[LANG] || def.legendHtml); return; }
  if (def.type === "wms") {
    box.innerHTML = legendTitle() + `<img alt="" style="max-width:100%" src="${def.wmsUrl}&service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=${def.wmsLayers}&sld_version=1.1.0">`;
    return;
  }
  // layer ArcGIS: legenda letta dal servizio (una sola volta per pannello)
  if (box.dataset.loaded || !def.url) return;
  box.dataset.loaded = "1";
  try {
    const j = legendCache[def.url] || (legendCache[def.url] = await fetch(`${def.url}/legend?f=json`).then((r) => r.json()));
    let rows = [];
    const show = def.showLayers ? def.showLayers.split(",").map(Number) : null;
    (j.layers || []).forEach((ly) => {
      if (show && !show.includes(ly.layerId)) return;
      (ly.legend || []).forEach((it) => rows.push(it));
    });
    const seen = new Set();
    rows = rows.filter((r) => r.label && !seen.has(r.label) && seen.add(r.label));
    // raster con etichette solo numeriche: uso i nomi delle classi della raster attribute table
    if (def.type === "arcgis-image" && rows.length && rows.every((r) => /^\d+$/.test(r.label.trim()))) {
      const rat = await getRAT(def);
      const named = (rat?.features || []).map((f) => {
        const a = f.attributes, key = Object.keys(a).find((k) => /class|label|name|descr/i.test(k) && typeof a[k] === "string");
        const img = rows.find((r) => r.label.trim() === String(a.Value ?? a.VALUE));
        return key && img ? { ...img, label: a[key] } : null;
      }).filter(Boolean);
      if (named.length) rows = named;
      else if (rows.length > 12) { // scala continua: campiono 8 voci
        const step = (rows.length - 1) / 7;
        rows = Array.from({ length: 8 }, (_, i) => rows[Math.round(i * step)]);
      }
    }
    rows = rows.slice(0, 48);
    if (!rows.length) return;
    box.innerHTML = legendTitle() + rows.map((r) =>
      `<div class="legend-row">${/^image\/[\w.+-]+$/.test(r.contentType) && /^[A-Za-z0-9+/=]+$/.test(r.imageData) ? `<img alt="" src="data:${r.contentType};base64,${r.imageData}">` : ""}<span>${escapeHtml(r.label)}</span></div>`).join("");
  } catch (e) { /* legenda non disponibile */ }
}

// ------------------------------------------------------------------ pannello layer
function yearSelect(id, label, current) {
  const years = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
  return `<div class="cty-year">${t(label)} <select id="${id}">${years.map((y) => `<option ${y === current ? "selected" : ""}>${y}</option>`).join("")}</select></div>`;
}
// "Campi e colture": prodotto con cui dare la coltura ai campi (mappa Copernicus di un anno o modello Columella su un'annata)
let cropProduct = "copernicus";
function cropProductControls() {
  const anni = Array.from({ length: new Date().getUTCFullYear() - 2017 + 1 }, (_, i) => new Date().getUTCFullYear() + 1 - i).filter((y) => y >= 2018);
  return `<div class="crop-product">
    <label>${t("cp_product")} <select id="cpProduct">
      <option value="copernicus"${cropProduct === "copernicus" ? " selected" : ""}>${t("cp_copernicus")}</option>
      <option value="model"${cropProduct === "model" ? " selected" : ""}>${t("cp_model")}</option></select></label>
    ${cropProduct === "model" ? `<label>${t("cp_season")} <select id="cpSeason">${anni.map((y) => `<option value="${y}"${y === Live.season() ? " selected" : ""}>${y - 1}/${String(y).slice(2)}</option>`).join("")}</select></label>` : ""}
    <p class="hint small">${t(cropProduct === "model" ? "cp_model_note" : "cp_cop_note")}</p></div>`;
}
// controlli in testa a un gruppo (finestra temporale, data Copernicus, anno HR-VPP, segmentazione + anno colture)
function groupControls(g) {
  switch (g.id) {
    case "live": return Live.windowControl();
    case "clms": {
      const dates = [...new Set(Object.values(clmsIdx).flat())].sort().reverse();
      return `<div class="cty-year">${t("hv_date")} <select id="clmsDate">${dates.map((d) => `<option ${d === clmsDate ? "selected" : ""}>${d}</option>`).join("")}</select></div>`;
    }
    case "hrvpp": return yearSelect("hvYear", "hv_year", hvYear);
    case "fields": return Live.segControl() + (cropProduct === "copernicus" ? yearSelect("ctyYear", "cty_year", ctyYear) : "");
    default: return "";
  }
}
// riga di un livello (casella, nome, pulsante info/stile, descrizione, trasparenza o stile, legenda, fonte)
const layerRow = (l) => `
        <div class="layer ${state.on.has(l.id) ? "on" : ""}" data-id="${l.id}">
          <div class="layer-head">
            <input type="checkbox" id="chk_${l.id}" ${state.on.has(l.id) ? "checked" : ""}>
            <label for="chk_${l.id}">${l[LANG].name}</label>
            <button class="info-toggle" title="${t(styleBase(l) ? "st_title" : "info")}" aria-label="${t(styleBase(l) ? "st_title" : "info")}">${styleBase(l) ? "🎨" : "ⓘ"}</button>
          </div>
          <div class="zoomnote">${t("zoom_in_to_see").replace("{z}", l.minZoom)}</div>
          <div class="layer-body">
            <div class="layer-desc">${l[LANG].desc}</div>
            ${styleBase(l) ? "" : `<div class="controls"><span>${t("opacity")}</span>
              <input type="range" min="0" max="100" value="${Math.round((leafletLayers[l.id]?.options.opacity ?? l.opacity ?? 0.7) * 100)}"></div>`}
            <div class="legend"></div>
            <div class="src">${t("source")}: ${l.source} · <a href="${l.link}" target="_blank" rel="noopener">${t("more")} ↗</a></div>
          </div>
        </div>`;
function renderLayerPanel() {
  const bm = document.getElementById("basemaps");
  bm.innerHTML = Object.keys(BASEMAPS).map((k) =>
    `<button data-key="${k}" class="${k === currentBase ? "active" : ""}">${t("bm_" + k)}</button>`).join("") +
    `<label class="chk bm-gray-chk"><input type="checkbox" id="bmGray" ${baseGray ? "checked" : ""}> ${t("bm_gray")}</label>`;
  bm.querySelectorAll("button").forEach((b) => b.onclick = () => setBase(b.dataset.key));
  document.getElementById("bmGray").onchange = (e) => {
    baseGray = e.target.checked;
    document.body.classList.toggle("bm-gray", baseGray);
    try { localStorage.setItem("columella.baseGray", baseGray ? "1" : "0"); } catch (err) { /* */ }
  };

  // sezioni della tab Mappe (MAP_SECTIONS); dentro la sezione CLMS un gruppo a scomparsa per ogni famiglia di prodotti
  const list = document.getElementById("layerList");
  const group = (gid, nested) => {
    // la mappa Copernicus Crop Types compare solo se è il prodotto scelto in "Campi e colture"
    const g = LAYER_GROUPS.find((x) => x.id === gid), items = LAYERS.filter((l) => l.group === gid && !(l.type === "cty" && cropProduct !== "copernicus"));
    const body = groupControls(g) + items.map(layerRow).join("");
    return nested ? `<details class="group" data-group="${gid}" ${items.some((l) => state.on.has(l.id)) ? "open" : ""}><summary>${g[LANG]}</summary>${body}</details>`
      : `<div class="group" data-group="${gid}">${body}</div>`;
  };
  const wasOpen = new Set([...list.querySelectorAll("details.sec[open]")].map((d) => d.id));
  list.innerHTML = MAP_SECTIONS.map((sec) => {
    const on = sec.groups.some((gid) => LAYERS.some((l) => l.group === gid && state.on.has(l.id)));
    return `<details class="sec" id="sec-map-${sec.id}" ${on || wasOpen.has("sec-map-" + sec.id) ? "open" : ""}>
      <summary><span class="sec-t">${sec[LANG]}</span><span class="sec-s" id="sum-map-${sec.id}"></span></summary>
      <div class="sec-body">${sec.id === "crops" ? cropProductControls() : ""}${sec.groups.map((gid) => group(gid, sec.groups.length > 1)).join("")}</div></details>`;
  }).join("");
  list.querySelectorAll("details.sec").forEach((d) => d.addEventListener("toggle", updateWide));
  list.querySelectorAll(".layer").forEach((el) => {
    const id = el.dataset.id, def = LAYERS.find((l) => l.id === id);
    el.querySelector("input[type=checkbox]").onchange = (e) => {
      setLayer(id, e.target.checked);
      if (e.target.checked) el.classList.add("expanded");
    };
    el.querySelector(".info-toggle").onclick = () => {
      el.classList.toggle("expanded");
      if (el.classList.contains("expanded")) loadLegend(def, el);
    };
    const op = el.querySelector(".controls input[type=range]");
    if (op) op.oninput = (e) => {
      const v = e.target.value / 100;
      def.opacity = v;
      if (leafletLayers[id]) leafletLayers[id].setOpacity(v);
    };
    if (state.on.has(id)) { el.classList.add("expanded"); loadLegend(def, el); }
  });
  Live.bindWindowControl();
  const hvSel = document.getElementById("hvYear");
  if (hvSel) hvSel.onchange = () => {
    hvYear = +hvSel.value;
    LAYERS.filter((l) => l.wmsTime === "hrvpp" && leafletLayers[l.id]).forEach((l) => leafletLayers[l.id].setParams({ time: `${hvYear}-01-01` }));
  };
  const clmsSel = document.getElementById("clmsDate");
  if (clmsSel) clmsSel.onchange = () => {
    clmsDate = clmsSel.value;
    LAYERS.filter((l) => l.type === "clms" && leafletLayers[l.id]).forEach((l) => { leafletLayers[l.id].setUrl(Clms.url(l.product, clmsPick(l.product))); updateFieldStats(l); });
  };
  const ctySel = document.getElementById("ctyYear");
  if (ctySel) ctySel.onchange = () => { ctyYear = +ctySel.value; if (leafletLayers.cty) leafletLayers.cty.setYear(ctyYear); };
  document.getElementById("cpProduct").onchange = (e) => {
    cropProduct = e.target.value;
    if (cropProduct !== "copernicus") LAYERS.filter((l) => l.type === "cty" && state.on.has(l.id)).forEach((l) => setLayer(l.id, false));
    renderLayerPanel();
  };
  const cpSeason = document.getElementById("cpSeason");
  if (cpSeason) cpSeason.onchange = () => Live.setSeason(+cpSeason.value);
  updateZoomNotes();
  updateSummaries();
}
// anno della mappa colture Copernicus da usare per i campi rilevati (null = prodotto "modello")
const cropYearForFields = () => (cropProduct === "copernicus" ? ctyYear : null);

// ------------------------------------------------------------------ catalogo / about
// come citare il sito (stesso testo di CITATION.cff); l'anno è quello della versione consultata
const SITE_URL = "https://francescorossi3.github.io/columella/";
function citeHtml() {
  const y = new Date().getFullYear(), oggi = new Date().toISOString().slice(0, 10);
  const txt = `Rossi, F. (${y}). Columella: open data for Italian agriculture [web application]. CNR – Istituto di Metodologie Integrate per l'Osservazione della Terra (IMIOT). ${SITE_URL} (${LANG === "it" ? "consultato il" : "accessed"} ${oggi}).`;
  const bib = `@misc{rossi_columella_${y},\n  author = {Rossi, Francesco},\n  title = {Columella: open data for Italian agriculture},\n  year = {${y}},\n  howpublished = {\\url{${SITE_URL}}},\n  organization = {CNR -- Istituto di Metodologie Integrate per l'Osservazione della Terra (IMIOT)},\n  note = {Web application, accessed ${oggi}}\n}`;
  return `<h3>${t("cite_title")}</h3><p>${t("cite_text")}</p>
    <div class="cite"><code>${escapeHtml(txt)}</code><button type="button" class="small-btn cite-copy">${t("cite_copy")}</button></div>
    <div class="cite"><pre>${escapeHtml(bib)}</pre><button type="button" class="small-btn cite-copy">${t("cite_copy")}</button></div>
    <p class="hint small">${t("cite_data")}</p>`;
}
function renderCatalog() {
  const onMap = LAYERS.map((l) => {
    const archived = ARCHIVE_GROUPS.includes(l.group);
    return `
    <div class="cat-item"><b>${l[LANG].name}<span class="badge ${archived ? "coming" : "on"}">${archived ? t("archive") : t("on_map")}</span></b>
      <p>${l[LANG].desc}</p><a href="${l.link}" target="_blank" rel="noopener">${l.source} ↗</a></div>`;
  }).join("");
  const extra = CATALOG_EXTRA.map((d) => `
    <div class="cat-item"><b>${d[LANG]}<span class="badge ${d.status === "on" ? "on" : "coming"}">${t(d.status === "on" ? "on_map" : "coming")}</span></b>
      <p>${LANG === "it" ? d.dit : d.den}</p><a href="${d.link}" target="_blank" rel="noopener">${d.link.replace(/^https?:\/\//, "").split("/")[0]} ↗</a></div>`).join("");
  document.getElementById("catalog").innerHTML = onMap + extra;
  document.getElementById("about").innerHTML = t("about_html") + citeHtml();
  document.querySelectorAll(".cite-copy").forEach((b) => (b.onclick = () => {
    navigator.clipboard.writeText(b.previousElementSibling.textContent).then(() => { b.textContent = t("cite_copied"); setTimeout(() => (b.textContent = t("cite_copy")), 1500); });
  }));
}

// ------------------------------------------------------------------ clic sulla mappa
// clic: seleziona il campo; con Ctrl/Maiusc/⌘ o con "aggiungi campi" attivo lo aggiunge ai campi selezionati
map.on("click", (e) => {
  if (Tools.busy()) return;
  const add = !!(e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.metaKey)) || document.getElementById("addMode").checked;
  Live.onMapClick(e.latlng, add);
});

// ------------------------------------------------------------------ ricerca luoghi
// 1) coordinate incollate ("41.86, 12.23" o "41°51'N 12°14'E"); 2) Photon (komoot, suggerimenti mentre si scrive,
// tollera errori e nomi parziali, priorità all'Italia); 3) Nominatim come riserva.
const sInput = document.getElementById("searchInput"), sList = document.getElementById("searchResults");
let sTimer = null, sItems = [], sSel = -1, sAbort = null, sMarker = null;
const sCache = {};
const TIPI = {
  it: { comune: "comune", city: "città", town: "comune", village: "paese", hamlet: "frazione", locality: "località", suburb: "quartiere", street: "via",
        house: "indirizzo", county: "provincia", state: "regione", district: "zona", farm: "azienda agricola", farmland: "terreno agricolo",
        vineyard: "vigneto", orchard: "frutteto", peak: "monte", water: "acqua", coords: "coordinate" },
  en: { comune: "municipality", city: "city", town: "town", village: "village", hamlet: "hamlet", locality: "locality", suburb: "suburb", street: "street",
        house: "address", county: "province", state: "region", district: "district", farm: "farm", farmland: "farmland",
        vineyard: "vineyard", orchard: "orchard", peak: "peak", water: "water", coords: "coordinates" },
};
function parseCoords(q) {
  const dms = q.match(/(\d+)[°\s]+(\d+)['\s]+([\d.]+)?"?\s*([NS])[,\s]+(\d+)[°\s]+(\d+)['\s]+([\d.]+)?"?\s*([EOW])/i);
  if (dms) {
    const lat = (+dms[1] + dms[2] / 60 + (+dms[3] || 0) / 3600) * (/S/i.test(dms[4]) ? -1 : 1);
    const lon = (+dms[5] + dms[6] / 60 + (+dms[7] || 0) / 3600) * (/W/i.test(dms[8]) ? -1 : 1);
    return { lat, lon };
  }
  const m = q.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (!m) return null;
  const lat = +m[1].replace(",", "."), lon = +m[2].replace(",", ".");
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
// indice locale dei ~7900 comuni (caricato alla prima ricerca): risponde subito e tollera errori di battitura
let COMUNI = null, comuniLoading = null;
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[''`’]/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function loadComuni() {
  if (!comuniLoading) comuniLoading = fetch("data/comuni.json").then((r) => (r.ok ? r.json() : null))
    .then((j) => { COMUNI = j ? j.comuni.map((c) => ({ c, n: norm(c[0]) })) : []; }).catch(() => { COMUNI = []; });
  return comuniLoading;
}
// distanza di Levenshtein con uscita anticipata: restituisce max + 1 appena la distanza supera max
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function searchComuni(q) {
  if (!COMUNI || !COMUNI.length) return [];
  // "Nome (RM)" o "Nome RM": la sigla filtra la provincia se esiste
  // (voce di comuni.json: [nome, sigla provincia, regione, lat, lon, ovest, sud, est, nord])
  let prov = null, qn = norm(q);
  const m = q.match(/^(.*?)[\s,(]+([A-Za-z]{2})\)?\s*$/);
  if (m && m[2]) {
    const sig = m[2].toUpperCase();
    if (COMUNI.some((x) => x.c[1] === sig)) { prov = sig; qn = norm(m[1]); }
  }
  if (qn.length < 2) return [];
  let maxD;                                       // errori di battitura tollerati
  if (qn.length <= 4) maxD = 1;
  else if (qn.length <= 8) maxD = 2;
  else maxD = 3;
  const scored = [];
  for (const x of COMUNI) {
    if (prov && x.c[1] !== prov) continue;
    let s = 0;
    if (x.n === qn) s = 100;
    else if (x.n.startsWith(qn)) s = 85 - Math.min(20, x.n.length - qn.length);
    else if (x.n.split(" ").some((w) => w.startsWith(qn))) s = 70;
    else if (x.n.includes(qn)) s = 55;
    else {
      const d = Math.min(lev(qn, x.n.slice(0, qn.length + 2), maxD), lev(qn, x.n, maxD));
      if (d <= maxD) s = 50 - d * 10;
    }
    if (s > 0) scored.push([s, x.c]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 6).map(([s, c]) => ({ nome: c[0], dove: `${c[1]} · ${c[2]}`, tipo: "comune", lat: c[3], lon: c[4], ext: [c[6], c[5], c[8], c[7]], score: s }));
}

// parole che non aiutano il geocoder ("località Strada" -> "Strada", cercata come località)
const FILLER = /^(localit[aà]|loc\.?|frazione|fraz\.?|contrada|c\.da|borgo|podere)\s+/i;
const PLACE_T = { city: 30, town: 28, village: 26, hamlet: 24, locality: 22, isolated_dwelling: 18, farm: 18, suburb: 16, district: 12, county: 10, state: 8 };
function rank(items, q) {
  const c = map.getCenter(), z = map.getZoom(), nq = norm(q.replace(FILLER, ""));
  const placeWanted = FILLER.test(q) || !/\d/.test(q);
  return items.map((r) => {
    const isAddress = r.tipo === "house" || r.tipo === "street";
    // punteggio di base per tipo; se la ricerca contiene numeri si privilegiano vie e indirizzi
    let s;
    if (PLACE_T[r.tipo]) s = PLACE_T[r.tipo];
    else if (r.tipo === "house") s = 6;
    else if (r.tipo === "street") s = 4;
    else s = 2;
    if (!placeWanted && isAddress) s = 30;
    const nn = norm(r.nome);
    if (nn === nq) s += 40; else if (nn.startsWith(nq)) s += 20; else if (nn.includes(nq)) s += 5;
    const km = Math.hypot((r.lat - c.lat) * 111, (r.lon - c.lng) * 111 * Math.cos(c.lat * Math.PI / 180));
    if (z >= 8) s += Math.max(0, 25 - km / (z >= 11 ? 2 : 8));
    return { ...r, rk: s };
  }).sort((a, b) => b.rk - a.rk);
}

async function photon(q, extra = "") {
  const c = map.getCenter();
  const qs = q.replace(FILLER, "");
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(qs)}&limit=12&lang=${LANG === "it" ? "default" : "en"}` +
    `&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&zoom=${Math.round(map.getZoom())}&location_bias_scale=0.3&bbox=6.0,35.3,19.0,47.2${extra}`;
  const j = await fetch(url, { signal: sAbort.signal }).then((r) => r.json());
  return (j.features || []).filter((f) => !f.properties.countrycode || f.properties.countrycode === "IT").map((f) => {
    const p = f.properties, [lon, lat] = f.geometry.coordinates;
    const nome = [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street].filter(Boolean)[0] || p.city || "";
    const dove = [p.city !== nome ? p.city : null, p.county, p.state].filter(Boolean).join(", ");
    const tipo = p.type === "other" ? p.osm_value : p.type;
    return { nome, dove, tipo, lat, lon, ext: p.extent ? [p.extent[1], p.extent[0], p.extent[3], p.extent[2]] : null };
  });
}
async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=it&limit=8&addressdetails=1&accept-language=${LANG}&q=${encodeURIComponent(q)}`;
  const j = await fetch(url, { signal: sAbort.signal }).then((r) => r.json());
  return j.map((r) => {
    const a = r.address || {}, bb = r.boundingbox.map(Number);
    return { nome: r.name || r.display_name.split(",")[0], dove: [a.city || a.town || a.village, a.county, a.state].filter(Boolean).join(", "),
      tipo: r.addresstype || r.type, lat: +r.lat, lon: +r.lon, ext: [bb[0], bb[2], bb[1], bb[3]] };
  });
}
async function doSearch(q) {
  q = q.trim();
  sSel = -1;
  if (q.length < 2) { sList.hidden = true; return; }
  const co = parseCoords(q);
  if (co) { sItems = [{ nome: `${co.lat.toFixed(5)}, ${co.lon.toFixed(5)}`, dove: "", tipo: "coords", lat: co.lat, lon: co.lon }]; renderResults(); return; }
  if (!COMUNI) await loadComuni();
  const loc = searchComuni(q);
  // risposta immediata dai comuni, poi si aggiungono località, vie e indirizzi da Photon (e Nominatim se serve)
  sItems = loc; if (loc.length) renderResults();
  if (sAbort) sAbort.abort();
  sAbort = new AbortController();
  let web = [];
  try {
    // per "località X" o una sola parola si cercano anche solo i luoghi abitati (città, frazioni, località)
    const solo = FILLER.test(q) || !/\s/.test(q);
    web = sCache[q] || (sCache[q] = (await Promise.all([photon(q).catch(() => []), solo ? photon(q, "&osm_tag=place").catch(() => []) : []])).flat()
      .filter((r, i, a) => a.findIndex((x) => x.nome === r.nome && Math.abs(x.lat - r.lat) < 0.002 && Math.abs(x.lon - r.lon) < 0.002) === i));
    if (!web.length && !loc.length) web = sCache[q] = await nominatim(q.replace(FILLER, ""));
    web = rank(web, q);
  } catch (e) { if (e.name === "AbortError") return; }
  const seen = new Set(loc.map((r) => norm(r.nome)));
  const extra = web.filter((r) => !(["city", "town", "village", "comune"].includes(r.tipo) && seen.has(norm(r.nome))));
  // se il comune è una corrispondenza esatta resta primo; altrimenti si alternano
  sItems = loc.length && loc[0].score >= 85 ? [...loc.slice(0, 3), ...extra.slice(0, 5), ...loc.slice(3)] : [...extra.slice(0, 4), ...loc, ...extra.slice(4)];
  sItems = sItems.slice(0, 10);
  renderResults();
}
function renderResults() {
  const tip = (tipo) => (TIPI[LANG] && TIPI[LANG][tipo]) || tipo || "";
  sList.innerHTML = sItems.length ? sItems.map((r, i) =>
    `<li data-i="${i}" class="${i === sSel ? "sel" : ""}"><b>${escapeHtml(r.nome)}</b> <span class="s-tipo">${escapeHtml(tip(r.tipo))}</span>` +
    (r.dove ? `<br><small>${escapeHtml(r.dove)}</small>` : "") + `</li>`).join("") : `<li>${t("search_none")}</li>`;
  sList.hidden = false;
  sList.querySelectorAll("li[data-i]").forEach((li) => (li.onmousedown = (e) => { e.preventDefault(); goTo(sItems[+li.dataset.i]); }));
}
function goTo(r) {
  sList.hidden = true;
  sInput.value = r.nome + (r.dove ? ", " + r.dove : "");
  const zoomTipo = { comune: 13, house: 18, street: 17, farm: 16, farmland: 16, vineyard: 16, orchard: 16, hamlet: 15, locality: 15, village: 14, suburb: 14, town: 13, city: 12, district: 12, county: 10, state: 8, coords: 16 };
  if (r.ext && !["house", "street", "coords"].includes(r.tipo)) map.fitBounds([[r.ext[0], r.ext[1]], [r.ext[2], r.ext[3]]], { maxZoom: zoomTipo[r.tipo] || 16 });
  else map.setView([r.lat, r.lon], zoomTipo[r.tipo] || 16);
  if (sMarker) map.removeLayer(sMarker);
  sMarker = L.circleMarker([r.lat, r.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#c0392b", fillOpacity: 0.9 }).addTo(map);
  setTimeout(() => { if (sMarker) { map.removeLayer(sMarker); sMarker = null; } }, 8000);
}
sInput.addEventListener("input", () => { clearTimeout(sTimer); sTimer = setTimeout(() => doSearch(sInput.value), 250); });
sInput.addEventListener("keydown", (e) => {
  if (sList.hidden || !sItems.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    sSel = (sSel + (e.key === "ArrowDown" ? 1 : -1) + sItems.length) % sItems.length;
    renderResults();
  } else if (e.key === "Escape") sList.hidden = true;
});
document.getElementById("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearTimeout(sTimer);
  if (!sItems.length || sList.hidden) await doSearch(sInput.value);
  if (sItems.length) goTo(sItems[Math.max(0, sSel)]);
});
sInput.addEventListener("focus", () => {
  loadComuni();
  if (sItems.length && sInput.value.trim().length >= 2) sList.hidden = false;
});
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) sList.hidden = true; });

// ------------------------------------------------------------------ tab e sezioni della barra laterale, telefono
// tab: maps (Mappe) · fields (Campi) · provinces (Province) · regions (Regioni); dentro le tab, sezioni a scomparsa
function openTab(name) {
  document.querySelectorAll(".tabs .tab").forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
  document.querySelectorAll(".tab-panel").forEach((p) => { const on = p.id === "tab-" + name; p.hidden = !on; p.classList.toggle("active", on); });
  if (name === "provinces") Regions.showProvince();
  if (name === "regions") Regions.showRegions();
  updateWide();
  if (document.body.dataset.sheet === "peek") setSheet("half");
}
document.querySelectorAll(".tabs .tab").forEach((b) => (b.onclick = () => openTab(b.dataset.tab)));
// apre la tab che contiene la sezione e la sezione stessa (fields, selected, series, compare, services, account, layers, point…)
function openSection(name) {
  const d = document.getElementById("sec-" + name);
  if (!d) return;
  const panel = d.closest(".tab-panel");
  if (panel && panel.hidden) openTab(panel.id.slice(4));
  d.open = true;
  if (document.body.dataset.sheet === "peek") setSheet("half");
  setTimeout(() => d.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 30);
}
// barra più larga (schermi grandi) quando servono grafici o tabelle
function updateWide() {
  const tab = (document.querySelector(".tabs .tab.active") || {}).dataset?.tab;
  const wide = tab === "provinces" || tab === "regions" || (tab === "fields" && ["sec-series", "sec-compare", "sec-services"].some((id) => document.getElementById(id).open));
  document.body.classList.toggle("wide-sidebar", wide);
  setTimeout(() => map.invalidateSize(), 220);
}
document.querySelectorAll("details.sec").forEach((d) => d.addEventListener("toggle", updateWide));
// riepilogo accanto al titolo delle sezioni
function updateSummaries() {
  const set = (id, txt) => { const el = document.getElementById("sum-" + id); if (el) el.textContent = txt; };
  MAP_SECTIONS.forEach((sec) => {
    const n = LAYERS.filter((l) => sec.groups.includes(l.group) && state.on.has(l.id)).length;
    set("map-" + sec.id, n ? t("sum_on").replace("{n}", n) : "");
  });
  const n = Clip.features().length;
  set("selected", n ? t("sum_n_fields").replace("{n}", n) : t("sum_nofield"));
  set("series", n ? t("sum_field") : t("sum_nofield"));
  set("services", n ? t("sum_field") : "");
  const u = typeof Account !== "undefined" && Account.utente();
  set("account", u ? u.email.split("@")[0] : "");
}
// telefono: la barra laterale diventa un foglio dal basso (peek / half / full)
function setSheet(pos) { document.body.dataset.sheet = pos; setTimeout(() => map.invalidateSize(), 260); }
document.getElementById("sheetHandle").onclick = () => setSheet({ peek: "half", half: "full", full: "peek" }[document.body.dataset.sheet] || "half");
document.getElementById("toggleSidebar").onclick = () => {
  if (matchMedia("(max-width: 899px)").matches) setSheet(document.body.dataset.sheet === "peek" ? "half" : "peek");
  else { document.body.classList.toggle("sidebar-closed"); setTimeout(() => map.invalidateSize(), 220); }
};

function applyLang() {
  document.documentElement.lang = LANG;
  document.title = `${t("title")} — ${t("tagline")}`;
  document.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => el.placeholder = t(el.dataset.i18nPh));
  document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("active", b.dataset.lang === LANG));
  renderLayerPanel();
  renderCatalog();
  renderLegendDock();
  if (document.getElementById("layerWin")) toggleLayerWin(!document.getElementById("layerWin").hidden);
  updateSummaries();
  Live.refreshLang();
  Tools.refreshLang();
  Account.render();
  Regions.render();
}
document.querySelectorAll(".lang button").forEach((b) => b.onclick = () => {
  LANG = b.dataset.lang;
  try { localStorage.setItem("campi_lang", LANG); } catch (e) {}
  applyLang();
});

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ------------------------------------------------------------------ avvio / start
(function start() {
  const h = readHash();
  if (h) {
    map.setView([h.lat, h.lng], h.z);
    if (h.base) currentBase = h.base;
    h.layers.forEach((id) => LAYERS.some((l) => l.id === id && !ARCHIVE_GROUPS.includes(l.group)) && state.on.add(id));
  } else {
    LAYERS.filter((l) => l.on).forEach((l) => state.on.add(l.id));
  }
  document.body.dataset.sheet = "peek";
  Tools.init();
  Account.init().catch((e) => console.warn("account non disponibile", e));
  if (typeof Account.onChange === "function") Account.onChange(() => { updateSummaries(); Tools.renderCommunity(); });
  document.getElementById("sec-community").addEventListener("toggle", (e) => { if (e.target.open) Tools.renderCommunity(); });
  Clms.loadIndex().then((j) => { clmsIdx = j || {}; renderLayerPanel(); });
  applyLang();
  setBase(currentBase);
  [...state.on].forEach((id) => setLayer(id, true));
})();
