#!/usr/bin/env python3
"""Clean geo-DVF transactions: raw CSV in HDFS -> curated Parquet.

DVF ("Demandes de Valeurs Foncières") is one row per *line of a notarised sale*.
It is the backbone of Brique A (capacité d'emprunt): it gives the price/m² that a
buyer's borrowing capacity is confronted with.

What this job does and why:
  * keeps only real building sales ("Vente" of Maison/Appartement) - the only rows
    where a meaningful price/m² exists (terrains, dépendances, échanges are dropped);
  * casts the all-TEXT raw columns to real types and parses the sale date;
  * aggregates each sale (id_mutation) before computing price/m²: valeur_fonciere is
    the total price and must be divided by the sum of dwelling surfaces, not one line;
  * drops sales with total built surface under 10 m² (parking, caves, DVF errors);
  * removes impossible/outlier prices (a national file has data-entry errors and
    a handful of €1 symbolic sales that would wreck commune averages);
  * de-duplicates: a single mutation spread over several parcelles/lots lands as
    several identical priced rows, which would double-count a sale;
  * partitions the output by department so downstream reads can prune by territory.

Output grain: one row per cleaned building-sale line.
"""

from __future__ import annotations

import os
import sys

# Make ``utils`` importable whether launched by spark-submit or run directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from utils.lake import curated_path, raw_path
from utils.session import build_session
from utils.transforms import clean_insee_code, to_double, to_int

SOURCE = "dvf"
BUILDING_TYPES = ["Maison", "Appartement"]
# Ignore tiny surfaces (parking, caves, DVF line errors) when computing €/m².
MIN_SURFACE_M2 = 10.0
# Plausible price/m² band (€). Outside this is almost always a bad row, not a real deal.
MIN_PRICE_M2 = 100.0
MAX_PRICE_M2 = 30000.0


def clean(df: DataFrame) -> DataFrame:
    typed = df.select(
        F.col("id_mutation"),
        F.to_date("date_mutation").alias("date_mutation"),
        F.col("nature_mutation"),
        to_double(F.col("valeur_fonciere")).alias("valeur_fonciere"),
        clean_insee_code(F.col("code_commune")).alias("code_commune"),
        F.col("code_departement"),
        F.col("nom_commune"),
        F.col("type_local"),
        to_double(F.col("surface_reelle_bati")).alias("surface_reelle_bati"),
        to_int(F.col("nombre_pieces_principales")).alias("nombre_pieces_principales"),
        to_double(F.col("longitude")).alias("longitude"),
        to_double(F.col("latitude")).alias("latitude"),
    )

    dwelling = (
        typed.where(F.col("nature_mutation") == "Vente")
        .where(F.col("type_local").isin(BUILDING_TYPES))
        .where(F.col("valeur_fonciere") > 0)
        .where(F.col("surface_reelle_bati") >= MIN_SURFACE_M2)
    )

    by_mutation = dwelling.groupBy(
        "id_mutation", "code_commune", "code_departement", "nom_commune"
    ).agg(
        F.max("date_mutation").alias("date_mutation"),
        F.max("valeur_fonciere").alias("valeur_fonciere"),
        F.sum("surface_reelle_bati").alias("total_surface_bati"),
        F.max("type_local").alias("type_local"),
        F.max("nombre_pieces_principales").alias("nombre_pieces_principales"),
        F.max("longitude").alias("longitude"),
        F.max("latitude").alias("latitude"),
    )

    priced = (
        by_mutation.where(F.col("total_surface_bati") >= MIN_SURFACE_M2)
        .withColumn(
            "price_m2",
            F.round(F.col("valeur_fonciere") / F.col("total_surface_bati"), 2),
        )
        .where(F.col("price_m2").between(MIN_PRICE_M2, MAX_PRICE_M2))
    )

    return priced.withColumn("year", F.year("date_mutation")).withColumn(
        "month", F.month("date_mutation")
    )


def main() -> int:
    spark = build_session("homepedia-clean-dvf")
    src = raw_path(SOURCE)
    print(f"[clean_dvf] reading {src}")

    raw = spark.read.option("header", True).csv(src)
    cleaned = clean(raw)

    out = curated_path(SOURCE)
    (
        cleaned.write.mode("overwrite")
        .partitionBy("code_departement")
        .parquet(out)
    )
    print(f"[clean_dvf] wrote {cleaned.count()} rows -> {out} (partitioned by department)")
    spark.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
