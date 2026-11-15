# 07 — Rese agricole ISTAT per provincia, coltura e anno (dal 2017)
#
# Fonte: ISTAT, "Stima delle superfici e produzioni delle coltivazioni agrarie", API SDMX
# dataflow 101_1015_DF_DCSP_COLTIVAZIONI_1. Dati: superficie in produzione (PA_EXT, ha) e produzione raccolta
# (HP_Q_EXT, quintali); per i seminativi la superficie è quella totale (ART). Resa = produzione / superficie (t/ha). Gli ultimi anni possono essere provvisori.
# Uscite: data/rese.json (per il sito) e data/province.json (confini semplificati con codice NUTS ISTAT)

import io
import os
import re
import json
import difflib
import unicodedata
import requests
import pandas as pd
import geopandas as gpd

BASE = "https://esploradati.istat.it/SDMXWS/rest"
FLOW = "101_1015_DF_DCSP_COLTIVAZIONI_1"
INIZIO = 2017

# codice ISTAT -> (nome italiano, nome inglese, classe Copernicus 1..19)
COLTURE = {
    "COMMEAT": ("Frumento tenero", "Common wheat", 1), "WHEATD": ("Frumento duro", "Durum wheat", 1),
    "BARLEY": ("Orzo", "Barley", 2), "MAIZE": ("Mais da granella", "Grain maize", 3), "RICE": ("Riso", "Rice", 4),
    "OATS": ("Avena", "Oats", 5), "SORGH": ("Sorgo", "Sorghum", 5), "TITICALE": ("Triticale", "Triticale", 5), "RYE": ("Segale", "Rye", 5),
    "POTA": ("Patate", "Potatoes", 8), "BEETS": ("Barbabietola da zucchero", "Sugar beet", 9), "SUNFLO": ("Girasole", "Sunflower", 10),
    "SOYA": ("Soia", "Soybeans", 11), "RAPE": ("Colza", "Rapeseed", 12), "HEMP": ("Canapa", "Hemp", 13),
    "BROAFIELD": ("Fava", "Broad beans", 7), "CHICS": ("Ceci", "Chickpeas", 7), "LENTIL": ("Lenticchie", "Lentils", 7),
    "WINEES": ("Uva da vino", "Wine grapes", 14), "TABLEGRAPES": ("Uva da tavola", "Table grapes", 14),
    "OLIVT": ("Olive (totale)", "Olives (total)", 15),
    "APPLE": ("Melo", "Apples", 16), "PEAR": ("Pero", "Pears", 16), "PEACH": ("Pesco", "Peaches", 16), "NECTA": ("Nettarine", "Nectarines", 16),
    "APRIC": ("Albicocco", "Apricots", 16), "CHERR": ("Ciliegio", "Cherries", 16), "PLUM": ("Susino", "Plums", 16), "KIWI": ("Actinidia (kiwi)", "Kiwi", 16),
    "ORANGE": ("Arancio", "Oranges", 16), "LEMON": ("Limone", "Lemons", 16), "MANDAR": ("Mandarino", "Mandarins", 16),
    "CLEMENTINE": ("Clementina", "Clementines", 16), "FIG": ("Fico", "Figs", 16),
    "HAZEL": ("Nocciolo", "Hazelnuts", 17), "ALMO": ("Mandorlo", "Almonds", 17), "WALNU": ("Noce", "Walnuts", 17),
    "CHEST": ("Castagno", "Chestnuts", 17), "PISTS": ("Pistacchio", "Pistachios", 17),
    "LUCERNE": ("Erba medica", "Lucerne", 18),
}

# ---- 1. nomi dei territori
xml = requests.get(f"{BASE}/codelist/IT1/CL_ITTER107", timeout=300).text
nomi = dict(re.findall(r'<structure:Code id="([^"]+)">[\s\S]*?<common:Name xml:lang="it">([^<]+)</common:Name>', xml))
print(len(nomi), "codici territoriali")

# ---- 2. dati (superficie in produzione e produzione raccolta)
parti = []
for codice in COLTURE:                       # una richiesta per coltura (la chiave unica è troppo lunga per il server)
    try:
        r = requests.get(f"{BASE}/data/{FLOW}/A..PA_EXT+HP_Q_EXT+ART.{codice}.?startPeriod={INIZIO}", timeout=600,
                         headers={"Accept": "application/vnd.sdmx.data+csv;version=1.0.0"})
        if r.status_code != 200 or r.text.startswith("NoRecords"):
            print("  ", codice, "nessun dato", r.status_code)
            continue
        parti.append(pd.read_csv(io.StringIO(r.text), dtype={"REF_AREA": str}))
        print("  ", codice, len(parti[-1]))
    except requests.RequestException as e:
        print("  ", codice, "errore", e)
d = pd.concat(parti, ignore_index=True)
if "DESTINATION_WINEGRAPES" in d:
    d = d[d.DESTINATION_WINEGRAPES.astype(str).eq("ALL")]
d = d[["REF_AREA", "DATA_TYPE", "TYPE_OF_CROP", "TIME_PERIOD", "OBS_VALUE"]]
print(len(d), "osservazioni")
w = d.pivot_table(index=["REF_AREA", "TYPE_OF_CROP", "TIME_PERIOD"], columns="DATA_TYPE", values="OBS_VALUE", aggfunc="first").reset_index()
# superficie: "in produzione" per le legnose, "totale" (ART) per i seminativi che non hanno PA_EXT
w["ha"] = w["PA_EXT"].fillna(w["ART"]) if "ART" in w else w["PA_EXT"]
w = w.rename(columns={"HP_Q_EXT": "q"})
w["resa"] = (w.q / 10) / w.ha                    # t/ha
w = w[(w.ha > 0) & w.resa.notna()]

# ---- 3. province: confini semplificati e abbinamento al codice ISTAT per nome
def norma(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", s.split("/")[0])
prov = gpd.read_file("province_istat.geojson")
codici_prov = {c: n for c, n in nomi.items() if c in set(w.REF_AREA) and re.fullmatch(r"IT[A-Z0-9]{3}", c)}
indice = {norma(n): c for c, n in codici_prov.items()}
def trova(nome):
    k = norma(nome)
    if k in indice:
        return indice[k]
    m = difflib.get_close_matches(k, list(indice), n=1, cutoff=0.75)
    return indice[m[0]] if m else None
prov["nuts"] = prov.prov_name.map(trova)
print("province abbinate:", prov.nuts.notna().sum(), "/", len(prov), "| non abbinate:", list(prov.loc[prov.nuts.isna(), "prov_name"]))
prov["geometry"] = prov.geometry.simplify(0.004, preserve_topology=True)
prov[["prov_name", "prov_acr", "reg_name", "nuts", "geometry"]].to_file(os.path.join("data", "province.json"), driver="GeoJSON",
                                                                        COORDINATE_PRECISION=4)

# ---- 4. uscita compatta
w = w[w.REF_AREA.isin(set(prov.nuts.dropna()) | {"IT"} | {c for c in nomi if re.fullmatch(r"IT[A-Z]\d", c)})]
out = {
    "fonte": "ISTAT — Stima delle superfici e produzioni delle coltivazioni agrarie (SDMX 101_1015_DF_DCSP_COLTIVAZIONI_1). Ultimi anni provvisori.",
    "generato": pd.Timestamp.now("UTC").isoformat(),
    "colture": {k: {"it": v[0], "en": v[1], "cty": v[2]} for k, v in COLTURE.items()},
    "territori": {c: nomi.get(c, c) for c in sorted(set(w.REF_AREA))},
    "colonne": ["territorio", "coltura", "anno", "ha", "t", "resa"],
    "righe": [[a, c, int(y), round(float(h), 1), round(float(q) / 10, 1), round(float(rs), 2)]
              for a, c, y, h, q, rs in w[["REF_AREA", "TYPE_OF_CROP", "TIME_PERIOD", "ha", "q", "resa"]].itertuples(index=False)],
}
with open(os.path.join("data", "rese.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print("righe:", len(out["righe"]), "anni:", sorted(w.TIME_PERIOD.unique()))
