import pandas as pd
import os

RAW = "data/raw"
CLEANED = "data/cleaned"
os.makedirs(CLEANED, exist_ok=True)

# NETTOYAGE DVF
print("Nettoyage du DVF...")

df = pd.read_csv(
    os.path.join(RAW, "dvf_2023.csv"),
    sep=",",
    low_memory=False,
    usecols=[
        "date_mutation", "nature_mutation", "valeur_fonciere",
        "code_postal", "nom_commune", "code_departement",
        "type_local", "surface_reelle_bati", "nombre_pieces_principales",
        "longitude", "latitude"
    ]
)

print(f"   Lignes initiales : {len(df):,}")

df = df[df["nature_mutation"] == "Vente"]
df = df[df["type_local"].isin(["Maison", "Appartement"])]
df = df.dropna(subset=["valeur_fonciere", "surface_reelle_bati", "code_departement"])
df = df[df["valeur_fonciere"] > 10000]
df = df[df["valeur_fonciere"] < 10000000]
df = df[df["surface_reelle_bati"] > 5]
df = df[df["surface_reelle_bati"] < 1000]

df["prix_m2"] = (df["valeur_fonciere"] / df["surface_reelle_bati"]).round(2)
df["valeur_fonciere"] = pd.to_numeric(df["valeur_fonciere"], errors="coerce")
df["date_mutation"] = pd.to_datetime(df["date_mutation"], errors="coerce")

print(f"   Lignes apres nettoyage : {len(df):,}")
df.to_csv(os.path.join(CLEANED, "dvf_clean.csv"), index=False)
print("dvf_clean.csv sauvegarde !")

# STATS PAR DEPARTEMENT
print("\nGeneration stats par departement...")
stats_dept = df.groupby("code_departement").agg(
    nb_transactions=("valeur_fonciere", "count"),
    prix_m2_moyen=("prix_m2", "mean"),
    prix_m2_median=("prix_m2", "median"),
    prix_moyen=("valeur_fonciere", "mean"),
    surface_moyenne=("surface_reelle_bati", "mean")
).reset_index()

stats_dept["prix_m2_moyen"] = stats_dept["prix_m2_moyen"].round(2)
stats_dept["prix_m2_median"] = stats_dept["prix_m2_median"].round(2)
stats_dept["prix_moyen"] = stats_dept["prix_moyen"].round(2)
stats_dept["surface_moyenne"] = stats_dept["surface_moyenne"].round(2)
stats_dept.to_csv(os.path.join(CLEANED, "stats_departement.csv"), index=False)
print(f"   {len(stats_dept)} departements - stats_departement.csv sauvegarde !")

# STATS PAR REGION
print("\nGeneration stats par region...")

# Mapping departement -> region
dept_region = {
    "01":"84","02":"32","03":"84","04":"93","05":"93","06":"93","07":"84","08":"44",
    "09":"76","10":"44","11":"76","12":"76","13":"93","14":"28","15":"84","16":"75",
    "17":"75","18":"24","19":"75","21":"27","22":"53","23":"75","24":"75","25":"27",
    "26":"84","27":"28","28":"24","29":"53","2A":"94","2B":"94","30":"76","31":"76",
    "32":"76","33":"75","34":"76","35":"53","36":"24","37":"24","38":"84","39":"27",
    "40":"75","41":"24","42":"84","43":"84","44":"52","45":"24","46":"76","47":"75",
    "48":"76","49":"52","50":"28","51":"44","52":"44","53":"52","54":"44","55":"44",
    "56":"53","57":"44","58":"27","59":"32","60":"32","61":"28","62":"32","63":"84",
    "64":"75","65":"76","66":"76","67":"44","68":"44","69":"84","70":"27","71":"27",
    "72":"52","73":"84","74":"84","75":"11","76":"28","77":"11","78":"11","79":"75",
    "80":"32","81":"76","82":"76","83":"93","84":"93","85":"52","86":"75","87":"75",
    "88":"44","89":"27","90":"27","91":"11","92":"11","93":"11","94":"11","95":"11",
    "971":"01","972":"02","973":"03","974":"04","976":"06"
}

region_noms = {
    "84":"Auvergne-Rhone-Alpes","32":"Hauts-de-France","75":"Nouvelle-Aquitaine",
    "27":"Bourgogne-Franche-Comte","53":"Bretagne","24":"Centre-Val de Loire",
    "94":"Corse","44":"Grand Est","01":"Guadeloupe","03":"Guyane","11":"Ile-de-France",
    "02":"Martinique","06":"Mayotte","76":"Occitanie","52":"Pays de la Loire",
    "28":"Normandie","93":"Provence-Alpes-Cote d Azur","04":"La Reunion"
}

df["code_region"] = df["code_departement"].astype(str).map(dept_region)

stats_region = df.groupby("code_region").agg(
    nb_transactions=("valeur_fonciere", "count"),
    prix_m2_moyen=("prix_m2", "mean"),
    prix_m2_median=("prix_m2", "median"),
    prix_moyen=("valeur_fonciere", "mean"),
    surface_moyenne=("surface_reelle_bati", "mean")
).reset_index()

stats_region["nom_region"] = stats_region["code_region"].map(region_noms)
stats_region["prix_m2_moyen"] = stats_region["prix_m2_moyen"].round(2)
stats_region["prix_m2_median"] = stats_region["prix_m2_median"].round(2)
stats_region["prix_moyen"] = stats_region["prix_moyen"].round(2)
stats_region["surface_moyenne"] = stats_region["surface_moyenne"].round(2)
stats_region = stats_region.dropna(subset=["code_region"])
stats_region.to_csv(os.path.join(CLEANED, "stats_region.csv"), index=False)
print(f"   {len(stats_region)} regions - stats_region.csv sauvegarde !")

# NETTOYAGE CHOMAGE
print("\nNettoyage chomage...")
try:
    for sep in [";", ",", "\t"]:
        try:
            chomage = pd.read_csv(
                os.path.join(RAW, "chomage.csv"),
                sep=sep,
                low_memory=False,
                on_bad_lines="skip"
            )
            if len(chomage.columns) > 1:
                print(f"   Separateur : '{sep}'")
                print(f"   Colonnes : {list(chomage.columns[:6])}")
                chomage.to_csv(os.path.join(CLEANED, "chomage_clean.csv"), index=False)
                print("chomage_clean.csv sauvegarde !")
                break
        except Exception:
            continue
except Exception as e:
    print(f"Erreur chomage : {e}")

# NETTOYAGE REVENUS
print("\nNettoyage revenus...")
try:
    for sep in [";", ",", "\t"]:
        try:
            revenus = pd.read_csv(
                os.path.join(RAW, "revenus.csv"),
                sep=sep,
                low_memory=False,
                on_bad_lines="skip"
            )
            if len(revenus.columns) > 1:
                print(f"   Separateur : '{sep}'")
                print(f"   Colonnes : {list(revenus.columns[:6])}")
                revenus.to_csv(os.path.join(CLEANED, "revenus_clean.csv"), index=False)
                print("revenus_clean.csv sauvegarde !")
                break
        except Exception:
            continue
except Exception as e:
    print(f"Erreur revenus : {e}")

print("\nNettoyage termine !")