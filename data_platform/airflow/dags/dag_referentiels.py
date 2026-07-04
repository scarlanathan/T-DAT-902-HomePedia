"""Référentiels géographiques DAG (HOM-22).

Monthly load of the INSEE COG (communes / départements / régions) into the
``raw_insee_cog_*`` tables plus the La Poste postal-code base into
``raw_code_postal``, then triggers the gold refresh. The COG loader auto-detects
the target table from each CSV header.
"""
from __future__ import annotations

from airflow import DAG
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from homepedia import (
    DEFAULT_ARGS,
    GOLD_REFRESH_DAG_ID,
    SOURCES,
    START_DATE,
    check_task,
    load_task,
)

with DAG(
    dag_id="homepedia_referentiels",
    description="INSEE COG (communes/départements/régions) -> raw_insee_cog_*",
    default_args=DEFAULT_ARGS,
    schedule="0 3 1 * *",  # 03:00, 1st of each month
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    tags=["homepedia", "ingestion", "referentiels"],
) as dag:
    check = check_task("check_cog_source", SOURCES["COG_COMMUNE_URL"])

    load_commune = load_task(
        "load_cog_commune",
        "load_cog.sh",
        ["url", "--url", SOURCES["COG_COMMUNE_URL"], "--truncate"],
    )
    load_departement = load_task(
        "load_cog_departement",
        "load_cog.sh",
        ["url", "--url", SOURCES["COG_DEPARTEMENT_URL"], "--truncate"],
    )
    load_region = load_task(
        "load_cog_region",
        "load_cog.sh",
        ["url", "--url", SOURCES["COG_REGION_URL"], "--truncate"],
    )

    check_code_postal = check_task(
        "check_code_postal_source", SOURCES["CODE_POSTAL_URL"]
    )
    load_code_postal = load_task(
        "load_codes_postaux",
        "load_codes_postaux.sh",
        ["url", "--url", SOURCES["CODE_POSTAL_URL"], "--truncate"],
    )

    trigger_gold = TriggerDagRunOperator(
        task_id="trigger_gold_refresh",
        trigger_dag_id=GOLD_REFRESH_DAG_ID,
        reset_dag_run=True,
        wait_for_completion=False,
    )

    # COG levels are independent; run them sequentially to keep DB load light.
    check >> load_commune >> load_departement >> load_region
    check_code_postal >> load_code_postal
    [load_region, load_code_postal] >> trigger_gold
