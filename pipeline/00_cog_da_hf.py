# 00 — Se il COG Crop Types dell'anno è già su Hugging Face lo scarica (così 01 e 02 si possono saltare)
import os
from huggingface_hub import hf_hub_download

ANNO = int(os.environ.get("ANNO", "2024"))
REPO = os.environ.get("HF_DATA_REPO", "Bradipo92/campi-aperti-data")
presente = False
try:
    p = hf_hub_download(REPO, f"crop_types/cty_{ANNO}_italia_3035.tif", repo_type="dataset", local_dir="data",
                        token=os.environ.get("HF_TOKEN"))
    os.makedirs(os.path.join("data", "cog"), exist_ok=True)
    os.replace(p, os.path.join("data", "cog", f"cty_{ANNO}_italia_3035.tif"))
    presente = True
except Exception as e:
    print("COG non ancora su Hugging Face:", str(e)[:150])
print("presente:", presente)
with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as fh:
    fh.write(f"presente={'true' if presente else 'false'}\n")
