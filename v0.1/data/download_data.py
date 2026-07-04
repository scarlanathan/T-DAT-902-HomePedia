import requests
import os
import gzip
import shutil

RAW = "data/raw"
os.makedirs(RAW, exist_ok=True)

datasets = {
    # Contours géographiques
    "departements.geojson": "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson",
    "regions.geojson": "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions-version-simplifiee.geojson",

    # Chomage par departement (INSEE)
    "chomage.csv": "https://www.insee.fr/fr/statistiques/fichier/4515925/sl_etc_2023T4.csv",

    # Revenus par departement (INSEE)
    "revenus.csv": "https://www.insee.fr/fr/statistiques/fichier/6436484/FILO2020_DEC_Pauvrete_DEP.csv",
}

for filename, url in datasets.items():
    filepath = os.path.join(RAW, filename)
    if os.path.exists(filepath):
        print(f"Deja telecharge : {filename}")
        continue
    print(f"Telechargement de {filename}...")
    try:
        response = requests.get(url, timeout=60, stream=True)
        total = 0
        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)
        print(f"OK - {filename} ({total//1024} KB)")
    except Exception as e:
        print(f"Erreur {filename}: {e}")

# DVF séparé car très gros
dvf_gz = os.path.join(RAW, "dvf_2023.csv.gz")
dvf_csv = os.path.join(RAW, "dvf_2023.csv")

if not os.path.exists(dvf_gz) and not os.path.exists(dvf_csv):
    print("Telechargement DVF 2023 (gros fichier)...")
    url = "https://files.data.gouv.fr/geo-dvf/latest/csv/2023/full.csv.gz"
    response = requests.get(url, stream=True)
    total = 0
    with open(dvf_gz, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            total += len(chunk)
            print(f"\r   {total//1024//1024} MB...", end="")
    print(f"\nOK - dvf_2023.csv.gz")

if os.path.exists(dvf_gz) and not os.path.exists(dvf_csv):
    print("Decompression DVF...")
    with gzip.open(dvf_gz, "rb") as f_in:
        with open(dvf_csv, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
    print("OK - dvf_2023.csv")

print("\nTous les fichiers sont prets !")