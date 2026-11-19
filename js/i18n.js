// Columella – i18n.js
// IT: testi dell'interfaccia in italiano e inglese e tabelle di supporto. Espone le costanti globali
//     I18N {it, en} (letta da t() in app.js) e CATALOG_EXTRA (dataset del catalogo, pannello Dati). Nessuna dipendenza.
// EN: UI strings (IT/EN) and lookup tables. Exposes I18N and CATALOG_EXTRA; no dependencies.
const I18N = {
  it: {
    cite_title: "Come citare Columella",
    cite_text: "Se usi Columella, i suoi dati o le sue mappe in una pubblicazione, una tesi o una presentazione, cita così:",
    cite_data: "Cita anche le fonti dei dati che usi (Copernicus, ESA, ISTAT, SoilGrids, ERA5/Open-Meteo…): sono indicate sotto ogni livello e nella sezione Dati.",
    cite_copy: "Copia", cite_copied: "Copiato",
    bm_none: "Nessuna", bm_gray: "Scala di grigi (luminosità)",
    cp_product: "Coltura dei campi da", cp_copernicus: "Mappa Copernicus HRL Crop Types (anno sotto)", cp_model: "Classificatore delle colture (3 reti neurali MLP addestrate sulle mappe Copernicus)",
    cp_season: "Annata a cui applicare il modello",
    cp_cop_note: "Per la mappa e per i campi rilevati si usa la mappa Copernicus dell'anno scelto (2017–2024).",
    cp_model_note: "Il modello riconosce la coltura dei campi selezionati nell'annata scelta (novembre–ottobre); i campi rilevati restano colorati con la mappa Copernicus.",
    lw_fields: "Campi selezionati", lw_nofields: "Nessun campo selezionato.", lw_veil: "Vela il resto della mappa", lw_zoom: "Vai",
    sec_community: "Mappe pubbliche", tab_maps: "Mappe", tab_fields: "Campi", tab_provinces: "Province",
    sec_selected: "Campi selezionati", sec_compare: "Confronto tra campi", sum_n_fields: "{n} campi",
    add_mode: "Aggiungi campi alla selezione (come Ctrl/Maiusc + clic)",
    multi_hint: "Clic su un campo: lo seleziona. Ctrl o Maiusc + clic: lo aggiunge con un nuovo id (C1, C2, …). Clic sull'id: lo mostra nel pannello; × lo toglie.",
    compare_empty: "Seleziona uno o più campi (Ctrl/Maiusc + clic) per confrontarli nel tempo e con il grafico a dispersione dei pixel.",
    det_view: "Rileva campi e colture nell'area visibile", det_draw: "… in un'area che disegno",
    det_big: "L'area visibile è troppo grande: avvicinati (al massimo circa 15 × 15 km) o disegna un'area.",
    lw_open: "Finestra dei livelli sulla mappa", lw_title: "Livelli accesi", lw_empty: "Nessun livello acceso: accendili dalla tab Mappe.",
    lw_up: "Sopra", lw_down: "Sotto", lw_hide: "Nascondi / mostra", lw_off: "Togli",
    sec_fields: "Ricerca e campi", sec_layers: "Livelli", sec_series: "Indici e serie temporali", sec_services: "Servizi",
    fields_hint: "Cerca un luogo in alto, poi clicca un campo sulla mappa oppure disegnalo.", series_empty: "Clicca un campo sulla mappa per vedere la mappa del campo e le serie temporali.",
    services_empty: "Con un campo selezionato qui trovi coltura, resa, suolo, carbonio e avvisi.",
    sum_on: "accesi: {n}", sum_field: "campo selezionato", sum_nofield: "nessun campo", info: "Informazioni",
    st_title: "Stile", st_ramp: "Scala di colori", st_range: "Minimo e massimo", st_r_default: "Predefiniti", st_r_minmax: "Min – max del campo",
    st_r_p2_98: "Percentili 2–98 % del campo", st_r_mean2sd: "Media ± 2 dev. std. del campo", st_r_manual: "Manuali",
    st_classes: "Classi", st_c_continuous: "Continue", st_c_equal: "Intervalli uguali", st_c_quantile: "Quantili", st_n: "Numero di classi",
    st_nodata: "Colore per nessun dato", st_field: "Campo", st_mean: "media", st_sd: "dev. std.",
    st_histo: "Istogramma dei valori del campo; le linee sono il minimo e il massimo della scala.",
    st_nofield: "Seleziona un campo per i limiti automatici e l'istogramma calcolati sui suoi valori.",
    st_limited: "Questo livello è colorato dal server: scegli scala, limiti manuali e trasparenza. Classi e istogramma sono nella mappa del campo (Indici e serie temporali).",
    title: "Columella",
    tagline: "Dati aperti per l'agricoltura italiana, gratis per agricoltori e ricercatori",
    tab_layers: "Layer",
    tab_info: "Punto",
    tab_data: "Dati",
    tab_regions: "Regioni",
    cty_year: "Anno della mappa colture:", hv_year: "Anno:", hv_date: "Data:", st_rev: "inverti", st_reset: "ripristina",
    tab_about: "Progetto",
    search_ph: "Cerca un comune, una località, un indirizzo o incolla coordinate…",
    search_none: "Nessun risultato in Italia.",
    basemap: "Mappa di base",
    bm_osm: "OpenStreetMap",
    bm_sat: "Satellite (Esri)",
    bm_hybrid: "Ibrida (satellite + nomi)",
    bm_s2: "Sentinel-2 senza nuvole 2023",
    bm_topo: "Topografica",
    opacity: "Opacità",
    zoom_in_to_see: "Ingrandisci per vederlo (zoom ≥ {z})",
    legend: "Legenda",
    source: "Fonte",
    more: "Scheda del dataset",
    data_intro: "Tutti i dataset aperti raccolti nel progetto. Quelli marcati “sulla mappa” si accendono dal pannello Layer; gli altri sono in arrivo.",
    on_map: "sulla mappa",
    coming: "in arrivo",
    archive: "archivio, non sulla mappa",
    about_html: `
      <p><b>Il nome.</b> Lucio Giunio Moderato <b>Columella</b> (I secolo d.C.) scrisse il <i>De re rustica</i>, il trattato di agricoltura più completo
      dell'antichità romana: terreni, colture, vite, olivo, alberi da frutto e allevamento. Fa parte di una famiglia di progetti con <b>Prognostica</b>
      (previsione meteo) e <b>Torricelli</b> (atmosfera e correzione atmosferica).</p>
      <p><b>Columella</b> raccoglie in un'unica mappa i dati aperti utili a chi coltiva e a chi fa ricerca: catasto, prodotti del <i>Copernicus Land Monitoring Service</i>, meteo e, nelle prossime versioni, rese agricole e servizi per gli agricoltori.</p>
      <p><b>Cosa puoi fare:</b> vedere le immagini Sentinel-2 più recenti (colori, NDVI, NDRE, NDMI), i confini reali dei campi e il catasto; cliccando un campo ottieni le serie temporali da San Martino, dal 1° gennaio o degli ultimi 12 mesi, con pioggia, temperatura, previsione a 7 giorni e radar Sentinel-1, e puoi scaricarle in CSV.</p>
      <p>Il sito è gratuito e senza registrazione (© 2026 Francesco Rossi: codice con tutti i diritti riservati, dati CC BY-NC 4.0). Tutti i dati vengono letti direttamente dai servizi ufficiali che li pubblicano: nulla passa da server privati.</p>
      <h4>Prossime versioni</h4>
      <ul>
        <li>Prodotti CLMS HR-VPP ufficiali (LAI, FAPAR, PPI a 10 m) e prodotti globali 300 m.</li>
        <li>Rese agricole ISTAT per provincia e coltura.</li>
        <li>Servizi: stima resa dell'olivo, frantoio più vicino, potenziale di crediti di carbonio, colture adatte al campo.</li>
        <li>Articoli di divulgazione scientifica su ogni dataset.</li>
      </ul>
      <h4>Avvertenza</h4>
      <p>La mappa catastale ha valore indicativo e non sostituisce le visure ufficiali. I layer Copernicus hanno risoluzione da 5 m a 500 m e anni di riferimento diversi.</p>`,
    credits: "Dati: Copernicus Sentinel-1/2 (via Microsoft Planetary Computer), Copernicus Land Monitoring Service / EEA, ERA5 Copernicus C3S (via Open-Meteo), Agenzia delle Entrate (CC BY 4.0), ISTAT, ISRIC SoilGrids (CC BY 4.0), OpenStreetMap, EOX, Esri. Confini dei campi: modello Delineate Anything S (Lavreniuk et al. 2025, AGPL-3.0).",
  },
  en: {
    cite_title: "How to cite Columella",
    cite_text: "If you use Columella, its data or its maps in a paper, a thesis or a presentation, please cite:",
    cite_data: "Please also cite the data sources you use (Copernicus, ESA, ISTAT, SoilGrids, ERA5/Open-Meteo…): they are listed under each layer and in the Data section.",
    cite_copy: "Copy", cite_copied: "Copied",
    bm_none: "None", bm_gray: "Greyscale (brightness)",
    cp_product: "Field crops from", cp_copernicus: "Copernicus HRL Crop Types map (year below)", cp_model: "Crop classifier (3 MLP neural networks trained on the Copernicus maps)",
    cp_season: "Season to apply the model to",
    cp_cop_note: "The map and the detected fields use the Copernicus map of the chosen year (2017–2024).",
    cp_model_note: "The model recognises the crop of the selected fields in the chosen season (November–October); detected fields stay coloured with the Copernicus map.",
    lw_fields: "Selected fields", lw_nofields: "No field selected.", lw_veil: "Dim the rest of the map", lw_zoom: "Go",
    sec_community: "Public maps", tab_maps: "Maps", tab_fields: "Fields", tab_provinces: "Provinces",
    sec_selected: "Selected fields", sec_compare: "Compare fields", sum_n_fields: "{n} fields",
    add_mode: "Add fields to the selection (like Ctrl/Shift + click)",
    multi_hint: "Click a field: it is selected. Ctrl or Shift + click: it is added with a new id (C1, C2, …). Click the id to show it in the panel; × removes it.",
    compare_empty: "Select one or more fields (Ctrl/Shift + click) to compare them over time and in the pixel scatter plot.",
    det_view: "Detect fields and crops in the visible area", det_draw: "… in an area I draw",
    det_big: "The visible area is too large: zoom in (about 15 × 15 km at most) or draw an area.",
    lw_open: "Layer window on the map", lw_title: "Layers on", lw_empty: "No layer on: switch them on from the Maps tab.",
    lw_up: "Up", lw_down: "Down", lw_hide: "Hide / show", lw_off: "Remove",
    sec_fields: "Search and fields", sec_layers: "Layers", sec_series: "Indices and time series", sec_services: "Services",
    fields_hint: "Search for a place above, then click a field on the map or draw it.", series_empty: "Click a field on the map to see its field map and time series.",
    services_empty: "With a field selected, crop, yield, soil, carbon and alerts appear here.",
    sum_on: "on: {n}", sum_field: "field selected", sum_nofield: "no field", info: "Information",
    st_title: "Style", st_ramp: "Colour ramp", st_range: "Minimum and maximum", st_r_default: "Default", st_r_minmax: "Field min – max",
    st_r_p2_98: "Field percentiles 2–98 %", st_r_mean2sd: "Field mean ± 2 std. dev.", st_r_manual: "Manual",
    st_classes: "Classes", st_c_continuous: "Continuous", st_c_equal: "Equal intervals", st_c_quantile: "Quantiles", st_n: "Number of classes",
    st_nodata: "No-data colour", st_field: "Field", st_mean: "mean", st_sd: "std. dev.",
    st_histo: "Histogram of the field values; the lines are the scale minimum and maximum.",
    st_nofield: "Select a field to compute automatic limits and the histogram from its values.",
    st_limited: "This layer is coloured by the server: choose the ramp, manual limits and opacity. Classes and histogram are in the field map (Indices and time series).",
    title: "Columella",
    tagline: "Open data for Italian agriculture, free for farmers and researchers",
    tab_layers: "Layers",
    tab_info: "Point",
    tab_data: "Data",
    tab_regions: "Regions",
    cty_year: "Crop map year:", hv_year: "Year:", hv_date: "Date:", st_rev: "reverse", st_reset: "reset",
    tab_about: "About",
    search_ph: "Search a town, place, address or paste coordinates…",
    search_none: "No results in Italy.",
    basemap: "Base map",
    bm_osm: "OpenStreetMap",
    bm_sat: "Satellite (Esri)",
    bm_hybrid: "Hybrid (satellite + labels)",
    bm_s2: "Sentinel-2 cloudless 2023",
    bm_topo: "Topographic",
    opacity: "Opacity",
    zoom_in_to_see: "Zoom in to see it (zoom ≥ {z})",
    legend: "Legend",
    source: "Source",
    more: "Dataset page",
    data_intro: "All open datasets gathered by the project. Those marked “on the map” can be switched on from the Layers panel; the others are coming.",
    on_map: "on the map",
    coming: "coming",
    archive: "archive, not on the map",
    about_html: `
      <p><b>The name.</b> Lucius Junius Moderatus <b>Columella</b> (1st century AD) wrote the <i>De re rustica</i>, the most complete treatise on
      agriculture of Roman antiquity: soils, crops, vines, olives, fruit trees and livestock. It belongs to a family of projects with <b>Prognostica</b>
      (weather forecast) and <b>Torricelli</b> (atmosphere and atmospheric correction).</p>
      <p><b>Columella</b> brings together on one map the open data useful to farmers and researchers: cadastre, <i>Copernicus Land Monitoring Service</i> products, weather and, in coming versions, crop yields and services for farmers.</p>
      <p><b>What you can do:</b> view the latest Sentinel-2 images (colour, NDVI, NDRE, NDMI), real field boundaries and the cadastre; clicking a field gives its time series since St Martin's Day, since 1 January or over the last 12 months, with rainfall, temperature, a 7-day forecast and Sentinel-1 radar, downloadable as CSV.</p>
      <p>The site is free and needs no sign-up (© 2026 Francesco Rossi: code all rights reserved, data CC BY-NC 4.0). All data are read directly from the official services that publish them: nothing goes through private servers.</p>
      <h4>Coming next</h4>
      <ul>
        <li>Official CLMS HR-VPP products (10 m LAI, FAPAR, PPI) and 300 m global products.</li>
        <li>ISTAT crop yields by province and crop.</li>
        <li>Services: olive yield estimate, nearest olive mill, carbon credit potential, crops suited to the field.</li>
        <li>Science outreach articles on every dataset.</li>
      </ul>
      <h4>Disclaimer</h4>
      <p>The cadastral map is indicative and does not replace official cadastral records. Copernicus layers range from 5 m to 500 m resolution and have different reference years.</p>`,
    credits: "Data: Copernicus Sentinel-1/2 (via Microsoft Planetary Computer), Copernicus Land Monitoring Service / EEA, ERA5 Copernicus C3S (via Open-Meteo), Agenzia delle Entrate (CC BY 4.0), ISTAT, ISRIC SoilGrids (CC BY 4.0), OpenStreetMap, EOX, Esri. Field boundaries: Delineate Anything S model (Lavreniuk et al. 2025, AGPL-3.0).",
  },
};

// Dataset del catalogo non ancora sulla mappa / Catalogue datasets not yet on the map
const CATALOG_EXTRA = [
  { it: "Rese agricole per provincia (ISTAT)", en: "Crop yields by province (ISTAT)",
    dit: "Superfici, produzione e resa delle principali colture, per provincia e anno.", den: "Area, production and yield of the main crops, by province and year.",
    link: "https://esploradati.istat.it/databrowser/#/it/dw/categories/IT1,Z1000AGR,1.0/AGR_CRP", status: "coming" },
  { it: "Meteo: pioggia e temperatura (Prognostica)", en: "Weather: rainfall and temperature (Prognostica)",
    dit: "Confronto tra provider meteo e modello GPR, dal progetto Prognostica.", den: "Comparison of weather providers and GPR model, from the Prognostica project.",
    link: "https://github.com/francescorossi3/meteo-accuracy", status: "coming" },
  { it: "Sentinel-1 RTC (radar)", en: "Sentinel-1 RTC (radar)",
    dit: "Retrodiffusione VV/VH ogni 2–6 giorni anche con le nuvole: nella scheda campo con il pulsante “radar”.", den: "VV/VH backscatter every 2–6 days even under clouds: in the field panel with the “radar” button.",
    link: "https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc", status: "on" },
  { it: "Meteo ERA5 / ERA5-Land + previsioni", en: "ERA5 / ERA5-Land weather + forecasts",
    dit: "Pioggia, temperatura ed evapotraspirazione giornaliere per ogni campo, dal 1940 a oggi più 7 giorni di previsione.", den: "Daily rainfall, temperature and evapotranspiration for every field, from 1940 to today plus a 7-day forecast.",
    link: "https://open-meteo.com/en/docs/historical-weather-api", status: "on" },
  { it: "HR-VPP — fenologia a 10 m", en: "HR-VPP — 10 m phenology",
    dit: "Prodotto CLMS ufficiale: NDVI, LAI, FAPAR e PPI giornalieri a 10 m in tempo quasi reale. Richiede un account gratuito Copernicus Data Space e un piccolo proxy: per ora gli indici equivalenti si calcolano direttamente da Sentinel-2.", den: "Official CLMS product: daily 10 m NDVI, LAI, FAPAR and PPI in near real time. Needs a free Copernicus Data Space account and a small proxy: for now equivalent indices are computed straight from Sentinel-2.",
    link: "https://land.copernicus.eu/en/products/vegetation", status: "coming" },
  { it: "Crop Types — tipi di coltura", en: "Crop Types",
    dit: "Mappa europea delle colture principali a 10 m (CLMS HRL Croplands).", den: "European 10 m map of main crop types (CLMS HRL Croplands).",
    link: "https://land.copernicus.eu/en/products/high-resolution-layer-croplands", status: "coming" },
  { it: "LUCAS Soil — analisi del suolo", en: "LUCAS Soil — soil analyses",
    dit: "Carbonio organico, tessitura, pH e nutrienti su migliaia di punti in Italia.", den: "Organic carbon, texture, pH and nutrients at thousands of points in Italy.",
    link: "https://esdac.jrc.ec.europa.eu/projects/lucas", status: "coming" },
  { it: "ERA5-Land", en: "ERA5-Land",
    dit: "Rianalisi climatica oraria a 9 km dal 1950: temperatura, pioggia, umidità del suolo.", den: "Hourly climate reanalysis at 9 km since 1950: temperature, rainfall, soil moisture.",
    link: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land", status: "coming" },
];
