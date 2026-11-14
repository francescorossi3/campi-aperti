// Catalogo dei layer / Layer catalogue
// type: "arcgis-map"   -> ArcGIS MapServer /export  (EEA discomap)
//       "arcgis-image" -> ArcGIS ImageServer /exportImage (EEA discomap)
//       "catasto"      -> WMS Agenzia delle Entrate (EPSG:4258)
// Per aggiungere un layer basta aggiungere un oggetto a questa lista.

const EEA = "https://image.discomap.eea.europa.eu/arcgis/rest/services/";
const CATASTO_WMS = "https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php";

const LAYER_GROUPS = [
  { id: "catasto", it: "Catasto (Agenzia delle Entrate)", en: "Cadastre (Italian Revenue Agency)" },
  { id: "landcover", it: "Copertura del suolo", en: "Land cover" },
  { id: "trees", it: "Alberi e foreste", en: "Trees and forests" },
  { id: "agri", it: "Agricoltura e prati", en: "Agriculture and grassland" },
  { id: "pheno", it: "Fenologia e produttività (2000–2019)", en: "Phenology and productivity (2000–2019)" },
  { id: "water", it: "Acqua e suolo impermeabile", en: "Water and sealed soil" },
  { id: "nature", it: "Aree protette e campionamenti", en: "Protected areas and surveys" },
];

const LAYERS = [
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
