# 12 — Resa stimata con il modello di Monteith per provincia × coltura × annata e confronto con ISTAT
#
# biomassa = Σ RUE × fAPAR × 0,48 × radiazione globale ; resa = biomassa × indice di raccolto / (1 − umidità commerciale)
# fAPAR = 1,24·NDVI − 0,168 (Myneni & Williams 1994), NDVI medio dei pixel puri della coltura nella provincia (script 10),
# ripulito (Hampel) e smussato (tricubica ±20 giorni) come nel sito; radiazione ERA5 giornaliera nel baricentro della provincia.
# Stessi parametri del sito (js/live.js, RESA_PAR). Il confronto con ISTAT dà, per ogni coltura, un fattore di taratura
# (mediana ISTAT / modello) che il sito applica anche alla resa stimata del singolo campo.
# Uscita: data/monteith_province.json

import os
import glob
import json
import time
import numpy as np
import pandas as pd
import requests
import geopandas as gpd

PAR = {1: (2.8, 0.45, 0.13), 2: (2.7, 0.45, 0.13), 3: (3.8, 0.50, 0.155), 4: (2.6, 0.45, 0.14), 5: (2.6, 0.40, 0.13),
       7: (2.0, 0.35, 0.13), 8: (2.8, 0.75, 0.78), 9: (3.2, 0.65, 0.77), 10: (2.4, 0.33, 0.09), 11: (2.0, 0.40, 0.13), 12: (2.3, 0.30, 0.09)}

nd = pd.concat([pd.read_parquet(f) for f in glob.glob(os.path.join("data", "province_ndvi", "ndvi_*.parquet"))], ignore_index=True)
nd = nd[nd.classe.isin(PAR)]
nd["t"] = pd.to_datetime(nd.data)
print(len(nd), "righe NDVI;", nd.anno.min(), "–", nd.anno.max())

# ---- radiazione ERA5 nel baricentro di ogni provincia
prov = gpd.read_file(os.path.join("data", "province.json"))
cen = prov.to_crs(3035).geometry.centroid.to_crs(4326)
prov["lon"], prov["lat"] = cen.x.round(3), cen.y.round(3)
y0, y1 = int(nd.anno.min()) - 1, int(nd.anno.max())
rad = {}
for p in prov.itertuples():
    url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={p.lat}&longitude={p.lon}&start_date={y0}-11-01"
           f"&end_date={min(pd.Timestamp.now().date() - pd.Timedelta(days=7), pd.Timestamp(f'{y1}-10-31').date())}"
           f"&daily=shortwave_radiation_sum&timezone=UTC")
    for tentativo in range(5):
        try:
            j = requests.get(url, timeout=300).json()
            if "daily" in j:
                rad[p.prov_name] = pd.Series(j["daily"]["shortwave_radiation_sum"], index=pd.to_datetime(j["daily"]["time"]), dtype=float)
                break
        except (requests.RequestException, ValueError):
            pass
        time.sleep(20 * (tentativo + 1))
    time.sleep(1)
print(len(rad), "province con radiazione")


def resa(g, cls, rs):
    g = g.sort_values("t")
    t, v = g.t.values.astype("datetime64[D]").astype(float), g.ndvi.values.copy()
    # Hampel ±25 giorni, 3 MAD
    ok = np.ones(len(v), bool)
    for i in range(len(v)):
        w = np.abs(t - t[i]) <= 25
        w[i] = False
        if w.sum() >= 3:
            med = np.median(v[w]); mad = np.median(np.abs(v[w] - med)) * 1.4826
            if abs(v[i] - med) > max(0.08, 3 * mad):
                ok[i] = False
    t, v = t[ok], v[ok]
    if len(v) < 8:
        return None
    grid = np.arange(t[0], t[-1] + 1, 3.0)
    sm = []
    for x in grid:
        d = np.abs(t - x) / 20
        w = np.where(d < 1, (1 - d ** 3) ** 3, 0)
        sm.append(np.sum(w * v) / w.sum() if w.sum() > 0.2 else np.nan)
    sm = np.array(sm)
    good = np.isfinite(sm)
    grid, sm = grid[good], sm[good]
    if len(sm) < 10 or sm.max() < 0.45:
        return None
    ip = int(np.argmax(sm)); a = b = ip
    while a > 0 and sm[a - 1] > 0.3: a -= 1
    while b < len(sm) - 1 and sm[b + 1] > 0.3: b += 1
    giorni = np.arange(grid[a], grid[b] + 1)
    nd_g = np.interp(giorni, grid, sm)
    r = rs.reindex(pd.to_datetime(giorni.astype("datetime64[D]"))).values
    m = np.isfinite(r)
    if m.sum() < 40:
        return None
    rue, hi, u = PAR[cls]
    fapar = np.clip(1.24 * nd_g - 0.168, 0, 0.95)
    bio = np.sum(rue * fapar[m] * 0.48 * r[m])           # g/m²
    return bio * hi / 100 / (1 - u), int(m.sum()), float(sm.max())


mod = []
for (pv, cls, anno), g in nd.groupby(["provincia", "classe", "anno"]):
    if pv not in rad:
        continue
    r = resa(g, cls, rad[pv])
    if r:
        mod.append((pv, int(cls), int(anno), round(r[0], 2), r[1], round(r[2], 3), int(g.n.median())))
mod = pd.DataFrame(mod, columns=["provincia", "classe", "anno", "modello", "giorni", "ndvi_max", "pixel"])
print(len(mod), "stime del modello")

# ---- ISTAT per classe: produzione e superficie sommate sulle colture ISTAT della stessa classe Copernicus
R = json.load(open(os.path.join("data", "rese.json")))
ist = pd.DataFrame(R["righe"], columns=R["colonne"])
ist["classe"] = ist.coltura.map({k: v["cty"] for k, v in R["colture"].items()})
ist = ist[ist.classe.isin(PAR)].groupby(["territorio", "classe", "anno"], as_index=False)[["ha", "t"]].sum()
ist["istat"] = (ist.t / ist.ha).round(2)
nuts = dict(zip(prov.prov_name, prov.nuts))
mod["nuts"] = mod.provincia.map(nuts)
cmp_ = mod.merge(ist.rename(columns={"territorio": "nuts"})[["nuts", "classe", "anno", "istat", "ha"]], on=["nuts", "classe", "anno"], how="left")
cmp_ = cmp_[cmp_.nuts.notna()]

# ---- fattore di taratura per classe e statistiche di accordo
tar = {}
for cls, g in cmp_.dropna(subset=["istat"]).groupby("classe"):
    g = g[(g.istat > 0) & (g.modello > 0)]
    if len(g) < 5:
        continue
    f = float(np.median(g.istat / g.modello))
    x, y = g.modello * f, g.istat
    tar[int(cls)] = {"fattore": round(f, 3), "n": int(len(g)), "r2": round(float(np.corrcoef(g.modello, y)[0, 1] ** 2), 3),
                     "rmse_tarato": round(float(np.sqrt(np.mean((x - y) ** 2))), 2),
                     "errore_rel_tarato": round(float(np.median(np.abs(x - y) / y)), 3)}
print(json.dumps(tar, indent=1))

out = {
    "generato": pd.Timestamp.now("UTC").isoformat(),
    "metodo": "Monteith: RUE × fAPAR(NDVI) × PAR ERA5 × indice di raccolto; NDVI medio dei pixel 200 m puri (≥80%) della coltura Copernicus nella provincia",
    "colonne": ["provincia", "nuts", "classe", "anno", "modello", "istat", "ha_istat", "giorni", "ndvi_max", "pixel"],
    "righe": [[r.provincia, r.nuts, int(r.classe), int(r.anno), r.modello, None if pd.isna(r.istat) else float(r.istat),
               None if pd.isna(r.ha) else float(r.ha), r.giorni, r.ndvi_max, int(r.pixel)] for r in cmp_.itertuples()],
    "taratura": tar,
}
json.dump(out, open(os.path.join("data", "monteith_province.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("scritto data/monteith_province.json:", len(out["righe"]), "righe")
