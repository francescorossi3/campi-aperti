// Campi Aperti — logica della mappa / map logic
// Sito statico: tutti i dati arrivano direttamente dai servizi pubblici (EEA, Agenzia delle Entrate, OSM).

// ------------------------------------------------------------------ lingua / language
let LANG = (() => {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "it" || q === "en") return q;
  try { const s = localStorage.getItem("campi_lang"); if (s) return s; } catch (e) {}
  return (navigator.language || "it").startsWith("it") ? "it" : "en";
})();
const t = (k) => (I18N[LANG] && I18N[LANG][k]) || I18N.it[k] || k;

// ------------------------------------------------------------------ mappa / map
const ITALY_BOUNDS = L.latLngBounds([35.0, 5.5], [47.5, 19.5]);
const map = L.map("map", {
  zoomControl: true, minZoom: 5, maxZoom: 19,
  maxBounds: ITALY_BOUNDS.pad(0.4),
}).fitBounds(ITALY_BOUNDS);
L.control.scale({ imperial: false }).addTo(map);
// riquadro dedicato al catasto: il riempimento giallo delle particelle viene reso trasparente
// con un filtro + fusione "multiply", così restano solo i contorni sopra la mappa
map.createPane("labels");
map.getPane("labels").style.zIndex = 640;
map.getPane("labels").style.pointerEvents = "none";
map.createPane("catasto");
map.getPane("catasto").style.zIndex = 450;
map.getPane("catasto").classList.add("catasto-pane");

const BASEMAPS = {
  osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap contributors" }),
  sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }),
  s2: L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg", {
    maxZoom: 17, maxNativeZoom: 15,
    attribution: 'Sentinel-2 cloudless 2023 by <a href="https://s2maps.eu">EOX</a> (Copernicus Sentinel data 2023), CC BY-NC-SA 4.0' }),
  hybrid: L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, pane: "labels", opacity: 0.8 }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, pane: "labels", attribution: "Etichette © Esri" }),
  ]),
  topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17, attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)" }),
};
let currentBase = "hybrid";

// --- tile layer per ArcGIS (export / exportImage) in EPSG:3857
const ArcGISTiles = L.TileLayer.extend({
  initialize(def, opts) { this.def = def; L.TileLayer.prototype.initialize.call(this, "", opts); },
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
const CatastoTiles = L.TileLayer.extend({
  initialize(def, opts) { this.def = def; L.TileLayer.prototype.initialize.call(this, "", opts); },
  getTileUrl(c) {
    const size = this.getTileSize();
    const nw = this._map.unproject(c.scaleBy(size), c.z);
    const se = this._map.unproject(c.scaleBy(size).add(size), c.z);
    const bbox = [nw.lng, se.lat, se.lng, nw.lat].map((v) => v.toFixed(7)).join(",");
    // Il server disegna le particelle solo a scala maggiore di ~1:5.000: chiedo più pixel
    // per tassello (fino a 512) e il browser li riduce a 256. Sotto lo zoom 16 le linee diventano invisibili.
    const widthM = 40075016 * Math.cos(((nw.lat + se.lat) / 2) * Math.PI / 180) / Math.pow(2, c.z);
    const scale256 = widthM / (size.x * 0.00028);
    const f = Math.min(2, Math.max(1, Math.pow(2, Math.ceil(Math.log2(scale256 / 3500)))));
    const px = this.def.hiRes ? size.x * f : size.x;
    return `${CATASTO_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${this.def.wmsLayers}&STYLES=` +
      `&SRS=EPSG:4258&BBOX=${bbox}&WIDTH=${px}&HEIGHT=${px}&FORMAT=image/png&TRANSPARENT=TRUE`;
  },
});

const leafletLayers = {};
let ctyYear = 2024, hvYear = 2024;
const state = { on: new Set() };

function makeLayer(def) {
  if (def.type === "s2live") return Live.makeS2Layer(def);
  if (def.type === "cty") return new CropLayer.Layer(ctyYear, { minZoom: def.minZoom, maxZoom: 19, opacity: def.opacity ?? 0.85, zIndex: 30 });
  const common = { opacity: def.opacity ?? 0.7, zIndex: 10, crossOrigin: false };
  if (def.type === "wms") {
    const o = { layers: def.wmsLayers, format: "image/png", transparent: true, version: def.wmsVersion || "1.3.0", opacity: def.opacity ?? 0.7,
      zIndex: 12, minZoom: def.minZoom || 0, maxZoom: 19, attribution: def.source, styles: "" };
    if (def.wmsTime === "hrvpp") o.time = `${hvYear}-01-01`;
    return L.tileLayer.wms(def.wmsUrl, o);
  }
  if (def.type === "catasto") {
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
  } else {
    if (leafletLayers[id]) map.removeLayer(leafletLayers[id]);
    state.on.delete(id);
  }
  const el = document.querySelector(`.layer[data-id="${id}"]`);
  if (el) { el.classList.toggle("on", on); el.querySelector("input[type=checkbox]").checked = on; if (on) loadLegend(def, el); }
  updateZoomNotes();
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
async function loadLegend(def, el) {
  const box = el.querySelector(".legend");
  if (box && def.type === "cty") { box.innerHTML = `<div style="font-weight:600;margin-top:4px">${t("legend")}</div>${CropLayer.legendHtml()}`; return; }
  if (box && def.legendHtml) { box.innerHTML = `<div style="font-weight:600;margin-top:4px">${t("legend")}</div>${def.legendHtml}`; return; }
  if (box && def.type === "wms" && !def.legendHtml) {
    box.innerHTML = `<div style="font-weight:600;margin-top:4px">${t("legend")}</div><img alt="" style="max-width:100%" src="${def.wmsUrl}&service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=${def.wmsLayers}&sld_version=1.1.0">`;
    return;
  }
  if (!box || box.dataset.loaded || !def.url) return;
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
    box.innerHTML = `<div style="font-weight:600;margin-top:4px">${t("legend")}</div>` + rows.map((r) =>
      `<div class="legend-row"><img alt="" src="data:${r.contentType};base64,${r.imageData}"><span>${escapeHtml(r.label)}</span></div>`).join("");
  } catch (e) { /* legenda non disponibile */ }
}

// ------------------------------------------------------------------ pannello layer
function renderLayerPanel() {
  const bm = document.getElementById("basemaps");
  bm.innerHTML = Object.keys(BASEMAPS).map((k) =>
    `<button data-key="${k}" class="${k === currentBase ? "active" : ""}">${t("bm_" + k)}</button>`).join("");
  bm.querySelectorAll("button").forEach((b) => b.onclick = () => setBase(b.dataset.key));

  const list = document.getElementById("layerList");
  list.innerHTML = LAYER_GROUPS.map((g, gi) => {
    const items = LAYERS.filter((l) => l.group === g.id);
    return `<details class="group" data-group="${g.id}" ${gi < 3 || items.some((l) => state.on.has(l.id)) ? "open" : ""}>
      <summary>${g[LANG]}</summary>${g.id === "live" ? Live.windowControl() : ""}${g.id === "hrvpp" ? `<div class="cty-year">${t("hv_year")} <select id="hvYear">${[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017].map((y) => `<option ${y === hvYear ? "selected" : ""}>${y}</option>`).join("")}</select></div>` : ""}${g.id === "fields" ? Live.segControl() + `<div class="cty-year">${t("cty_year")} <select id="ctyYear">${[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017].map((y) => `<option ${y === ctyYear ? "selected" : ""}>${y}</option>`).join("")}</select></div>` : ""}
      ${items.map((l) => `
        <div class="layer ${state.on.has(l.id) ? "on" : ""}" data-id="${l.id}">
          <div class="layer-head">
            <input type="checkbox" id="chk_${l.id}" ${state.on.has(l.id) ? "checked" : ""}>
            <label for="chk_${l.id}">${l[LANG].name}</label>
            <button class="info-toggle" title="info">ⓘ</button>
          </div>
          <div class="zoomnote">${t("zoom_in_to_see").replace("{z}", l.minZoom)}</div>
          <div class="layer-body">
            <div>${l[LANG].desc}</div>
            <div class="controls"><span>${t("opacity")}</span>
              <input type="range" min="0" max="100" value="${Math.round((leafletLayers[l.id]?.options.opacity ?? l.opacity ?? 0.7) * 100)}"></div>
            <div class="legend"></div>
            <div class="src">${t("source")}: ${l.source} · <a href="${l.link}" target="_blank" rel="noopener">${t("more")} ↗</a></div>
          </div>
        </div>`).join("")}
    </details>`;
  }).join("");

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
    el.querySelector("input[type=range]").oninput = (e) => {
      const v = e.target.value / 100;
      def.opacity = v;
      if (leafletLayers[id]) leafletLayers[id].setOpacity(v);
    };
    if (state.on.has(id)) { el.classList.add("expanded"); loadLegend(def, el); }
  });
  Live.bindWindowControl();
  const hy = document.getElementById("hvYear");
  if (hy) hy.onchange = () => { hvYear = +hy.value; LAYERS.filter((l) => l.wmsTime === "hrvpp" && leafletLayers[l.id]).forEach((l) => leafletLayers[l.id].setParams({ time: `${hvYear}-01-01` })); };
  const cy = document.getElementById("ctyYear");
  if (cy) cy.onchange = () => { ctyYear = +cy.value; if (leafletLayers.cty) leafletLayers.cty.setYear(ctyYear); };
  updateZoomNotes();
}

// ------------------------------------------------------------------ catalogo / about
function renderCatalog() {
  const onMap = LAYERS.map((l) => `
    <div class="cat-item"><b>${l[LANG].name}<span class="badge ${ARCHIVE_GROUPS.includes(l.group) ? "coming" : "on"}">${ARCHIVE_GROUPS.includes(l.group) ? t("archive") : t("on_map")}</span></b>
      <p>${l[LANG].desc}</p><a href="${l.link}" target="_blank" rel="noopener">${l.source} ↗</a></div>`).join("");
  const extra = CATALOG_EXTRA.map((d) => `
    <div class="cat-item"><b>${d[LANG]}<span class="badge ${d.status === "on" ? "on" : "coming"}">${t(d.status === "on" ? "on_map" : "coming")}</span></b>
      <p>${LANG === "it" ? d.dit : d.den}</p><a href="${d.link}" target="_blank" rel="noopener">${d.link.replace(/^https?:\/\//, "").split("/")[0]} ↗</a></div>`).join("");
  document.getElementById("catalog").innerHTML = onMap + extra;
  document.getElementById("about").innerHTML = t("about_html");
}

// ------------------------------------------------------------------ clic sulla mappa / point query
let clickMarker = null;
map.on("click", (e) => { if (Tools.busy()) return; queryPoint(e.latlng); Live.onMapClick(e.latlng); });

const ratCache = {};
async function getRAT(def) {
  try {
    return ratCache[def.url] || (ratCache[def.url] = await fetch(`${def.url}/rasterAttributeTable?f=json`).then((r) => r.json()));
  } catch (e) { return null; }
}
async function rasterLabel(def, value) {
  // prova a tradurre il valore del pixel in una classe tramite la raster attribute table
  try {
    const rat = await getRAT(def);
    if (!rat || !rat.features) return null;
    const f = rat.features.find((x) => String(x.attributes.Value ?? x.attributes.VALUE) === String(value));
    if (!f) return null;
    const key = Object.keys(f.attributes).find((k) => /class|label|name|descr/i.test(k) && typeof f.attributes[k] === "string");
    return key ? f.attributes[key] : null;
  } catch (e) { return null; }
}

async function identify(def, ll, clc = false) {
  const geom = encodeURIComponent(JSON.stringify({ x: ll.lng, y: ll.lat, spatialReference: { wkid: 4326 } }));
  if (def.type === "arcgis-image") {
    const j = await fetch(`${def.url}/identify?geometry=${geom}&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json`).then((r) => r.json());
    const v = j.value;
    if (v == null || v === "NoData") return t("info_nodata");
    const lab = await rasterLabel(def, v);
    return lab ? `${lab} (${v})` : v;
  }
  const b = map.getBounds(), s = map.getSize();
  const ext = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
  const lyr = def.identifyLayers ? `all:${def.identifyLayers}` : "visible";
  const j = await fetch(`${def.url}/identify?geometry=${geom}&geometryType=esriGeometryPoint&sr=4326&layers=${lyr}` +
    `&tolerance=3&mapExtent=${ext}&imageDisplay=${s.x},${s.y},96&returnGeometry=false&f=json`).then((r) => r.json());
  const r = (j.results || [])[0];
  if (!r) return t("info_nodata");
  const a = r.attributes || {};
  if (clc) { // CORINE: codice a 3 cifre + nome della classe nella lingua scelta
    const code = a.Code_18 || r.value;
    return `${LANG === "it" && CLC_IT[code] ? CLC_IT[code] : (CLC_EN[code] || "")} (${code})`;
  }
  const labKey = Object.keys(a).find((k) => /label3|label|class|name|descr/i.test(k) && !/shape|objectid|fid/i.test(k));
  return labKey ? `${a[labKey]}${r.value && r.value !== a[labKey] ? ` (${r.value})` : ""}` : (r.value ?? t("info_nodata"));
}

function parcelUrl(ll) {
  const d = 0.00005;
  return `${CATASTO_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=CP.CadastralParcel&QUERY_LAYERS=CP.CadastralParcel` +
    `&SRS=EPSG:4258&BBOX=${ll.lng - d},${ll.lat - d},${ll.lng + d},${ll.lat + d}&WIDTH=101&HEIGHT=101&X=50&Y=50` +
    `&INFO_FORMAT=text/html&STYLES=&FORMAT=image/png`;
}

async function queryPoint(ll) {
  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="click-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(map);
  if (window.innerWidth > 760) document.getElementById("sidebar").classList.add("open");

  const lat = ll.lat.toFixed(6), lng = ll.lng.toFixed(6);
  const active = LAYERS.filter((l) => state.on.has(l.id) && l.type.startsWith("arcgis"));
  const panel = document.getElementById("infoPanel");
  panel.innerHTML = `
    <div class="info-block"><h4>${t("info_coords")}</h4>
      <div class="kv"><span>lat, lon</span><span>${lat}, ${lng} <button class="small-btn" id="copyBtn">${t("copy_coords")}</button></span></div>
      <div class="ext-links">${t("links_ext")}:
        <a href="https://browser.dataspace.copernicus.eu/?zoom=15&lat=${lat}&lng=${lng}" target="_blank" rel="noopener">Copernicus Browser ↗</a>
        <a href="https://www.google.com/maps/@${lat},${lng},500m/data=!3m1!1e3" target="_blank" rel="noopener">Google Maps ↗</a>
        <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}" target="_blank" rel="noopener">OSM ↗</a>
      </div></div>
    <div class="info-block"><h4>${t("info_parcel")}</h4>
      <p class="hint" style="margin:0 0 6px">${t("info_parcel_how")}</p>
      <a class="small-btn" style="display:inline-block;text-decoration:none;color:inherit" href="${parcelUrl(ll)}" target="_blank" rel="noopener">${t("info_parcel_open")} ↗</a>
    </div>
    <p class="hint">${t("info_field")}</p>`;
  document.getElementById("copyBtn").onclick = async (ev) => {
    try { await navigator.clipboard.writeText(`${lat}, ${lng}`); ev.target.textContent = t("copied"); } catch (e) {}
  };

}

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
  // "Nome (RM)" o "Nome, provincia"
  let pr = null; const m = q.match(/^(.*?)[\s,(]+([A-Za-z]{2})\)?\s*$/);
  let qq = norm(q);
  if (m && m[2]) { const sig = m[2].toUpperCase(); if (COMUNI.some((x) => x.c[1] === sig)) { pr = sig; qq = norm(m[1]); } }
  if (qq.length < 2) return [];
  const maxD = qq.length <= 4 ? 1 : qq.length <= 8 ? 2 : 3;
  const sc = [];
  for (const x of COMUNI) {
    if (pr && x.c[1] !== pr) continue;
    let s = 0;
    if (x.n === qq) s = 100;
    else if (x.n.startsWith(qq)) s = 85 - Math.min(20, x.n.length - qq.length);
    else if (x.n.split(" ").some((w) => w.startsWith(qq))) s = 70;
    else if (x.n.includes(qq)) s = 55;
    else { const d = lev(qq, x.n.slice(0, qq.length + 2), maxD), d2 = lev(qq, x.n, maxD); const dd = Math.min(d, d2); if (dd <= maxD) s = 50 - dd * 10; }
    if (s > 0) sc.push([s, x.c]);
  }
  return sc.sort((a, b) => b[0] - a[0]).slice(0, 6).map(([s, c]) => ({ nome: c[0], dove: `${c[1]} · ${c[2]}`, tipo: "comune", lat: c[3], lon: c[4], ext: [c[6], c[5], c[8], c[7]], score: s }));
}

// parole che non aiutano il geocoder ("località Strada" -> "Strada", cercata come località)
const FILLER = /^(localit[aà]|loc\.?|frazione|fraz\.?|contrada|c\.da|borgo|podere)\s+/i;
const PLACE_T = { city: 30, town: 28, village: 26, hamlet: 24, locality: 22, isolated_dwelling: 18, farm: 18, suburb: 16, district: 12, county: 10, state: 8 };
function rank(items, q) {
  const c = map.getCenter(), z = map.getZoom(), nq = norm(q.replace(FILLER, ""));
  const placeWanted = FILLER.test(q) || !/\d/.test(q);
  return items.map((r) => {
    let s = PLACE_T[r.tipo] || (r.tipo === "house" ? 6 : r.tipo === "street" ? 4 : 2);
    if (!placeWanted) s = r.tipo === "house" || r.tipo === "street" ? 30 : s;
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
    const solo = FILLER.test(q) || !/\s/.test(q.trim());
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
  const tip = (t) => (TIPI[LANG] && TIPI[LANG][t]) || t || "";
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
sInput.addEventListener("focus", () => { loadComuni(); });
sInput.addEventListener("focus", () => { if (sItems.length && sInput.value.trim().length >= 2) sList.hidden = false; });
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) sList.hidden = true; });

// ------------------------------------------------------------------ tab, lingua, mobile
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
  document.body.classList.toggle("wide-sidebar", name === "regions");
  if (name === "regions") Regions.show();
  setTimeout(() => map.invalidateSize(), 220);
}
document.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => showTab(b.dataset.tab));
document.getElementById("toggleSidebar").onclick = () => document.getElementById("sidebar").classList.toggle("open");

function applyLang() {
  document.documentElement.lang = LANG;
  document.title = `${t("title")} — ${t("tagline")}`;
  document.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => el.placeholder = t(el.dataset.i18nPh));
  document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("active", b.dataset.lang === LANG));
  renderLayerPanel();
  renderCatalog();
  Live.refreshLang();
  Tools.refreshLang();
  if (document.body.classList.contains("wide-sidebar")) Regions.render();
  const info = document.getElementById("infoPanel");
  if (!clickMarker) info.innerHTML = `<p class="hint">${t("info_hint")}</p>`;
  else queryPoint(clickMarker.getLatLng());
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
  Tools.init();
  applyLang();
  setBase(currentBase);
  [...state.on].forEach((id) => setLayer(id, true));
})();
