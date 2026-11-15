#!/bin/bash
# Sonda dei servizi web dei prodotti biogeofisici Copernicus
for U in "https://phenology.vgt.vito.be/wms?service=WMS&request=GetCapabilities&version=1.1.1" \
         "https://land.copernicus.vgt.vito.be/geoserver/wms?service=WMS&request=GetCapabilities&version=1.3.0" \
         "https://land.copernicus.vgt.vito.be/geoserver/ows?service=WMS&request=GetCapabilities" \
         "https://viewer.globalland.vgt.vito.be/geoserver/wms?service=WMS&request=GetCapabilities" \
         "https://image.discomap.eea.europa.eu/arcgis/rest/services?f=json" \
         "https://image.discomap.eea.europa.eu/arcgis/rest/services/GioLandPublic?f=json" \
         "https://sh.dataspace.copernicus.eu/ogc/wms/" ; do
  echo "=== $U"; curl -s -m 90 "$U" -o out.txt -w "%{http_code} %{size_download}\n"
  python3 - <<'PY'
import re, json
x = open("out.txt", encoding="utf-8", errors="ignore").read()
n = re.findall(r"<Name>([^<]+)</Name>", x)
if n:
    print(len(n), "layer:", [k for k in n if not k.startswith(("OGC", "WMS"))][:400])
else:
    try:
        j = json.loads(x); print([s.get("name") for s in j.get("services", [])][:300], j.get("folders", [])[:80])
    except Exception:
        print(x[:300])
PY
done
# Sun Nov 15 15:14:08 UTC 2026
