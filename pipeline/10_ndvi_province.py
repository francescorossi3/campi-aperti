# Columella — 10: NDVI medio per provincia × coltura × data (un'annata alla volta), per il confronto rese ISTAT / modello Monteith
#
# Per ogni tassello Sentinel-2 (MGRS) che copre l'Italia:
#   - immagini L2A dell'annata (novembre dell'anno prima → ottobre) con nuvolosità < 50%, al massimo 3 al mese
#   - NDVI e maschera nuvole/ombre/neve/foschia (SCL, AOT) ricampionati a 200 m in EPSG:3035
#   - pixel da 200 m "puri": almeno 80% della superficie con la stessa coltura nella mappa Copernicus Crop Types
#     (letta a 40 m, blocchi 5×5)
#   - per ogni provincia e coltura con almeno 15 pixel puri sereni: NDVI medio della data
# Ingressi: Microsoft Planetary Computer (STAC + data API, pubblici), COG Crop Types su Hugging Face,
#           province_istat.geojson; env ANNO (def. 2024)
# Uscita: data/province_ndvi/ndvi_<anno>.parquet (provincia, sigla, classe, data, ndvi, n, anno, anno_mappa)
# Esecuzione: workflow monteith.yml (poi hf_sync.py carica "province_ndvi") oppure Spyder
# EN: mean Sentinel-2 NDVI per province × crop × date over "pure" 200 m crop pixels.

import os
import time
import numpy as np
import pandas as pd
import requests
import rasterio
import geopandas as gpd
from rasterio import features
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
from rasterio.transform import from_origin
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor

ANNO = int(os.environ.get("ANNO", "2024"))
ANNO_MAPPA = min(ANNO, 2024)                 # le mappe Copernicus arrivano al 2024
PC = "https://planetarycomputer.microsoft.com/api"
COG = f"https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/crop_types/cty_{ANNO_MAPPA}_italia_3035.tif"
RES = 200
PURO = 0.8
MIN_PIX = 15
OUT = os.path.join("data", "province_ndvi")
os.makedirs(OUT, exist_ok=True)
inizio, fine = f"{ANNO - 1}-11-01", f"{ANNO}-10-31"

to3035 = Transformer.from_crs(4326, 3035, always_xy=True)
EXPR = ";".join([
    "(B08-B04)/(B08+B04-2000)",
    "((SCL==0)|(SCL==1)|(SCL==3)|(SCL==7)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==11)|(AOT>300))*1.0",
])

prov = gpd.read_file("province_istat.geojson").to_crs(3035)
prov["pid"] = np.arange(1, len(prov) + 1)
cog = rasterio.open(COG)

# ---- tasselli MGRS sull'Italia: una ricerca in una settimana estiva
tiles = {}
for bb in ([6.5, 43.5, 14.0, 47.1], [9.5, 39.5, 16.0, 43.8], [14.0, 36.5, 18.6, 42.3], [8.0, 38.8, 9.9, 41.3], [12.3, 36.6, 15.7, 38.4]):
    body = {"collections": ["sentinel-2-l2a"], "bbox": bb, "datetime": f"{ANNO}-07-01T00:00:00Z/{ANNO}-07-12T23:59:59Z", "limit": 500}
    for it in requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json().get("features", []):
        t = it["properties"]["s2:mgrs_tile"]
        if t not in tiles:
            lo0, la0, lo1, la1 = it["bbox"]
            xs, ys = to3035.transform([lo0, lo1, lo0, lo1], [la0, la0, la1, la1])
            tiles[t] = [np.floor(min(xs) / RES) * RES, np.floor(min(ys) / RES) * RES, np.ceil(max(xs) / RES) * RES, np.ceil(max(ys) / RES) * RES]
print(len(tiles), "tasselli")


def leggi_npy(url):
    for tentativo in range(4):
        try:
            r = requests.get(url, timeout=240)
            if r.status_code == 200:
                b = r.content
                hl = int.from_bytes(b[8:10], "little")
                hdr = b[10:10 + hl].decode()
                shape = eval(hdr.split("'shape':")[1].split(")")[0] + ")")
                return np.frombuffer(b[10 + hl:], dtype="<f8" if "<f8" in hdr else "<f4").reshape(shape).astype("float32")
            if r.status_code in (404, 422):
                return None
        except requests.RequestException:
            pass
        time.sleep(15 * (tentativo + 1))
    return None


righe = []
for k, (tile, (x0, y0, x1, y1)) in enumerate(sorted(tiles.items())):
    t0 = time.time()
    W, H = int((x1 - x0) / RES), int((y1 - y0) / RES)
    tr = from_origin(x0, y1, RES, RES)
    # province sulla griglia del tassello
    pid = features.rasterize([(g, i) for g, i in zip(prov.geometry, prov.pid)], out_shape=(H, W), transform=tr, fill=0, dtype="int16")
    if (pid > 0).mean() < 0.02:
        continue
    # colture a 40 m -> purezza su blocchi 5×5
    win = from_bounds(x0, y0, x1, y1, cog.transform)
    lab = cog.read(1, window=win, out_shape=(H * 5, W * 5), resampling=Resampling.nearest, boundless=True, fill_value=0)
    lab = lab.reshape(H, 5, W, 5).transpose(0, 2, 1, 3).reshape(H, W, 25)
    lab = np.where((lab >= 1) & (lab <= 19), lab, 0)
    cnt = np.stack([(lab == c).sum(-1) for c in range(20)], -1)
    cls = cnt.argmax(-1)
    puro = (cnt.max(-1) >= PURO * 25) & (cls > 0) & (pid > 0)
    if puro.sum() < MIN_PIX:
        continue
    grp = np.where(puro, pid.astype(np.int64) * 32 + cls, 0)
    gruppi, inv = np.unique(grp[puro], return_inverse=True)
    validi_g = gruppi[np.bincount(inv) >= MIN_PIX]
    if not len(validi_g):
        continue
    # immagini del tassello
    body = {"collections": ["sentinel-2-l2a"], "datetime": f"{inizio}T00:00:00Z/{fine}T23:59:59Z",
            "query": {"s2:mgrs_tile": {"eq": tile}, "eo:cloud_cover": {"lt": 50}}, "limit": 500}
    items = requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json().get("features", [])
    per_mese = {}
    for it in sorted(items, key=lambda i: i["properties"]["eo:cloud_cover"]):
        d = it["properties"]["datetime"][:10]
        lst = per_mese.setdefault(d[:7], [])
        if len(lst) < 3 and all(abs(pd.Timestamp(d) - pd.Timestamp(q["properties"]["datetime"][:10])).days >= 5 for q in lst):
            lst.append(it)
    scelti = [it for v in per_mese.values() for it in v]

    def una(it):
        url = (f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=sentinel-2-l2a&item={it['id']}"
               f"&expression={requests.utils.quote(EXPR)}&asset_as_band=true&coord_crs=epsg:3035&dst_crs=epsg:3035"
               f"&width={W}&height={H}&resampling=average")
        return it["properties"]["datetime"][:10], leggi_npy(url)

    with ThreadPoolExecutor(4) as ex:
        risultati = list(ex.map(una, scelti))
    tot = pd.Series(1, index=grp[puro]).groupby(level=0).sum()     # pixel puri per gruppo (provincia, classe)
    n_ok = 0
    for d, arr in risultati:
        if arr is None or arr.shape[0] < 2:
            continue
        ndvi, nuv = arr[0], arr[1]
        ok = puro & (nuv < 0.2) & np.isfinite(ndvi) & (np.abs(ndvi) <= 1)
        if arr.shape[0] > 2:
            ok &= arr[-1] > 0
        if not ok.any():
            continue
        s = pd.DataFrame({"g": grp[ok], "v": ndvi[ok]}).groupby("g")["v"].agg(["mean", "count"])
        s = s[s.index.isin(validi_g)]
        s = s[(s["count"] >= MIN_PIX) & (s["count"] >= 0.6 * tot.reindex(s.index).values)]
        for g, r in s.iterrows():
            righe.append((int(g // 32), int(g % 32), d, float(r["mean"]), int(r["count"])))
        n_ok += 1
    print(f"[{k + 1}/{len(tiles)}] {tile}: {len(scelti)} immagini, {n_ok} utili, {len(validi_g)} gruppi, {time.time() - t0:.0f} s", flush=True)

df = pd.DataFrame(righe, columns=["pid", "classe", "data", "ndvi", "n"])
df["provincia"] = df.pid.map(dict(zip(prov.pid, prov.prov_name)))
df["sigla"] = df.pid.map(dict(zip(prov.pid, prov.prov_acr)))
# stessa data da tasselli sovrapposti: media pesata
df["vn"] = df.ndvi * df.n
df = df.groupby(["provincia", "sigla", "classe", "data"], as_index=False).agg(vn=("vn", "sum"), n=("n", "sum"))
df["ndvi"] = df.vn / df.n
df["anno"], df["anno_mappa"] = ANNO, ANNO_MAPPA
df.drop(columns="vn").to_parquet(os.path.join(OUT, f"ndvi_{ANNO}.parquet"), index=False)
print(ANNO, len(df), "righe")
