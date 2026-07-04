from pyspark.sql import SparkSession
from pyspark.sql import functions as F
import os

spark = SparkSession.builder \
    .appName("Homepedia") \
    .config("spark.driver.memory", "4g") \
    .getOrCreate()

spark.sparkContext.setLogLevel("ERROR")

print("Chargement du DVF...")
df = spark.read.csv("data/cleaned/dvf_clean.csv", header=True, inferSchema=True)
print(f"   Lignes : {df.count():,}")

# ANALYSE 1 : Prix moyen par departement
print("Analyse prix par departement...")
prix_dept = df.groupBy("code_departement") \
    .agg(
        F.round(F.mean("prix_m2"), 2).alias("prix_m2_moyen"),
        F.round(F.median("prix_m2"), 2).alias("prix_m2_median"),
        F.count("*").alias("nb_transactions"),
        F.round(F.mean("valeur_fonciere"), 2).alias("prix_moyen"),
        F.round(F.mean("surface_reelle_bati"), 2).alias("surface_moyenne")
    ) \
    .orderBy("prix_m2_moyen", ascending=False)

prix_dept.toPandas().to_csv("data/cleaned/spark_prix_departement.csv", index=False)
print("   spark_prix_departement.csv sauvegarde !")

# ANALYSE 2 : Prix moyen par ville
print("Analyse prix par ville...")
prix_ville = df.groupBy("nom_commune", "code_departement") \
    .agg(
        F.round(F.mean("prix_m2"), 2).alias("prix_m2_moyen"),
        F.round(F.median("prix_m2"), 2).alias("prix_m2_median"),
        F.count("*").alias("nb_transactions"),
        F.round(F.mean("valeur_fonciere"), 2).alias("prix_moyen")
    ) \
    .filter(F.col("nb_transactions") >= 5) \
    .orderBy("prix_m2_moyen", ascending=False)

prix_ville.toPandas().to_csv("data/cleaned/spark_prix_ville.csv", index=False)
print("   spark_prix_ville.csv sauvegarde !")

# ANALYSE 3 : Maisons vs Appartements
print("Analyse maisons vs appartements...")
type_bien = df.groupBy("code_departement", "type_local") \
    .agg(
        F.round(F.mean("prix_m2"), 2).alias("prix_m2_moyen"),
        F.count("*").alias("nb_transactions")
    ) \
    .orderBy("code_departement", "type_local")

type_bien.toPandas().to_csv("data/cleaned/spark_type_bien.csv", index=False)
print("   spark_type_bien.csv sauvegarde !")

# ANALYSE 4 : Top 10 villes les plus cheres
print("Top 10 villes les plus cheres...")
top10 = prix_ville.limit(10)
top10.show(truncate=False)

# ANALYSE 5 : Top 10 villes les moins cheres
print("Top 10 villes les moins cheres...")
bottom10 = prix_ville.orderBy("prix_m2_moyen", ascending=True).limit(10)
bottom10.show(truncate=False)

spark.stop()
print("\nAnalyse Spark terminee !")