# 17 — Indice dei file Copernicus su Hugging Face (date disponibili per prodotto), letto dal sito
import os, json, re
from huggingface_hub import HfApi
api = HfApi(token=os.environ.get("HF_TOKEN"))
files = api.list_repo_files(os.environ["HF_DATA_REPO"], repo_type="dataset")
ind = {}
for f in files:
    m = re.match(r"clms/([A-Z]+)/(\d{4}-\d{2}-\d{2})\.tif$", f)
    if m:
        ind.setdefault(m[1], []).append(m[2])
    m = re.match(r"eta/italia/ETA300_(\d{4}-\d{2}-\d{2})_ET-ENSEMBLE\.tif$", f)
    if m:
        ind.setdefault("ETA", []).append(m[1])
ind = {k: sorted(v) for k, v in ind.items()}
json.dump(ind, open(os.path.join("data", "clms_indice.json"), "w"), separators=(",", ":"))
print({k: (len(v), v[-1]) for k, v in ind.items()})
