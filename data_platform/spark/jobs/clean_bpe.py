#!/usr/bin/env python3
"""Aggregate INSEE BPE equipment: raw CSV in HDFS -> curated per-commune Parquet.

The BPE ("Base Permanente des Équipements") is one row per facility (school, GP,
supermarket, sports hall ...). On its own it is too fine-grained to join to a commune
score, so this job rolls it up: it maps each ``TYPEQU`` code to a family and counts
facilities per commune. The result is a *proximity / amenity density* proxy - part of
Brique D (qualité de vie: animation vs. calme) and a general attractiveness signal.

What this job does:
  * derives ``code_commune`` from the first 5 chars of ``DCIRIS`` (which may be a
    9-char IRIS code or already a 5-char commune code);
  * classifies ``TYPEQU`` into families via its leading 2 chars;
  * counts facilities per (commune, family) and pivots to one wide row per commune,
    plus a total.

Output grain: one row per commune, with a count column per equipment family.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from utils.lake import curated_path, raw_path
from utils.session import build_session
from utils.transforms import clean_insee_code

SOURCE = "bpe"

# Leading 2 chars of TYPEQU -> family. (Full nomenclature: insee.fr/fr/statistiques/3568614)
FAMILIES = ["ecole", "college", "lycee", "sante", "commerce", "sport"]


def family_expr() -> F.Column:
    prefix = F.substring(F.col("TYPEQU"), 1, 2)
    return (
        F.when(prefix == "C1", "ecole")     # enseignement 1er degré (maternelle/primaire)
        .when(prefix == "C2", "college")
        .when(prefix == "C3", "lycee")
        .when(prefix == "D1", "sante")      # médecins / professionnels de santé
        .when(prefix == "A5", "commerce")   # commerces alimentaires
        .when(prefix == "F1", "sport")      # équipements sportifs
        .otherwise("autre")
    )


def clean(df: DataFrame) -> DataFrame:
    tagged = (
        df.select(
            clean_insee_code(F.substring(F.col("DCIRIS"), 1, 5)).alias("code_commune"),
            family_expr().alias("family"),
        )
        .where(F.col("code_commune").isNotNull())
        .where(F.col("family") != "autre")
    )

    wide = (
        tagged.groupBy("code_commune")
        .pivot("family", FAMILIES)
        .count()
        .na.fill(0, FAMILIES)
    )

    total = F.lit(0)
    for fam in FAMILIES:
        total = total + F.col(fam)
    return wide.withColumn("equipements_total", total)


def main() -> int:
    spark = build_session("homepedia-clean-bpe")
    src = raw_path(SOURCE)
    print(f"[clean_bpe] reading {src}")

    raw = spark.read.option("header", True).option("sep", ";").csv(src)
    cleaned = clean(raw)

    out = curated_path(SOURCE)
    cleaned.write.mode("overwrite").parquet(out)
    print(f"[clean_bpe] wrote {cleaned.count()} communes -> {out}")
    spark.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
