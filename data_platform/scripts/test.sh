#!/usr/bin/env bash
# Run all data_platform tests (ingestion pytest + dbt test). Assumes Postgres is up.
# Uses the isolated test database (homepedia_test); dev data in homepedia is untouched.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_ensure_test_database
homepedia_use_test_db

echo "==> test database: $POSTGRES_DB"
echo "==> ingestion tests"
"$SCRIPT_DIR/ingestion_test.sh"

echo "==> load sample fixtures (dbt needs full raw tables after pytest)"
"$SCRIPT_DIR/load_dvf.sh" sample
"$SCRIPT_DIR/load_cog.sh" sample
"$SCRIPT_DIR/load_bpe.sh" sample
"$SCRIPT_DIR/load_filosofi.sh" sample

echo "==> dbt run (materialize models before tests)"
"$SCRIPT_DIR/dbt.sh" deps
"$SCRIPT_DIR/dbt.sh" run

echo "==> dbt tests"
"$SCRIPT_DIR/dbt_test.sh"

echo "done: all data_platform tests passed."
