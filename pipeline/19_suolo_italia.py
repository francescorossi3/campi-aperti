# Columella — 19: mappe del suolo per l'Italia da ISRIC SoilGrids 2.0 (CC BY 4.0), strato 0–30 cm, in COG EPSG:4326 (~250 m)
#
# Si leggono via HTTP solo le finestre sull'Italia dei VRT pubblici di SoilGrids (proiezione Homolosine), si
# riproiettano su una griglia geografica e si fa la media pesata degli strati 0–5, 5–15, 15–30 cm (pesi 5, 10, 15).
# Uscite (data/suolo/): argilla, sabbia, limo (%), soc (g/kg), azoto (g/kg), ph, densita (kg/dm³),
#   tessitura (classi USDA 1..12), stock_soc (t C/ha nei primi 30 cm, al netto dello scheletro)
# Ingressi: VRT pubblici ISRIC via HTTP (nessuna credenziale)
# Esecuzione: workflow suolo.yml (poi hf_sync.py carica "suolo") oppure Spyder
# EN: SoilGrids 2.0 soil maps for Italy (0–30 cm weighted mean) as EPSG:4326 COGs, plus USDA texture and SOC stock.
import os
import numpy as np
import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.transform import from_origin

B = "/vsicurl/https://files.isric.org/soilgrids/latest/data"
W0, S0, E0, N0, R = 6.5, 35.4, 18.6, 47.2, 0.0025
W, H = int(round((E0 - W0) / R)), int(round((N0 - S0) / R))
TR = from_origin(W0, N0, R, R)
OUT = os.path.join("data", "suolo")
os.makedirs(OUT, exist_ok=True)
STRATI = [("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15)]
FATT = {"clay": 10, "sand": 10, "silt": 10, "soc": 10, "nitrogen": 100, "phh2o": 10, "bdod": 100, "cfvo": 10}   # -> %, g/kg, pH, kg/dm³, %vol

def leggi(prop):
    tot, pesi = np.zeros((H, W), "float64"), np.zeros((H, W), "float64")
    for s, p in STRATI:
        with rasterio.Env(GDAL_HTTP_MAX_RETRY=5, GDAL_HTTP_RETRY_DELAY=10, GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
            with rasterio.open(f"{B}/{prop}/{prop}_{s}_mean.vrt") as src:
                with WarpedVRT(src, crs="EPSG:4326", transform=TR, width=W, height=H, resampling=Resampling.average) as v:
                    a = v.read(1).astype("float64")
                    nd = src.nodata
        ok = (a != nd) & (a > 0)
        tot[ok] += a[ok] * p
        pesi[ok] += p
        print(prop, s, "letto", flush=True)
    out = np.where(pesi > 0, tot / np.maximum(pesi, 1) / FATT[prop], np.nan)
    return out.astype("float32")

def salva(nome, a, dtype="float32", nodata=-9999):
    prof = dict(driver="COG", width=W, height=H, count=1, dtype=dtype, crs="EPSG:4326", transform=TR, nodata=nodata, compress="deflate",
                overview_resampling="average" if dtype == "float32" else "nearest")
    with rasterio.open(os.path.join(OUT, f"{nome}.tif"), "w", **prof) as o:
        o.write(np.where(np.isfinite(a), a, nodata).astype(dtype), 1)
    print("salvato", nome, flush=True)

V = {k: leggi(k) for k in ["clay", "sand", "silt", "soc", "nitrogen", "phh2o", "bdod", "cfvo"]}
for k, n in [("clay", "argilla"), ("sand", "sabbia"), ("silt", "limo"), ("soc", "soc"), ("nitrogen", "azoto"), ("phh2o", "ph"), ("bdod", "densita")]:
    salva(n, V[k])
# stock di carbonio organico 0–30 cm: SOC (g/kg) × densità (kg/dm³ = t/m³) × 0,3 m × (1 − scheletro) × 10  -> t C/ha
stock = V["soc"] * V["bdod"] * 0.3 * (1 - np.nan_to_num(V["cfvo"]) / 100) * 10
salva("stock_soc", stock)
# classi tessiturali USDA (triangolo), 1..12
S, C = V["sand"], V["clay"]
Si = np.where(np.isfinite(V["silt"]), V["silt"], 100 - S - C)
cl = np.zeros(S.shape, "uint8")
regole = [  # (classe, condizione) nell'ordine del triangolo USDA
    (1, Si + 1.5 * C < 15), (2, (Si + 1.5 * C >= 15) & (Si + 2 * C < 30)),
    (3, ((C >= 7) & (C < 20) & (S > 52) & (Si + 2 * C >= 30)) | ((C < 7) & (Si < 50) & (Si + 2 * C >= 30))),
    (4, (C >= 7) & (C < 27) & (Si >= 28) & (Si < 50) & (S <= 52)),
    (5, ((Si >= 50) & (C >= 12) & (C < 27)) | ((Si >= 50) & (Si < 80) & (C < 12))), (6, (Si >= 80) & (C < 12)),
    (7, (C >= 20) & (C < 35) & (Si < 28) & (S > 45)), (8, (C >= 27) & (C < 40) & (S > 20) & (S <= 45)),
    (9, (C >= 27) & (C < 40) & (S <= 20)), (10, (C >= 35) & (S > 45)), (11, (C >= 40) & (Si >= 40)), (12, C >= 40)]
for k, cond in regole:
    cl[(cl == 0) & cond & np.isfinite(S) & np.isfinite(C)] = k
salva("tessitura", cl.astype("float32"), "uint8", 0)
