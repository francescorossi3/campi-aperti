// Catalogo dei layer / Layer catalogue
// type: "arcgis-map"   -> ArcGIS MapServer /export  (EEA discomap)
//       "arcgis-image" -> ArcGIS ImageServer /exportImage (EEA discomap)
//       "catasto"      -> WMS Agenzia delle Entrate (EPSG:4258)
// Per aggiungere un layer basta aggiungere un oggetto a questa lista.

const EEA = "https://image.discomap.eea.europa.eu/arcgis/rest/services/";
const CATASTO_WMS = "https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php";

const LAYER_GROUPS = [
  { id: "live", it: "Satellite in tempo reale (Sentinel-2)", en: "Real-time satellite (Sentinel-2)" },
  { id: "fields", it: "Campi e colture", en: "Fields and crops" },
  { id: "catasto", it: "Catasto (Agenzia delle Entrate)", en: "Cadastre (Italian Revenue Agency)" },
  { id: "hrvpp", it: "Fenologia e produttività (Copernicus HR-VPP, 10 m)", en: "Phenology and productivity (Copernicus HR-VPP, 10 m)" },
  { id: "soil", it: "Suolo (SoilGrids, 250 m)", en: "Soil (SoilGrids, 250 m)" },
];
// I layer statici CLMS (2012–2021) restano solo nel catalogo "Dati" come archivio.
const ARCHIVE_GROUPS = ["landcover", "trees", "agri", "pheno", "water", "nature"];

const LAYERS = [
  // ---------------- FENOLOGIA / PHENOLOGY (HR-VPP) ----------------
  {
    id: "hv_sosd", group: "hrvpp", type: "wms", wmsVersion: "1.1.1", wmsTime: "hrvpp", minZoom: 8, opacity: 0.75,
    wmsUrl: "https://phenology.vgt.vito.be/wms?", wmsLayers: "CLMS_HRVPP_VPP_SOSD_SEASON1_10M",
    legendHtml: "<p class='hint small'>Scala colori ufficiale CLMS. Prima stagione dell'anno scelto.</p>",
    it: { name: "Inizio della stagione vegetativa", desc: "Data in cui la vegetazione inizia a crescere nell'anno (dall'indice fenologico PPI di Sentinel-2). Copernicus HR-VPP, 10 m, una mappa all'anno (2017–2024)." },
    en: { name: "Start of season", desc: "Date when vegetation starts growing in the year (from the Sentinel-2 Plant Phenology Index). Copernicus HR-VPP, 10 m, one map per year (2017–2024)." },
    source: "Copernicus Land Monitoring Service — HR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "hv_maxd", group: "hrvpp", type: "wms", wmsVersion: "1.1.1", wmsTime: "hrvpp", minZoom: 8, opacity: 0.75,
    wmsUrl: "https://phenology.vgt.vito.be/wms?", wmsLayers: "CLMS_HRVPP_VPP_MAXD_SEASON1_10M",
    legendHtml: "<p class='hint small'>Scala colori ufficiale CLMS. Prima stagione dell'anno scelto.</p>",
    it: { name: "Picco della stagione", desc: "Data del massimo vigore della vegetazione. Copernicus HR-VPP, 10 m, una mappa all'anno (2017–2024)." },
    en: { name: "Peak of season", desc: "Date of maximum vegetation vigour. Copernicus HR-VPP, 10 m, one map per year (2017–2024)." },
    source: "Copernicus Land Monitoring Service — HR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "hv_eosd", group: "hrvpp", type: "wms", wmsVersion: "1.1.1", wmsTime: "hrvpp", minZoom: 8, opacity: 0.75,
    wmsUrl: "https://phenology.vgt.vito.be/wms?", wmsLayers: "CLMS_HRVPP_VPP_EOSD_SEASON1_10M",
    legendHtml: "<p class='hint small'>Scala colori ufficiale CLMS. Prima stagione dell'anno scelto.</p>",
    it: { name: "Fine della stagione vegetativa", desc: "Data in cui la stagione vegetativa finisce (raccolta, senescenza). Copernicus HR-VPP, 10 m, una mappa all'anno (2017–2024)." },
    en: { name: "End of season", desc: "Date when the growing season ends (harvest, senescence). Copernicus HR-VPP, 10 m, one map per year (2017–2024)." },
    source: "Copernicus Land Monitoring Service — HR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "hv_length", group: "hrvpp", type: "wms", wmsVersion: "1.1.1", wmsTime: "hrvpp", minZoom: 8, opacity: 0.75,
    wmsUrl: "https://phenology.vgt.vito.be/wms?", wmsLayers: "CLMS_HRVPP_VPP_LENGTH_SEASON1_10M",
    legendHtml: "<p class='hint small'>Scala colori ufficiale CLMS. Prima stagione dell'anno scelto.</p>",
    it: { name: "Durata della stagione", desc: "Giorni tra inizio e fine della stagione vegetativa. Copernicus HR-VPP, 10 m, una mappa all'anno (2017–2024)." },
    en: { name: "Season length", desc: "Days between start and end of the growing season. Copernicus HR-VPP, 10 m, one map per year (2017–2024)." },
    source: "Copernicus Land Monitoring Service — HR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "hv_maxv", group: "hrvpp", type: "wms", wmsVersion: "1.1.1", wmsTime: "hrvpp", minZoom: 8, opacity: 0.75,
    wmsUrl: "https://phenology.vgt.vito.be/wms?", wmsLayers: "CLMS_HRVPP_VPP_MAXV_SEASON1_10M",
    legendHtml: "<p class='hint small'>Scala colori ufficiale CLMS. Prima stagione dell'anno scelto.</p>",
    it: { name: "Vigore massimo (PPI)", desc: "Valore massimo dell'indice fenologico PPI nella stagione. Copernicus HR-VPP, 10 m, una mappa all'anno (2017–2024)." },
    en: { name: "Maximum vigour (PPI)", desc: "Maximum Plant Phenology Index value in the season. Copernicus HR-VPP, 10 m, one map per year (2017–2024)." },
    source: "Copernicus Land Monitoring Service — HR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "hv_tprod", group: "hrvpp", type: "wms", wmsVersion: "1.1.1", wmsTime: "hrvpp", minZoom: 8, opacity: 0.75,
    wmsUrl: "https://phenology.vgt.vito.be/wms?", wmsLayers: "CLMS_HRVPP_VPP_TPROD_SEASON1_10M",
    legendHtml: "<p class='hint small'>Scala colori ufficiale CLMS. Prima stagione dell'anno scelto.</p>",
    it: { name: "Produttività totale", desc: "Somma del PPI giornaliero tra inizio e fine stagione: indicatore della biomassa prodotta. Copernicus HR-VPP, 10 m, una mappa all'anno (2017–2024)." },
    en: { name: "Total productivity", desc: "Sum of daily PPI between season start and end: proxy of biomass produced. Copernicus HR-VPP, 10 m, one map per year (2017–2024)." },
    source: "Copernicus Land Monitoring Service — HR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  // ---------------- SUOLO / SOIL ----------------
  {
    id: "sg_clay", group: "soil", type: "wms", minZoom: 5, opacity: 0.7,
    wmsUrl: "https://maps.isric.org/mapserv?map=/map/clay.map", wmsLayers: "clay_0-5cm_mean",
    it: { name: "Argilla 0–5 cm", desc: "Contenuto di argilla (g/kg) dello strato superficiale. Stima ISRIC SoilGrids 2.0 a 250 m." },
    en: { name: "Clay 0–5 cm", desc: "Clay content (g/kg) of the topsoil. ISRIC SoilGrids 2.0 estimate at 250 m." },
    source: "ISRIC SoilGrids 2.0 — CC BY 4.0", link: "https://soilgrids.org",
  },
  {
    id: "sg_sand", group: "soil", type: "wms", minZoom: 5, opacity: 0.7,
    wmsUrl: "https://maps.isric.org/mapserv?map=/map/sand.map", wmsLayers: "sand_0-5cm_mean",
    it: { name: "Sabbia 0–5 cm", desc: "Contenuto di sabbia (g/kg). Stima ISRIC SoilGrids 2.0 a 250 m." },
    en: { name: "Sand 0–5 cm", desc: "Sand content (g/kg). ISRIC SoilGrids 2.0 estimate at 250 m." },
    source: "ISRIC SoilGrids 2.0 — CC BY 4.0", link: "https://soilgrids.org",
  },
  {
    id: "sg_soc", group: "soil", type: "wms", minZoom: 5, opacity: 0.7,
    wmsUrl: "https://maps.isric.org/mapserv?map=/map/soc.map", wmsLayers: "soc_0-5cm_mean",
    it: { name: "Carbonio organico 0–5 cm", desc: "Carbonio organico del suolo (dg/kg). Stima ISRIC SoilGrids 2.0 a 250 m." },
    en: { name: "Organic carbon 0–5 cm", desc: "Soil organic carbon (dg/kg). ISRIC SoilGrids 2.0 estimate at 250 m." },
    source: "ISRIC SoilGrids 2.0 — CC BY 4.0", link: "https://soilgrids.org",
  },
  {
    id: "sg_nitrogen", group: "soil", type: "wms", minZoom: 5, opacity: 0.7,
    wmsUrl: "https://maps.isric.org/mapserv?map=/map/nitrogen.map", wmsLayers: "nitrogen_0-5cm_mean",
    it: { name: "Azoto totale 0–5 cm", desc: "Azoto totale (cg/kg). Stima ISRIC SoilGrids 2.0 a 250 m." },
    en: { name: "Total nitrogen 0–5 cm", desc: "Total nitrogen (cg/kg). ISRIC SoilGrids 2.0 estimate at 250 m." },
    source: "ISRIC SoilGrids 2.0 — CC BY 4.0", link: "https://soilgrids.org",
  },
  {
    id: "sg_phh2o", group: "soil", type: "wms", minZoom: 5, opacity: 0.7,
    wmsUrl: "https://maps.isric.org/mapserv?map=/map/phh2o.map", wmsLayers: "phh2o_0-5cm_mean",
    it: { name: "pH 0–5 cm", desc: "pH in acqua (×10). Stima ISRIC SoilGrids 2.0 a 250 m." },
    en: { name: "pH 0–5 cm", desc: "pH in water (×10). ISRIC SoilGrids 2.0 estimate at 250 m." },
    source: "ISRIC SoilGrids 2.0 — CC BY 4.0", link: "https://soilgrids.org",
  },
  {
    id: "sg_cec", group: "soil", type: "wms", minZoom: 5, opacity: 0.7,
    wmsUrl: "https://maps.isric.org/mapserv?map=/map/cec.map", wmsLayers: "cec_0-5cm_mean",
    it: { name: "Capacità di scambio cationico 0–5 cm", desc: "CSC (mmol(c)/kg). Stima ISRIC SoilGrids 2.0 a 250 m." },
    en: { name: "Cation exchange capacity 0–5 cm", desc: "CEC (mmol(c)/kg). ISRIC SoilGrids 2.0 estimate at 250 m." },
    source: "ISRIC SoilGrids 2.0 — CC BY 4.0", link: "https://soilgrids.org",
  },
  // ---------------- TEMPO REALE / REAL TIME ----------------
  {
    id: "s2_rgb", group: "live", type: "s2live", minZoom: 10, opacity: 1,
    render: "&assets=visual&asset_bidx=visual%7C1%2C2%2C3",
    it: { name: "Colori naturali", desc: "L'immagine Sentinel-2 più recente senza nuvole, a 10 m. Si aggiorna ogni 2–5 giorni." },
    en: { name: "Natural colour", desc: "The most recent cloud-free Sentinel-2 image, 10 m. Updated every 2–5 days." },
    source: "Copernicus Sentinel-2 L2A · Microsoft Planetary Computer", link: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
  },
  {
    id: "s2_ndvi", group: "live", type: "s2live", minZoom: 10, opacity: 0.85, on: false,
    expr: "(B08-B04)/(B08+B04-2000)", rescale: "0,0.9", colormap: "rdylgn",
    legendHtml: '<div class="grad" style="background:linear-gradient(90deg,#a50026,#f46d43,#fee08b,#d9ef8b,#66bd63,#006837)"></div><div class="grad-l"><span>0</span><span>0,45</span><span>0,9</span></div>',
    it: { name: "NDVI — vigore della vegetazione", desc: "Indice di vegetazione: rosso suolo nudo, verde coltura vigorosa." },
    en: { name: "NDVI — vegetation vigour", desc: "Vegetation index: red bare soil, green vigorous crop." },
    source: "Copernicus Sentinel-2 L2A · Microsoft Planetary Computer", link: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
  },
  {
    id: "s2_ndre", group: "live", type: "s2live", minZoom: 10, opacity: 0.85,
    expr: "(B8A-B05)/(B8A+B05-2000)", rescale: "0,0.6", colormap: "rdylgn",
    legendHtml: '<div class="grad" style="background:linear-gradient(90deg,#a50026,#f46d43,#fee08b,#d9ef8b,#66bd63,#006837)"></div><div class="grad-l"><span>0</span><span>0,3</span><span>0,6</span></div>',
    it: { name: "NDRE — clorofilla e azoto", desc: "Usa la banda red-edge: più sensibile del NDVI su colture già sviluppate, utile per la concimazione azotata." },
    en: { name: "NDRE — chlorophyll and nitrogen", desc: "Uses the red-edge band: more sensitive than NDVI on developed crops, useful for nitrogen fertilisation." },
    source: "Copernicus Sentinel-2 L2A · Microsoft Planetary Computer", link: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
  },
  {
    id: "s2_ndmi", group: "live", type: "s2live", minZoom: 10, opacity: 0.85,
    expr: "(B8A-B11)/(B8A+B11-2000)", rescale: "-0.3,0.5", colormap: "rdbu",
    legendHtml: '<div class="grad" style="background:linear-gradient(90deg,#67001f,#d6604d,#fddbc7,#d1e5f0,#4393c3,#053061)"></div><div class="grad-l"><span>-0,3</span><span>0,1</span><span>0,5</span></div>',
    it: { name: "NDMI — acqua nella vegetazione", desc: "Contenuto d'acqua di foglie e suolo: valori bassi (rosso) segnalano stress idrico." },
    en: { name: "NDMI — vegetation water", desc: "Water content of leaves and soil: low values (red) flag water stress." },
    source: "Copernicus Sentinel-2 L2A · Microsoft Planetary Computer", link: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
  },
  {
    id: "s2_evi", group: "live", type: "s2live", minZoom: 10, opacity: 0.85,
    expr: "2.5*(B08-B04)/(B08+6*B04-7.5*B02+10500)", rescale: "0,0.8", colormap: "rdylgn",
    legendHtml: '<div class="grad" style="background:linear-gradient(90deg,#a50026,#f46d43,#fee08b,#d9ef8b,#66bd63,#006837)"></div><div class="grad-l"><span>0</span><span>0,4</span><span>0,8</span></div>',
    it: { name: "EVI — vegetazione densa", desc: "Come l'NDVI ma non si satura sulle colture molto sviluppate e corregge l'effetto dell'atmosfera." },
    en: { name: "EVI — dense vegetation", desc: "Like NDVI but does not saturate on well-developed crops and corrects for the atmosphere." },
    source: "Copernicus Sentinel-2 L2A · Microsoft Planetary Computer", link: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
  },
  {
    id: "s2_false", group: "live", type: "s2live", minZoom: 10, opacity: 1,
    render: "&assets=B08&assets=B04&assets=B03&rescale=1000,5000",
    it: { name: "Falsi colori (infrarosso)", desc: "Vicino infrarosso in rosso: la vegetazione sana appare rosso acceso, il suolo nudo grigio-azzurro." },
    en: { name: "False colour (infrared)", desc: "Near infrared as red: healthy vegetation looks bright red, bare soil grey-blue." },
    source: "Copernicus Sentinel-2 L2A · Microsoft Planetary Computer", link: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
  },

  // ---------------- COLTURE / CROPS ----------------
  {
    id: "cty", group: "fields", type: "cty", minZoom: 8, opacity: 0.85, on: true,
    it: { name: "Colture Copernicus (HRL Crop Types)", desc: "Coltura principale di ogni pixel di 10 m secondo Copernicus, anno per anno dal 2017 al 2024. Scegli l'anno qui sopra. Visibile da zoom 8." },
    en: { name: "Copernicus crops (HRL Crop Types)", desc: "Main crop of every 10 m pixel according to Copernicus, year by year from 2017 to 2024. Choose the year above. Visible from zoom 8." },
    source: "Copernicus Land Monitoring Service — HRL Croplands", link: "https://land.copernicus.eu/en/products/high-resolution-layer-croplands",
  },
  // ---------------- CATASTO ----------------
  {
    id: "cat_particelle", group: "catasto", type: "catasto",
    wmsLayers: "CP.CadastralParcel,codice_plla,fabbricati", hiRes: true,
    minZoom: 16, opacity: 1, on: true,
    it: { name: "Particelle catastali", desc: "Confini delle particelle e fabbricati della mappa catastale, visibili da zoom 16. Clicca su un punto e poi su “Leggi la particella” per comune, foglio e numero." },
    en: { name: "Cadastral parcels", desc: "Parcel boundaries and buildings from the Italian cadastral map, visible from zoom 16. Click a point, then “Read the parcel” for municipality, sheet and number." },
    source: "Agenzia delle Entrate — CC BY 4.0", link: "https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/consultazione-cartografia-catastale/servizio-consultazione-cartografia",
  },
  {
    id: "cat_fogli", group: "catasto", type: "catasto",
    wmsLayers: "CP.CadastralZoning",
    minZoom: 13, opacity: 1, on: true,
    it: { name: "Fogli di mappa", desc: "Limiti e numeri dei fogli di mappa catastali, visibili da zoom 13." },
    en: { name: "Cadastral sheets", desc: "Boundaries and numbers of cadastral map sheets, visible from zoom 13." },
    source: "Agenzia delle Entrate — CC BY 4.0", link: "https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/consultazione-cartografia-catastale/servizio-consultazione-cartografia",
  },

  // ---------------- LAND COVER ----------------
  {
    id: "clc2018", group: "landcover", type: "arcgis-map",
    url: EEA + "Corine/CLC2018_WM/MapServer", showLayers: "0,1", identifyLayers: "0",
    opacity: 0.6,
    it: { name: "CORINE Land Cover 2018", desc: "Copertura del suolo in 44 classi, unità minima 25 ha. Utile per una lettura d'insieme del territorio." },
    en: { name: "CORINE Land Cover 2018", desc: "Land cover in 44 classes, 25 ha minimum mapping unit. Good for an overview of the landscape." },
    source: "Copernicus Land Monitoring Service (EEA)", link: "https://land.copernicus.eu/en/products/corine-land-cover/clc2018",
  },
  {
    id: "clcplus2021", group: "landcover", type: "arcgis-image",
    url: EEA + "CLC_plus/CLMS_CLCplus_RASTER_2021_010m_eu/ImageServer",
    opacity: 0.7,
    it: { name: "CLC+ Backbone 2021 (10 m)", desc: "Copertura del suolo a 10 m in 11 classi, prodotta da serie temporali Sentinel-2. Più dettagliata di CORINE, utile per distinguere i campi." },
    en: { name: "CLC+ Backbone 2021 (10 m)", desc: "10 m land cover in 11 classes from Sentinel-2 time series. More detailed than CORINE, useful to separate fields." },
    source: "Copernicus Land Monitoring Service (EEA)", link: "https://land.copernicus.eu/en/products/clc-backbone",
  },
  {
    id: "clcplus2018", group: "landcover", type: "arcgis-image",
    url: EEA + "CLC_plus/CLMS_CLCplus_RASTER_2018_010m_eu/ImageServer",
    opacity: 0.7,
    it: { name: "CLC+ Backbone 2018 (10 m)", desc: "Come sopra, anno di riferimento 2018: confrontalo con il 2021 per vedere i cambiamenti." },
    en: { name: "CLC+ Backbone 2018 (10 m)", desc: "As above, reference year 2018: compare with 2021 to see changes." },
    source: "Copernicus Land Monitoring Service (EEA)", link: "https://land.copernicus.eu/en/products/clc-backbone",
  },

  // ---------------- TREES ----------------
  {
    id: "tcd2018", group: "trees", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer",
    opacity: 0.7,
    it: { name: "Densità copertura arborea 2018 (10 m)", desc: "Percentuale di chioma che copre il suolo (0–100 %). Include frutteti, oliveti e alberi isolati." },
    en: { name: "Tree cover density 2018 (10 m)", desc: "Share of ground covered by tree crowns (0–100 %). Includes orchards, olive groves and isolated trees." },
    source: "Copernicus HRL Forest", link: "https://land.copernicus.eu/en/products/high-resolution-layer-tree-cover-density",
  },
  {
    id: "dlt2018", group: "trees", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_DominantLeafType2018/ImageServer",
    opacity: 0.7,
    it: { name: "Tipo di foglia dominante 2018", desc: "Latifoglie o conifere, pixel per pixel. Primo passo per capire che tipo di alberi ci sono." },
    en: { name: "Dominant leaf type 2018", desc: "Broadleaved or coniferous, per pixel. A first step to know which kind of trees are present." },
    source: "Copernicus HRL Forest", link: "https://land.copernicus.eu/en/products/high-resolution-layer-dominant-leaf-type",
  },
  {
    id: "fty2018", group: "trees", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_ForestType_2018/ImageServer",
    opacity: 0.7,
    it: { name: "Tipo di foresta 2018", desc: "Bosco di latifoglie o di conifere secondo la definizione FAO (esclude gli alberi agricoli e urbani)." },
    en: { name: "Forest type 2018", desc: "Broadleaved or coniferous forest following the FAO definition (agricultural and urban trees excluded)." },
    source: "Copernicus HRL Forest", link: "https://land.copernicus.eu/en/products/high-resolution-layer-forest-type",
  },
  {
    id: "swf2021", group: "trees", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_SmallWoodyFeatures_2021_005m/ImageServer",
    opacity: 0.85,
    it: { name: "Siepi e filari 2021 (5 m)", desc: "Elementi legnosi lineari e a macchia: siepi, filari, boschetti. Importanti per biodiversità e crediti di carbonio." },
    en: { name: "Small woody features 2021 (5 m)", desc: "Linear and patchy woody features: hedgerows, tree lines, copses. Relevant for biodiversity and carbon credits." },
    source: "Copernicus HRL Small Woody Features", link: "https://land.copernicus.eu/en/products/high-resolution-layer-small-woody-features",
  },
  {
    id: "wvl2021", group: "trees", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_WoodyVegetationLayer_2021/ImageServer",
    opacity: 0.7,
    it: { name: "Vegetazione legnosa 2021", desc: "Tutta la vegetazione legnosa (alberi e arbusti), dentro e fuori dal bosco." },
    en: { name: "Woody vegetation 2021", desc: "All woody vegetation (trees and shrubs), inside and outside forests." },
    source: "Copernicus HRL Small Woody Features", link: "https://land.copernicus.eu/en/products/high-resolution-layer-small-woody-features",
  },

  // ---------------- AGRICULTURE ----------------
  {
    id: "grass2018", group: "agri", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_Grassland_2018/ImageServer",
    opacity: 0.7,
    it: { name: "Prati e pascoli 2018", desc: "Superfici a prato e pascolo permanente distinte dai seminativi." },
    en: { name: "Grassland 2018", desc: "Permanent grassland and pasture, separated from arable land." },
    source: "Copernicus HRL Grassland", link: "https://land.copernicus.eu/en/products/high-resolution-layer-grassland",
  },
  {
    id: "plough2015", group: "agri", type: "arcgis-map",
    url: EEA + "GioLandPublic/HRL_PloughingIndicator_2015/MapServer", showLayers: "0", identifyLayers: "0",
    opacity: 0.7,
    it: { name: "Indicatore di aratura 2015", desc: "Quante volte una superficie a prato è stata arata negli anni precedenti: distingue prati permanenti da rotazioni." },
    en: { name: "Ploughing indicator 2015", desc: "How often grassland was ploughed in previous years: separates permanent grassland from rotations." },
    source: "Copernicus HRL Grassland", link: "https://land.copernicus.eu/en/products/high-resolution-layer-grassland",
  },

  // ---------------- PHENOLOGY ----------------
  {
    id: "sos", group: "pheno", type: "arcgis-image",
    url: EEA + "MR_VPP/Start_of_season_2000_2019/ImageServer",
    opacity: 0.7,
    it: { name: "Inizio stagione vegetativa", desc: "Giorno dell'anno in cui la vegetazione inizia a crescere (media 2000–2019, MODIS 500 m)." },
    en: { name: "Start of growing season", desc: "Day of year when vegetation starts growing (2000–2019, MODIS 500 m)." },
    source: "Copernicus MR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "eos", group: "pheno", type: "arcgis-image",
    url: EEA + "MR_VPP/End_of_season_2000_2019/ImageServer",
    opacity: 0.7,
    it: { name: "Fine stagione vegetativa", desc: "Giorno dell'anno in cui termina la stagione vegetativa." },
    en: { name: "End of growing season", desc: "Day of year when the growing season ends." },
    source: "Copernicus MR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "los", group: "pheno", type: "arcgis-image",
    url: EEA + "MR_VPP/Length_of_season_2000_2019/ImageServer",
    opacity: 0.7,
    it: { name: "Durata stagione vegetativa", desc: "Numero di giorni della stagione vegetativa." },
    en: { name: "Length of growing season", desc: "Number of days of the growing season." },
    source: "Copernicus MR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "prod", group: "pheno", type: "arcgis-image",
    url: EEA + "MR_VPP/Large_integral_productivity_2000_2019/ImageServer",
    opacity: 0.7,
    it: { name: "Produttività vegetale", desc: "Integrale stagionale dell'indice di vegetazione: una misura indiretta di quanta biomassa produce il suolo." },
    en: { name: "Vegetation productivity", desc: "Seasonal integral of the vegetation index: an indirect measure of how much biomass the land produces." },
    source: "Copernicus MR-VPP", link: "https://land.copernicus.eu/en/products/vegetation",
  },
  {
    id: "lpd", group: "pheno", type: "arcgis-map",
    url: EEA + "Land_Productivity/LINT0016trdR/MapServer", showLayers: "0", identifyLayers: "0",
    opacity: 0.7,
    it: { name: "Tendenza produttività 2000–2016", desc: "Dove la produttività del suolo cresce o cala nel tempo: segnale di degrado o di miglioramento." },
    en: { name: "Productivity trend 2000–2016", desc: "Where land productivity rises or falls over time: a sign of degradation or improvement." },
    source: "Copernicus / EEA", link: "https://www.eea.europa.eu/en/analysis/indicators",
  },

  // ---------------- WATER ----------------
  {
    id: "waw2018", group: "water", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_WaterWetness_2018/ImageServer",
    opacity: 0.7,
    it: { name: "Acqua e umidità 2018", desc: "Superfici con acqua permanente o temporanea e zone umide: utile per ristagni e drenaggio." },
    en: { name: "Water and wetness 2018", desc: "Permanent and temporary water and wet areas: useful for waterlogging and drainage." },
    source: "Copernicus HRL Water & Wetness", link: "https://land.copernicus.eu/en/products/high-resolution-layer-water-wetness",
  },
  {
    id: "imp2018", group: "water", type: "arcgis-image",
    url: EEA + "GioLandPublic/HRL_ImperviousnessDensity_2018/ImageServer",
    opacity: 0.7,
    it: { name: "Suolo impermeabilizzato 2018", desc: "Percentuale di suolo coperto da edifici, strade e superfici artificiali." },
    en: { name: "Imperviousness 2018", desc: "Share of soil sealed by buildings, roads and artificial surfaces." },
    source: "Copernicus HRL Imperviousness", link: "https://land.copernicus.eu/en/products/high-resolution-layer-imperviousness",
  },
  {
    id: "rivers", group: "water", type: "arcgis-map",
    url: EEA + "EUHydro/EUHydro_RiverNetworkDatabase/MapServer", showLayers: "", identifyLayers: "",
    opacity: 0.9,
    it: { name: "Reticolo idrografico (EU-Hydro)", desc: "Fiumi, canali e corpi idrici. Utile per irrigazione e vincoli." },
    en: { name: "River network (EU-Hydro)", desc: "Rivers, canals and water bodies. Useful for irrigation and constraints." },
    source: "Copernicus EU-Hydro", link: "https://land.copernicus.eu/en/products/eu-hydro",
  },

  // ---------------- NATURE ----------------
  {
    id: "n2k2018", group: "nature", type: "arcgis-map",
    url: EEA + "Natura2000/N2K_2018/MapServer", showLayers: "", identifyLayers: "",
    opacity: 0.6,
    it: { name: "Natura 2000 — uso del suolo 2018", desc: "Copertura del suolo dentro i siti Natura 2000: i campi in queste aree possono avere vincoli e premi PAC specifici." },
    en: { name: "Natura 2000 — land cover 2018", desc: "Land cover inside Natura 2000 sites: fields here can have specific CAP constraints and payments." },
    source: "Copernicus N2K", link: "https://land.copernicus.eu/en/products/n2k",
  },
  {
    id: "riparian2018", group: "nature", type: "arcgis-map",
    url: EEA + "RiparianZones/RZ_2018/MapServer", showLayers: "", identifyLayers: "",
    opacity: 0.6,
    it: { name: "Zone ripariali 2018", desc: "Copertura del suolo lungo i corsi d'acqua." },
    en: { name: "Riparian zones 2018", desc: "Land cover along watercourses." },
    source: "Copernicus Riparian Zones", link: "https://land.copernicus.eu/en/products/riparian-zones",
  },
  {
    id: "lucas2018", group: "nature", type: "arcgis-map",
    url: EEA + "LUCAS/LUCAS_2018/MapServer", showLayers: "", identifyLayers: "",
    opacity: 1,
    it: { name: "Punti LUCAS 2018", desc: "Punti dell'indagine europea LUCAS su uso e copertura del suolo, con foto a terra. Un sottoinsieme ha anche analisi del suolo." },
    en: { name: "LUCAS 2018 points", desc: "Points of the EU LUCAS land use / land cover survey, with ground photos. A subset also has soil analyses." },
    source: "Eurostat / JRC", link: "https://esdac.jrc.ec.europa.eu/projects/lucas",
  },
];
