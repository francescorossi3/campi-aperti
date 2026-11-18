# Columella — classi HRL Croplands - Crop Types (CTY), nomi IT/EN e coefficienti colturali mensili (Kc)
# Modulo importato da 02 (CTY_CODICI) e 05 (NOMI, KC). Nessuna funzione: solo dizionari.
# EN: Crop Types class codes, IT/EN names and monthly Kc, imported by scripts 02 and 05.

# codice originale CTY (uint16) -> codice compatto (uint8) usato nei COG di Columella
# 0 = nessuna coltura, 255 = fuori area / nodata
CTY_CODICI = {
    0: 0,
    1110: 1,   # frumento
    1120: 2,   # orzo
    1130: 3,   # mais
    1140: 4,   # riso
    1150: 5,   # altri cereali
    1210: 6,   # ortaggi freschi
    1220: 7,   # legumi secchi
    1310: 8,   # patate
    1320: 9,   # barbabietola da zucchero
    1410: 10,  # girasole
    1420: 11,  # soia
    1430: 12,  # colza
    1440: 13,  # lino, cotone, canapa
    2100: 14,  # vite
    2200: 15,  # olivo
    2310: 16,  # frutta
    2320: 17,  # frutta a guscio
    3100: 18,  # seminativo non classificato
    3200: 19,  # coltura permanente non classificata
    65535: 255,
}

NOMI = {
    1: ("Frumento", "Wheat"), 2: ("Orzo", "Barley"), 3: ("Mais", "Maize"), 4: ("Riso", "Rice"),
    5: ("Altri cereali", "Other cereals"), 6: ("Ortaggi freschi", "Fresh vegetables"), 7: ("Legumi secchi", "Dry pulses"),
    8: ("Patate", "Potatoes"), 9: ("Barbabietola da zucchero", "Sugar beet"), 10: ("Girasole", "Sunflower"),
    11: ("Soia", "Soybeans"), 12: ("Colza", "Rapeseed"), 13: ("Lino, cotone e canapa", "Flax, cotton and hemp"),
    14: ("Vite", "Grapes"), 15: ("Olivo", "Olives"), 16: ("Frutta", "Fruits"), 17: ("Frutta a guscio", "Nuts"),
    18: ("Seminativo non classificato", "Unclassified annual crop"), 19: ("Coltura permanente non classificata", "Unclassified permanent crop"),
}

# Kc mensili (gennaio..dicembre), adattati da FAO-56 (tab. 12 e 17) a un calendario colturale
# tipico italiano. Fuori stagione si usa 0,25 (evaporazione da suolo nudo).
# Sono valori indicativi per stime regionali, non per l'irrigazione di un singolo campo.
S = 0.25
KC = {
    1:  [0.50, 0.70, 1.00, 1.15, 1.15, 0.60, S, S, S, S, 0.40, 0.40],    # frumento (semina nov, raccolta fine giu)
    2:  [0.50, 0.75, 1.05, 1.15, 0.90, 0.40, S, S, S, S, 0.40, 0.40],    # orzo
    3:  [S, S, S, 0.30, 0.50, 0.90, 1.20, 1.15, 0.70, S, S, S],          # mais
    4:  [S, S, S, 1.05, 1.10, 1.20, 1.20, 1.15, 0.90, S, S, S],          # riso (sommersione)
    5:  [0.50, 0.70, 1.00, 1.10, 1.05, 0.50, S, S, S, S, 0.40, 0.40],    # altri cereali
    6:  [0.30, 0.30, 0.60, 0.80, 1.00, 1.05, 1.05, 0.95, 0.80, 0.30, 0.30, 0.30],  # ortaggi
    7:  [0.40, 0.50, 0.80, 1.00, 1.05, 0.60, S, S, S, S, 0.40, 0.40],    # legumi secchi
    8:  [S, S, 0.50, 0.80, 1.10, 1.10, 0.75, S, S, S, S, S],             # patate
    9:  [S, S, 0.35, 0.60, 1.00, 1.20, 1.20, 1.10, 0.90, S, S, S],       # barbabietola
    10: [S, S, S, 0.35, 0.60, 1.05, 1.05, 0.50, S, S, S, S],             # girasole
    11: [S, S, S, S, 0.40, 0.80, 1.15, 1.10, 0.60, S, S, S],             # soia
    12: [0.70, 0.90, 1.10, 1.10, 0.80, 0.35, S, S, S, 0.35, 0.50, 0.60], # colza
    13: [S, S, S, 0.35, 0.70, 1.10, 1.15, 0.80, S, S, S, S],             # canapa / lino / cotone
    14: [0.30, 0.30, 0.30, 0.35, 0.50, 0.70, 0.70, 0.70, 0.55, 0.45, 0.30, 0.30],  # vite
    15: [0.65, 0.65, 0.65, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.65, 0.65],  # olivo
    16: [0.40, 0.40, 0.45, 0.60, 0.80, 0.95, 0.95, 0.95, 0.80, 0.70, 0.40, 0.40],  # frutta
    17: [0.40, 0.40, 0.45, 0.60, 0.80, 0.90, 0.90, 0.90, 0.75, 0.65, 0.40, 0.40],  # frutta a guscio
    18: [0.35, 0.35, 0.60, 0.80, 0.90, 0.80, 0.60, 0.50, 0.35, 0.35, 0.35, 0.35],  # seminativo n.c.
    19: [0.60] * 12,                                                     # permanente n.c.
}
