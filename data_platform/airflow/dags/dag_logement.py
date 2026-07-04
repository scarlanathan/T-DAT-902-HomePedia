"""Logement DAG (HOM-22).

Monthly load of geo-DVF (transactions) into ``raw_dvf_transaction``, then
triggers the gold refresh. The national ``full.csv.gz`` is large (~500 MB);
set ``DVF_MAX_ROWS`` in the environment to cap ingestion for trials.

Other logement sources (RPLS, Sit@del2, DPE) have no loader yet — they are
listed in the project README and will plug in here as new ``load_*.sh`` land.
"""
from __future__ import annotations

from airflow import DAG
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from homepedia import (
    DEFAULT_ARGS,
    DVF_MAX_ROWS,
    GOLD_REFRESH_DAG_ID,
    SOURCES,
    START_DATE,
    check_task,
    load_task,
)

_dvf_args = ["url", "--url", SOURCES["DVF_CSV_URL"], "--truncate"]
if DVF_MAX_ROWS:
    _dvf_args += ["--max-rows", DVF_MAX_ROWS]

with DAG(
    dag_id="homepedia_logement",
    description="geo-DVF transactions -> raw_dvf_transaction",
    default_args=DEFAULT_ARGS,
    schedule="0 4 1 * *",  # 04:00, 1st of each month
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    tags=["homepedia", "ingestion", "logement"],
) as dag:
    check = check_task("check_dvf_source", SOURCES["DVF_CSV_URL"])
    load_dvf = load_task("load_dvf", "load_dvf.sh", _dvf_args)
    trigger_gold = TriggerDagRunOperator(
        task_id="trigger_gold_refresh",
        trigger_dag_id=GOLD_REFRESH_DAG_ID,
        reset_dag_run=True,
        wait_for_completion=False,
    )

    check >> load_dvf >> trigger_gold
