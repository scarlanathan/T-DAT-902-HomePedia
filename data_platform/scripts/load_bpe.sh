#!/usr/bin/env bash
# Load BPE (Base Permanente des Équipements) into raw_bpe_equipement.
#
# Production: one BPE zip or CSV per invocation.
#
# Usage:
#   load_bpe.sh url --url https://.../bpe_2022_ensemble_xy_csv.zip --truncate
#   load_bpe.sh file path/to/bpe.csv --truncate
#   load_bpe.sh sample [--max-rows 100]   # tests / local dev (tests/fixtures)
#   load_bpe.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_bpe.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load one remote BPE zip or CSV (use --url or BPE_CSV_URL).

  file <path> [args...]    Load a local zip or CSV; relative paths are under data_platform/.

  sample [args...]         Load tests/fixtures/bpe_sample.csv with --truncate (tests & local dev).

Examples:
  ./scripts/load_bpe.sh url --url https://example/bpe_2022_ensemble_xy_csv.zip --truncate
  ./scripts/load_bpe.sh sample
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/bpe/load_raw_bpe.py")
SAMPLE_FILES=(
  "$DATA_PLATFORM_ROOT/tests/fixtures/bpe_sample.csv"
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
    echo "error: load_bpe.sh file <path> [...]" >&2
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

echo "error: load_bpe.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
