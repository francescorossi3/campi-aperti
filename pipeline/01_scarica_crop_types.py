# Columella — 01: scarica i tasselli Copernicus HRL Croplands "Crop Types" (CTY) che coprono l'Italia
#
# Fonte: Copernicus Data Space Ecosystem (CDSE), catalogo OData (pubblico) + download (serve token).
# Ingressi: env ANNO (def. 2024), CDSE_USERNAME e CDSE_PASSWORD (su GitHub sono "secrets").
# In Spyder: impostale prima con  os.environ["CDSE_USERNAME"] = "..."  oppure nel file .env
# Uscita: data/cty/<anno>/*.tif  (COG originali, EPSG:3035, uint16, 10 m)
# Esecuzione: workflow crop-types.yml (saltato se 00 trova il COG) oppure Spyder
# EN: downloads the Copernicus Crop Types tiles covering Italy from CDSE.

import os
import io
import time
import zipfile
import requests

ANNO = int(os.environ.get("ANNO", "2024"))
CARTELLA = os.path.join("data", "cty", str(ANNO))
os.makedirs(CARTELLA, exist_ok=True)

UTENTE = os.environ["CDSE_USERNAME"]
PASSWORD = os.environ["CDSE_PASSWORD"]

CATALOGO = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
DOWNLOAD = "https://zipper.dataspace.copernicus.eu/odata/v1/Products({})/$value"
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"

# rettangolo che contiene l'Italia (lon/lat); i tasselli LAEA da 100 km che lo toccano
ITALIA_WKT = "POLYGON((6.5 35.4,18.6 35.4,18.6 47.1,6.5 47.1,6.5 35.4))"

# ---- 1. elenco dei prodotti dal catalogo (non serve login)
filtro = (f"Collection/Name eq 'CLMS' and startswith(Name,'CLMS_HRLVLCC_CTY_S{ANNO}_R10m') "
          f"and OData.CSC.Intersects(area=geography'SRID=4326;{ITALIA_WKT}')")
prodotti = []
url = f"{CATALOGO}?$filter={filtro}&$top=200&$count=true"
while url:
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    j = r.json()
    prodotti += j["value"]
    url = j.get("@odata.nextLink")
print(f"{ANNO}: {len(prodotti)} tasselli Crop Types sull'Italia")

# ---- 2. token CDSE (dura 10 minuti: lo rinnovo ogni 8)
token, t_token = None, 0
def nuovo_token():
    r = requests.post(TOKEN_URL, data={"grant_type": "password", "username": UTENTE, "password": PASSWORD,
                                       "client_id": "cdse-public"}, timeout=60)
    r.raise_for_status()
    return r.json()["access_token"]

# ---- 3. scaricamento: ogni prodotto è uno zip con il .tif e i metadati
scaricati = 0
for i, p in enumerate(prodotti):
    nome = p["Name"]
    dest = os.path.join(CARTELLA, nome + ".tif")
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        continue
    if token is None or time.time() - t_token > 480:
        token, t_token = nuovo_token(), time.time()
    for tentativo in range(4):
        try:
            r = requests.get(DOWNLOAD.format(p["Id"]), headers={"Authorization": f"Bearer {token}"}, timeout=600)
            if r.status_code == 401:
                token, t_token = nuovo_token(), time.time()
                continue
            r.raise_for_status()
            break
        except requests.RequestException as e:
            print("  riprovo", nome, e)
            time.sleep(10 * (tentativo + 1))
    else:
        raise RuntimeError(f"impossibile scaricare {nome}")
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        tifs = [n for n in z.namelist() if n.lower().endswith(".tif") and "CTY_" in n]
        with z.open(tifs[0]) as src, open(dest, "wb") as out:
            out.write(src.read())
    scaricati += 1
    print(f"  [{i + 1}/{len(prodotti)}] {nome}  {os.path.getsize(dest) / 1e6:.1f} MB")

print(f"Fatto: {scaricati} nuovi file in {CARTELLA}")
