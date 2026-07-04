#!/usr/bin/env bash
# Load La Poste postal codes into raw_code_postal (wraps ingestion/laposte/load_raw_codes_postaux.py).
#
# Usage:
#   load_codes_postaux.sh url --url 'https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw' --truncate
#   load_codes_postaux.sh file path/to.csv --truncate
#   load_codes_postaux.sh sample
#   load_codes_postaux.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_codes_postaux.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load the remote La Poste postal codes CSV (use --url or CODE_POSTAL_URL).
  file <path> [args...]    Load a local CSV; relative paths are under data_platform/.
  sample [args...]         Load tests/fixtures/codes_postaux_sample.csv with --truncate.
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/laposte/load_raw_codes_postaux.py")
SAMPLE_FILES=("$DATA_PLATFORM_ROOT/tests/fixtures/codes_postaux_sample.csv")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then echo "error: load_codes_postaux.sh file <path> [...]" >&2; exit 1; fi
  path=$1; shift
  if [[ "$path" != /* ]]; then path="$DATA_PLATFORM_ROOT/$path"; fi
  exec "${LOADER[@]}" --file "$path" "$@"
fi

if [[ "${1:-}" == "sample" ]]; then
  shift
  extra=(--truncate --encoding utf-8)
  if (($# > 0)); then extra+=("$@"); fi
  for sample in "${SAMPLE_FILES[@]}"; do
    "${LOADER[@]}" --file "$sample" "${extra[@]}"
  done
  exit 0
fi

echo "error: load_codes_postaux.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
