#!/bin/bash
curl -s -m 120 "https://phenology.vgt.vito.be/wms?service=WMS&request=GetCapabilities&version=1.1.1" -o cap.xml
python3 - <<'PY'
import re
x = open("cap.xml", encoding="utf-8", errors="ignore").read()
names = re.findall(r"<Name>([^<]+)</Name>", x)
print([n for n in names if "SEASON1_10M" in n and "LAEA" not in n])
for L in ["CLMS_HRVPP_VPP_LENGTH_SEASON1_10M", "CLMS_HRVPP_VPP_TPROD_SEASON1_10M", "CLMS_HRVPP_ST_PPI_10M"]:
    i = x.find("<Name>" + L)
    print(L, re.findall(r"<Style>\s*<Name>([^<]+)</Name>", x[i:i + 4000])[:3], re.findall(r'<Dimension[^>]*>([^<]{0,200})', x[i:i + 4000])[:1])
PY
B="1360000,5130000,1370000,5140000"
for ST in "" "hrvpp_dates_2024.txt"; do
  for L in CLMS_HRVPP_VPP_SOSD_SEASON1_10M CLMS_HRVPP_VPP_TPROD_SEASON1_10M; do
    curl -s -m 60 -o t.png -w "$L style=[$ST] %{http_code} %{content_type} %{size_download}\n" "https://phenology.vgt.vito.be/wms?service=WMS&request=GetMap&version=1.1.1&layers=$L&styles=$ST&srs=EPSG:3857&bbox=$B&width=256&height=256&format=image/png&transparent=true&time=2024-01-01"
  done
done
curl -s -m 60 -D - -o /dev/null "https://phenology.vgt.vito.be/wms?service=WMS&request=GetMap&version=1.1.1&layers=CLMS_HRVPP_VPP_SOSD_SEASON1_10M&styles=&srs=EPSG:3857&bbox=$B&width=256&height=256&format=image/png" | grep -i "access-control\|content-type"
curl -s -m 60 -o leg.png -w "legend %{http_code} %{content_type}\n" "https://phenology.vgt.vito.be/wms?service=WMS&request=GetLegendGraphic&version=1.1.1&layer=CLMS_HRVPP_VPP_SOSD_SEASON1_10M&format=image/png"
