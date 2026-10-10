#!/usr/bin/env bash
# Load several geo-DVF yearly national files into raw_dvf_transaction (needed by the
# price forecast, which requires a multi-year history). The first year truncates.
#
# Usage:
#   load_dvf_history.sh                 # DVF_YEARS default: 2021 2022 2023 2024 2025
#   DVF_YEARS="2024 2025" load_dvf_history.sh
#   DVF_MAX_ROWS=50000 load_dvf_history.sh   # trial run
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_use_dev_db

: "${DVF_YEARS:=2021 2022 2023 2024 2025}"
: "${DVF_BASE_URL:=https://files.data.gouv.fr/geo-dvf/latest/csv}"

extra=()
if [[ -n "${DVF_MAX_ROWS:-}" ]]; then
  extra=(--max-rows "$DVF_MAX_ROWS")
fi

first=1
for year in $DVF_YEARS; do
  url="$DVF_BASE_URL/$year/full.csv.gz"
  echo "==> DVF $year: $url"
  if [[ $first -eq 1 ]]; then
    "$SCRIPT_DIR/load_dvf.sh" url --url "$url" --truncate "${extra[@]}"
    first=0
  else
    "$SCRIPT_DIR/load_dvf.sh" url --url "$url" "${extra[@]}"
  fi
done
echo "done: DVF years loaded: $DVF_YEARS"
