# Columella — 12: resa stimata con il modello di Monteith per provincia × coltura × annata e confronto con ISTAT
#
# biomassa = Σ RUE × fAPAR × 0,48 × radiazione globale ; resa = biomassa × indice di raccolto / (1 − umidità commerciale)
# fAPAR = 1,24·NDVI − 0,168 (Myneni & Williams 1994), NDVI medio dei pixel puri della coltura nella provincia (script 10),
# ripulito (Hampel) e smussato (tricubica ±20 giorni) come nel sito; radiazione ERA5 giornaliera nel baricentro della provincia.
# Stessi parametri del sito (js/live.js, RESA_PAR). Il confronto con ISTAT dà, per ogni coltura, un fattore di taratura
# (mediana ISTAT / modello) che il sito applica anche alla resa stimata del singolo campo.
# Fonte dei campi (env FONTE): "copernicus" (def.) = pixel puri della mappa Crop Types (script 10);
#   "classificatore" = pixel riconosciuti dal classificatore delle colture (script 20), con le superfici stimate.
# Ingressi: data/province_ndvi/ndvi_*.parquet (10) o data/province_ndvi_cls/ndvi_*.parquet e superfici_*.parquet (20),
#           data/province.json e data/rese.json (07), cache data/province_ndvi/radiazione.parquet;
#           radiazione da Open-Meteo (riserva NASA POWER)
# Uscita: data/monteith_province.json (copernicus) o data/monteith_province_cls.json (classificatore); cache radiazione
# Esecuzione: workflow monteith.yml (poi hf_sync.py carica "province_ndvi") oppure Spyder
# EN: Monteith (RUE × fAPAR × radiation) yield per province × crop × season, calibrated against ISTAT.

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

FONTE = os.environ.get("FONTE", "copernicus")
CLS = FONTE == "classificatore"
DIR = os.path.join("data", "province_ndvi_cls" if CLS else "province_ndvi")
def leggi(prefisso):
    # più calcoli della stessa provincia e annata (es. manuale e automatico): vale il più recente
    d = pd.concat([pd.read_parquet(f) for f in glob.glob(os.path.join(DIR, prefisso + "_*.parquet"))], ignore_index=True)
    if "calcolato" in d:
        d["calcolato"] = d.calcolato.fillna("")
        d = d[d.calcolato == d.groupby(["provincia", "anno"]).calcolato.transform("max")]
    return d


nd = leggi("ndvi")
nd = nd[nd.classe.isin(PAR)]
nd["t"] = pd.to_datetime(nd.data)
print(len(nd), "righe NDVI;", nd.anno.min(), "–", nd.anno.max())

# ---- radiazione ERA5 nel baricentro di ogni provincia
prov = gpd.read_file(os.path.join("data", "province.json"))
cen = prov.to_crs(3035).geometry.centroid.to_crs(4326)
prov["lon"], prov["lat"] = cen.x.round(3), cen.y.round(3)
y0, y1 = int(nd.anno.min()) - 1, int(nd.anno.max())
rad = {}
# cache sul repository dati: le annate già scaricate non si riscaricano
cache = os.path.join("data", "province_ndvi", "radiazione.parquet")
if os.path.exists(cache):
    c = pd.read_parquet(cache)
    for pv, g in c.groupby("provincia"):
        rad[pv] = pd.Series(g.rad.values, index=pd.to_datetime(g.data))
fine = min(pd.Timestamp.now().normalize() - pd.Timedelta(days=7), pd.Timestamp(f"{y1}-10-31"))
mancano = [p for p in prov.itertuples() if p.prov_name not in rad or rad[p.prov_name].index.max() < fine - pd.Timedelta(days=40)]
print(len(mancano), "province da scaricare (ERA5 via Open-Meteo, 20 punti per richiesta)", flush=True)


def nasa_power(lat, lon):
    # riserva: NASA POWER, radiazione globale giornaliera (MJ/m²/giorno)
    u = (f"https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=AG&longitude={lon}&latitude={lat}"
         f"&start={y0}1101&end={fine:%Y%m%d}&format=JSON")
    j = requests.get(u, timeout=300).json()["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
    s_ = pd.Series(j, dtype=float)
    s_.index = pd.to_datetime(s_.index, format="%Y%m%d")
    return s_.where(s_ > -900)


for k in range(0, len(mancano), 20):
    lotto = mancano[k:k + 20]
    url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={','.join(str(p.lat) for p in lotto)}&longitude={','.join(str(p.lon) for p in lotto)}"
           f"&start_date={y0}-11-01&end_date={fine:%Y-%m-%d}&daily=shortwave_radiation_sum&timezone=UTC")
    js = None
    for tentativo in range(4):
        try:
            r = requests.get(url, timeout=600)
            if r.status_code == 200:
                js = r.json()
                js = js if isinstance(js, list) else [js]     # con un solo punto Open-Meteo non restituisce una lista
                break
            print("Open-Meteo", r.status_code, r.text[:150], flush=True)
        except (requests.RequestException, ValueError) as e:
            print("Open-Meteo errore", e, flush=True)
        time.sleep(60 * (tentativo + 1))
    for i, p in enumerate(lotto):
        try:
            if js and "daily" in js[i]:
                d = js[i]["daily"]
                rad[p.prov_name] = pd.Series(d["shortwave_radiation_sum"], index=pd.to_datetime(d["time"]), dtype=float)
            else:
                rad[p.prov_name] = nasa_power(p.lat, p.lon)
        except Exception as e:
            print("radiazione non disponibile per", p.prov_name, e, flush=True)
    print(f"radiazione: {min(k + 20, len(mancano))}/{len(mancano)}", flush=True)
if mancano:
    pd.concat([pd.DataFrame({"provincia": pv, "data": sr.index, "rad": sr.values}) for pv, sr in rad.items()]).to_parquet(cache, index=False)
print(len(rad), "province con radiazione", flush=True)


# calendario colturale (mese inizio, mese fine) entro cui cercare la stagione: evita di sommare la ricrescita
# di infestanti e cover crop dopo la raccolta, che gonfiava la biomassa
CAL = {1: (2, 6), 2: (2, 6), 5: (2, 6), 7: (2, 6), 12: (2, 6), 3: (4, 9), 4: (4, 9), 10: (4, 8), 11: (5, 9), 8: (3, 8), 9: (3, 9)}


def resa(g, cls, rs):
    g = g.sort_values("t")
    t, v = g.t.values.astype("datetime64[D]").astype(float), g.ndvi.values.copy()
    # Hampel ±25 giorni, 3 MAD
    ok = np.ones(len(v), bool)
    for i in range(len(v)):
        w = np.abs(t - t[i]) <= 25
        w[i] = False
        if w.sum() >= 3:
            med = np.median(v[w])
            mad = np.median(np.abs(v[w] - med)) * 1.4826
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
    mesi = pd.to_datetime(grid.astype("datetime64[D]")).month
    m0, m1 = CAL[cls]
    win = (mesi >= m0) & (mesi <= m1)
    if win.sum() < 10:
        return None
    sm = np.where(win, sm, -1)
    # stagione: dal picco si allarga finché NDVI > 0,3
    a = b = int(np.argmax(sm))
    while a > 0 and sm[a - 1] > 0.3:
        a -= 1
    while b < len(sm) - 1 and sm[b + 1] > 0.3:
        b += 1
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

# superfici stimate dal classificatore (ettari di pixel sicuri) da confrontare con quelle ISTAT
cmp_["ha_stimati"] = np.nan
if CLS:
    sf = leggi("superfici")
    cmp_ = cmp_.drop(columns="ha_stimati").merge(sf.rename(columns={"ha": "ha_stimati"})[["provincia", "classe", "anno", "ha_stimati"]],
                                                 on=["provincia", "classe", "anno"], how="left")

num = lambda v: None if pd.isna(v) else float(v)
out = {
    "generato": pd.Timestamp.now("UTC").isoformat(),
    "fonte": FONTE,
    "metodo": "Monteith: RUE × fAPAR(NDVI) × PAR ERA5 × indice di raccolto; NDVI medio dei pixel 200 m " +
              ("riconosciuti dal classificatore delle colture (probabilità ≥ 0,6)" if CLS else "puri (≥80%) della coltura Copernicus") + " nella provincia",
    "colonne": ["provincia", "nuts", "classe", "anno", "modello", "istat", "ha_istat", "giorni", "ndvi_max", "pixel", "ha_stimati"],
    "righe": [[r.provincia, r.nuts, int(r.classe), int(r.anno), r.modello, num(r.istat), num(r.ha), r.giorni, r.ndvi_max, int(r.pixel), num(r.ha_stimati)]
              for r in cmp_.itertuples()],
    "taratura": tar,
}
if CLS:   # tempo di calcolo (classificatore + NDVI) di ogni provincia e annata, per il sito
    tp = leggi("tempi") if glob.glob(os.path.join(DIR, "tempi_*.parquet")) else pd.DataFrame(columns=["provincia", "anno", "secondi", "tasselli", "calcolato"])
    out["tempi"] = {f"{r.provincia}|{int(r.anno)}": {"secondi": int(r.secondi), "tasselli": int(r.tasselli), "quando": r.calcolato} for r in tp.itertuples()}
nome = "monteith_province_cls.json" if CLS else "monteith_province.json"
json.dump(out, open(os.path.join("data", nome), "w"), ensure_ascii=False, separators=(",", ":"))
print("scritto data/" + nome + ":", len(out["righe"]), "righe")
