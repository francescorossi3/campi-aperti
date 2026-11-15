# 14 — Classificatore delle colture v2: LightGBM + reti neurali che votano, su variabili Sentinel-2, Sentinel-1, DEM
#
# Valutazione onesta in due modi:
#   - spaziale: 5 gruppi di zone; ogni zona è valutata da un modello che non l'ha mai vista
#   - temporale: addestramento su tutte le annate tranne l'ultima, verifica sull'ultima
# Confronto con il classificatore v1 (solo NDVI/NDMI/NDRE mensili) sugli stessi pixel.
# Uscite: data/modelli_v2/ (modelli, privati) e data/report_classificatore_v2.json (pubblico, solo metriche)

import os
import glob
import json
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import accuracy_score, f1_score, classification_report

CLASSI = list(range(1, 18))
CAP = int(os.environ.get("CAP", "2500"))          # esempi al massimo per classe e annata nell'addestramento (tempi contenuti)
PIEGHE = 3
os.makedirs(os.path.join("data", "modelli_v2"), exist_ok=True)
ds = pd.concat([pd.read_parquet(f) for f in sorted(glob.glob(os.path.join("data", "dataset_v2", "ds_*.parquet")))], ignore_index=True)
ds = ds[ds.classe.isin(CLASSI)].reset_index(drop=True)
feat = [c for c in ds.columns if c not in ("classe", "zona", "regione", "anno")]
feat_v1 = [c for c in feat if c[:4] in ("ndvi", "ndmi", "ndre")]
print(len(ds), "esempi,", ds.anno.nunique(), "annate,", ds.zona.nunique(), "zone,", len(feat), "variabili")
print(ds.classe.value_counts().sort_index().to_dict())

def pesi(y):
    c = pd.Series(y).value_counts()
    return pd.Series(y).map((c.max() / c) ** 0.5).values

def lgbm(X, y, seed=0):
    m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.08, num_leaves=63, max_bin=63, subsample=0.8, subsample_freq=1, colsample_bytree=0.5,
                           min_child_samples=30, reg_lambda=1.0, random_state=seed, verbose=-1, n_jobs=-1)
    m.fit(X, y, sample_weight=pesi(y))
    return m

def mlp(X, y, seed=0):
    mu, sd = np.nanmean(X, 0), np.nanstd(X, 0) + 1e-6
    Z = np.nan_to_num((X - mu) / sd)
    m = MLPClassifier(hidden_layer_sizes=(256, 128), alpha=1e-3, batch_size=512, max_iter=60, early_stopping=True, n_iter_no_change=8, random_state=seed)
    m.fit(Z, y)
    return m, mu, sd

def prob(modelli, X, classi):
    P = np.zeros((len(X), len(classi)))
    for kind, m in modelli:
        if kind == "lgb":
            p = m.predict_proba(X); cl = m.classes_
        else:
            mm, mu, sd = m; p = mm.predict_proba(np.nan_to_num((X - mu) / sd)); cl = mm.classes_
        for j, c in enumerate(cl):
            P[:, classi.index(c)] += p[:, j]
    return P

def addestra(d, f, seed=0):
    d = d.sample(frac=1, random_state=seed).groupby(["classe", "anno"]).head(CAP)
    X, y = d[f].values.astype("float32"), d.classe.values
    out = [("lgb", lgbm(X, y, seed))]
    sub = d.groupby("classe").head(3000)
    out.append(("mlp", mlp(sub[f].values.astype("float32"), sub.classe.values, seed)))
    return out

def metriche(y, p):
    return {"accuratezza": round(accuracy_score(y, p), 4), "f1_macro": round(f1_score(y, p, average="macro"), 4)}

classi = sorted(ds.classe.unique().tolist())
rep = {"esempi": int(len(ds)), "zone": int(ds.zona.nunique()), "annate": sorted(ds.anno.unique().tolist()), "variabili": len(feat)}

# ---- validazione spaziale (gruppi di zone)
pred, pred1 = np.zeros(len(ds), int), np.zeros(len(ds), int)
for k, (tr, te) in enumerate(GroupKFold(PIEGHE).split(ds, ds.classe, ds.zona)):
    d = ds.iloc[tr]
    d1 = d.sample(frac=1, random_state=k).groupby(["classe", "anno"]).head(CAP)
    P = prob(addestra(d, feat, k), ds.iloc[te][feat].values.astype("float32"), classi)
    pred[te] = np.array(classi)[P.argmax(1)]
    m1 = lgbm(d1[feat_v1].values.astype("float32"), d1.classe.values, k)
    pred1[te] = m1.predict(ds.iloc[te][feat_v1].values.astype("float32"))
    print("gruppo", k, metriche(ds.classe.values[te], pred[te]), flush=True)
rep["spaziale_v2"] = metriche(ds.classe, pred)
rep["spaziale_solo_indici"] = metriche(ds.classe, pred1)
rep["spaziale_per_classe"] = {int(c): round(v["f1-score"], 3) for c, v in classification_report(ds.classe, pred, output_dict=True).items() if c.isdigit()}

# ---- validazione temporale
ult = ds.anno.max()
tr, te = ds[ds.anno < ult], ds[ds.anno == ult]
if len(tr) and len(te):
    P = prob(addestra(tr, feat), te[feat].values.astype("float32"), classi)
    rep["temporale_v2"] = {"anno_verifica": int(ult), **metriche(te.classe, np.array(classi)[P.argmax(1)])}
print(json.dumps(rep, indent=1))

# ---- modello finale su tutto
fin = addestra(ds, feat)
fin[0][1].booster_.save_model(os.path.join("data", "modelli_v2", "lgbm.txt"))
import joblib
joblib.dump({"modelli": fin, "classi": classi, "variabili": feat}, os.path.join("data", "modelli_v2", "colture_v2.joblib"))
imp = pd.Series(fin[0][1].booster_.feature_importance("gain"), index=feat)
gruppi = imp.groupby(lambda c: "Sentinel-1" if c[:2] in ("vv", "vh") else "DEM e latitudine" if c in ("quota", "pendenza", "lat")
                     else "indici S2" if c[:4] in ("ndvi", "ndmi", "ndre") else "bande S2").sum()
rep["importanza_per_prodotto"] = (gruppi / gruppi.sum()).round(3).to_dict()
json.dump(rep, open(os.path.join("data", "report_classificatore_v2.json"), "w"), ensure_ascii=False, indent=1)
