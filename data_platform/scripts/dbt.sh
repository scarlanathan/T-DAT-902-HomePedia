#!/usr/bin/env bash
# Run dbt from data_platform/dbt with DBT_PROFILES_DIR set.
# Examples:
#   scripts/dbt.sh deps
#   scripts/dbt.sh run
#   scripts/dbt.sh test
#   scripts/dbt.sh run --full-refresh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_activate_venv
export DBT_TARGET="${DBT_TARGET:-dev}"

if ! command -v dbt >/dev/null 2>&1; then
  echo "error: dbt not on PATH; run scripts/bootstrap_venv.sh and activate .venv" >&2
  exit 1
fi

cd "$DATA_PLATFORM_ROOT/dbt"

dbt_args=("$@")
if [[ ${#dbt_args[@]} -eq 0 ]] || [[ "${dbt_args[*]}" != *" --target "* ]]; then
  dbt_args=(--target "$DBT_TARGET" "${dbt_args[@]}")
fi

exec dbt "${dbt_args[@]}"
