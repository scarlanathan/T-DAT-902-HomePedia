#!/usr/bin/env python3
"""Clean INSEE COG communes: raw CSV in HDFS -> curated Parquet.

The COG ("Code Officiel Géographique") is the geographic backbone (Brique C): the
authoritative list of communes with their department and region codes. Every other
dataset joins onto it by ``code_commune``, so it becomes ``dim_location``.

What this job does:
  * keeps only actual communes (``TYPECOM = COM``), dropping the municipal
    arrondissements (ARM: Paris/Lyon/Marseille) and associated/deleted entries;
  * exposes ``code_commune`` -> department -> region for the territory hierarchy;
  * normalises codes (zero-padding) so joins are exact;
  * de-duplicates on ``code_commune`` (a millésime file is already unique, but this
    guards against a re-run appending a second year).

Output grain: one row per commune.
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

SOURCE = "cog"


def clean(df: DataFrame) -> DataFrame:
    communes = (
        df.where(F.col("TYPECOM") == "COM")
        .select(
            clean_insee_code(F.col("COM")).alias("code_commune"),
            clean_insee_code(F.col("DEP"), width=2).alias("code_departement"),
            F.col("REG").alias("code_region"),
            F.coalesce(F.col("LIBELLE"), F.col("NCCENR")).alias("nom_commune"),
        )
        .where(F.col("code_commune").isNotNull())
    )
    return communes.dropDuplicates(["code_commune"])


def main() -> int:
    spark = build_session("homepedia-clean-cog")
    src = raw_path(SOURCE)
    print(f"[clean_cog] reading {src}")

    raw = spark.read.option("header", True).csv(src)
    cleaned = clean(raw)

    out = curated_path(SOURCE)
    cleaned.write.mode("overwrite").parquet(out)
    print(f"[clean_cog] wrote {cleaned.count()} communes -> {out}")
    spark.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
