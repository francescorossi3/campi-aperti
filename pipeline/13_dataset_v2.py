# Columella — 13: dataset v2 per il classificatore delle colture: più zone e più prodotti (un'annata alla volta)
#
# Zone: ~130 quadrati di 2 × 2 km scelti dai blocchi da 1 km dello script 03, stratificati per coltura e regione,
#       con più peso alle colture rare (frutteti, frutta a guscio, vite, olivo, riso, legumi…).
# Variabili per pixel da 20 m (mediane mensili dell'annata nov → ott):
#   - Sentinel-2 L2A: 10 bande di riflettanza + NDVI, NDMI, NDRE (nuvole, ombre, neve e foschia tolte con SCL e AOT)
#   - Sentinel-1 RTC: retrodiffusione VV e VH in dB e rapporto VH/VV (vede anche sotto le nuvole: struttura della pianta)
#   - Copernicus DEM 30 m: quota e pendenza
#   - latitudine (clima)
# Etichetta: Copernicus HRL Crop Types dell'anno, solo pixel omogenei 3×3 a 10 m.
# Ingressi: data/blocchi/blocchi_<anno>.parquet (03), COG Crop Types su Hugging Face, Planetary Computer (pubblico); env ANNO
# Uscita: data/dataset_v2/ds_<anno>.parquet
# Esecuzione: workflow classificatore-v2.yml (poi hf_sync.py carica "dataset_v2") oppure Spyder
# EN: builds the per-pixel training table (S2, S1, DEM monthly features + Crop Types label) for the v2 classifier.

import ast
import os
import time
import numpy as np
import pandas as pd
import requests
import rasterio
from rasterio.windows import from_bounds
from scipy import ndimage
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor

ANNO = int(os.environ.get("ANNO", "2024"))
PC = "https://planetarycomputer.microsoft.com/api"
COG = f"https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/crop_types/cty_{ANNO}_italia_3035.tif"
RES, LATO = 20, 2000
N = LATO // RES
MAX_S2, MAX_S1 = 30, 24
OUT = os.path.join("data", "dataset_v2")
os.makedirs(OUT, exist_ok=True)
to4326 = Transformer.from_crs(3035, 4326, always_xy=True)
BANDE = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B11", "B12"]
mesi = [(ANNO - 1, 11), (ANNO - 1, 12)] + [(ANNO, m) for m in range(1, 11)]
inizio, fine = f"{ANNO - 1}-11-01", f"{ANNO}-10-31"

# ---- scelta delle zone dai blocchi da 1 km (ettari per classe c1..c19)
bl = pd.read_parquet(os.path.join("data", "blocchi", f"blocchi_{min(ANNO, 2024)}.parquet"))
cc = [f"c{i}" for i in range(1, 18)]
bl["tot"] = bl[cc].sum(1)
bl = bl[bl.tot > 40]
quota = {1: 10, 2: 6, 3: 10, 4: 6, 5: 5, 6: 5, 7: 8, 8: 6, 9: 5, 10: 7, 11: 6, 12: 5, 13: 3, 14: 12, 15: 12, 16: 14, 17: 10}
rng = np.random.default_rng(42)
scelti = []
for c, q in quota.items():
    d = bl[bl[f"c{c}"] > 15].copy()
    if d.empty:
        continue
    d["peso"] = d[f"c{c}"] / d.tot
    d = d.sort_values("peso", ascending=False).groupby("regione").head(3)          # varietà geografica
    d = d.assign(_r=rng.random(len(d)) ** (1 / d.peso.clip(lower=1e-3))).nlargest(min(q, len(d)), "_r")   # campione pesato senza ripetizioni
    for r in d.itertuples():
        if all(abs(r.x - x) > LATO or abs(r.y - y) > LATO for x, y, *_ in scelti):
            scelti.append((r.x, r.y, r.regione, c))
print(len(scelti), "zone")


def npy(url):
    for k in range(4):
        try:
            r = requests.get(url, timeout=240)
            if r.status_code == 200:
                b = r.content
                hl = int.from_bytes(b[8:10], "little")
                hdr = b[10:10 + hl].decode()
                shape = ast.literal_eval(hdr.split("'shape':")[1].split(")")[0] + ")")
                return np.frombuffer(b[10 + hl:], dtype="<f8" if "<f8" in hdr else "<f4").reshape(shape).astype("float32")
            if r.status_code in (404, 422):
                return None
        except requests.RequestException:
            pass
        time.sleep(10 * (k + 1))
    return None


def cerca(coll, bbox, query, limite):
    body = {"collections": [coll], "bbox": bbox, "datetime": f"{inizio}T00:00:00Z/{fine}T23:59:59Z", "limit": 500}
    if query:
        body["query"] = query
    its = requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json().get("features", [])
    per = {}
    for it in sorted(its, key=lambda i: i["properties"].get("eo:cloud_cover", 0)):
        per.setdefault(it["properties"]["datetime"][:10], it)
    d = sorted(per)
    if len(d) > limite:
        d = [d[i] for i in sorted(set(np.linspace(0, len(d) - 1, limite).round().astype(int)))]
    return [(x, per[x]) for x in d]


def mensili(cubo, nb):
    f = np.full((nb, 12, N, N), np.nan, dtype="float32")
    for k, (a, m) in enumerate(mesi):
        sel = [v for d, v in cubo.items() if int(d[:4]) == a and int(d[5:7]) == m]
        if sel:
            with np.errstate(all="ignore"):
                f[:, k] = np.nanmedian(np.stack(sel), axis=0)
    for i in range(nb):
        g = f[i].reshape(12, -1)
        ok = np.isfinite(g)
        cols = np.where(~ok.all(0) & (ok.sum(0) >= 3))[0]
        for p in cols:
            h = ok[:, p]
            g[~h, p] = np.interp(np.where(~h)[0], np.where(h)[0], g[h, p])
    return f


cog = rasterio.open(COG)
parti = []
for zi, (cx, cy, regione, c_z) in enumerate(scelti):
    t0 = time.time()
    # x, y dei blocchi sono già i centri
    x0, y0, x1, y1 = cx - LATO / 2, cy - LATO / 2, cx + LATO / 2, cy + LATO / 2
    win = from_bounds(x0, y0, x1, y1, cog.transform).round_offsets().round_lengths()
    lab = cog.read(1, window=win)
    omog = (ndimage.maximum_filter(lab, 3) == lab) & (ndimage.minimum_filter(lab, 3) == lab) & (lab >= 1) & (lab <= 17)
    xs, ys = x0 + (np.arange(N) + 0.5) * RES, y1 - (np.arange(N) + 0.5) * RES
    XX, YY = np.meshgrid(xs, ys)
    tr = cog.window_transform(win)
    cc_ = ((XX - tr.c) / tr.a).astype(int).clip(0, lab.shape[1] - 1)
    rr_ = ((YY - tr.f) / tr.e).astype(int).clip(0, lab.shape[0] - 1)
    y_lab = np.where(omog[rr_, cc_], lab[rr_, cc_], 0)
    if (y_lab > 0).sum() < 100:
        continue
    lo, la = to4326.transform([x0, x1], [y0, y1])
    bbox = [min(lo), min(la), max(lo), max(la)]
    q = f"coord_crs=epsg:3035&dst_crs=epsg:3035&width={N}&height={N}&resampling=average"
    # Sentinel-2
    expr = ";".join([f"({b}-1000)/10000" for b in BANDE] +
                    ["((SCL==0)|(SCL==1)|(SCL==3)|(SCL==7)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==11)|(AOT>300))*1.0"])
    s2 = cerca("sentinel-2-l2a", bbox, {"eo:cloud_cover": {"lt": 50}}, MAX_S2)
    def una_s2(di):
        d, it = di
        a = npy(f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=sentinel-2-l2a&item={it['id']}&expression={requests.utils.quote(expr)}&asset_as_band=true&{q}")
        if a is None or a.shape[0] < 11:
            return d, None
        v = a[:10]
        ok = (a[10] < 0.5) & np.isfinite(v).all(0) & (v > -0.05).all(0) & (v < 1.2).all(0)
        if a.shape[0] > 11:
            ok &= a[-1] > 0
        v[:, ~ok] = np.nan
        return d, v if ok.mean() > 0.2 else None
    with ThreadPoolExecutor(4) as ex:
        cubo = {d: v for d, v in ex.map(una_s2, s2) if v is not None}
    if len(cubo) < 8:
        print(zi, "S2 insufficiente", len(cubo))
        continue
    fs2 = mensili(cubo, 10)
    B = {b: fs2[i] for i, b in enumerate(BANDE)}
    with np.errstate(all="ignore"):
        ind = np.stack([(B["B08"] - B["B04"]) / (B["B08"] + B["B04"]), (B["B8A"] - B["B11"]) / (B["B8A"] + B["B11"]),
                        (B["B8A"] - B["B05"]) / (B["B8A"] + B["B05"])])
    # Sentinel-1 RTC
    s1 = cerca("sentinel-1-rtc", bbox, None, MAX_S1)
    def una_s1(di):
        d, it = di
        a = npy(f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=sentinel-1-rtc&item={it['id']}&assets=vv&assets=vh&{q}")
        if a is None or a.shape[0] < 2:
            return d, None
        v = a[:2]
        v[(v <= 0) | ~np.isfinite(v)] = np.nan
        return d, 10 * np.log10(v)
    with ThreadPoolExecutor(4) as ex:
        c1 = {d: v for d, v in ex.map(una_s1, s1) if v is not None}
    fs1 = mensili(c1, 2) if len(c1) >= 6 else np.full((2, 12, N, N), np.nan, dtype="float32")
    # DEM
    dem_it = requests.post(f"{PC}/stac/v1/search", json={"collections": ["cop-dem-glo-30"], "bbox": bbox, "limit": 4}, timeout=60).json().get("features", [])
    dem = None
    if dem_it:
        dem = npy(f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=cop-dem-glo-30&item={dem_it[0]['id']}&assets=data&{q}")
    quota_ = dem[0] if dem is not None else np.full((N, N), np.nan, "float32")
    gy, gx = np.gradient(quota_, RES)
    pend = np.degrees(np.arctan(np.hypot(gx, gy)))
    # tabella
    m = (y_lab > 0) & np.isfinite(fs2).all((0, 1)) & np.isfinite(ind).all((0, 1))
    cols, arrs = [], []
    for i, b in enumerate(BANDE):
        cols += [f"{b}_{k:02d}" for k in range(12)]
        arrs.append(fs2[i][:, m].T)
    for i, n_ in enumerate(["ndvi", "ndmi", "ndre"]):
        cols += [f"{n_}_{k:02d}" for k in range(12)]
        arrs.append(ind[i][:, m].T)
    for i, n_ in enumerate(["vv", "vh"]):
        cols += [f"{n_}_{k:02d}" for k in range(12)]
        arrs.append(fs1[i][:, m].T)
    cols += [f"vhvv_{k:02d}" for k in range(12)]
    arrs.append((fs1[1] - fs1[0])[:, m].T)                # rapporto VH/VV in dB
    df = pd.DataFrame(np.hstack(arrs), columns=cols)
    df["quota"], df["pendenza"] = quota_[m], pend[m]
    df["lat"] = to4326.transform(XX[m], YY[m])[1]
    df["classe"], df["zona"], df["regione"], df["anno"] = y_lab[m], f"z{zi:03d}", regione, ANNO
    if len(df) > 4000:
        df = df.sample(frac=1, random_state=0).groupby("classe").head(1500)
    parti.append(df.astype({c: "float32" for c in cols}))
    print(f"[{zi + 1}/{len(scelti)}] {regione} ({c_z}): S2 {len(cubo)} date, S1 {len(c1)}, {len(df)} pixel, {time.time() - t0:.0f} s", flush=True)

ds = pd.concat(parti, ignore_index=True)
ds.to_parquet(os.path.join(OUT, f"ds_{ANNO}.parquet"), index=False)
print(ANNO, len(ds), "esempi;", ds.classe.value_counts().sort_index().to_dict())
