#!/usr/bin/env python3
"""Join the four curated datasets into one commune overview (the problem statement).

This is the pay-off of the cleaning jobs: it answers Brique A directly - for a median
local household, how many m² can they afford given the commune's price/m²? - and carries
the social-mix (Brique B) and amenity (Brique D proxy) indicators alongside.

Inputs : curated/cog, curated/dvf, curated/filosofi, curated/bpe (Parquet in the lake).
Output : curated/app_commune_overview - one row per commune, ready for the transform
         service to load into Postgres ``app_*``.

The borrowing-capacity model is intentionally simple and transparent:
    monthly_payment = (annual_income / 12) * DEBT_RATIO
    capital         = monthly_payment * (1 - (1+r)^-n) / r       (annuity formula)
    affordable_m2   = capital / median_price_m2
with r the monthly rate and n the number of monthly instalments. Rate and duration are
env-tunable so the same job can sweep scenarios.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pyspark.sql import functions as F

from utils.lake import curated_path
from utils.session import build_session

# Loan scenario (Brique A): tunable without touching code.
ANNUAL_RATE = float(os.environ.get("LOAN_RATE", "0.03"))     # 3 % nominal
DURATION_YEARS = int(os.environ.get("LOAN_YEARS", "25"))
DEBT_RATIO = float(os.environ.get("DEBT_RATIO", "0.35"))     # HCSF max effort rate


def affordable_capital_col(annual_income: F.Column) -> F.Column:
    r = ANNUAL_RATE / 12.0
    n = DURATION_YEARS * 12
    monthly_payment = (annual_income / 12.0) * DEBT_RATIO
    annuity_factor = (1 - (1 + r) ** (-n)) / r
    return monthly_payment * F.lit(annuity_factor)


def main() -> int:
    spark = build_session("homepedia-analyse-commune")

    cog = spark.read.parquet(curated_path("cog"))
    dvf = spark.read.parquet(curated_path("dvf"))
    filosofi = spark.read.parquet(curated_path("filosofi"))
    bpe = spark.read.parquet(curated_path("bpe"))

    # DVF transactions -> robust per-commune price/m² (median resists outliers).
    price = dvf.groupBy("code_commune").agg(
        F.expr("percentile_approx(price_m2, 0.5)").alias("median_price_m2"),
        F.count(F.lit(1)).alias("n_sales"),
    )

    # COG is the spine: every commune appears even if some indicators are missing.
    overview = (
        cog.join(price, "code_commune", "left")
        .join(
            filosofi.select(
                "code_commune", "med_income", "poverty_rate", "interdecile_ratio"
            ),
            "code_commune",
            "left",
        )
        .join(bpe.select("code_commune", "equipements_total"), "code_commune", "left")
    )

    scored = overview.withColumn(
        "affordable_capital",
        F.round(affordable_capital_col(F.col("med_income")), 0),
    ).withColumn(
        "affordable_m2",
        F.round(
            affordable_capital_col(F.col("med_income")) / F.col("median_price_m2"), 1
        ),
    )

    out = curated_path("app_commune_overview")
    scored.write.mode("overwrite").parquet(out)
    print(
        f"[analyse_commune] wrote {scored.count()} communes -> {out} "
        f"(rate={ANNUAL_RATE}, years={DURATION_YEARS}, debt_ratio={DEBT_RATIO})"
    )
    scored.where(F.col("affordable_m2").isNotNull()).orderBy(
        F.col("affordable_m2").desc()
    ).select(
        "code_commune", "nom_commune", "median_price_m2", "med_income", "affordable_m2"
    ).show(10, truncate=False)

    spark.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
