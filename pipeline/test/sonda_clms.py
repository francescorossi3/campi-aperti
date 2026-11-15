# Sonda del catalogo CDSE: prodotti biogeofisici CLMS disponibili, nomi e file contenuti
import os, requests
CAT = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
tok = requests.post("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
                    data={"grant_type": "password", "username": os.environ["CDSE_USERNAME"], "password": os.environ["CDSE_PASSWORD"], "client_id": "cdse-public"}, timeout=60).json()["access_token"]
for k in ["LAI300", "FAPAR300", "FCOVER300", "NDVI300", "NDVI_300", "DMP300", "GDMP300", "SWI", "SSM1km", "SSM", "BA300", "WB300", "LST", "ETA300", "VPP", "PPI", "SCE", "SWE"]:
    u = f"{CAT}?$filter=Collection/Name eq 'CLMS' and contains(Name,'{k}')&$orderby=ContentDate/Start desc&$top=3&$count=true"
    try:
        j = requests.get(u, timeout=120).json()
    except Exception as e:
        print(k, "errore", e); continue
    v = j.get("value", [])
    print(f"== {k}: {j.get('@odata.count')} prodotti")
    for p in v[:2]:
        print("  ", p["Name"], p["ContentDate"]["Start"][:10], round(p.get("ContentLength", 0) / 1e6), "MB")
    if v:
        p = v[0]
        try:
            n = requests.get(f"https://download.dataspace.copernicus.eu/odata/v1/Products({p['Id']})/Nodes({p['Name']})/Nodes",
                             headers={"Authorization": f"Bearer {tok}"}, timeout=120).json()
            print("   file:", [x["Name"] for x in n.get("result", n.get("value", []))][:12])
        except Exception as e:
            print("   nodi: errore", str(e)[:100])
