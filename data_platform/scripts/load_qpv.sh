#!/usr/bin/env bash
# Load ANCT QPV list into raw_qpv (wraps ingestion/qpv/load_raw_qpv.py).
#
# Usage:
#   load_qpv.sh url --url 'https://static.data.gouv.fr/.../listeqp2024-cog2024.csv' --truncate
#   load_qpv.sh file path/to.csv --truncate
#   load_qpv.sh sample
#   load_qpv.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_qpv.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load the remote QPV list CSV (use --url or QPV_URL).
  file <path> [args...]    Load a local CSV; relative paths are under data_platform/.
  sample [args...]         Load tests/fixtures/qpv_sample.csv with --truncate.
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/qpv/load_raw_qpv.py")
SAMPLE_FILES=("$DATA_PLATFORM_ROOT/tests/fixtures/qpv_sample.csv")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then echo "error: load_qpv.sh file <path> [...]" >&2; exit 1; fi
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

echo "error: load_qpv.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
