// Columella — js/clip.js
// IT: ritaglio dei raster sul campo selezionato. Tutti i livelli raster (indici Sentinel-2, prodotti Copernicus,
//     suolo, colture, mappe EEA) stanno nel riquadro Leaflet "rasters"; quando c'è un campo selezionato il
//     riquadro riceve un clip-path con il poligono del campo (fuori è trasparente) e la mappa si centra sul campo.
//     Il clip-path è in coordinate "layer point" di Leaflet: si ricalcola a ogni cambio di zoom; durante
//     l'animazione dello zoom il riquadro è nascosto per non mostrare un ritaglio sfasato.
// EN: clips every raster layer (pane "rasters") to the selected field polygon with a CSS clip-path and zooms to it.
//
// Globale esposto / exposed global: Clip { init(map), pane(), set(feature|null, zoom), feature(), active(), onChange(fn) }
// Dipende da / depends on: Leaflet (L). Va caricato prima di app.js, che chiama Clip.init(map) appena crea la mappa.

const Clip = (() => {
  let m = null, pane = null, feature = null;
  const listeners = [];

  function init(theMap) {
    m = theMap;
    pane = m.createPane("rasters");
    pane.style.zIndex = 300;                         // sopra le mappe di base (200), sotto vettori e catasto (400+)
    m.on("zoomend viewreset", update);
    m.on("zoomanim", () => { if (feature) pane.style.visibility = "hidden"; });
    m.on("zoomend", () => { pane.style.visibility = ""; });
  }

  // percorso SVG del poligono (anelli esterni e buchi, regola evenodd) in pixel del riquadro
  function pathOf(f) {
    const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return polys.flatMap((p) => p.map((ring) => "M" + ring.map(([lon, lat]) => {
      const pt = m.latLngToLayerPoint([lat, lon]);
      return `${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }).join("L") + "Z")).join("");
  }
  function update() {
    if (!pane) return;
    pane.style.clipPath = feature ? `path(evenodd, "${pathOf(feature)}")` : "";
  }

  function set(f, zoom = true) {
    feature = f && f.geometry && /Polygon/.test(f.geometry.type) ? f : null;
    update();
    document.body.classList.toggle("clip-on", !!feature);
    if (feature && zoom) m.fitBounds(L.geoJSON(feature).getBounds(), { maxZoom: 18, padding: [40, 40] });
    listeners.forEach((fn) => fn(feature));
  }

  return { init, set, feature: () => feature, active: () => !!feature, onChange: (fn) => listeners.push(fn), pane: () => "rasters" };
})();
