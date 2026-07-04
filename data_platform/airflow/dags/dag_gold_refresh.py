"""Gold refresh DAG (HOM-22).

Terminal DAG triggered by the domain ingestion DAGs. Rebuilds the dbt layer
(``stg_* -> normalized_* -> dim_/fact_ -> app_*``) on the dev database and runs
the data-quality tests, reusing ``scripts/dbt.sh`` (dbt on PATH via the image's
isolated venv).

``schedule=None``: it only runs when triggered (or manually), so multiple
domain loads in the same window coalesce instead of racing — ``max_active_runs=1``
serialises overlapping triggers.
"""
from __future__ import annotations

from airflow import DAG
from airflow.operators.bash import BashOperator

from homepedia import DEFAULT_ARGS, SCRIPTS_DIR, START_DATE

with DAG(
    dag_id="homepedia_gold_refresh",
    description="dbt deps/run/test — rebuild marts after ingestion",
    default_args=DEFAULT_ARGS,
    schedule=None,  # triggered by the domain DAGs
    start_date=START_DATE,
    catchup=False,
    max_active_runs=1,
    tags=["homepedia", "dbt", "gold"],
) as dag:
    dbt_deps = BashOperator(
        task_id="dbt_deps",
        bash_command=f"bash {SCRIPTS_DIR}/dbt.sh deps",
    )
    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=f"bash {SCRIPTS_DIR}/dbt.sh run",
    )
    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=f"bash {SCRIPTS_DIR}/dbt.sh test",
    )

    dbt_deps >> dbt_run >> dbt_test
