# 08 — Dataset per il classificatore delle colture (un'annata alla volta)
#
# Per 24 zone agricole di 4×4 km sparse in Italia:
#   - immagini Sentinel-2 L2A serene dell'annata (novembre dell'anno prima → ottobre), via Planetary Computer,
#     ricampionate a 20 m: NDVI, NDMI, NDRE + maschera nuvole/ombre/neve (SCL) e foschia (AOT)
#   - mediane mensili per pixel (12 mesi × 3 indici = 36 variabili)
#   - etichetta: Copernicus HRL Crop Types dell'anno, solo dove la coltura è omogenea su 3×3 pixel da 10 m
#     (si evitano bordi e campi misti)
# Uscita: data/dataset/ds_<anno>.parquet

import os
import time
import numpy as np
import pandas as pd
import requests
import rasterio
from rasterio.windows import from_bounds
from scipy import ndimage
from pyproj import Transformer

ANNO = int(os.environ.get("ANNO", "2024"))
PC = "https://planetarycomputer.microsoft.com/api"
COG = f"https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/crop_types/cty_{ANNO}_italia_3035.tif"
RES = 20                                     # metri
LATO = 4000                                  # lato della zona in metri
MAX_DATE = 30
os.makedirs(os.path.join("data", "dataset"), exist_ok=True)

# zone agricole (lon, lat del centro) — pianura padana, centro, sud, isole; colture diverse
ZONE = [
    ("Lomellina risaie", 8.78, 45.20), ("Lodi mais", 9.55, 45.25), ("Mantova", 10.75, 45.10), ("Ferrara", 11.85, 44.80),
    ("Ravenna frutteti", 12.05, 44.35), ("Verona vigneti", 10.95, 45.45), ("Treviso prosecco", 12.25, 45.85), ("Friuli", 13.05, 45.95),
    ("Trentino meleti", 11.05, 46.30), ("Cuneo frutta", 7.55, 44.60), ("Langhe noccioleti", 8.10, 44.65), ("Val d'Orcia", 11.65, 43.05),
    ("Chianti", 11.30, 43.55), ("Marche", 13.45, 43.45), ("Fucino", 13.55, 42.00), ("Maccarese", 12.23, 41.86),
    ("Agro Pontino kiwi", 12.95, 41.48), ("Piana del Sele", 14.98, 40.55), ("Tavoliere grano", 15.55, 41.45), ("Bari olivi", 16.65, 41.05),
    ("Salento olivi", 18.15, 40.20), ("Metapontino", 16.75, 40.38), ("Piana di Sibari", 16.40, 39.70), ("Catania agrumi", 14.95, 37.40),
    ("Ragusa", 14.55, 36.85), ("Oristano", 8.60, 39.90),
]

to3035 = Transformer.from_crs(4326, 3035, always_xy=True)
to4326 = Transformer.from_crs(3035, 4326, always_xy=True)
EXPR = ";".join([
    "(B08-B04)/(B08+B04-2000)",                 # NDVI (offset L2A +1000)
    "(B8A-B11)/(B8A+B11-2000)",                 # NDMI
    "(B8A-B05)/(B8A+B05-2000)",                 # NDRE
    "((SCL==0)|(SCL==1)|(SCL==3)|(SCL==7)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==11)|(AOT>300))*1.0",
])
mesi = [(ANNO - 1, 11), (ANNO - 1, 12)] + [(ANNO, m) for m in range(1, 11)]
inizio, fine = f"{ANNO - 1}-11-01", f"{ANNO}-10-31"

parti = []
cog = rasterio.open(COG)
for nome, lon, lat in ZONE:
    t0 = time.time()
    cx, cy = to3035.transform(lon, lat)
    x0, y0, x1, y1 = cx - LATO / 2, cy - LATO / 2, cx + LATO / 2, cy + LATO / 2
    # ---- etichette Copernicus a 10 m, solo pixel omogenei 3×3
    win = from_bounds(x0, y0, x1, y1, cog.transform).round_offsets().round_lengths()
    lab = cog.read(1, window=win)
    omog = (ndimage.maximum_filter(lab, 3) == lab) & (ndimage.minimum_filter(lab, 3) == lab) & (lab >= 1) & (lab <= 19)
    # griglia 20 m: centri dei pixel in 3035 -> etichetta dal pixel 10 m corrispondente
    n = int(LATO / RES)
    xs = x0 + (np.arange(n) + 0.5) * RES
    ys = y1 - (np.arange(n) + 0.5) * RES
    XX, YY = np.meshgrid(xs, ys)
    tr = cog.window_transform(win)
    cc = ((XX - tr.c) / tr.a).astype(int).clip(0, lab.shape[1] - 1)
    rr = ((YY - tr.f) / tr.e).astype(int).clip(0, lab.shape[0] - 1)
    y_lab = np.where(omog[rr, cc], lab[rr, cc], 0)
    if (y_lab > 0).sum() < 200:
        print(nome, "poche colture omogenee, salto")
        continue
    # ---- immagini serene dell'annata
    lo0, la0 = to4326.transform(x0, y0)
    lo1, la1 = to4326.transform(x1, y1)
    bbox = [min(lo0, lo1), min(la0, la1), max(lo0, lo1), max(la0, la1)]
    body = {"collections": ["sentinel-2-l2a"], "bbox": bbox, "datetime": f"{inizio}T00:00:00Z/{fine}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": 40}}, "limit": 500}
    items = requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json().get("features", [])
    per_data = {}
    for it in sorted(items, key=lambda i: i["properties"]["eo:cloud_cover"]):
        per_data.setdefault(it["properties"]["datetime"][:10], it)
    date = sorted(per_data)
    if len(date) > MAX_DATE:                  # distribuite nell'annata
        idx = np.linspace(0, len(date) - 1, MAX_DATE).round().astype(int)
        date = [date[i] for i in sorted(set(idx))]
    cubo = {}                                 # data -> array (3, n, n) con NaN dove nuvoloso
    for d in date:
        it = per_data[d]
        # griglia di uscita esattamente in EPSG:3035, allineata alle etichette
        url = (f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=sentinel-2-l2a&item={it['id']}"
               f"&expression={requests.utils.quote(EXPR)}&asset_as_band=true&coord_crs=epsg:3035&dst_crs=epsg:3035"
               f"&width={n}&height={n}&resampling=average")
        for tentativo in range(3):
            try:
                r = requests.get(url, timeout=180)
                break
            except requests.RequestException:
                time.sleep(10)
        else:
            continue
        if r.status_code != 200:
            continue
        b = r.content
        hl = int.from_bytes(b[8:10], "little")
        hdr = b[10:10 + hl].decode()
        arr = np.frombuffer(b[10 + hl:], dtype="<f8" if "<f8" in hdr else "<f4").reshape(-1, n, n).astype("float32")
        val, nuv = arr[:3], arr[3]
        valido = (nuv < 0.5) & np.isfinite(val).all(0) & (np.abs(val) <= 1).all(0)
        if arr.shape[0] > 4:                  # banda maschera "outside" restituita da titiler
            valido &= arr[4] > 0
        val[:, ~valido] = np.nan
        if np.isfinite(val[0]).mean() > 0.2:
            cubo[d] = val
    if len(cubo) < 8:
        print(nome, "troppo poche date valide:", len(cubo))
        continue
    # ---- mediane mensili (12 mesi × 3 indici), mesi vuoti interpolati nel tempo
    feat = np.full((3, 12, n, n), np.nan, dtype="float32")
    for k, (a, m) in enumerate(mesi):
        sel = [v for d, v in cubo.items() if int(d[:4]) == a and int(d[5:7]) == m]
        if sel:
            with np.errstate(all="ignore"):
                feat[:, k] = np.nanmedian(np.stack(sel), axis=0)
    for i in range(3):                         # interpolazione lineare lungo i mesi
        f = feat[i].reshape(12, -1)
        ok = np.isfinite(f)
        for p in np.where(~ok.all(0) & (ok.sum(0) >= 4))[0]:
            g = ok[:, p]
            f[~g, p] = np.interp(np.where(~g)[0], np.where(g)[0], f[g, p])
    m = (y_lab > 0) & np.isfinite(feat).all((0, 1))
    X = feat[:, :, m].reshape(36, -1).T
    df = pd.DataFrame(X, columns=[f"{ix}_{k:02d}" for ix in ("ndvi", "ndmi", "ndre") for k in range(12)])
    df["classe"] = y_lab[m]
    df["zona"], df["anno"] = nome, ANNO
    parti.append(df)
    print(f"{nome}: {len(cubo)} date, {len(df)} pixel etichettati, {time.time() - t0:.0f} s")

ds = pd.concat(parti, ignore_index=True)
ds.to_parquet(os.path.join("data", "dataset", f"ds_{ANNO}.parquet"), index=False)
print(ANNO, len(ds), "esempi;", ds.classe.value_counts().to_dict())
