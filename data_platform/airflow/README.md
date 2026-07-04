# Homepedia — Airflow ingestion scheduler (HOM-22)

Airflow orchestrates the existing data_platform loaders (`scripts/load_*.sh`) and
the dbt gold refresh (`scripts/dbt.sh`). It is a thin scheduler over the same
scripts used for manual loads — no duplicated ingestion logic.

## DAGs

| DAG id | Schedule | Loads | Raw tables |
|--------|----------|-------|------------|
| `homepedia_referentiels` | `0 3 1 * *` (monthly) | COG commune / département / région | `raw_insee_cog_*` |
| `homepedia_logement` | `0 4 1 * *` (monthly) | geo-DVF | `raw_dvf_transaction` |
| `homepedia_demo` | `0 5 1 * *` (monthly) | BPE + FiLoSoFi (communes & IRIS) | `raw_bpe_equipement`, `raw_filosofi` |
| `homepedia_gold_refresh` | triggered | `dbt deps && dbt run && dbt test` | builds `stg_*` → `app_*` |

Each domain DAG: **check source URL (HEAD)** → **load** → **trigger
`homepedia_gold_refresh`**. The gold DAG runs only when triggered and is
serialised (`max_active_runs=1`), so several loads in the same window coalesce.

Cadence follows the README "Extraction en continu" matrix (monthly HEAD checks,
full reload on a new millésime via each loader's `--truncate`). Sources without a
loader yet (RPLS, Sit@del2, DPE, taux BdF, transports…) plug in here as new
`load_*.sh` scripts land.

## Run

The warehouse must be up first (separate stack):

```bash
cd data_platform
./scripts/postgres_up.sh
```

Then start Airflow:

```bash
cd data_platform/airflow
cp .env.example .env          # set AIRFLOW_UID on Linux: id -u
docker compose up -d --build  # first build installs loaders + dbt into the image
```

- Web UI: <http://localhost:8080> (default `admin` / `admin`, change in `.env`).
- DAGs ship **paused**; unpause the ones you want, or trigger manually.
- Connection to the warehouse is `host.docker.internal:5432` by default (Docker
  Desktop, and Linux via the `host-gateway` mapping in `docker-compose.yml`).

Trial-friendly defaults: `.env.example` sets `DVF_MAX_ROWS=100000` so a manual
trigger of `homepedia_logement` finishes quickly instead of pulling the full
~500 MB national DVF file.

### Smoke test a single DAG

```bash
docker compose exec airflow-scheduler airflow dags test homepedia_referentiels
```

## Notes / next steps

- **Watermarking** (`pipeline_state` ETag/Last-Modified to skip unchanged files)
  and dbt `source freshness` alerts are described in the root README; the HEAD
  check here is the first step. Loaders currently `--truncate` + full reload.
- **Notifications**: set `SLACK_WEBHOOK_URL` in `.env` to get task-failure pings.
- **Metadata DB**: Airflow uses its own `airflow-meta` Postgres; it never touches
  the `homepedia` warehouse.
- This is a LocalExecutor single-host setup for dev. For prod, move to
  Celery/Kubernetes executors and externalise secrets.
