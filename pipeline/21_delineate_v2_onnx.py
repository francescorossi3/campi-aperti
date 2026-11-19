# Columella — 21: esporta Delineate Anything v2 (YOLO11-seg, AGPL-3.0, Lavreniuk et al. 2026) in ONNX per il browser,
# ne fa una versione quantizzata a 8 bit (circa 4 volte più leggera), la confronta con il modello S già in uso
# su tre tasselli Sentinel-2 (tempo per tassello e numero di campi) e pubblica i file nel repository dati.
# Licenza: modello e pesi restano AGPL-3.0 (attribuzione: Lavreniuk et al. 2026, MykolaL/DelineateAnything).
# Ingressi: pesi DelineateAnythingv2.pt da Hugging Face (controllo SHA-256); env HF_TOKEN, HF_DATA_REPO
# Uscite: data/modelli/delineate_anything_v2.onnx e delineate_anything_v2_int8.onnx (caricati in <HF_DATA_REPO>/modelli/),
#         data/modelli/delineate_v2_prova.json (tempi e confronto)
# Esecuzione: workflow delineate.yml (da pipeline/) oppure Spyder
# EN: exports Delineate Anything v2 (AGPL-3.0) to ONNX (+ 8-bit version), benchmarks it against model S, uploads to HF.
import os, json, time, hashlib, io
import numpy as np, requests
from PIL import Image
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
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
# versione a 8 bit: pesi quantizzati, calcolo nel browser più rapido e file più piccolo
i8 = "data/modelli/delineate_anything_v2_int8.onnx"
quantize_dynamic(f32, i8, weight_type=QuantType.QUInt8)
for f in (f32, i8):
    print(f, round(os.path.getsize(f) / 1e6, 1), "MB")

# prova: tre tasselli Sentinel-2 a 5 m (2,56 km) come nel sito
s_onnx = hf_hub_download(os.environ["HF_DATA_REPO"], "modelli/delineate_anything_s.onnx", repo_type="dataset")
PC = "https://planetarycomputer.microsoft.com/api"
SITI = {"lodi": (9.55, 45.25), "maccarese": (12.23, 41.86), "muccese": (13.0524, 43.1167)}
modelli = {"S": s_onnx, "v2": f32, "v2_int8": i8}
sess = {k: ort.InferenceSession(v, providers=["CPUExecutionProvider"]) for k, v in modelli.items()}
prova = {"pesi_mb": {k: round(os.path.getsize(v) / 1e6, 1) for k, v in modelli.items()}, "siti": {}}
for nome, (lo, la) in SITI.items():
    cx, cy = lo * 20037508.34 / 180, np.log(np.tan((90 + la) * np.pi / 360)) * 6378137
    T = 2560 / np.cos(la * np.pi / 180)
    body = {"collections": ["sentinel-2-l2a"], "intersects": {"type": "Point", "coordinates": [lo, la]},
            "datetime": "2026-05-01/2026-09-30", "query": {"eo:cloud_cover": {"lt": 5}}, "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}], "limit": 1}
    it = requests.post(PC + "/stac/v1/search", json=body, timeout=60).json()["features"][0]
    url = (f"{PC}/data/v1/item/bbox/{cx - T / 2},{cy - T / 2},{cx + T / 2},{cy + T / 2}/512x512.png?collection=sentinel-2-l2a"
           f"&item={it['id']}&assets=visual&coord_crs=epsg:3857&dst_crs=epsg:3857")
    img = np.asarray(Image.open(io.BytesIO(requests.get(url, timeout=120).content)).convert("RGB"), dtype=np.float32) / 255
    x = img.transpose(2, 0, 1)[None].copy()
    r = {"data": it["properties"]["datetime"][:10]}
    for k, s in sess.items():
        s.run(None, {s.get_inputs()[0].name: x})                       # primo giro (riscaldamento)
        t0 = time.time(); out = s.run(None, {s.get_inputs()[0].name: x}); dt = time.time() - t0
        conf = out[0][0, 4]
        r[k] = {"s_per_tassello": round(dt, 2), "rilevazioni_conf_0.25": int((conf > 0.25).sum())}
        if k == "v2": ref = out
        if k == "v2_int8":
            r[k]["scarto_medio_conf"] = round(float(np.abs(out[0][0, 4] - ref[0][0, 4]).mean()), 4)
    prova["siti"][nome] = r
    print(nome, r)
json.dump(prova, open("data/modelli/delineate_v2_prova.json", "w"), indent=1)

api = HfApi(token=os.environ["HF_TOKEN"])
for f in (f32, i8, "data/modelli/delineate_v2_prova.json"):
    api.upload_file(path_or_fileobj=f, path_in_repo="modelli/" + os.path.basename(f), repo_id=os.environ["HF_DATA_REPO"],
                    repo_type="dataset", commit_message="Delineate Anything v2 in ONNX (AGPL-3.0, Lavreniuk et al. 2026)")
