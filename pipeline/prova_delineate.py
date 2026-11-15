# Prova del modello Delineate Anything S su immagini Sentinel-2 (true color) di alcune zone:
# confronta ultralytics con la post-elaborazione "a mano" (quella replicata nel browser) e salva immagini di controllo.
import os, io, json
import numpy as np
import requests
from PIL import Image, ImageDraw
import onnxruntime as ort
from ultralytics import YOLO
from huggingface_hub import hf_hub_download

PC = "https://planetarycomputer.microsoft.com/api"
os.makedirs("prove", exist_ok=True)
onnx = hf_hub_download("Bradipo92/campi-aperti-data", "modelli/delineate_anything_s.onnx", repo_type="dataset")
sess = ort.InferenceSession(onnx)
print([(i.name, i.shape) for i in sess.get_inputs()], [(o.name, o.shape) for o in sess.get_outputs()])
yolo = YOLO(onnx, task="segment")
ZONE = [("Maccarese", 12.23, 41.86), ("Lodi", 9.55, 45.25), ("Tavoliere", 15.55, 41.45), ("Val_dOrcia", 11.65, 43.05)]
riass = {}
for nome, lon, lat in ZONE:
    dx, dy = 1280 / (111320 * np.cos(np.radians(lat))), 1280 / 110540
    bb = [lon - dx, lat - dy, lon + dx, lat + dy]
    body = {"collections": ["sentinel-2-l2a"], "bbox": bb, "datetime": "2025-04-01T00:00:00Z/2025-06-30T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": 5}, "s2:nodata_pixel_percentage": {"lt": 1}}, "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}], "limit": 3}
    its = requests.post(f"{PC}/stac/v1/search", json=body, timeout=120).json()["features"]
    for it in its[:1]:
        for modo, extra in (("visual", "assets=visual"),):
            url = f"{PC}/data/v1/item/bbox/{bb[0]},{bb[1]},{bb[2]},{bb[3]}/512x512.png?collection=sentinel-2-l2a&item={it['id']}&{extra}"
            r = requests.get(url, timeout=180)
            if r.status_code != 200:
                print(nome, modo, r.status_code, r.text[:200]); continue
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            a = np.asarray(img)
            # --- post-elaborazione a mano
            x = (a.astype("float32") / 255).transpose(2, 0, 1)[None]
            o0, o1 = sess.run(None, {sess.get_inputs()[0].name: x})
            p = o0[0].T                         # (N, 4+1+32)
            conf = p[:, 4]
            k = conf > 0.25
            # ultralytics
            res = yolo.predict(a[:, :, ::-1], imgsz=512, conf=0.1, iou=0.5, verbose=False)[0]
            nu = 0 if res.masks is None else len(res.masks)
            riass[f"{nome}_{modo}"] = {"candidati": int(k.sum()), "ultralytics": nu, "media": float(a.mean())}
            print(nome, modo, it["id"], "candidati", int(k.sum()), "istanze ultralytics", nu, "luminosità", a.mean())
            ov = img.copy(); d = ImageDraw.Draw(ov)
            if res.masks is not None:
                for poly in res.masks.xy:
                    if len(poly) > 2:
                        d.line([tuple(q) for q in poly] + [tuple(poly[0])], fill=(255, 255, 0), width=1)
            Image.fromarray(np.hstack([a, np.asarray(ov)])).save(f"prove/{nome}_{modo}_x2.jpg", quality=80)
json.dump({"shape_out": [list(o0.shape), list(o1.shape)], "zone": riass}, open("prove/riassunto.json", "w"), indent=1)
