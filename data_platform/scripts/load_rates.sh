#!/usr/bin/env bash
# Load monthly bank interest rates into raw_interest_rate (wraps ingestion/rates/load_raw_rates.py).
#
# Default series (ECB SDW / MIR): France housing loans to households, new business.
#
# Usage:
#   load_rates.sh url --url 'https://data-api.ecb.europa.eu/service/data/MIR/M.FR.B.A2C.A.R.A.2250.EUR.N?format=csvdata&detail=dataonly' --truncate
#   load_rates.sh file path/to.csv --truncate
#   load_rates.sh sample
#   load_rates.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_rates.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load a remote ECB SDW csvdata export (use --url or RATES_CSV_URL).
  file <path> [args...]    Load a local CSV; relative paths are under data_platform/.
  sample [args...]         Load tests/fixtures/rates_sample.csv with --truncate.
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/rates/load_raw_rates.py")
SAMPLE_FILES=("$DATA_PLATFORM_ROOT/tests/fixtures/rates_sample.csv")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then echo "error: load_rates.sh file <path> [...]" >&2; exit 1; fi
  path=$1; shift
  if [[ "$path" != /* ]]; then path="$DATA_PLATFORM_ROOT/$path"; fi
  exec "${LOADER[@]}" --file "$path" "$@"
fi

if [[ "${1:-}" == "sample" ]]; then
  shift
  extra=(--truncate)
  if (($# > 0)); then extra+=("$@"); fi
  for sample in "${SAMPLE_FILES[@]}"; do
    "${LOADER[@]}" --file "$sample" "${extra[@]}"
  done
  exit 0
fi

echo "error: load_rates.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
