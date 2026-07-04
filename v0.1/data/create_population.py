import pandas as pd
import os

CLEANED = "data/cleaned"

# Donnees population 2023 par departement (source INSEE)
population_data = {
    "01": ("Ain", 663000), "02": ("Aisne", 534000), "03": ("Allier", 337000),
    "04": ("Alpes-de-Haute-Provence", 165000), "05": ("Hautes-Alpes", 141000),
    "06": ("Alpes-Maritimes", 1094000), "07": ("Ardeche", 330000),
    "08": ("Ardennes", 273000), "09": ("Ariege", 154000), "10": ("Aube", 310000),
    "11": ("Aude", 376000), "12": ("Aveyron", 279000), "13": ("Bouches-du-Rhone", 2043000),
    "14": ("Calvados", 694000), "15": ("Cantal", 144000), "16": ("Charente", 353000),
    "17": ("Charente-Maritime", 651000), "18": ("Cher", 303000), "19": ("Correze", 240000),
    "2A": ("Corse-du-Sud", 163000), "2B": ("Haute-Corse", 177000),
    "21": ("Cote-d-Or", 533000), "22": ("Cotes-d-Armor", 601000),
    "23": ("Creuse", 116000), "24": ("Dordogne", 413000), "25": ("Doubs", 542000),
    "26": ("Drome", 517000), "27": ("Eure", 598000), "28": ("Eure-et-Loir", 432000),
    "29": ("Finistere", 909000), "30": ("Gard", 748000), "31": ("Haute-Garonne", 1400000),
    "32": ("Gers", 191000), "33": ("Gironde", 1600000), "34": ("Herault", 1175000),
    "35": ("Ille-et-Vilaine", 1060000), "36": ("Indre", 222000),
    "37": ("Indre-et-Loire", 606000), "38": ("Isere", 1271000), "39": ("Jura", 260000),
    "40": ("Landes", 413000), "41": ("Loir-et-Cher", 330000), "42": ("Loire", 762000),
    "43": ("Haute-Loire", 226000), "44": ("Loire-Atlantique", 1394000),
    "45": ("Loiret", 678000), "46": ("Lot", 174000), "47": ("Lot-et-Garonne", 330000),
    "48": ("Lozere", 76000), "49": ("Maine-et-Loire", 810000), "50": ("Manche", 499000),
    "51": ("Marne", 568000), "52": ("Haute-Marne", 174000), "53": ("Mayenne", 307000),
    "54": ("Meurthe-et-Moselle", 733000), "55": ("Meuse", 187000),
    "56": ("Morbihan", 750000), "57": ("Moselle", 1043000), "58": ("Nievre", 210000),
    "59": ("Nord", 2608000), "60": ("Oise", 824000), "61": ("Orne", 284000),
    "62": ("Pas-de-Calais", 1474000), "63": ("Puy-de-Dome", 661000),
    "64": ("Pyrenees-Atlantiques", 682000), "65": ("Hautes-Pyrenees", 228000),
    "66": ("Pyrenees-Orientales", 479000), "67": ("Bas-Rhin", 1130000),
    "68": ("Haut-Rhin", 764000), "69": ("Rhone", 1843000), "70": ("Haute-Saone", 238000),
    "71": ("Saone-et-Loire", 553000), "72": ("Sarthe", 566000), "73": ("Savoie", 430000),
    "74": ("Haute-Savoie", 820000), "75": ("Paris", 2133000), "76": ("Seine-Maritime", 1254000),
    "77": ("Seine-et-Marne", 1397000), "78": ("Yvelines", 1438000),
    "79": ("Deux-Sevres", 372000), "80": ("Somme", 572000), "81": ("Tarn", 385000),
    "82": ("Tarn-et-Garonne", 258000), "83": ("Var", 1066000), "84": ("Vaucluse", 561000),
    "85": ("Vendee", 680000), "86": ("Vienne", 436000), "87": ("Haute-Vienne", 374000),
    "88": ("Vosges", 363000), "89": ("Yonne", 338000), "90": ("Territoire de Belfort", 143000),
    "91": ("Essonne", 1296000), "92": ("Hauts-de-Seine", 1609000),
    "93": ("Seine-Saint-Denis", 1623000), "94": ("Val-de-Marne", 1352000),
    "95": ("Val-d-Oise", 1228000), "971": ("Guadeloupe", 383000),
    "972": ("Martinique", 349000), "973": ("Guyane", 294000),
    "974": ("La Reunion", 877000), "976": ("Mayotte", 321000)
}

rows = []
for code, (nom, pop) in population_data.items():
    rows.append({
        "code_departement": code,
        "nom_departement": nom,
        "population": pop
    })

df = pd.DataFrame(rows)
df.to_csv(os.path.join(CLEANED, "population_departement.csv"), index=False)
print(f"population_departement.csv sauvegarde ! ({len(df)} departements)")

# Fusionner avec les stats existantes
stats = pd.read_csv(os.path.join(CLEANED, "spark_prix_departement.csv"))
stats["code_departement"] = stats["code_departement"].astype(str)
df["code_departement"] = df["code_departement"].astype(str)

merged = stats.merge(df, on="code_departement", how="left")
merged["transactions_par_habitant"] = (merged["nb_transactions"] / merged["population"] * 1000).round(2)
merged.to_csv(os.path.join(CLEANED, "stats_departement_complet.csv"), index=False)
print(f"stats_departement_complet.csv sauvegarde ! ({len(merged)} departements)")
print(f"Colonnes : {list(merged.columns)}")