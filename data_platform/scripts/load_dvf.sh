#!/usr/bin/env bash
# Load geo-DVF into raw_dvf_transaction (wraps ingestion/dvf/load_raw_dvf.py).
#
# Production: one DVF file per invocation (national geo-DVF CSV or CSV.gz).
#
# Usage:
#   load_dvf.sh url --url https://.../dvf.csv.gz --truncate
#   load_dvf.sh file path/to.csv --truncate
#   load_dvf.sh sample [--max-rows 100]   # tests / local dev (tests/fixtures)
#   load_dvf.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_dvf.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load one remote geo-DVF CSV or CSV.gz (use --url or DVF_CSV_URL).

  file <path> [args...]    Load a local CSV or CSV.gz; relative paths are under data_platform/.

  sample [args...]         Load tests/fixtures/dvf_sample.csv with --truncate (tests & local dev).

Examples:
  ./scripts/load_dvf.sh url --url https://example/dvf.csv.gz --truncate --max-rows 10000
  ./scripts/load_dvf.sh file tests/fixtures/dvf_sample.csv --truncate
  ./scripts/load_dvf.sh sample
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/dvf/load_raw_dvf.py")
SAMPLE_FILES=(
  "$DATA_PLATFORM_ROOT/tests/fixtures/dvf_sample.csv"
)

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then
    echo "error: load_dvf.sh file <path> [...]" >&2
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
    "${LOADER[@]}" --file "$sample" "${extra[@]}"
  done
  exit 0
fi

echo "error: load_dvf.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
