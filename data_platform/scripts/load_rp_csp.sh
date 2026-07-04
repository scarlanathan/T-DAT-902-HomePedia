#!/usr/bin/env bash
# Load INSEE RP active population by CSP into raw_rp_csp (wraps ingestion/rp/load_raw_rp_csp.py).
#
# Usage:
#   load_rp_csp.sh url --url 'https://www.insee.fr/.../base-ic-activite-residents-2021_csv.zip' --truncate
#   load_rp_csp.sh file path/to.zip --truncate
#   load_rp_csp.sh sample
#   load_rp_csp.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_rp_csp.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load the remote INSEE RP activité ZIP/CSV (use --url or RP_CSP_URL).
  file <path> [args...]    Load a local ZIP/CSV; relative paths are under data_platform/.
  sample [args...]         Load tests/fixtures/rp_csp_sample.csv with --truncate.
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/rp/load_raw_rp_csp.py")
SAMPLE_FILES=("$DATA_PLATFORM_ROOT/tests/fixtures/rp_csp_sample.csv")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then echo "error: load_rp_csp.sh file <path> [...]" >&2; exit 1; fi
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

echo "error: load_rp_csp.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
