# Columella — 21: esporta Delineate Anything v2 (YOLO11-seg, AGPL-3.0, Lavreniuk et al. 2026) in ONNX per il browser,
# ne fa una versione con pesi a 16 bit (metà peso, calcolo a 32 bit), la confronta con il modello S già in uso
# su quattro zone (tempo, campi, immagini di confronto; v2 anche a 10 m) e pubblica il modello nel repository dati.
# (Provata anche la quantizzazione a 8 bit: più lenta e con risultati diversi, scartata.)
# Licenza: modello e pesi restano AGPL-3.0 (attribuzione: Lavreniuk et al. 2026, MykolaL/DelineateAnything).
# Ingressi: pesi DelineateAnythingv2.pt da Hugging Face (controllo SHA-256); env HF_TOKEN, HF_DATA_REPO
# Uscite: data/modelli/delineate_anything_v2_f16.onnx (caricato in <HF_DATA_REPO>/modelli/),
#         data/modelli/delineate_v2_prova.json e confronto_<zona>.png (immagine | S | v2 | v2 a 10 m)
# Esecuzione: workflow delineate.yml (da pipeline/) oppure Spyder
# EN: exports Delineate Anything v2 (AGPL-3.0) to ONNX (+ 8-bit version), benchmarks it against model S, uploads to HF.
import os, json, time, hashlib, io
import numpy as np, requests
from PIL import Image
import onnxruntime as ort
from huggingface_hub import hf_hub_download, HfApi
from ultralytics import YOLO

SHA = "46700b8a279b07922953a11adaeb5e658d9a2384b6334c8e0a3090886218915a"   # DelineateAnythingv2.pt (settembre 2026)
os.makedirs("data/modelli", exist_ok=True)
pt = hf_hub_download("MykolaL/DelineateAnything", "DelineateAnythingv2.pt")
h = hashlib.sha256(open(pt, "rb").read()).hexdigest()
assert h == SHA, "pesi diversi da quelli controllati: " + h
m = YOLO(pt, task="segment")
print("classi:", m.model.names, "parametri:", sum(p.numel() for p in m.model.parameters()) / 1e6, "M")

# ONNX a 32 bit, stesso formato del modello S (ingresso 1×3×512×512, uscite box+maschere e prototipi)
onnx = m.export(format="onnx", imgsz=512, opset=12, simplify=True, dynamic=False)
f32 = "data/modelli/delineate_anything_v2.onnx"
os.replace(onnx, f32)
# versione con pesi a 16 bit e calcolo a 32 bit (Cast all'apertura): metà peso, stessi risultati, funziona nel browser (wasm)
import onnx as ox
from onnx import helper, numpy_helper, TensorProto
g = ox.load(f32)
nuovi = []
for ini in list(g.graph.initializer):
    a = numpy_helper.to_array(ini)
    if a.dtype != np.float32 or a.size < 1024: continue
    h16 = numpy_helper.from_array(a.astype(np.float16), ini.name + "_f16")
    g.graph.initializer.remove(ini); g.graph.initializer.append(h16)
    nuovi.append(helper.make_node("Cast", [h16.name], [ini.name], to=TensorProto.FLOAT, name="cast_" + ini.name))
for nd in reversed(nuovi): g.graph.node.insert(0, nd)
f16 = "data/modelli/delineate_anything_v2_f16.onnx"
ox.save(g, f16)
for f in (f32, f16):
    print(f, round(os.path.getsize(f) / 1e6, 1), "MB")

# prova: tre zone, immagine Sentinel-2 come nel sito (2,56 km a 5 m) e, per v2, anche a 10 m (5,12 km, poi il quarto centrale)
s_onnx = hf_hub_download(os.environ["HF_DATA_REPO"], "modelli/delineate_anything_s.onnx", repo_type="dataset")
PC = "https://planetarycomputer.microsoft.com/api"
SITI = {"lodi": (9.55, 45.25), "maccarese": (12.23, 41.86), "muccese": (13.0524, 43.1167), "foggia": (15.62, 41.50)}
sess = {k: ort.InferenceSession(v, providers=["CPUExecutionProvider"]) for k, v in {"S": s_onnx, "v2": f32, "v2_f16": f16}.items()}
prova = {"pesi_mb": {"S": round(os.path.getsize(s_onnx) / 1e6, 1), "v2": round(os.path.getsize(f32) / 1e6, 1), "v2_f16": round(os.path.getsize(f16) / 1e6, 1)}, "siti": {}}
rng = np.random.default_rng(0)
PAL = rng.integers(40, 255, (5000, 3), dtype=np.uint8)
def campi(s, x, conf=0.1, iou=0.5):
    # stessa post-elaborazione del sito (delineate.js): NMS, maschere dai prototipi, frammenti tolti
    o0, o1 = s.run(None, {s.get_inputs()[0].name: x})
    od, pr = o0[0], o1[0]
    C, N = od.shape; P = pr.shape[1]
    idx = np.where(od[4] >= conf)[0]; idx = idx[np.argsort(-od[4, idx])]
    bx = np.stack([od[0] - od[2] / 2, od[1] - od[3] / 2, od[0] + od[2] / 2, od[1] + od[3] / 2], 1)
    keep = []
    for i in idx:
        if len(keep) >= 300: break
        ok = True
        for k in keep:
            ix = max(0, min(bx[i, 2], bx[k, 2]) - max(bx[i, 0], bx[k, 0])); iy = max(0, min(bx[i, 3], bx[k, 3]) - max(bx[i, 1], bx[k, 1]))
            I = ix * iy; U = (bx[i, 2] - bx[i, 0]) * (bx[i, 3] - bx[i, 1]) + (bx[k, 2] - bx[k, 0]) * (bx[k, 3] - bx[k, 1]) - I
            if I / U >= iou: ok = False; break
        if ok: keep.append(i)
    lab = np.zeros((512, 512), np.int32); area = {}
    up = lambda m: np.asarray(Image.fromarray(m.astype(np.float32)).resize((512, 512), Image.BILINEAR))
    for j, i in enumerate(reversed(keep)):
        lg = up(np.tensordot(od[5:, i], pr, 1))
        x0, y0, x1, y1 = [int(np.clip(v, 0, 511)) for v in bx[i]]
        sub = np.zeros_like(lab, bool); sub[y0:y1 + 1, x0:x1 + 1] = lg[y0:y1 + 1, x0:x1 + 1] > 0
        lab[sub] = j + 1; area[j + 1] = sub.sum()
    ids, cnt = np.unique(lab, return_counts=True)
    for l, c in zip(ids, cnt):
        if l and (c < 40 or c < 0.35 * area[l]): lab[lab == l] = 0
    return lab
def colora(img, lab):
    out = (img * 255).astype(np.uint8).copy()
    m = lab > 0
    out[m] = (0.45 * out[m] + 0.55 * PAL[lab[m] % 5000]).astype(np.uint8)
    bd = np.zeros_like(m); bd[1:] |= lab[1:] != lab[:-1]; bd[:, 1:] |= lab[:, 1:] != lab[:, :-1]
    out[bd] = 255
    return out
def tassello(lo, la, km, it):
    cx, cy = lo * 20037508.34 / 180, np.log(np.tan((90 + la) * np.pi / 360)) * 6378137
    T = km * 1000 / np.cos(la * np.pi / 180)
    url = (f"{PC}/data/v1/item/bbox/{cx - T / 2},{cy - T / 2},{cx + T / 2},{cy + T / 2}/512x512.png?collection=sentinel-2-l2a"
           f"&item={it['id']}&assets=visual&coord_crs=epsg:3857&dst_crs=epsg:3857")
    return np.asarray(Image.open(io.BytesIO(requests.get(url, timeout=120).content)).convert("RGB"), dtype=np.float32) / 255
for nome, (lo, la) in SITI.items():
    body = {"collections": ["sentinel-2-l2a"], "intersects": {"type": "Point", "coordinates": [lo, la]},
            "datetime": "2026-05-01/2026-09-30", "query": {"eo:cloud_cover": {"lt": 5}}, "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}], "limit": 1}
    it = requests.post(PC + "/stac/v1/search", json=body, timeout=60).json()["features"][0]
    i5, i10 = tassello(lo, la, 2.56, it), tassello(lo, la, 5.12, it)
    r = {"data": it["properties"]["datetime"][:10]}
    pannelli = [(i5 * 255).astype(np.uint8)]
    for k, img, centro in [("S", i5, False), ("v2", i5, False), ("v2_f16", i5, False), ("v2_10m", i10, True)]:
        s = sess["v2" if k == "v2_10m" else k]; x = img.transpose(2, 0, 1)[None].copy()
        s.run(None, {s.get_inputs()[0].name: x})
        t0 = time.time(); lab = campi(s, x); dt = time.time() - t0
        if centro:      # quarto centrale (stessi 2,56 km), ingrandito a 512 per il confronto
            lab = np.asarray(Image.fromarray(lab[128:384, 128:384]).resize((512, 512), Image.NEAREST)); img = np.asarray(Image.fromarray((img[128:384, 128:384] * 255).astype(np.uint8)).resize((512, 512))) / 255
        r[k] = {"s_per_tassello": round(dt, 2), "campi": int(len(np.unique(lab)) - 1), "copertura": round(float((lab > 0).mean()), 2)}
        if k != "v2_f16": pannelli.append(colora(img, lab))
    prova["siti"][nome] = r
    print(nome, r)
    Image.fromarray(np.concatenate(pannelli, 1)).save(f"data/modelli/confronto_{nome}.png")
json.dump(prova, open("data/modelli/delineate_v2_prova.json", "w"), indent=1)

api = HfApi(token=os.environ["HF_TOKEN"])
for f in (f16, "data/modelli/delineate_v2_prova.json"):
    api.upload_file(path_or_fileobj=f, path_in_repo="modelli/" + os.path.basename(f), repo_id=os.environ["HF_DATA_REPO"],
                    repo_type="dataset", commit_message="Delineate Anything v2 in ONNX (AGPL-3.0, Lavreniuk et al. 2026)")
