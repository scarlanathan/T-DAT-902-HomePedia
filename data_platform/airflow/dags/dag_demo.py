"""Démographie & socio-économique DAG (HOM-22).

Monthly load of INSEE BPE (équipements) and FiLoSoFi (revenus / pauvreté) into
``raw_bpe_equipement`` and ``raw_filosofi``, plus the social-mix sources QPV
(ANCT) and RP catégories socioprofessionnelles (INSEE), then triggers the gold
refresh.

FiLoSoFi is loaded in two passes that coexist in ``raw_filosofi``:
  * Filosofi 2 communes (tidy CSV) via ``url-v2``
  * legacy wide IRIS (Filosofi 1, 2021) via ``url-wide`` — no IRIS in Filosofi 2.
"""
from __future__ import annotations

from airflow import DAG
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from homepedia import (
    BPE_TYPEQU_FILTER,
    DEFAULT_ARGS,
    GOLD_REFRESH_DAG_ID,
    SOURCES,
    START_DATE,
    check_task,
    load_task,
)

_bpe_args = [
    "url",
    "--url",
    SOURCES["BPE_URL"],
    "--truncate",
    "--millesime",
    SOURCES["BPE_MILLESIME"],
]
if BPE_TYPEQU_FILTER:
    _bpe_args += ["--typequ-filter", BPE_TYPEQU_FILTER]

with DAG(
    dag_id="homepedia_demo",
    description="INSEE BPE + FiLoSoFi -> raw_bpe_equipement / raw_filosofi",
    default_args=DEFAULT_ARGS,
    schedule="0 5 1 * *",  # 05:00, 1st of each month
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    tags=["homepedia", "ingestion", "demographie"],
) as dag:
    check_bpe = check_task("check_bpe_source", SOURCES["BPE_URL"])
    check_filosofi = check_task("check_filosofi_source", SOURCES["FILOSOFI_COMMUNE_URL"])

    load_bpe = load_task("load_bpe", "load_bpe.sh", _bpe_args)
    load_filosofi_communes = load_task(
        "load_filosofi_communes",
        "load_filosofi.sh",
        ["url-v2", "--url", SOURCES["FILOSOFI_COMMUNE_URL"], "--truncate"],
    )
    load_filosofi_iris = load_task(
        "load_filosofi_iris",
        "load_filosofi.sh",
        ["url-wide", "--url", SOURCES["FILOSOFI_IRIS_URL"], "--truncate"],
    )

    check_qpv = check_task("check_qpv_source", SOURCES["QPV_URL"])
    load_qpv = load_task(
        "load_qpv",
        "load_qpv.sh",
        ["url", "--url", SOURCES["QPV_URL"], "--truncate"],
    )

    check_rp_csp = check_task("check_rp_csp_source", SOURCES["RP_CSP_URL"])
    load_rp_csp = load_task(
        "load_rp_csp",
        "load_rp_csp.sh",
        ["url", "--url", SOURCES["RP_CSP_URL"], "--truncate"],
    )

    trigger_gold = TriggerDagRunOperator(
        task_id="trigger_gold_refresh",
        trigger_dag_id=GOLD_REFRESH_DAG_ID,
        reset_dag_run=True,
        wait_for_completion=False,
    )

    check_bpe >> load_bpe
    check_filosofi >> load_filosofi_communes >> load_filosofi_iris
    check_qpv >> load_qpv
    check_rp_csp >> load_rp_csp
    [load_bpe, load_filosofi_iris, load_qpv, load_rp_csp] >> trigger_gold
