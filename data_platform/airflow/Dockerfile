# Airflow image for Homepedia ingestion orchestration (HOM-22).
#
# Extends the official Airflow image with:
#   * git + curl (dbt deps clones packages; loaders fetch over HTTPS),
#   * the data_platform loader deps (psycopg, python-dotenv) in the Airflow env,
#   * dbt-core/dbt-postgres in an ISOLATED venv (avoids clashing with Airflow's
#     pinned deps) exposed on PATH so scripts/dbt.sh finds `dbt`.
FROM apache/airflow:2.9.3-python3.11

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER airflow

# Loader runtime deps (kept in sync with data_platform/requirements.txt).
RUN pip install --no-cache-dir "psycopg[binary]>=3.1.0" "python-dotenv>=1.0.0"

# dbt in its own venv so its dependency pins never fight Airflow's.
RUN python -m venv /home/airflow/dbt-venv \
    && /home/airflow/dbt-venv/bin/pip install --no-cache-dir \
        "dbt-core>=1.7,<2" "dbt-postgres>=1.7.0,<2"

# Expose ONLY the dbt binary on PATH (via .local/bin, already on PATH) so
# scripts/dbt.sh finds `dbt` while `python3` stays the Airflow interpreter that
# has the loader deps (psycopg, python-dotenv).
RUN ln -sf /home/airflow/dbt-venv/bin/dbt /home/airflow/.local/bin/dbt
