# Sincronizza cartelle di lavoro con il dataset Hugging Face (usato dalle GitHub Actions)
# MODO=giu  scarica  CARTELLE (es. "blocchi,meteo") dal dataset in data/
# MODO=su   carica   CARTELLE da data/ al dataset
import os
from huggingface_hub import HfApi, snapshot_download

MODO = os.environ.get("MODO", "giu")
CARTELLE = [c for c in os.environ.get("CARTELLE", "blocchi,meteo").split(",") if c]
REPO = os.environ.get("HF_DATA_REPO", "Bradipo92/campi-aperti-data")
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo(REPO, repo_type="dataset", private=False, exist_ok=True)

if MODO == "giu":
    snapshot_download(REPO, repo_type="dataset", local_dir="data", allow_patterns=[f"{c}/*" for c in CARTELLE],
                      token=os.environ["HF_TOKEN"])
else:
    for c in CARTELLE:
        if os.path.isdir(os.path.join("data", c)):
            api.upload_folder(folder_path=os.path.join("data", c), path_in_repo=c, repo_id=REPO, repo_type="dataset",
                              commit_message=f"aggiorna {c}")
print(MODO, CARTELLE, "ok")
