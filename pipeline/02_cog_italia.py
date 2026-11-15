# 02 — Unisce i tasselli Crop Types di un anno in un unico COG per l'Italia e lo carica su Hugging Face
#
# - ricodifica le classi da uint16 (1110, 1120, ...) a uint8 (1..19), 0 = nessuna coltura, 255 = nodata
# - resta in EPSG:3035 (equivalente: ogni pixel vale esattamente 100 m²)
# - COG con compressione DEFLATE, blocchi 512 e panoramiche in modalità "mode" (classi)
# Usa solo rasterio (GDAL incluso nel pacchetto): il mosaico è un VRT scritto a mano con una LUT.
#
# Uscita: data/cog/cty_<anno>_italia_3035.tif  e  dataset HF  <utente>/campi-aperti-data

import os
import glob
import rasterio
import rasterio.shutil
from classi import CTY_CODICI

ANNO = int(os.environ.get("ANNO", "2024"))
HF_REPO = os.environ.get("HF_DATA_REPO", "Bradipo92/campi-aperti-data")
CARICA = bool(os.environ.get("HF_TOKEN"))

tifs = sorted(glob.glob(os.path.join("data", "cty", str(ANNO), "*.tif")))
print(f"{ANNO}: {len(tifs)} tasselli")
os.makedirs(os.path.join("data", "cog"), exist_ok=True)
vrt = os.path.join("data", "cog", f"cty_{ANNO}.vrt")
cog = os.path.join("data", "cog", f"cty_{ANNO}_italia_3035.tif")

# ---- 1. estensione complessiva dei tasselli (stessa griglia LAEA a 10 m)
info = []
for f in tifs:
    with rasterio.open(f) as ds:
        info.append((os.path.abspath(f), ds.bounds, ds.width, ds.height, ds.block_shapes[0], ds.crs, ds.res))
res = info[0][6][0]
xmin = min(b.left for _, b, *_ in info)
xmax = max(b.right for _, b, *_ in info)
ymin = min(b.bottom for _, b, *_ in info)
ymax = max(b.top for _, b, *_ in info)
W, H = int(round((xmax - xmin) / res)), int(round((ymax - ymin) / res))
print(f"mosaico {W} × {H} pixel")

# ---- 2. VRT con ricodifica (LUT) uint16 -> uint8
lut = ",".join(f"{a}:{b}" for a, b in sorted(CTY_CODICI.items()))
sorgenti = []
for path, b, w, h, (by, bx), crs, _ in info:
    xo, yo = int(round((b.left - xmin) / res)), int(round((ymax - b.top) / res))
    sorgenti.append(f"""    <ComplexSource>
      <SourceFilename relativeToVRT="0">{path}</SourceFilename>
      <SourceBand>1</SourceBand>
      <SourceProperties RasterXSize="{w}" RasterYSize="{h}" DataType="UInt16" BlockXSize="{bx}" BlockYSize="{by}"/>
      <SrcRect xOff="0" yOff="0" xSize="{w}" ySize="{h}"/>
      <DstRect xOff="{xo}" yOff="{yo}" xSize="{w}" ySize="{h}"/>
      <NODATA>65535</NODATA>
      <LUT>{lut}</LUT>
    </ComplexSource>""")
xml = f"""<VRTDataset rasterXSize="{W}" rasterYSize="{H}">
  <SRS>{info[0][5].to_wkt()}</SRS>
  <GeoTransform>{xmin}, {res}, 0, {ymax}, 0, {-res}</GeoTransform>
  <VRTRasterBand dataType="Byte" band="1">
    <NoDataValue>255</NoDataValue>
{chr(10).join(sorgenti)}
  </VRTRasterBand>
</VRTDataset>"""
with open(vrt, "w") as fh:
    fh.write(xml)

# ---- 3. COG
with rasterio.Env(GDAL_NUM_THREADS="ALL_CPUS", GDAL_CACHEMAX=2048):
    rasterio.shutil.copy(vrt, cog, driver="COG", COMPRESS="DEFLATE", LEVEL=9, BLOCKSIZE=512,
                         OVERVIEW_RESAMPLING="MODE", NUM_THREADS="ALL_CPUS", BIGTIFF="IF_SAFER")
print(f"COG: {cog}  {os.path.getsize(cog) / 1e6:.0f} MB")

# ---- 4. caricamento su Hugging Face (dataset pubblico; il repository dei modelli resta privato)
if CARICA:
    from huggingface_hub import HfApi
    api = HfApi(token=os.environ["HF_TOKEN"])
    api.create_repo(HF_REPO, repo_type="dataset", private=False, exist_ok=True)
    api.create_repo(os.environ.get("HF_MODEL_REPO", "Bradipo92/campi-aperti-models"), repo_type="model", private=True, exist_ok=True)
    api.upload_file(path_or_fileobj=cog, path_in_repo=f"crop_types/cty_{ANNO}_italia_3035.tif", repo_id=HF_REPO,
                    repo_type="dataset", commit_message=f"Crop Types {ANNO} Italia (COG EPSG:3035, classi uint8)")
    print("caricato su", HF_REPO)
