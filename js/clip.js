// Columella — js/clip.js
// IT: campi selezionati e ritaglio dei raster. Si possono selezionare più campi: ognuno riceve un id temporaneo
//     (C1, C2, …) e un colore. Tutti i livelli raster (indici Sentinel-2, prodotti Copernicus, suolo, colture,
//     mappe EEA) stanno nel riquadro Leaflet "rasters": con dei campi selezionati il riquadro riceve un clip-path
//     con i loro poligoni (fuori è trasparente) e il resto della mappa viene velato, così gli altri campi si
//     vedono opachi. Il clip-path è in coordinate "layer point" di Leaflet: si ricalcola a ogni zoom; durante
//     l'animazione dello zoom il riquadro è nascosto per non mostrare un ritaglio sfasato.
// EN: selected fields (temporary ids C1, C2…, colours); rasters clipped to their polygons, the rest of the map dimmed.
//
// Globale esposto / exposed global: Clip { init(map), pane(), set(list|feature|null, zoom), add(feature), remove(id),
//   features(), feature() (primo), active(), ids(), byId(id), colorOf(id), onChange(fn), veil(), setVeil(on), zoomTo(id) }
// Dipende da / depends on: Leaflet (L). Va caricato prima di app.js, che chiama Clip.init(map) appena crea la mappa.

const Clip = (() => {
  const COLORS = ["#ffd84a", "#4fd1c5", "#f687b3", "#90cdf4", "#f6ad55", "#b794f4", "#68d391", "#fc8181"];
  let m = null, pane = null, list = [], next = 1, veil = null, outlines = null, veilOn = true;
  const listeners = [];

  function init(theMap) {
    m = theMap;
    pane = m.createPane("rasters");
    pane.style.zIndex = 300;                         // sopra le mappe di base (200), sotto vettori e catasto (400+)
    const v = m.createPane("veil");                  // velo sul resto della mappa
    v.style.zIndex = 390; v.style.pointerEvents = "none";
    m.on("zoomend viewreset", update);
    m.on("zoomanim", () => { if (list.length) pane.style.visibility = "hidden"; });
    m.on("zoomend", () => { pane.style.visibility = ""; });
  }

  const ringsOf = (f) => { const g = f.geometry; return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []; };
  // percorso SVG dei poligoni (anelli esterni e buchi, regola evenodd) in pixel del riquadro
  function pathOf(feats) {
    return feats.flatMap((f) => ringsOf(f).flatMap((p) => p.map((ring) => "M" + ring.map(([lon, lat]) => {
      const pt = m.latLngToLayerPoint([lat, lon]);
      return `${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }).join("L") + "Z"))).join("");
  }
  function update() {
    if (!pane) return;
    pane.style.clipPath = list.length ? `path(evenodd, "${pathOf(list.map((x) => x.feature))}")` : "";
  }
  // velo chiaro sul mondo con i buchi dei campi selezionati; contorni colorati con l'id
  function redraw() {
    if (veil) { m.removeLayer(veil); veil = null; }
    if (outlines) { m.removeLayer(outlines); outlines = null; }
    if (!list.length) return;
    const world = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
    const holes = list.flatMap((x) => ringsOf(x.feature).map((p) => p[0].map(([lon, lat]) => [lat, lon])));
    if (veilOn) veil = L.polygon([world, ...holes], { pane: "veil", stroke: false, fillColor: "#f4f5ef", fillOpacity: 0.55, interactive: false }).addTo(m);
    outlines = L.layerGroup(list.map((x) => L.geoJSON(x.feature, { style: { color: x.color, weight: 3, fill: false }, interactive: false })
      .bindTooltip(x.id, { permanent: true, direction: "center", className: "field-id" }))).addTo(m);
  }
  const valid = (f) => f && f.geometry && /Polygon/.test(f.geometry.type);
  function changed(zoom) {
    update(); redraw();
    document.body.classList.toggle("clip-on", list.length > 0);
    if (list.length && zoom) m.fitBounds(L.featureGroup(list.map((x) => L.geoJSON(x.feature))).getBounds(), { maxZoom: 18, padding: [40, 40] });
    listeners.forEach((fn) => fn(list.map((x) => x.feature)));
  }
  function entry(f) {
    const id = "C" + next++;
    f.properties = { ...(f.properties || {}), fid: id };
    return { id, color: COLORS[(next - 2) % COLORS.length], feature: f };
  }
  // sostituisce la selezione (un campo, una lista o niente); gli id ripartono da C1
  function set(fs, zoom = true) {
    next = 1;
    list = (Array.isArray(fs) ? fs : fs ? [fs] : []).filter(valid).map(entry);
    changed(zoom);
    return list.map((x) => x.id);
  }
  // aggiunge un campo alla selezione e restituisce il suo id
  function add(f, zoom = false) {
    if (!valid(f)) return null;
    const x = entry(f);
    list.push(x);
    changed(zoom);
    return x.id;
  }
  function remove(id) { list = list.filter((x) => x.id !== id); changed(false); }

  return {
    init, set, add, remove,
    veil: () => veilOn, setVeil: (on) => { veilOn = !!on; redraw(); },
    zoomTo: (id) => { const x = list.find((e) => e.id === id); if (x) m.fitBounds(L.geoJSON(x.feature).getBounds(), { maxZoom: 18, padding: [40, 40] }); },
    features: () => list.map((x) => x.feature), feature: () => (list[0] ? list[0].feature : null), active: () => list.length > 0,
    ids: () => list.map((x) => x.id), byId: (id) => (list.find((x) => x.id === id) || {}).feature,
    colorOf: (id) => (list.find((x) => x.id === id) || {}).color || "#888",
    onChange: (fn) => listeners.push(fn), pane: () => "rasters",
  };
})();
