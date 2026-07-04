#!/usr/bin/env bash
# Local dev refresh: load tests/fixtures CSVs into raw, then dbt deps / run / test.
# Production data: ./scripts/load_all_default.sh (see data_platform/README.md).
# Assumes Postgres is already up (see scripts/postgres_up.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_use_dev_db
homepedia_require_venv_python
homepedia_activate_venv

if ! command -v dbt >/dev/null 2>&1; then
  echo "error: dbt not on PATH; run scripts/bootstrap_venv.sh" >&2
  exit 1
fi

"$SCRIPT_DIR/load_dvf.sh" sample
"$SCRIPT_DIR/load_cog.sh" sample
"$SCRIPT_DIR/load_bpe.sh" sample
"$SCRIPT_DIR/load_filosofi.sh" sample
"$SCRIPT_DIR/load_rates.sh" sample
"$SCRIPT_DIR/load_taxe_fonciere.sh" sample
"$SCRIPT_DIR/load_qpv.sh" sample
"$SCRIPT_DIR/load_rp_csp.sh" sample
"$SCRIPT_DIR/load_delinquance.sh" sample
"$SCRIPT_DIR/load_codes_postaux.sh" sample

cd "$DATA_PLATFORM_ROOT/dbt"
dbt deps
dbt run
dbt test
echo "done: sample data loaded and dbt models refreshed."
