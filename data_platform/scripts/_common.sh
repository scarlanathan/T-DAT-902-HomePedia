#!/usr/bin/env bash
# shellcheck shell=bash
# Internal: source from other scripts in this directory (do not execute directly).
set -euo pipefail

_scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
export DATA_PLATFORM_ROOT="$(cd "$_scripts_dir/.." && pwd)"

cd "$DATA_PLATFORM_ROOT"

export DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-$DATA_PLATFORM_ROOT/dbt}"

# Dev database (default for loads, dbt run, backend).
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_USER="${POSTGRES_USER:-homepedia}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-homepedia}"
export POSTGRES_DEV_DB="${POSTGRES_DEV_DB:-homepedia}"
export POSTGRES_TEST_DB="${POSTGRES_TEST_DB:-homepedia_test}"
export POSTGRES_SCHEMA="${POSTGRES_SCHEMA:-public}"

# Active database (overridden by homepedia_use_dev_db / homepedia_use_test_db).
export POSTGRES_DB="${POSTGRES_DB:-$POSTGRES_DEV_DB}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}}"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_TEST_DB}}"

homepedia_activate_venv() {
  if [[ -f "$DATA_PLATFORM_ROOT/.venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "$DATA_PLATFORM_ROOT/.venv/bin/activate"
  elif [[ -f "$DATA_PLATFORM_ROOT/.venv/Scripts/activate" ]]; then
    # Windows venv layout (Git Bash)
    # shellcheck source=/dev/null
    source "$DATA_PLATFORM_ROOT/.venv/Scripts/activate"
  fi
}

homepedia_require_venv_python() {
  homepedia_activate_venv
  if ! command -v python3 >/dev/null 2>&1; then
    echo "error: python3 not found; create a venv: scripts/bootstrap_venv.sh" >&2
    exit 1
  fi
}

homepedia_use_dev_db() {
  export POSTGRES_DB="$POSTGRES_DEV_DB"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  export DBT_TARGET=dev
}

homepedia_use_test_db() {
  export POSTGRES_DB="$POSTGRES_TEST_DB"
  export DATABASE_URL="$TEST_DATABASE_URL"
  export DBT_TARGET=test
}

homepedia_ensure_test_database() {
  local container="${POSTGRES_CONTAINER_NAME:-homepedia-postgres}"
  if ! docker exec "$container" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DEV_DB" >/dev/null 2>&1; then
    echo "error: Postgres is not ready (container: $container); run scripts/postgres_up.sh" >&2
    return 1
  fi

  if ! docker exec "$container" psql -U "$POSTGRES_USER" -d "$POSTGRES_DEV_DB" -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_TEST_DB}'" | grep -q 1; then
    docker exec "$container" psql -U "$POSTGRES_USER" -d "$POSTGRES_DEV_DB" -v ON_ERROR_STOP=1 -c \
      "CREATE DATABASE \"${POSTGRES_TEST_DB}\" OWNER \"${POSTGRES_USER}\";"
    echo "Created database ${POSTGRES_TEST_DB}."
  fi

  docker exec "$container" psql -U "$POSTGRES_USER" -d "$POSTGRES_TEST_DB" -v ON_ERROR_STOP=1 -c \
    "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null

  homepedia_apply_raw_schemas "$TEST_DATABASE_URL"
}

homepedia_apply_raw_schemas() {
  local database_url="${1:-$DATABASE_URL}"
  homepedia_require_venv_python
  python3 - "$database_url" <<'PY'
import sys
from pathlib import Path
import os

import psycopg

root = Path(os.environ["DATA_PLATFORM_ROOT"])
database_url = sys.argv[1]
schema_files = (
    "ingestion/dvf/schema.sql",
    "ingestion/insee/schema.sql",
    "ingestion/bpe/schema.sql",
    "ingestion/filosofi/schema.sql",
    "ingestion/rates/schema.sql",
    "ingestion/fiscalite/schema.sql",
    "ingestion/qpv/schema.sql",
    "ingestion/rp/schema.sql",
    "ingestion/securite/schema.sql",
    "ingestion/laposte/schema.sql",
)

with psycopg.connect(database_url) as conn:
    for rel in schema_files:
        sql = (root / rel).read_text(encoding="utf-8")
        for stmt in (s.strip() for s in sql.split(";")):
            if stmt:
                conn.execute(stmt)
    conn.commit()
PY
}
