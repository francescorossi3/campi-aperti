# 05 — Riepiloghi per regione × coltura × anno × mese: superficie, pioggia, ET0, ET coltura, bilancio
#
# - superficie: Copernicus HRL Crop Types (pixel 10 m)
# - pioggia ed ET0: media delle celle meteo pesata con gli ettari di quella coltura in ogni cella
# - ET coltura = Kc mensile (FAO-56, tabella in classi.py) × ET0
# Uscita: data/riepiloghi.json  (letto dalla tab "Regioni" del sito)

import os
import glob
import json
import pandas as pd
from classi import NOMI, KC

meteo = pd.read_parquet(os.path.join("data", "meteo", "celle_mensili.parquet"))
col = [f"c{k}" for k in range(1, 20)]

righe = []
anni_ok = []
mappe = {int(f.split("_")[-1].split(".")[0]): f for f in glob.glob(os.path.join("data", "blocchi", "blocchi_*.parquet"))}
ultimo_meteo = int(meteo.anno.max())
for anno in range(min(mappe), ultimo_meteo + 1):
    # per gli anni senza mappa Copernicus (es. 2025, 2026) uso l'ultima mappa disponibile
    anno_carta = anno if anno in mappe else max(m for m in mappe if m <= anno)
    b = pd.read_parquet(mappe[anno_carta])
    lungo = b.melt(id_vars=["regione", "cella"], value_vars=col, var_name="classe", value_name="ha")
    lungo = lungo[lungo.ha > 0]
    lungo["classe"] = lungo.classe.str[1:].astype(int)
    rc = lungo.groupby(["regione", "cella", "classe"], as_index=False).ha.sum()
    # mesi: da novembre dell'anno prima (inizio annata agraria) a dicembre dell'anno
    mesi = [(anno - 1, 11), (anno - 1, 12)] + [(anno, m) for m in range(1, 13)]
    met = meteo[meteo[["anno", "mese"]].apply(tuple, axis=1).isin(mesi)]
    if met.empty:
        continue
    anni_ok.append(anno)
    x = rc.merge(met, on="cella")
    for regione, gr in list(x.groupby("regione")) + [("Italia", x)]:
        for classe, gc in gr.groupby("classe"):
            area = rc[(rc.classe == classe) & ((rc.regione == regione) if regione != "Italia" else True)].ha.sum()
            for (a, m), gm in gc.groupby(["anno", "mese"]):
                w = gm.ha.sum()
                p = (gm.pioggia_mm * gm.ha).sum() / w
                e0 = (gm.et0_mm * gm.ha).sum() / w
                etc = KC[classe][m - 1] * e0
                righe.append([anno, anno_carta, regione, classe, a, m, round(area, 1), round(p, 1), round(e0, 1), round(etc, 1)])
    print(anno, "ok (mappa colture", anno_carta, ")")

df = pd.DataFrame(righe, columns=["anno_mappa", "carta", "regione", "classe", "anno", "mese", "ha", "pioggia", "et0", "etc"])

# ---- ET reale Copernicus (CLMS ETA 300 m, dal novembre 2025): mm/giorno × giorni della decade -> mm/mese
eta_f = os.path.join("data", "eta", "eta_decadi.parquet")
if os.path.exists(eta_f):
    eta = pd.read_parquet(eta_f)
    eta["anno"] = pd.to_datetime(eta.decade).dt.year
    eta["mese"] = pd.to_datetime(eta.decade).dt.month
    for v in ("et", "e", "t"):
        eta[v] = eta[v] * eta.giorni
    m = eta.groupby(["regione", "classe", "anno", "mese"], as_index=False).agg(eta=("et", "sum"), eva=("e", "sum"), tra=("t", "sum"), n=("decade", "nunique"))
    m = m[m.n == 3]                                      # solo mesi con tutte e tre le decadi
    df = df.merge(m.drop(columns="n"), on=["regione", "classe", "anno", "mese"], how="left")
    df = df.round(1)
else:
    df["eta"] = df["eva"] = df["tra"] = None
df["anno_mappa"] = df.anno_mappa.astype(int)
df = df.astype(object).where(df.notna(), None)
out = {
    "generato": pd.Timestamp.now("UTC").isoformat(),
    "fonte": "Copernicus HRL Croplands Crop Types (EEA/CLMS); meteo ERA5 via Open-Meteo; Kc FAO-56; ETa CLMS 300 m (Sentinel-3)",
    "anni": anni_ok,
    "carte": {str(a): int(c) for a, c in df.groupby("anno_mappa").carta.first().items()},
    "classi": {str(k): {"it": v[0], "en": v[1]} for k, v in NOMI.items()},
    "colonne": ["anno_mappa", "regione", "classe", "anno", "mese", "ha", "pioggia", "et0", "etc", "eta", "eva", "tra"],
    "righe": df[["anno_mappa", "regione", "classe", "anno", "mese", "ha", "pioggia", "et0", "etc", "eta", "eva", "tra"]].values.tolist(),
}
with open(os.path.join("data", "riepiloghi.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print("righe:", len(df), "anni:", anni_ok)
