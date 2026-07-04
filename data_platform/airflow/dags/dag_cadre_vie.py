"""Cadre de vie & sécurité DAG (HOM-22).

Monthly load of the SSMSI communal recorded-crime base into ``raw_delinquance``,
then triggers the gold refresh. Feeds the ``safety_index`` dimension of
``app_opportunity_score``.

Other cadre-de-vie sources (annuaire éducation, FINESS santé, GTFS transports)
have no loader yet — they will plug in here as new ``load_*.sh`` land.
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
    dag_id="homepedia_cadre_vie",
    description="SSMSI délinquance communale -> raw_delinquance",
    default_args=DEFAULT_ARGS,
    schedule="0 7 1 * *",  # 07:00, 1st of each month
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    tags=["homepedia", "ingestion", "cadre_vie"],
) as dag:
    check_delinquance = check_task(
        "check_delinquance_source", SOURCES["DELINQUANCE_URL"]
    )
    load_delinquance = load_task(
        "load_delinquance",
        "load_delinquance.sh",
        ["url", "--url", SOURCES["DELINQUANCE_URL"], "--truncate"],
    )

    trigger_gold = TriggerDagRunOperator(
        task_id="trigger_gold_refresh",
        trigger_dag_id=GOLD_REFRESH_DAG_ID,
        reset_dag_run=True,
        wait_for_completion=False,
    )

    check_delinquance >> load_delinquance >> trigger_gold
