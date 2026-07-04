# Homepedia frontend (Next.js)

Dashboard wired to the NestJS API (`backend/`). Requires Postgres with dbt models built (`data_platform/`).

## Layout

| Path | Role |
|------|------|
| `api/` | Backend HTTP client - one module per resource (`client`, `health`, `locations`, `stats`, `transactions`, `map`) |
| `hooks/` | React hooks that compose API calls (`use-dashboard-data`) |
| `lib/` | UI helpers (filters, format, chart transforms) - no API or mock data |
| `components/` | Dashboard UI |
| `scripts/` | Helpers; they resolve paths from `frontend/` automatically |

## Scripts

| Script | Purpose |
|--------|---------|
| `run.sh` | Dev server (`next dev`, default [http://localhost:3000](http://localhost:3000)) |
| `build.sh` | Production build |
| `test.sh` | Unit tests (`vitest run`) |
| `lint.sh` | ESLint |

## Setup

Before starting the frontend, ensure Postgres is up and dbt models are built and the API is running (`backend/scripts/run.sh`).

```bash
cd frontend
cp .env.example .env.local   # optional: NEXT_PUBLIC_API_URL
npm install
```

## Run

From `frontend/`:

```bash
./scripts/run_dev.sh
```

Open [http://localhost:3000](http://localhost:3000). Search for a commune to load stats; the map loads sales from the viewport via the API.

Production build and start:

```bash
./scripts/build.sh
npm run start
```

## Tests

```bash
./scripts/test.sh
./scripts/lint.sh
```

Coverage includes `api/`, `hooks/`, `lib/`, and UI components. Test fixtures live in `test/fixtures/` (tests only).
