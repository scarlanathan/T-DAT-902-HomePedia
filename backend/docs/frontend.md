# Frontend integration (Next.js)

## Base URL

Default dev URL: `http://localhost:3001`.

## Swagger / OpenAPI

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /docs-json`
- Static export (recommended for codegen): run `./scripts/export_openapi.sh` in `backend/` to generate `openapi.yaml`.

## CORS

Backend enables CORS. Configure allowed origins with:

- `CORS_ORIGIN=http://localhost:3000` (single origin)
- `CORS_ORIGIN=http://localhost:3000,http://localhost:3002` (multiple)

## Useful endpoints

### Health

`GET /health` → `{ status, postgres }`

### Locations (COG + communes)

- `GET /locations?limit=20`
- `GET /locations?q=paris&limit=20`
- `GET /locations/:codeCommune` – includes `code_region`, `type_commune`, `cog_millesime`
- `GET /locations/regions`
- `GET /locations/regions/:codeRegion`
- `GET /locations/departments?code_region=11`
- `GET /locations/departments/:codeDepartement`
- `GET /locations/departments/:codeDepartement/communes`

### DVF aggregates

`GET /stats/city-housing-summary?code_commune=75056&from=2020-01-01&to=2024-12-31`

Returns rows from `app_city_housing_summary` (commune × month).

### BPE equipment

`GET /stats/city-equipment-summary?code_commune=75056` – per-commune counts by category.

`GET /equipment?code_commune=75056&equipment_category=education&limit=200` – individual équipements from `fact_equipment`.

### FiLoSoFi social indicators

`GET /stats/city-social-summary?code_commune=75056` – commune-level income & poverty.

`GET /stats/iris-social-summary?code_commune=75056` – IRIS-level detail (large cities).

### Opportunity score

`GET /stats/opportunity-score?code_commune=75056&from=2020-01-01&to=2024-12-31`

Composite score combining DVF price, FiLoSoFi social mix, and BPE quality-of-life dimensions.

### Transaction lines

`GET /transactions?code_commune=75056&from=2020-01-01&to=2020-12-31&limit=200&include_location=true`

Returns rows from `fact_transaction` (optionally includes `code_commune`, `nom_commune`).

## Example (Next.js)

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchCitySocialSummary(codeCommune: string) {
  const url = new URL('/stats/city-social-summary', API_URL);
  url.searchParams.set('code_commune', codeCommune);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchOpportunityScore(codeCommune: string) {
  const url = new URL('/stats/opportunity-score', API_URL);
  url.searchParams.set('code_commune', codeCommune);
  url.searchParams.set('limit', '24');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```
