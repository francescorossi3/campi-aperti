# 04 — Pioggia ed ET0 giornaliere per le celle meteo di 0,5° che contengono colture
#
# Fonte: Open-Meteo Historical Weather API (ERA5 / ERA5-Land, Copernicus C3S), gratuita, senza chiave.
# Il piano gratuito ha un limite giornaliero di chiamate: lo script salva ogni cella appena scaricata e,
# se riceve "429 troppe richieste", si ferma. La Action lo rilancia ogni giorno finché non ha tutto.
# Uscita: data/meteo/celle_mensili.parquet  (cella, anno, mese, pioggia_mm, et0_mm)

import os
import glob
import time
import datetime as dt
import pandas as pd
import requests

INIZIO = os.environ.get("METEO_INIZIO", "2016-11-01")          # da San Martino 2016
FINE = (dt.date.today() - dt.timedelta(days=6)).isoformat()      # l'archivio ERA5 ha ~5 giorni di ritardo
CARTELLA = os.path.join("data", "meteo")
os.makedirs(CARTELLA, exist_ok=True)
DEST = os.path.join(CARTELLA, "celle_mensili.parquet")

# ---- 1. celle necessarie (da tutti gli anni di blocchi disponibili)
celle = set()
for f in glob.glob(os.path.join("data", "blocchi", "blocchi_*.parquet")):
    celle |= set(pd.read_parquet(f, columns=["cella"]).cella.unique())
celle = sorted(celle)
print(len(celle), "celle meteo con colture")

fatto = pd.read_parquet(DEST) if os.path.exists(DEST) else pd.DataFrame(columns=["cella", "anno", "mese", "pioggia_mm", "et0_mm", "fine"])
# una cella è completa se arriva fino al mese prima di FINE
completo = set(fatto.loc[fatto.fine >= FINE[:7], "cella"]) if len(fatto) else set()
da_fare = [c for c in celle if c not in completo]
print(len(da_fare), "celle da scaricare o aggiornare")

nuove = []
def salva():
    if nuove:
        prima = pd.read_parquet(DEST) if os.path.exists(DEST) else fatto
        celle_nuove = set(pd.concat(nuove).cella)
        tutto = pd.concat([prima[~prima.cella.isin(celle_nuove)]] + nuove, ignore_index=True)
        tutto.to_parquet(DEST, index=False)
        print("salvate", len(celle_nuove), "celle; totale", tutto.cella.nunique())

stop = False
for k, c in enumerate(da_fare):
    lat, lon = c.split("_")
    url = (f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
           f"&start_date={INIZIO}&end_date={FINE}&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=Europe%2FRome")
    r = None
    for tentativo in range(3):
        try:
            r = requests.get(url, timeout=300)
            break
        except requests.RequestException as e:
            print(f"  {c}: tentativo {tentativo + 1} non riuscito ({type(e).__name__})")
            time.sleep(20 * (tentativo + 1))
    if r is None:
        continue                               # salto la cella: la riprendo al prossimo giro
    if r.status_code == 429:
        print("limite giornaliero raggiunto: riprendo domani")
        break
    if not r.ok:
        print(f"  {c}: errore {r.status_code}")
        continue
    d = r.json()["daily"]
    g = pd.DataFrame({"data": pd.to_datetime(d["time"]), "p": d["precipitation_sum"], "e": d["et0_fao_evapotranspiration"]})
    g["anno"], g["mese"] = g.data.dt.year, g.data.dt.month
    m = g.groupby(["anno", "mese"]).agg(pioggia_mm=("p", "sum"), et0_mm=("e", "sum")).reset_index()
    m["cella"], m["fine"] = c, FINE[:7]
    nuove.append(m)
    if (k + 1) % 10 == 0:
        print(f"  {k + 1}/{len(da_fare)}")
        salva(); nuove = []
    time.sleep(1)

salva()
