#!/usr/bin/env bash
# Load FiLoSoFi (Filosofi) into raw_filosofi (commune and IRIS levels).
#
# Two INSEE formats are supported (see ingestion/filosofi/load_raw_filosofi.py):
#   wide  - Filosofi 1 (MED21, TP6021, …)  use url-wide / file + --format wide
#   v2    - Filosofi 2 (FILOSOFI_MEASURE, …) use url-v2 / file + --format v2
#   url   - auto-detect format from CSV header
#
# Truncate removes only the (millesime, kind) being loaded, so multiple loads
# keep history in raw_filosofi.
#
# Usage:
#   load_filosofi.sh url-v2 --url https://.../FILOSOFI_CC_csv.zip --truncate
#   load_filosofi.sh url-wide --url https://.../BASE_TD_FILO_IRIS_2021_DISP_CSV.zip --truncate
#   load_filosofi.sh sample
#   load_filosofi.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_filosofi.sh --help | url <loader-args...> | url-wide <loader-args...>
       | url-v2 <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]        Auto-detect wide vs v2 from CSV header.

  url-wide [args...]   Force Filosofi 1 wide format (cc_filosofi_*, IRIS DISP zips).

  url-v2 [args...]     Force Filosofi 2 tidy format (FILOSOFI_CC_csv.zip).

  file <path> [args...]
                       Local zip/CSV; pass --format wide|v2|auto if needed.

  sample [args...]     Load tests/fixtures (wide commune + IRIS samples).

Examples:
  ./scripts/load_filosofi.sh url-v2 --url 'https://…/FILOSOFI_CC_csv.zip' --truncate
  ./scripts/load_filosofi.sh url-wide --url 'https://…/BASE_TD_FILO_IRIS_2021_DISP_CSV.zip' --truncate
  ./scripts/load_filosofi.sh sample
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/filosofi/load_raw_filosofi.py")
SAMPLE_FILES=(
  "$DATA_PLATFORM_ROOT/tests/fixtures/filosofi_sample.csv"
  "$DATA_PLATFORM_ROOT/tests/fixtures/filosofi_iris_sample.csv"
)

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" --format auto "$@"
fi

if [[ "${1:-}" == "url-wide" ]]; then
  shift
  exec "${LOADER[@]}" --format wide "$@"
fi

if [[ "${1:-}" == "url-v2" ]]; then
  shift
  exec "${LOADER[@]}" --format v2 "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then
    echo "error: load_filosofi.sh file <path> [...]" >&2
    exit 1
  fi
  path=$1
  shift
  if [[ "$path" != /* ]]; then
    path="$DATA_PLATFORM_ROOT/$path"
  fi
  exec "${LOADER[@]}" --file "$path" "$@"
fi

if [[ "${1:-}" == "sample" ]]; then
  shift
  extra=(--truncate)
  if (($# > 0)); then
    extra+=("$@")
  fi
  for sample in "${SAMPLE_FILES[@]}"; do
    "${LOADER[@]}" --file "$sample" --format wide "${extra[@]}"
  done
  exit 0
fi

echo "error: load_filosofi.sh requires a subcommand: url, url-wide, url-v2, file, or sample" >&2
usage >&2
exit 1
