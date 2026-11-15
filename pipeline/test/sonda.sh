#!/bin/bash
# Sonda di servizi esterni (eseguita in GitHub Actions)
curl -s -m 120 "https://phenology.vgt.vito.be/wms?service=WMS&request=GetCapabilities&version=1.3.0" -o cap.xml; ls -la cap.xml
python3 - <<'PY'
import re
x = open("cap.xml", encoding="utf-8", errors="ignore").read()
print(x[:300])
names = re.findall(r"<Name>([^<]+)</Name>", x)
print(len(names), "layer")
print([n for n in names if "VPP" in n or "PPI" in n or "ST" in n][:80])
i = x.find("CLMS_HRVPP_VPP_SOSD_SEASON1_10M")
print(x[i-200:i+2500] if i > 0 else "no SOSD")
print("CRS:", sorted(set(re.findall(r"<CRS>([^<]+)</CRS>", x)))[:20])
PY
curl -s -m 60 -D - -o /dev/null "https://phenology.vgt.vito.be/wms?service=WMS&request=GetMap&version=1.3.0&layers=CLMS_HRVPP_VPP_SOSD_SEASON1_10M&crs=EPSG:3857&bbox=1360000,5130000,1365000,5135000&width=256&height=256&format=image/png&transparent=true" | head -15
curl -s -m 60 "https://api.open-meteo.com/v1/forecast?latitude=41.9&longitude=12.5&hourly=temperature_2m,relative_humidity_2m,leaf_wetness_probability,precipitation&past_days=2&forecast_days=1" | head -c 600; echo
