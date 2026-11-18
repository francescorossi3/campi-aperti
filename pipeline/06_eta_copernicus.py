# Columella — 06: evapotraspirazione reale Copernicus (CLMS ETA 300 m, Sentinel-3, decadale) per regione e coltura
#
# Prodotto: "Evapotranspiration 2025-present (raster 300 m), global, 10-daily" (CLMS), dal 1/11/2025.
# Variabili (mm/giorno, modello ENSEMBLE di TSEB-PT ed ETLook): ET reale, E evaporazione dal suolo,
# T traspirazione delle piante.
# Per ogni decade nuova: legge solo la finestra dell'Italia dai COG globali (letture parziali HTTP con token CDSE;
# se il server non le accetta scarica il file intero), poi fa la media pesata sugli ettari di ogni coltura
# usando i blocchi di 1 km dell'ultima mappa Crop Types disponibile.
#
# Uscite: data/eta/eta_decadi.parquet  (decade, giorni, regione, classe, et, e, t  in mm/giorno)
#         data/eta/italia/ETA300_<decade>_<var>.tif  (finestra Italia, per la scheda campo del sito)
# Ingressi: data/blocchi/blocchi_*.parquet (03); env CDSE_USERNAME, CDSE_PASSWORD, MAX_DECADI (def. 40)
# Esecuzione: workflow riepiloghi.yml (poi hf_sync.py carica "eta") oppure Spyder
# EN: Copernicus actual ET (300 m, 10-daily) averaged over crop hectares per region and crop.

import os
import glob
import time
import numpy as np
import pandas as pd
import requests
import rasterio
from rasterio.windows import from_bounds

UTENTE = os.environ["CDSE_USERNAME"]
PASSWORD = os.environ["CDSE_PASSWORD"]
CATALOGO = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
VARIABILI = ["ET-ENSEMBLE", "E-ENSEMBLE", "T-ENSEMBLE"]
ITALIA = (6.5, 35.4, 18.6, 47.1)   # lon/lat
CART = os.path.join("data", "eta")
os.makedirs(os.path.join(CART, "italia"), exist_ok=True)
DEST = os.path.join(CART, "eta_decadi.parquet")
MAX_DECADI = int(os.environ.get("MAX_DECADI", "40"))

def token_cdse():
    r = requests.post(TOKEN_URL, data={"grant_type": "password", "username": UTENTE, "password": PASSWORD,
                                       "client_id": "cdse-public"}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]

# ---- 1. blocchi colturali più recenti (dove stanno le colture)
ultimo = sorted(glob.glob(os.path.join("data", "blocchi", "blocchi_*.parquet")))[-1]
blocchi = pd.read_parquet(ultimo)
col = [f"c{k}" for k in range(1, 20)]
print("mappa colture di riferimento:", ultimo, len(blocchi), "blocchi")

# ---- 2. decadi disponibili e già elaborate
prodotti, url = [], f"{CATALOGO}?$filter=Collection/Name eq 'CLMS' and contains(Name,'ETA300_') and contains(Name,'GLOBE')&$orderby=ContentDate/Start asc&$top=200"
while url:
    j = requests.get(url, timeout=120).json()
    prodotti += j["value"]
    url = j.get("@odata.nextLink")
fatto = pd.read_parquet(DEST) if os.path.exists(DEST) else pd.DataFrame(columns=["decade"])
gia = set(fatto.decade.astype(str))
da_fare = [p for p in prodotti if p["ContentDate"]["Start"][:10] not in gia][:MAX_DECADI]
print(len(prodotti), "decadi nel catalogo,", len(da_fare), "da elaborare")

righe = []
tok, t_tok = token_cdse(), time.time()
for p in da_fare:
    dec = p["ContentDate"]["Start"][:10]
    d0 = pd.Timestamp(dec)
    giorni = 10 if d0.day < 21 else (d0 + pd.offsets.MonthEnd(0)).day - 20
    valori = {}
    for var in VARIABILI:
        if time.time() - t_tok > 480:
            tok, t_tok = token_cdse(), time.time()
        nome_tif = p["Name"].replace("ETA300_", f"ETA300_{var}_").replace("_cog", "") + ".tif"
        href = (f"https://download.dataspace.copernicus.eu/odata/v1/Products({p['Id']})/Nodes({p['Name']})"
                f"/Nodes({nome_tif})/$value")
        uscita = os.path.join(CART, "italia", f"ETA300_{dec}_{var}.tif")
        try:
            # lettura parziale (solo la finestra Italia) con il token nell'intestazione HTTP
            with rasterio.Env(GDAL_HTTP_HEADERS=f"Authorization: Bearer {tok}", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                              CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,$value", GDAL_HTTP_MAX_RETRY=4):
                ds = rasterio.open("/vsicurl/" + href)
                win = from_bounds(*ITALIA, ds.transform).round_offsets().round_lengths()
                a = ds.read(1, window=win, masked=True).astype("float32")
                prof = ds.profile.copy()
                scala, offs = ds.scales[0], ds.offsets[0]
                tr = ds.window_transform(win)
                ds.close()
        except Exception as e:
            print("  lettura parziale non riuscita, scarico il file intero:", str(e)[:120])
            loc = os.path.join(CART, "tmp.tif")
            with requests.get(href, headers={"Authorization": f"Bearer {tok}"}, stream=True, timeout=1800) as r:
                r.raise_for_status()
                with open(loc, "wb") as fh:
                    for blocco in r.iter_content(1 << 22):
                        fh.write(blocco)
            with rasterio.open(loc) as ds:
                win = from_bounds(*ITALIA, ds.transform).round_offsets().round_lengths()
                a = ds.read(1, window=win, masked=True).astype("float32")
                prof = ds.profile.copy()
                scala, offs = ds.scales[0], ds.offsets[0]
                tr = ds.window_transform(win)
            os.remove(loc)
        a = a * scala + offs                          # mm/giorno
        prof.update(width=a.shape[1], height=a.shape[0], transform=tr, dtype="float32", nodata=-9999, compress="deflate",
                    tiled=True, blockxsize=256, blockysize=256, driver="GTiff")
        with rasterio.open(uscita, "w", **prof) as o:
            o.write(a.filled(-9999), 1)
        valori[var] = (a, tr)
        print(f"  {dec} {var}: media Italia {float(a.mean()):.2f} mm/giorno")

    # ---- 3. media pesata sulle colture per regione (ogni blocco di 1 km prende il pixel ETa che lo contiene)
    a_et, tr = valori["ET-ENSEMBLE"]
    inv = ~tr
    cc, rr = inv * (blocchi.lon.values, blocchi.lat.values)
    rr, cc = np.floor(rr).astype(int), np.floor(cc).astype(int)
    ok = (rr >= 0) & (cc >= 0) & (rr < a_et.shape[0]) & (cc < a_et.shape[1])
    b = blocchi[ok].copy()
    for var, nome in zip(VARIABILI, ["et", "e", "t"]):
        arr = valori[var][0]
        v = arr[rr[ok], cc[ok]]
        b[nome] = np.where(np.ma.getmaskarray(v), np.nan, np.ma.getdata(v))
    lungo = b.melt(id_vars=["regione", "et", "e", "t"], value_vars=col, var_name="classe", value_name="ha")
    lungo = lungo[(lungo.ha > 0) & lungo.et.notna()]
    lungo["classe"] = lungo.classe.str[1:].astype(int)
    for regione, g in list(lungo.groupby("regione")) + [("Italia", lungo)]:
        for classe, gc in g.groupby("classe"):
            w = gc.ha.sum()
            righe.append([dec, giorni, regione, classe, (gc.et * gc.ha).sum() / w, (gc.e * gc.ha).sum() / w, (gc.t * gc.ha).sum() / w])

if righe:
    nuovo = pd.DataFrame(righe, columns=["decade", "giorni", "regione", "classe", "et", "e", "t"])
    tutto = pd.concat([fatto, nuovo], ignore_index=True) if len(fatto) else nuovo
    tutto.to_parquet(DEST, index=False)
    print("decadi totali:", tutto.decade.nunique())
