# Columella — 20: come lo script 10, ma i campi di ogni coltura sono individuati dal classificatore delle colture
#                 (3 reti neurali MLP dello script 18) invece che dalla mappa Copernicus Crop Types
#
# Per ogni tassello Sentinel-2 (MGRS) che tocca le province scelte, su una griglia da 200 m in EPSG:3035:
#   - Sentinel-2 L2A dell'annata (nov → ott, nuvolosità < 50%, al massimo 3 immagini al mese): 10 bande di riflettanza
#     e maschera nuvole/ombre/neve/foschia (SCL, AOT); Sentinel-1 RTC (VV, VH in dB); Copernicus DEM (quota, pendenza)
#   - mediane mensili e variabili come nello script 13 (10 bande, NDVI, NDMI, NDRE, VV, VH, VH−VV, quota, pendenza, latitudine)
#   - le 3 reti votano: classe = media delle probabilità; si tengono i pixel con probabilità ≥ PROB ("pixel sicuri")
#   - per ogni provincia, classe e data: NDVI medio dei pixel sicuri sereni (stessi criteri dello script 10)
# Nota: le reti sono addestrate su pixel da 20 m; qui si applicano a medie su 200 m (come nel sito si applicano a medie
#       sul campo). La pendenza a 200 m è più bassa che a 20 m.
# Ingressi: modello pubblico modelli/colture_v2_mlp.json su Hugging Face, Planetary Computer (pubblico),
#           province_istat.geojson; env ANNO (def. 2024), PROVINCE (sigle separate da virgole, es. "RM,LT"; vuoto = tutte)
# Uscite: data/province_ndvi_cls/ndvi_<anno>.parquet (stesse colonne dello script 10)
#         data/province_ndvi_cls/superfici_<anno>.parquet (ettari stimati per provincia e classe)
# Esecuzione: workflow monteith-classificatore.yml (poi 12 con FONTE=classificatore) oppure Spyder
# EN: per-province NDVI series like script 10, with crop pixels found by the browser crop classifier (3 MLPs) instead of
#     the Copernicus crop map.

import ast
import os
import time
import json
import numpy as np
import pandas as pd
import requests
import geopandas as gpd
from rasterio import features
from rasterio.transform import from_origin
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor

ANNO = int(os.environ.get("ANNO", "2024"))
SIGLE = [s.strip().upper() for s in os.environ.get("PROVINCE", "").split(",") if s.strip()]
PC = "https://planetarycomputer.microsoft.com/api"
MODELLO = "https://huggingface.co/datasets/Bradipo92/campi-aperti-data/resolve/main/modelli/colture_v2_mlp.json"
RES = 200
PROB = 0.6
MIN_PIX = 15
OUT = os.path.join("data", "province_ndvi_cls")
os.makedirs(OUT, exist_ok=True)
inizio, fine = f"{ANNO - 1}-11-01", f"{ANNO}-10-31"
mesi = [(ANNO - 1, 11), (ANNO - 1, 12)] + [(ANNO, m) for m in range(1, 11)]
BANDE = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B11", "B12"]
EXPR = ";".join([f"({b}-1000)/10000" for b in BANDE] +
                ["((SCL==0)|(SCL==1)|(SCL==3)|(SCL==7)|(SCL==8)|(SCL==9)|(SCL==10)|(SCL==11)|(AOT>300))*1.0"])
to3035 = Transformer.from_crs(4326, 3035, always_xy=True)
to4326 = Transformer.from_crs(3035, 4326, always_xy=True)

# ---- classificatore: 3 reti (ReLU, uscita softmax), variabili standardizzate con mu/sd di ogni rete
M = requests.get(MODELLO, timeout=120).json()
VAR, CLASSI = M["variabili"], np.array(M["classi"])
print(len(VAR), "variabili,", len(CLASSI), "classi; verifica", M.get("verifica_zone_escluse"))


def probabilita(X):
    P = 0
    for r in M["reti"]:
        h = np.nan_to_num((X - np.array(r["mu"], "float32")) / np.array(r["sd"], "float32"))
        for i, (W, b) in enumerate(zip(r["W"], r["b"])):
            h = h @ np.array(W, "float32") + np.array(b, "float32")
            if i < len(r["W"]) - 1:
                h = np.maximum(h, 0)
        e = np.exp(h - h.max(1, keepdims=True))
        P = P + e / e.sum(1, keepdims=True)
    return P / len(M["reti"])


prov = gpd.read_file("province_istat.geojson").to_crs(3035)
prov["pid"] = np.arange(1, len(prov) + 1)
scelte = prov[prov.prov_acr.isin(SIGLE)] if SIGLE else prov
print(len(scelte), "province:", ", ".join(scelte.prov_acr))
lo0, la0, lo1, la1 = scelte.to_crs(4326).total_bounds

# ---- tasselli MGRS che toccano le province scelte (una settimana estiva)
tiles = {}
body = {"collections": ["sentinel-2-l2a"], "bbox": [lo0, la0, lo1, la1], "datetime": f"{ANNO}-07-01T00:00:00Z/{ANNO}-07-12T23:59:59Z", "limit": 500}
for it in requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json().get("features", []):
    t = it["properties"]["s2:mgrs_tile"]
    if t not in tiles:
        a, b, c, d = it["bbox"]
        xs, ys = to3035.transform([a, c, a, c], [b, b, d, d])
        tiles[t] = [np.floor(min(xs) / RES) * RES, np.floor(min(ys) / RES) * RES, np.ceil(max(xs) / RES) * RES, np.ceil(max(ys) / RES) * RES]
print(len(tiles), "tasselli")


def npy(url):
    for tentativo in range(4):
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
        time.sleep(15 * (tentativo + 1))
    return None


def cerca(coll, query, tile=None, bbox=None):
    body = {"collections": [coll], "datetime": f"{inizio}T00:00:00Z/{fine}T23:59:59Z", "limit": 500}
    if tile:
        body["query"] = {"s2:mgrs_tile": {"eq": tile}, **(query or {})}
    else:
        body["bbox"] = bbox
    return requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json().get("features", [])


def mensili(cubo, nb, H, W):
    f = np.full((nb, 12, H, W), np.nan, dtype="float32")
    for k, (a, m) in enumerate(mesi):
        sel = [v for d, v in cubo.items() if int(d[:4]) == a and int(d[5:7]) == m]
        if sel:
            with np.errstate(all="ignore"):
                f[:, k] = np.nanmedian(np.stack(sel), axis=0)
    for i in range(nb):              # mesi mancanti: interpolazione lineare se ci sono almeno 3 mesi validi
        g = f[i].reshape(12, -1)
        ok = np.isfinite(g)
        for p in np.where(~ok.all(0) & (ok.sum(0) >= 3))[0]:
            h = ok[:, p]
            g[~h, p] = np.interp(np.where(~h)[0], np.where(h)[0], g[h, p])
    return f


righe, superfici, visti = [], [], set()
for k, (tile, (x0, y0, x1, y1)) in enumerate(sorted(tiles.items())):
    t0 = time.time()
    W, H = int((x1 - x0) / RES), int((y1 - y0) / RES)
    tr = from_origin(x0, y1, RES, RES)
    pid = features.rasterize([(g, i) for g, i in zip(scelte.geometry, scelte.pid)], out_shape=(H, W), transform=tr, fill=0, dtype="int16")
    if (pid > 0).sum() < MIN_PIX:
        continue
    q = f"coord_crs=epsg:3035&dst_crs=epsg:3035&width={W}&height={H}&resampling=average"
    lo, la = to4326.transform([x0, x1], [y0, y1])
    bbox = [min(lo), min(la), max(lo), max(la)]
    # Sentinel-2: al massimo 3 immagini al mese, distanti almeno 5 giorni
    per_mese = {}
    for it in sorted(cerca("sentinel-2-l2a", {"eo:cloud_cover": {"lt": 50}}, tile=tile), key=lambda i: i["properties"]["eo:cloud_cover"]):
        d = it["properties"]["datetime"][:10]
        lst = per_mese.setdefault(d[:7], [])
        if len(lst) < 3 and all(abs(pd.Timestamp(d) - pd.Timestamp(x["properties"]["datetime"][:10])).days >= 5 for x in lst):
            lst.append(it)
    scelti = [it for v in per_mese.values() for it in v]

    def una_s2(it):
        a = npy(f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=sentinel-2-l2a&item={it['id']}"
                f"&expression={requests.utils.quote(EXPR)}&asset_as_band=true&{q}")
        if a is None or a.shape[0] < 11:
            return it["properties"]["datetime"][:10], None
        v = a[:10]
        ok = (a[10] < 0.2) & np.isfinite(v).all(0) & (v > -0.05).all(0) & (v < 1.2).all(0)
        if a.shape[0] > 11:
            ok &= a[-1] > 0
        v[:, ~ok] = np.nan
        return it["properties"]["datetime"][:10], v

    with ThreadPoolExecutor(4) as ex:
        cubo = {d: v for d, v in ex.map(una_s2, scelti) if v is not None}
    if len(cubo) < 8:
        print(tile, "Sentinel-2 insufficiente", len(cubo))
        continue
    fs2 = mensili(cubo, 10, H, W)
    B = {b: fs2[i] for i, b in enumerate(BANDE)}
    with np.errstate(all="ignore"):
        ind = np.stack([(B["B08"] - B["B04"]) / (B["B08"] + B["B04"]), (B["B8A"] - B["B11"]) / (B["B8A"] + B["B11"]),
                        (B["B8A"] - B["B05"]) / (B["B8A"] + B["B05"])])
    # Sentinel-1 RTC (al massimo 24 date)
    s1 = {}
    for it in cerca("sentinel-1-rtc", None, bbox=bbox):
        s1.setdefault(it["properties"]["datetime"][:10], it)
    d1 = sorted(s1)
    if len(d1) > 24:
        d1 = [d1[i] for i in sorted(set(np.linspace(0, len(d1) - 1, 24).round().astype(int)))]

    def una_s1(d):
        a = npy(f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=sentinel-1-rtc&item={s1[d]['id']}&assets=vv&assets=vh&{q}")
        if a is None or a.shape[0] < 2:
            return d, None
        v = a[:2]
        v[(v <= 0) | ~np.isfinite(v)] = np.nan
        return d, 10 * np.log10(v)

    with ThreadPoolExecutor(4) as ex:
        c1 = {d: v for d, v in ex.map(una_s1, d1) if v is not None}
    fs1 = mensili(c1, 2, H, W) if len(c1) >= 6 else np.full((2, 12, H, W), np.nan, dtype="float32")
    # DEM: più riquadri da 1° sul tassello, si tiene il valore valido
    quota = np.full((H, W), np.nan, "float32")
    for it in requests.post(f"{PC}/stac/v1/search", json={"collections": ["cop-dem-glo-30"], "bbox": bbox, "limit": 12}, timeout=60).json().get("features", []):
        a = npy(f"{PC}/data/v1/item/bbox/{x0},{y0},{x1},{y1}.npy?collection=cop-dem-glo-30&item={it['id']}&assets=data&{q}")
        if a is not None:
            v = a[0]
            quota = np.where(np.isfinite(quota) & (quota != 0), quota, np.where(np.isfinite(v), v, quota))
    gy, gx = np.gradient(quota, RES)
    pend = np.degrees(np.arctan(np.hypot(gx, gy)))
    XX, YY = np.meshgrid(x0 + (np.arange(W) + 0.5) * RES, y1 - (np.arange(H) + 0.5) * RES)
    # variabili nell'ordine del modello
    col = {}
    for i, b in enumerate(BANDE):
        for m_ in range(12):
            col[f"{b}_{m_:02d}"] = fs2[i, m_]
    for i, n_ in enumerate(["ndvi", "ndmi", "ndre"]):
        for m_ in range(12):
            col[f"{n_}_{m_:02d}"] = ind[i, m_]
    for i, n_ in enumerate(["vv", "vh"]):
        for m_ in range(12):
            col[f"{n_}_{m_:02d}"] = fs1[i, m_]
    for m_ in range(12):
        col[f"vhvv_{m_:02d}"] = fs1[1, m_] - fs1[0, m_]
    col["quota"], col["pendenza"], col["lat"] = quota, pend, to4326.transform(XX, YY)[1].astype("float32")
    dentro = (pid > 0) & np.isfinite(fs2).all((0, 1)) & np.isfinite(ind).all((0, 1))
    if dentro.sum() < MIN_PIX:
        continue
    X = np.stack([col[v][dentro] for v in VAR], 1).astype("float32")
    P = probabilita(X)
    cls = np.zeros((H, W), "int16")
    cls[dentro] = np.where(P.max(1) >= PROB, CLASSI[P.argmax(1)], 0)
    sicuro = cls > 0
    grp = np.where(sicuro, pid.astype(np.int64) * 32 + cls, 0)
    g_, n_ = np.unique(grp[sicuro], return_counts=True)
    validi_g = g_[n_ >= MIN_PIX]
    # superfici stimate (pixel sicuri × 4 ha); i tasselli MGRS si sovrappongono: ogni pixel della griglia conta una volta
    rr, cc = np.nonzero(sicuro)
    chiavi = (np.round(x0 / RES).astype(np.int64) + cc) * 10_000_000 + (np.round(y1 / RES).astype(np.int64) - rr)
    nuovi = np.array([c not in visti for c in chiavi.tolist()], bool)
    visti.update(chiavi[nuovi].tolist())
    superfici += list(zip(pid[rr[nuovi], cc[nuovi]].tolist(), cls[rr[nuovi], cc[nuovi]].tolist()))
    tot = pd.Series(1, index=grp[sicuro]).groupby(level=0).sum()
    # NDVI per data sui pixel sicuri sereni (stessi criteri dello script 10)
    n_ok = 0
    for d, v in cubo.items():
        with np.errstate(all="ignore"):
            ndvi = (v[6] - v[2]) / (v[6] + v[2])
        ok = sicuro & np.isfinite(ndvi) & (np.abs(ndvi) <= 1)
        if not ok.any():
            continue
        s = pd.DataFrame({"g": grp[ok], "v": ndvi[ok]}).groupby("g")["v"].agg(["mean", "count"])
        s = s[s.index.isin(validi_g)]
        s = s[(s["count"] >= MIN_PIX) & (s["count"] >= 0.6 * tot.reindex(s.index).values)]
        for g, r in s.iterrows():
            righe.append((int(g // 32), int(g % 32), d, float(r["mean"]), int(r["count"])))
        n_ok += 1
    print(f"[{k + 1}/{len(tiles)}] {tile}: S2 {len(cubo)}, S1 {len(c1)}, {int(sicuro.sum())} pixel sicuri, {n_ok} date utili, {time.time() - t0:.0f} s", flush=True)

nome = dict(zip(prov.pid, prov.prov_name))
sigla = dict(zip(prov.pid, prov.prov_acr))
df = pd.DataFrame(righe, columns=["pid", "classe", "data", "ndvi", "n"])
df["provincia"], df["sigla"] = df.pid.map(nome), df.pid.map(sigla)
df["vn"] = df.ndvi * df.n                              # stessa data da tasselli sovrapposti: media pesata
df = df.groupby(["provincia", "sigla", "classe", "data"], as_index=False).agg(vn=("vn", "sum"), n=("n", "sum"))
df["ndvi"] = df.vn / df.n
df["anno"], df["anno_mappa"] = ANNO, ANNO
sf = pd.DataFrame(superfici, columns=["pid", "classe"]).groupby(["pid", "classe"], as_index=False).size().rename(columns={"size": "pixel"})
sf["ha"] = sf.pixel * RES * RES / 1e4
sf["provincia"], sf["anno"] = sf.pid.map(nome), ANNO


# si aggiunge ai risultati già calcolati per altre province (stessa annata): le province rifatte si sostituiscono
def salva(nuovo, nome_file):
    f = os.path.join(OUT, nome_file)
    if os.path.exists(f):
        vecchio = pd.read_parquet(f)
        nuovo = pd.concat([vecchio[~vecchio.provincia.isin(scelte.prov_name)], nuovo], ignore_index=True)
    nuovo.to_parquet(f, index=False)


salva(df.drop(columns="vn"), f"ndvi_{ANNO}.parquet")
salva(sf.drop(columns="pid"), f"superfici_{ANNO}.parquet")
print(ANNO, len(df), "righe NDVI;", len(sf), "superfici")
