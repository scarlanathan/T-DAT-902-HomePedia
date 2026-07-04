"""Capacité d'emprunt DAG (HOM-22).

Loads the borrowing-power sources into the warehouse, then triggers the gold
refresh:
  * monthly housing-loan interest rate (ECB MIR series) -> ``raw_interest_rate``
  * DGFiP taxe foncière rates per commune -> ``raw_taxe_fonciere``

These feed ``app_opportunity_score`` (real borrowing capacity + holding cost),
replacing the previously hard-coded interest-rate assumption.
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
    dag_id="homepedia_emprunt",
    description="Taux crédit (BCE) + taxe foncière (DGFiP) -> raw_interest_rate / raw_taxe_fonciere",
    default_args=DEFAULT_ARGS,
    schedule="0 6 1 * *",  # 06:00, 1st of each month (rate is monthly; tax annual)
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    tags=["homepedia", "ingestion", "emprunt"],
) as dag:
    check_rates = check_task("check_rates_source", SOURCES["RATES_CSV_URL"])
    load_rates = load_task(
        "load_rates",
        "load_rates.sh",
        ["url", "--url", SOURCES["RATES_CSV_URL"], "--truncate"],
    )

    check_taxe = check_task("check_taxe_fonciere_source", SOURCES["TAXE_FONCIERE_URL"])
    load_taxe = load_task(
        "load_taxe_fonciere",
        "load_taxe_fonciere.sh",
        ["url", "--url", SOURCES["TAXE_FONCIERE_URL"], "--truncate"],
    )

    trigger_gold = TriggerDagRunOperator(
        task_id="trigger_gold_refresh",
        trigger_dag_id=GOLD_REFRESH_DAG_ID,
        reset_dag_run=True,
        wait_for_completion=False,
    )

    check_rates >> load_rates
    check_taxe >> load_taxe
    [load_rates, load_taxe] >> trigger_gold
