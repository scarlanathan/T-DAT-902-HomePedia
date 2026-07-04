#!/usr/bin/env bash
# Load SSMSI communal delinquency into raw_delinquance (wraps ingestion/securite/load_raw_delinquance.py).
#
# Usage:
#   load_delinquance.sh url --url 'https://static.data.gouv.fr/.../donnee-....csv.gz' --truncate
#   load_delinquance.sh file path/to.csv.gz --truncate
#   load_delinquance.sh sample
#   load_delinquance.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_delinquance.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load the remote SSMSI communal CSV.gz (use --url or DELINQUANCE_URL).
  file <path> [args...]    Load a local CSV/CSV.gz; relative paths are under data_platform/.
  sample [args...]         Load tests/fixtures/delinquance_sample.csv with --truncate.
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/securite/load_raw_delinquance.py")
SAMPLE_FILES=("$DATA_PLATFORM_ROOT/tests/fixtures/delinquance_sample.csv")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then echo "error: load_delinquance.sh file <path> [...]" >&2; exit 1; fi
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

echo "error: load_delinquance.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
