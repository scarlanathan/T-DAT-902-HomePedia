# Homepedia data platform

Ingestion loaders land public datasets into Postgres `raw_*` tables, then **dbt** builds marts per `docs/data_flow.md` (`raw_*` → `stg_*` → `normalized_*` → `dim_*` / `fact_*` → `app_*`).

| Source | Script | Raw table(s) |
|--------|--------|--------------|
| [geo-DVF](https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/) (data.gouv) | `load_dvf.sh` | `raw_dvf_transaction` |
| [INSEE COG](https://www.insee.fr/fr/information/2560452) | `load_cog.sh` | `raw_insee_cog_commune`, `_departement`, `_region` |
| [INSEE BPE](https://www.insee.fr/fr/statistiques/serie/s1161) | `load_bpe.sh` | `raw_bpe_equipement` |
| [INSEE FiLoSoFi](https://www.data.gouv.fr/datasets/revenus-et-pauvrete-des-menages-aux-niveaux-national-et-local-revenus-localises-sociaux-et-fiscaux) | `load_filosofi.sh` | `raw_filosofi` |

## Layout

| Path | Role |
|------|------|
| `ingestion/dvf/` | `raw_dvf_transaction` + CSV loader. |
| `ingestion/insee/` | `raw_insee_cog_*` + COG CSV loader. |
| `ingestion/bpe/` | `raw_bpe_equipement` + BPE CSV/ZIP loader. |
| `ingestion/filosofi/` | `raw_filosofi` + FiLoSoFi CSV/ZIP loader. |
| `tests/` | Pytest suite + CSV data. |
| `dbt/` | Models on top of `raw_*`. |
| `sql/init_postgres.sql` | `CREATE EXTENSION postgis` (Docker init). |
| `tests/fixtures/` | Sample CSV files for pytest and local dev (`*_sample.csv`, 26 cities with full DVF/BPE/FiLoSoFi). |
| `scripts/` | Helpers; they resolve paths from `data_platform/` automatically. |

## Scripts

| Script | Purpose |
|--------|---------|
| `bootstrap_venv.sh` | `.venv` + `requirements.txt` + `requirements-dbt.txt`. |
| `postgres_up.sh` / `postgres_down.sh` | Docker PostGIS up (wait for ready) / down. |
| `load_dvf.sh` | DVF → `raw_dvf_transaction`. |
| `load_cog.sh` | COG → `raw_insee_cog_*`. |
| `load_bpe.sh` | BPE → `raw_bpe_equipement`. |
| `load_filosofi.sh` | FiLoSoFi → `raw_filosofi`. |
| `dbt.sh` | `dbt` with `DBT_PROFILES_DIR` (e.g. `run`, `deps`). |
| `ingestion_test.sh` | `pytest` for loaders + `load_*.sh` (integration tests need Postgres). |
| `dbt_test.sh` | `dbt test` on **`homepedia_test`** (forwards args). |
| `test.sh` | Ingestion + `dbt run` + dbt tests (uses **`homepedia_test`** only). |
| `load_sample_demo.sh` | Sample loads (`tests/fixtures`) + `dbt deps` + `dbt run` + `dbt test` (**`homepedia`**). |
| `load_all_default.sh` | Production loads from default public URLs + dbt refresh (**`homepedia`**). |

Two databases on the same PostGIS instance:

| Database | Used by |
|----------|---------|
| `homepedia` | Dev, production loads, `load_sample_demo.sh`, `dbt.sh run` |
| `homepedia_test` | `test.sh`, `ingestion_test.sh` (pytest + sample reload) |

`postgres_up.sh` creates `homepedia_test` if missing. Override with `POSTGRES_DEV_DB` / `POSTGRES_TEST_DB`.

## Run locally

```bash
cd data_platform
./scripts/bootstrap_venv.sh          # first time
./scripts/postgres_up.sh
./scripts/load_sample_demo.sh          # sample data + dbt (for backend/frontend dev)
```

After changing dbt models on **dev** data:

```bash
./scripts/dbt.sh run
```

After changing dbt models, validate on **test** data (`homepedia_test`):

```bash
./scripts/test.sh          # full pipeline, or:
./scripts/dbt_test.sh      # dbt tests only (test DB)
```

Tests (isolated `homepedia_test` - does not touch dev data):

```bash
./scripts/postgres_up.sh      # ensures homepedia_test exists
./scripts/ingestion_test.sh   # loaders only
./scripts/test.sh             # ingestion + dbt run + dbt tests (Postgres required)
```

## Load data

All `load_*.sh` scripts use `url` / `file` for real data (`--help` on each). Use `sample` for pytest and local dev (`load_sample_demo.sh`).

| Subcommand | Behaviour |
|------------|-----------|
| `url [args…]` | Remote file; pass `--url …` or set the env var below. **Production.** |
| `file <path> [args…]` | Local CSV / CSV.gz / ZIP; relative paths are under `data_platform/`. |
| `sample [args…]` | Load `tests/fixtures/*_sample.csv` with `--truncate`. **Tests and local dev.** |

Extra loader flags are forwarded as-is (`--truncate`, `--max-rows`, …). Each loader creates its `raw_*` table on first run (`ingestion/*/schema.sql`).

### DVF

```bash
./scripts/load_dvf.sh url --url 'https://…/dvf.csv.gz' --truncate --max-rows 100000
```

- Env: `DVF_CSV_URL`
- Format: comma-separated geo-DVF CSV ([README-CSV](https://github.com/datagouv/dvf/blob/master/README-CSV.md))
- `--truncate`: `TRUNCATE` the whole `raw_dvf_transaction` table

### COG (communes, départements, régions)

One file per level; the loader auto-detects the target table from the CSV header (or pass `--kind commune|departement|region`).

```bash
# Production - one INSEE file per run (loader picks the table from the header)
./scripts/load_cog.sh url --url 'https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv' --truncate
./scripts/load_cog.sh url --url 'https://www.insee.fr/fr/statistiques/fichier/8740222/v_departement_2026.csv' --truncate
./scripts/load_cog.sh url --url 'https://www.insee.fr/fr/statistiques/fichier/8740222/v_region_2026.csv' --truncate
```

- Env: `COG_CSV_URL`
- Format: comma-separated INSEE COG CSV (UTF-8)
- `--truncate`: `TRUNCATE` the detected `raw_insee_cog_*` table only
- Millesime is inferred from the filename (`v_commune_2024.csv` → 2024)

### BPE (équipements)

```bash
./scripts/load_bpe.sh url --url 'https://www.insee.fr/fr/statistiques/fichier/8217525/BPE24.zip' --truncate --millesime 2024
./scripts/load_bpe.sh url --url 'https://…' --typequ-filter C101,C102,C201,C301,D101,D201,D501,A504,A505 --truncate
```

- Env: `BPE_URL`
- Format: semicolon-separated CSV inside a ZIP (or plain CSV / CSV.gz)
- `--typequ-filter`: keep only listed equipment codes ([nomenclature](https://www.insee.fr/fr/statistiques/3568614))
- `--truncate`: `TRUNCATE` the whole `raw_bpe_equipement` table

### FiLoSoFi (revenus & pauvreté)

INSEE publishes two formats; both map into `raw_filosofi` so **multiple millésimes can coexist**:

| Format | Subcommand | Typical files |
|--------|------------|---------------|
| **Filosofi 2** (tidy) | `url-v2` | `FILOSOFI_CC_csv.zip` (communes 2023) |
| **Filosofi 1** (wide) | `url-wide` | `cc_filosofi_*_COM.zip`, `BASE_TD_FILO_IRIS_*_DISP_CSV.zip` |

```bash
# Filosofi 2 communes (2023)
./scripts/load_filosofi.sh url-v2 --url 'https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip' --truncate

# Legacy wide IRIS (2021) - no IRIS in Filosofi 2 2023
./scripts/load_filosofi.sh url-wide --url 'https://www.insee.fr/fr/statistiques/fichier/8229323/BASE_TD_FILO_IRIS_2021_DISP_CSV.zip' --truncate
```

- `--format auto|wide|v2` on the Python loader (default `auto` for `url`)
- Millesime: from `TIME_PERIOD` (v2) or column suffix / filename (`MED21` → 2021)
- `--truncate`: `DELETE` only the `(millesime, kind)` being loaded; other years/levels stay in `raw_filosofi`

### Load all sources from default public URLs

```bash
./scripts/postgres_up.sh
./scripts/load_all_default.sh
```

Default URLs (override via env):

| Variable | Source |
|----------|--------|
| `DVF_CSV_URL` | geo-DVF national `full.csv.gz` (data.gouv, 2025 release) |
| `COG_COMMUNE_URL` / `COG_DEPARTEMENT_URL` / `COG_REGION_URL` | INSEE COG 2026 |
| `BPE_URL` / `BPE_MILLESIME` | INSEE BPE 2024 (`BPE24.zip`, millésime 2024) |
| `FILOSOFI_COMMUNE_URL` | FiLoSoFi 2 communes (`FILOSOFI_CC_csv.zip`, loaded via `url-v2`) |
| `FILOSOFI_LEGACY_COMMUNE_URL` | Optional Filosofi 1 wide commune zip (`url-wide`) |
| `FILOSOFI_IRIS_URL` | Filosofi 1 wide IRIS (`BASE_TD_FILO_IRIS_2021_DISP_CSV.zip`, `url-wide`) |

Optional: `DVF_MAX_ROWS=100000` (trial cap), `BPE_TYPEQU_FILTER=C101,C102,…`, `SKIP_DBT=1` (raw load only).

Manual equivalent:

```bash
./scripts/load_dvf.sh url --url 'https://…/dvf.csv.gz' --truncate
./scripts/load_cog.sh url --url 'https://…/v_commune_2024.csv' --truncate
# … (see load_*.sh --help)
./scripts/dbt.sh deps && ./scripts/dbt.sh run && ./scripts/dbt.sh test
```

## dbt models

| Source | Pipeline | Marts |
|--------|----------|-------|
| DVF | `stg_dvf__transaction` → `normalized_dvf_transaction` | `fact_transaction`, `app_city_housing_summary` |
| COG | `stg_cog__*` → `normalized_cog_*` | `dim_location`, `dim_departement`, `dim_region` |
| BPE | `stg_bpe__equipement` → `normalized_bpe_equipement` | `fact_equipment`, `app_city_equipment_summary` |
| FiLoSoFi | `stg_filosofi__indicator` → `normalized_filosofi_*` | `app_city_social_summary`, `app_iris_social_summary` |

Composite: `app_opportunity_score` (DVF price + FiLoSoFi social + BPE quality).

## Orchestration (Airflow)

Scheduled ingestion lives in [`airflow/`](airflow/README.md) (HOM-22): one DAG per
domain (`referentiels`, `logement`, `demo`) wrapping the `load_*.sh` loaders, plus a
terminal `gold_refresh` DAG running `dbt deps/run/test`. It's a thin scheduler over
the same scripts — no duplicated ingestion logic.

```bash
cd data_platform && ./scripts/postgres_up.sh   # warehouse first
cd airflow && cp .env.example .env && docker compose up -d --build   # UI: :8080
```

## Next

COG/IGN → `dim_location.geom`; watermarking (`pipeline_state`) + dbt `source freshness`; OpenSearch: `docs/guide.md`.
