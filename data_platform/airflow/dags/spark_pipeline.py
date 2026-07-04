from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "homepedia",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="spark_dvf_pipeline",
    description="Traitement DVF via Spark : CSV → Parquet nettoyé + métriques",
    schedule_interval="0 6 * * 1",  # tous les lundis à 6h
    start_date=datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["spark", "dvf"],
) as dag:

    spark_dvf = BashOperator(
        task_id="spark_dvf_processing",
        bash_command=(
            "docker exec homepedia-spark-master "
            "/opt/spark/bin/spark-submit "
            "--master spark://spark-master:7077 "
            "--py-files /opt/spark/jobs/dvf_processing.py "
            "/opt/spark/jobs/dvf_processing.py "
            "--input {{ params.input_path }} "
            "--output {{ params.output_path }}"
        ),
        params={
            "input_path": "/data/dvf/full.csv",
            "output_path": "/data/dvf/parquet/",
        },
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command="cd /opt/airflow/data_platform && ./scripts/dbt.sh run",
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command="cd /opt/airflow/data_platform && ./scripts/dbt.sh test",
    )

    spark_dvf >> dbt_run >> dbt_test
