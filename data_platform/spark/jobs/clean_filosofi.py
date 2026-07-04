#!/usr/bin/env python3
"""Clean INSEE FiLoSoFi commune file: raw CSV in HDFS -> curated Parquet.

FiLoSoFi ("Fichier Localisé Social et Fiscal") gives, per commune, the median
disposable income and the income distribution. It feeds two bricks of the problem:
  * Brique A - ``med_income`` drives the local borrowing capacity;
  * Brique B - ``poverty_rate`` and the interdecile ratio D9/D1 measure social mix.

Source quirks this job handles:
  * semicolon-delimited;
  * column names carry a 2-digit year suffix (``MED21``, ``TP6021``, ``D121`` ...),
    detected at runtime so the job works on any millésime without code changes;
  * French decimal commas and statistical-secrecy tokens (``s``/``ns``/``nd``)
    are converted to proper doubles/nulls.

Output grain: one row per commune (for the file's millésime).
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from utils.lake import curated_path, raw_path
from utils.session import build_session
from utils.transforms import clean_insee_code, to_double

SOURCE = "filosofi"


def detect_year_suffix(columns: list[str]) -> str:
    """Return the 2-digit suffix shared by indicator columns (e.g. '21' from 'MED21')."""
    for col in columns:
        m = re.match(r"^MED(\d{2})$", col.upper())
        if m:
            return m.group(1)
    raise ValueError(
        f"Could not find a MEDxx column in {columns}; is this a FiLoSoFi commune file?"
    )


def clean(df: DataFrame) -> DataFrame:
    suffix = detect_year_suffix(df.columns)
    millesime = 2000 + int(suffix)

    def src(base: str) -> str:
        # Match the source column case-insensitively (files vary: MED21 vs Med21).
        want = f"{base}{suffix}".upper()
        for c in df.columns:
            if c.upper() == want:
                return c
        raise ValueError(f"Missing expected column {want} in {df.columns}")

    selected = df.select(
        clean_insee_code(F.col("CODGEO")).alias("code_commune"),
        F.col("LIBGEO").alias("nom_commune"),
        to_double(F.col(src("MED")), comma_decimal=True).alias("med_income"),
        to_double(F.col(src("TP60")), comma_decimal=True).alias("poverty_rate"),
        to_double(F.col(src("D1")), comma_decimal=True).alias("decile1"),
        to_double(F.col(src("D9")), comma_decimal=True).alias("decile9"),
        to_double(F.col(src("RD")), comma_decimal=True).alias("interdecile_published"),
    ).withColumn("millesime", F.lit(millesime))

    # Keep commune-level rows only (5-char codes) and drop secrecy-masked income rows.
    commune = selected.where(F.length("code_commune") == 5).where(
        F.col("med_income").isNotNull()
    )

    # Prefer the published D9/D1, fall back to a computed ratio when it is masked.
    return commune.withColumn(
        "interdecile_ratio",
        F.coalesce(
            F.col("interdecile_published"),
            F.when(F.col("decile1") > 0, F.round(F.col("decile9") / F.col("decile1"), 2)),
        ),
    ).drop("interdecile_published")


def main() -> int:
    spark = build_session("homepedia-clean-filosofi")
    src = raw_path(SOURCE)
    print(f"[clean_filosofi] reading {src}")

    raw = spark.read.option("header", True).option("sep", ";").csv(src)
    cleaned = clean(raw)

    out = curated_path(SOURCE)
    cleaned.write.mode("overwrite").parquet(out)
    print(f"[clean_filosofi] wrote {cleaned.count()} communes -> {out}")
    spark.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
