# Columella — 15: indice dei comuni italiani per la ricerca istantanea nel sito (anche con errori di battitura)
# Fonte: confini comunali ISTAT ridistribuiti da openpolis/geojson-italy (CC BY 4.0); copia temporanea in /tmp.
# Uscita: data/comuni.json  [nome, sigla provincia, regione, lat, lon, ovest, sud, est, nord]
# Esecuzione: workflow comuni.yml (da pipeline/) oppure Spyder
# EN: builds the municipality search index (name, province, region, point, bbox) for the website.
import json
import requests
import geopandas as gpd

URL = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_municipalities.geojson"
open("/tmp/comuni.geojson", "wb").write(requests.get(URL, timeout=300).content)
g = gpd.read_file("/tmp/comuni.geojson")
print(len(g), "comuni;", list(g.columns))
pt = g.to_crs(3035).representative_point().to_crs(4326)
b = g.bounds
righe = []
for i, r in g.iterrows():
    righe.append([r["name"], r.get("prov_acr") or "", r.get("reg_name") or "", round(pt.iloc[i].y, 4), round(pt.iloc[i].x, 4),
                  round(b.minx[i], 3), round(b.miny[i], 3), round(b.maxx[i], 3), round(b.maxy[i], 3)])
json.dump({"fonte": "ISTAT via openpolis/geojson-italy (CC BY 4.0)", "comuni": righe}, open("data/comuni.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("scritti", len(righe))
