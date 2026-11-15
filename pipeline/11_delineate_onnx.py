# Esporta il modello Delineate Anything S (YOLO11n-seg, AGPL-3.0, Lavreniuk et al. 2025)
# in formato ONNX per l'inferenza nel browser e lo pubblica nel repository dati (pubblico).
import os
from huggingface_hub import hf_hub_download, HfApi
from ultralytics import YOLO

pt = hf_hub_download("torchgeo/delineate-anything-s", "delineate_anything_s_rgb_yolo11n-b879d643.pt",
                     revision="69cd440b0c5bd450ced145e68294aa9393ddae05")
m = YOLO(pt, task="segment")
print(m.model.names)
onnx = m.export(format="onnx", imgsz=512, opset=12, simplify=True, dynamic=False)
os.makedirs("data/modelli", exist_ok=True)
dest = "data/modelli/delineate_anything_s.onnx"
os.replace(onnx, dest)
print(dest, os.path.getsize(dest) / 1e6, "MB")

api = HfApi(token=os.environ["HF_TOKEN"])
api.upload_file(path_or_fileobj=dest, path_in_repo="modelli/delineate_anything_s.onnx",
                repo_id=os.environ["HF_DATA_REPO"], repo_type="dataset",
                commit_message="Delineate Anything S in ONNX (AGPL-3.0, Lavreniuk et al. 2025)")
