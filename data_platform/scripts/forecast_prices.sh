#!/usr/bin/env bash
# Train the price forecast on app_price_history (dbt mart) and write app_price_forecast*.
# Run after dbt (scripts/dbt.sh run). Requires a multi-year DVF history
# (scripts/load_dvf_history.sh).
#
# Usage:
#   forecast_prices.sh [--horizon 8]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_require_venv_python

exec python3 "$DATA_PLATFORM_ROOT/forecast/forecast_prices.py" "$@"
