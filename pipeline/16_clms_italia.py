# 16 — Variabili biogeofisiche Copernicus (CLMS) ritagliate sull'Italia, per la mappa e la scheda campo
#
# Prodotti (catalogo Copernicus Data Space, collezione CLMS, versioni COG):
#   LAI, FAPAR, FCOVER (300 m, Sentinel-3 OLCI, ogni 10 giorni)     NDVI 300 m (ogni 10 giorni)
#   GDMP 300 m (produttività lorda di sostanza secca, kg/ha/giorno)  SWI (indice di umidità del suolo, 0,1°, ASCAT)
#   SSM 1 km (umidità superficiale del suolo da Sentinel-1, Europa)
# Per ogni decade degli ultimi MESI mesi si legge solo la finestra Italia (letture parziali HTTP col token CDSE),
# si applicano scala e offset e si salva un COG float32 (nullo -9999). I file già presenti su Hugging Face si saltano.
# Uscita: data/clms/<PRODOTTO>/<AAAA-MM-GG>.tif

import os
import time
import requests
import pandas as pd
import rasterio
from rasterio.windows import from_bounds
from huggingface_hub import HfApi

PRODOTTO = os.environ.get("PRODOTTO", "LAI")
MESI = int(os.environ.get("MESI", "14"))
CAT = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
ITALIA = (6.5, 35.4, 18.6, 47.1)
CFG = {   # filtro sul nome del prodotto, parola chiave del file da leggere
    "LAI": ("c_gls_LAI300-RT", "-LAI-"), "FAPAR": ("c_gls_FAPAR300-RT", "-FAPAR-"), "FCOVER": ("c_gls_FCOVER300-RT", "-FCOVER-"),
    "NDVI": ("c_gls_NDVI300_", "NDVI"), "GDMP": ("c_gls_GDMP300-RT", "-GDMP-"), "SWI": ("c_gls_SWI_", "SWI010"), "SSM": ("c_gls_SSM1km_", "SSM"),
}
ESCLUDI = ("QFLAG", "RMSE", "NOBS", "LAFTER", "LBEFORE", "LENGTH", "NOISE", "STD", "FLAG", "UNC")
filtro, chiave = CFG[PRODOTTO]
OUT = os.path.join("data", "clms", PRODOTTO)
os.makedirs(OUT, exist_ok=True)
api = HfApi(token=os.environ["HF_TOKEN"])
presenti = {f.split("/")[-1][:10] for f in api.list_repo_files(os.environ["HF_DATA_REPO"], repo_type="dataset") if f.startswith(f"clms/{PRODOTTO}/")}


def token():
    r = requests.post(TOKEN_URL, data={"grant_type": "password", "username": os.environ["CDSE_USERNAME"], "password": os.environ["CDSE_PASSWORD"],
                                       "client_id": "cdse-public"}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]


# ---- prodotti COG degli ultimi MESI mesi, uno per decade (la versione più consolidata: RT6 > RT2 > RT1 > RT0)
inizio = (pd.Timestamp.now() - pd.DateOffset(months=MESI)).strftime("%Y-%m-%d")
url = (f"{CAT}?$filter=Collection/Name eq 'CLMS' and contains(Name,'{filtro}') and contains(Name,'_cog') and "
       f"ContentDate/Start ge {inizio}T00:00:00.000Z&$orderby=ContentDate/Start asc&$top=1000")
prodotti = []
while url:
    j = requests.get(url, timeout=120).json()
    prodotti += j.get("value", [])
    url = j.get("@odata.nextLink")
per_dec = {}
for p in prodotti:
    d = pd.Timestamp(p["ContentDate"]["Start"][:10])
    if PRODOTTO == "SSM" and "CEURO" not in p["Name"]:
        continue
    dec = d.replace(day=1 if d.day < 11 else 11 if d.day < 21 else 21).strftime("%Y-%m-%d")
    rt = int(p["Name"].split("-RT")[1][0]) if "-RT" in p["Name"] else 0
    if dec not in per_dec or rt > per_dec[dec][0]:
        per_dec[dec] = (rt, p)
forza = PRODOTTO in os.environ.get("FORZA", "").split(",")          # rielabora anche i file già presenti
da_fare = [(d, v[1]) for d, v in sorted(per_dec.items()) if forza or d not in presenti]
print(PRODOTTO, len(prodotti), "prodotti,", len(per_dec), "decadi,", len(da_fare), "da elaborare", flush=True)

tok, t_tok = token(), time.time()
for dec, p in da_fare:
    if time.time() - t_tok > 400:
        tok, t_tok = token(), time.time()
    base = f"https://download.dataspace.copernicus.eu/odata/v1/Products({p['Id']})/Nodes({p['Name']})"
    try:
        nodi = requests.get(base + "/Nodes", headers={"Authorization": f"Bearer {tok}"}, timeout=120).json()
        nomi = [n["Name"] for n in nodi.get("result", nodi.get("value", []))]
        tif = [n for n in nomi if n.lower().endswith((".tif", ".tiff")) and chiave.upper() in n.upper() and not any(e in n.upper() for e in ESCLUDI)]
        if not tif:
            tif = [n for n in nomi if n.lower().endswith((".tif", ".tiff")) and not any(e in n.upper() for e in ESCLUDI)]
        if not tif:
            print(dec, "nessun GeoTIFF fra", nomi[:8]); continue
        href = f"{base}/Nodes({tif[0]})/$value"
        with rasterio.Env(GDAL_HTTP_HEADERS=f"Authorization: Bearer {tok}", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                          CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff,$value", GDAL_HTTP_MAX_RETRY=4, GDAL_HTTP_RETRY_DELAY=5):
            with rasterio.open("/vsicurl/" + href) as ds:
                win = from_bounds(*ITALIA, ds.transform).round_offsets().round_lengths()
                a = ds.read(1, window=win, masked=True).astype("float32")
                sc, of = ds.scales[0] or 1.0, ds.offsets[0] or 0.0
                prof = ds.profile.copy(); tr = ds.window_transform(win)
        a = a * sc + of
        prof.update(driver="COG", width=a.shape[1], height=a.shape[0], transform=tr, dtype="float32", nodata=-9999, compress="deflate", count=1)
        for k in ("blockxsize", "blockysize", "tiled", "interleave"):
            prof.pop(k, None)
        with rasterio.open(os.path.join(OUT, f"{dec}.tif"), "w", **prof) as o:
            o.write(a.filled(-9999), 1)
        print(f"{dec} {tif[0]}: media Italia {float(a.mean()):.3f}", flush=True)
    except Exception as e:
        print(dec, "errore", str(e)[:200], flush=True)
