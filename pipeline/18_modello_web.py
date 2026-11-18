# Columella — 18: classificatore delle colture per il browser: 3 reti neurali (MLP) che votano, pesi pubblici in JSON
#
# Stesse variabili del v2 (script 13): mediane mensili nov→ott di 10 bande Sentinel-2, NDVI/NDMI/NDRE, Sentinel-1 VV/VH (dB)
# e VH−VV, quota, pendenza, latitudine. Nel sito le variabili si calcolano come medie sul campo.
# Verifica: un gruppo di zone escluso dall'addestramento (accuratezza del solo insieme di reti).
# Ingressi: data/dataset_v2/ds_*.parquet (13)
# Uscita: data/modelli_web/colture_v2_mlp.json (pubblico su Hugging Face, modelli/)
# Esecuzione: workflow modello-web.yml (che poi carica il JSON) oppure Spyder
# EN: trains a 3-MLP ensemble for in-browser crop classification and exports its weights as JSON.
import os
import glob
import json
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import accuracy_score, f1_score

CAP = 3000
ds = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join("data", "dataset_v2", "ds_*.parquet")))], ignore_index=True)
ds = ds[ds.classe.between(1, 17)].reset_index(drop=True)
feat = [c for c in ds.columns if c not in ("classe", "zona", "regione", "anno")]
print(len(ds), "esempi,", len(feat), "variabili", flush=True)

def addestra(d, seed):
    d = d.sample(frac=1, random_state=seed).groupby(["classe", "anno"]).head(CAP)
    X = d[feat].values.astype("float32")
    mu, sd = np.nanmean(X, 0), np.nanstd(X, 0) + 1e-6
    Z = np.nan_to_num((X - mu) / sd)
    m = MLPClassifier(hidden_layer_sizes=(128, 64), alpha=1e-3, batch_size=512, max_iter=80, early_stopping=True, n_iter_no_change=8, random_state=seed)
    m.fit(Z, d.classe.values)
    return m, mu, sd

def prob(ms, X):
    P = 0
    for m, mu, sd in ms:
        P = P + m.predict_proba(np.nan_to_num((X - mu) / sd))
    return P / len(ms)

# verifica: primo dei 4 gruppi di zone escluso dall'addestramento
tr, te = next(GroupKFold(4).split(ds, ds.classe, ds.zona))
ms = [addestra(ds.iloc[tr], s) for s in range(3)]
p = ms[0][0].classes_[prob(ms, ds.iloc[te][feat].values.astype("float32")).argmax(1)]
ver = {"accuratezza": round(accuracy_score(ds.classe.iloc[te], p), 4), "f1_macro": round(f1_score(ds.classe.iloc[te], p, average="macro"), 4)}
print("verifica su zone escluse:", ver, flush=True)

# modelli finali su tutti i dati
ms = [addestra(ds, s) for s in range(3)]
out = {"variabili": feat, "classi": [int(c) for c in ms[0][0].classes_], "verifica_zone_escluse": ver,
       "fonte": "Campi Aperti — addestrato su etichette Copernicus HRL Crop Types 2019-2024 (CC BY 4.0)",
       "reti": [{"mu": [round(float(v), 5) for v in mu], "sd": [round(float(v), 5) for v in sd],
                 "W": [np.round(w, 5).tolist() for w in m.coefs_], "b": [np.round(b, 5).tolist() for b in m.intercepts_]} for m, mu, sd in ms]}
os.makedirs(os.path.join("data", "modelli_web"), exist_ok=True)
json.dump(out, open(os.path.join("data", "modelli_web", "colture_v2_mlp.json"), "w"), separators=(",", ":"))
print("scritto", os.path.getsize(os.path.join("data", "modelli_web", "colture_v2_mlp.json")) / 1e6, "MB")
