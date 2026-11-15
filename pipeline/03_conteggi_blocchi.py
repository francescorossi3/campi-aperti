# 03 — Superfici per coltura su blocchi di 1 km, con regione e cella meteo
#
# Legge il COG Crop Types di un anno a finestre e conta i pixel di ogni classe in blocchi di 100×100 pixel
# (1 km × 1 km). Ogni blocco riceve la regione ISTAT (dal centro del blocco) e la cella meteo 0,5°.
# Uscita: data/blocchi/blocchi_<anno>.parquet  colonne: x, y, lon, lat, regione, cella, c1..c19 (ettari)

import os
import io
import zipfile
import numpy as np
import pandas as pd
import requests
import rasterio
from rasterio.windows import Window
import geopandas as gpd
from pyproj import Transformer

ANNO = int(os.environ.get("ANNO", "2024"))
COG = os.environ.get("COG", os.path.join("data", "cog", f"cty_{ANNO}_italia_3035.tif"))
B = 100                      # pixel per lato del blocco (100 × 10 m = 1 km)
FIN = 50 * B                 # finestra di lettura: 5 km × 5 km
os.makedirs(os.path.join("data", "blocchi"), exist_ok=True)

# ---- 1. confini regionali ISTAT (generalizzati); riusa il file se già presente
REG = os.path.join("data", "istat", "regioni_3035.gpkg")
regioni = gpd.read_file(REG) if os.path.exists(REG) else None
for anno_ist in ((2025, 2024, 2023) if regioni is None else ()):
    url = f"https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzata/{anno_ist}/Limiti0101{anno_ist}_g.zip"
    try:
        r = requests.get(url, timeout=300)
        r.raise_for_status()
        z = zipfile.ZipFile(io.BytesIO(r.content))
        z.extractall(os.path.join("data", "istat"))
        shp = [n for n in z.namelist() if n.lower().endswith(".shp") and "/reg" in n.lower()][0]
        regioni = gpd.read_file(os.path.join("data", "istat", shp))
        print("confini ISTAT", anno_ist, len(regioni), "regioni")
        break
    except Exception as e:
        print("ISTAT", anno_ist, "non disponibile:", e)
regioni = regioni.to_crs(3035)[["COD_REG", "DEN_REG", "geometry"]]
os.makedirs(os.path.dirname(REG), exist_ok=True)
regioni.to_file(REG)

# ---- 2. lettura a finestre e conteggio per blocco
righe = []
with rasterio.open(COG) as ds:
    T = ds.transform
    for r0 in range(0, ds.height, FIN):
        for c0 in range(0, ds.width, FIN):
            h, w = min(FIN, ds.height - r0), min(FIN, ds.width - c0)
            a = ds.read(1, window=Window(c0, r0, w, h))
            if not ((a >= 1) & (a <= 19)).any():
                continue
            hb, wb = h // B, w // B
            if hb == 0 or wb == 0:
                continue
            a = a[: hb * B, : wb * B].reshape(hb, B, wb, B).transpose(0, 2, 1, 3).reshape(hb, wb, B * B)
            for i in range(hb):
                for j in range(wb):
                    v = a[i, j]
                    v = v[(v >= 1) & (v <= 19)]
                    if v.size == 0:
                        continue
                    cnt = np.bincount(v, minlength=20)
                    x = T.c + (c0 + (j + 0.5) * B) * T.a
                    y = T.f + (r0 + (i + 0.5) * B) * T.e
                    righe.append([x, y] + list(cnt[1:20]))
        print(f"  riga {r0}/{ds.height}  blocchi agricoli: {len(righe)}")

col = [f"c{k}" for k in range(1, 20)]
df = pd.DataFrame(righe, columns=["x", "y"] + col)
df[col] = df[col] * 0.01     # pixel da 100 m² -> ettari

# ---- 3. regione e cella meteo (0,5°) di ogni blocco
g = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.x, df.y), crs=3035)
g = gpd.sjoin(g, regioni, how="inner", predicate="within").drop(columns=["index_right"])
lon, lat = Transformer.from_crs(3035, 4326, always_xy=True).transform(g.x.values, g.y.values)
g["lon"], g["lat"] = lon, lat
g["cella"] = [f"{np.floor(la * 2) / 2 + 0.25:.2f}_{np.floor(lo * 2) / 2 + 0.25:.2f}" for la, lo in zip(lat, lon)]
out = pd.DataFrame(g.drop(columns="geometry"))
out = out.rename(columns={"COD_REG": "cod_reg", "DEN_REG": "regione"})
dest = os.path.join("data", "blocchi", f"blocchi_{ANNO}.parquet")
out.to_parquet(dest, index=False)
print(f"{ANNO}: {len(out)} blocchi, {out[col].sum().sum():,.0f} ha di colture -> {dest}")
