# Homepedia backend (API)

This service serves API endpoints on top of the Postgres warehouse populated by `data_platform/` (DVF, BPE, COG, FiLoSoFi ingestion + dbt models).

## Prerequisites

- Postgres (recommended: `data_platform/docker-compose.yml` which enables PostGIS)
- dbt models built at least once (`dim_location`, `dim_departement`, `dim_region`, `fact_transaction`, `fact_equipment`, `app_city_housing_summary`, `app_city_equipment_summary`, `app_city_social_summary`, `app_iris_social_summary`, `app_opportunity_score`)

## Run

Before starting the backend, make sure you followed the `data_platform/` documentation and that **Postgres is up** (and dbt models have been built at least once).

From repo root, in one terminal:

```bash
cd backend
cp .env.example .env
npm install
./scripts/run.sh
```

API listens on `PORT` (default `3001`).

Tests : `./scripts/test.sh`.

## Endpoints

### Health & docs

- `GET /health` – postgres connectivity
- `GET /docs` (Swagger UI)

### Locations (COG + communes)

- `GET /locations?q=paris&limit=20`
- `GET /locations/:codeCommune` – commune detail (includes `code_region`, `type_commune`, …)
- `GET /locations/regions?limit=50`
- `GET /locations/regions/:codeRegion`
- `GET /locations/departments?code_region=11&limit=200`
- `GET /locations/departments/:codeDepartement`
- `GET /locations/departments/:codeDepartement/communes?limit=500`

### DVF (housing & transactions)

- `GET /transactions?code_commune=75101&from=2020-01-01&to=2022-12-31&limit=200`
- `GET /transactions/:transactionId`
- `GET /stats/city-housing-summary?code_commune=75101&from=2020-01-01&to=2022-12-31`
- `GET /stats/transaction-summary?code_commune=75101&from=2020-01-01&to=2022-12-31`
- `GET /map/transactions?bbox=2.0,48.0,3.0,49.0&from=2020-01-01&to=2022-12-31&limit=2000`

### BPE (public equipment)

- `GET /stats/city-equipment-summary?code_commune=75056`
- `GET /equipment?code_commune=75056&equipment_category=education&limit=200`

### FiLoSoFi (social indicators)

- `GET /stats/city-social-summary?code_commune=75056`
- `GET /stats/iris-social-summary?code_commune=75056&code_iris=751010101`

### Composite score

- `GET /stats/opportunity-score?code_commune=75056&from=2020-01-01&to=2024-12-31`

## Swagger / OpenAPI

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`
- Export static file: `./scripts/export_openapi.sh` → `openapi.yaml`

## Frontend documentation

See `docs/frontend.md`.
