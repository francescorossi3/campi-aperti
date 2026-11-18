# Columella — sincronizza cartelle di lavoro in data/ con il dataset Hugging Face
# MODO=giu  scarica  CARTELLE (es. "blocchi,meteo") dal dataset in data/
# MODO=su   carica   CARTELLE da data/ al dataset (crea il dataset pubblico se manca)
# Ingressi: env MODO, CARTELLE, HF_DATA_REPO, HF_TOKEN (obbligatorio)
# Esecuzione: quasi tutti i workflow (da pipeline/) oppure Spyder
# EN: downloads/uploads data/ subfolders from/to the Hugging Face dataset.
import os
import time
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
            for tentativo in range(6):          # più job caricano insieme: in caso di conflitto si riprova
                try:
                    api.upload_folder(folder_path=os.path.join("data", c), path_in_repo=c, repo_id=REPO, repo_type="dataset",
                                      commit_message=f"aggiorna {c}")
                    break
                except Exception as e:
                    print("caricamento non riuscito, riprovo:", str(e)[:120])
                    time.sleep(30 * (tentativo + 1))
print(MODO, CARTELLE, "ok")
