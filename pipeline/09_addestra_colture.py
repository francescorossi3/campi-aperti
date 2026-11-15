# 09 — Addestramento del classificatore delle colture (insieme di reti neurali che votano)
#
# Dati: data/dataset/ds_<anno>.parquet (script 08), etichette Copernicus HRL Crop Types.
# Modello: 5 reti MLP (scikit-learn) addestrate su campioni bootstrap diversi; la classe finale è quella più votata,
# e nel sito si vota anche su varianti della curva (un mese tolto alla volta).
# Validazione onesta: si addestra su tutti gli anni tranne l'ultimo e si misura l'accuratezza sull'ultimo.
# Uscite: data/modelli/colture_mlp.json (pesi), data/modelli/report.json (accuratezza per classe)

import os
import glob
import json
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

CLASSI = list(range(1, 18))                       # 18 e 19 sono "non classificate": escluse
PER_CLASSE = int(os.environ.get("PER_CLASSE", "3000"))
N_MODELLI = 5
os.makedirs(os.path.join("data", "modelli"), exist_ok=True)

ds = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join("data", "dataset", "ds_*.parquet")))], ignore_index=True)
ds = ds[ds.classe.isin(CLASSI)]
feat = [c for c in ds.columns if c[:4] in ("ndvi", "ndmi", "ndre")]
print(len(ds), "esempi,", ds.anno.nunique(), "annate,", ds.zona.nunique(), "zone")
print(ds.classe.value_counts().sort_index().to_dict())

def bilancia(d, seed):
    # al massimo PER_CLASSE esempi per classe e annata (le classi rare restano tutte)
    return d.sample(frac=1, random_state=seed).groupby(["classe", "anno"]).head(PER_CLASSE)

def addestra(d, seed):
    X, y = d[feat].values.astype("float32"), d.classe.values
    mu, sd = X.mean(0), X.std(0) + 1e-6
    m = MLPClassifier(hidden_layer_sizes=(128, 64), alpha=1e-3, batch_size=512, max_iter=200, early_stopping=True,
                      n_iter_no_change=10, random_state=seed)
    m.fit((X - mu) / sd, y)
    return m, mu, sd

def vota(modelli, X):
    voti = np.zeros((len(X), len(CLASSI)))
    for m, mu, sd in modelli:
        p = m.predict_proba((X - mu) / sd)
        idx = [CLASSI.index(c) for c in m.classes_]
        voti[np.arange(len(X)), [idx[k] for k in p.argmax(1)]] += 1
    return np.array(CLASSI)[voti.argmax(1)], voti.max(1) / len(modelli)

# ---- 1. validazione: addestro senza l'ultima annata
ultimo = int(ds.anno.max())
tr, te = ds[ds.anno != ultimo], ds[ds.anno == ultimo]
report = {"anno_test": ultimo}
if len(tr) and len(te):
    mods = []
    for k in range(N_MODELLI):
        b = bilancia(tr, k).sample(frac=1.0, replace=True, random_state=100 + k)
        mods.append(addestra(b, k))
    pred, accordo = vota(mods, te[feat].values.astype("float32"))
    acc = accuracy_score(te.classe, pred)
    print(f"accuratezza sull'annata {ultimo} (mai vista): {acc:.3f}")
    rep = classification_report(te.classe, pred, output_dict=True, zero_division=0)
    report.update({"accuratezza": round(acc, 4), "per_classe": {str(k): {m: round(v, 3) for m, v in rep[str(k)].items()} for k in CLASSI if str(k) in rep},
                   "confusione": confusion_matrix(te.classe, pred, labels=CLASSI).tolist(), "classi": CLASSI,
                   "accuratezza_voto_unanime": round(float(accuracy_score(te.classe[accordo == 1], pred[accordo == 1])), 4) if (accordo == 1).any() else None,
                   "quota_unanime": round(float((accordo == 1).mean()), 3)})
    print(classification_report(te.classe, pred, zero_division=0))

# ---- 2. modello finale su tutte le annate
modelli = []
for k in range(N_MODELLI):
    b = bilancia(ds, k).sample(frac=1.0, replace=True, random_state=200 + k)
    modelli.append(addestra(b, k))
out = {"versione": pd.Timestamp.now("UTC").isoformat(), "variabili": feat, "classi": CLASSI, "modelli": []}
for m, mu, sd in modelli:
    out["modelli"].append({"mu": mu.round(5).tolist(), "sd": sd.round(5).tolist(), "classi": [int(c) for c in m.classes_],
                           "strati": [{"W": np.round(W, 5).tolist(), "b": np.round(b, 5).tolist()} for W, b in zip(m.coefs_, m.intercepts_)]})
with open(os.path.join("data", "modelli", "colture_mlp.json"), "w") as fh:
    json.dump(out, fh, separators=(",", ":"))
report["esempi"] = int(len(ds)); report["annate"] = sorted(int(a) for a in ds.anno.unique())
with open(os.path.join("data", "modelli", "report.json"), "w") as fh:
    json.dump(report, fh, indent=1)
print("modello salvato;", os.path.getsize(os.path.join("data", "modelli", "colture_mlp.json")) // 1024, "KB")
