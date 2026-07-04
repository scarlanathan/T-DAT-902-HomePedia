#!/usr/bin/env bash
# Load INSEE COG into raw_insee_cog_* (wraps ingestion/insee/load_raw_cog.py).
# The Python loader auto-detects commune / département / région from the CSV header.
#
# Production: one INSEE file per invocation (commune, département, or région).
#
# Usage:
#   load_cog.sh url --url https://.../v_commune_2024.csv --truncate
#   load_cog.sh url --url https://.../v_departement_2024.csv --truncate
#   load_cog.sh url --url https://.../v_region_2024.csv --truncate
#   load_cog.sh file path/to/v_commune_2024.csv --truncate
#   load_cog.sh sample [--max-rows 100]   # tests / local dev (tests/fixtures)
#   load_cog.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_cog.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load one remote INSEE COG CSV (use --url or COG_CSV_URL).
                           Run once per level: v_commune_*, v_departement_*, v_region_*.

  file <path> [args...]    Load one local CSV; relative paths are under data_platform/.

  sample [args...]         Load tests/fixtures/cog_*_sample.csv with --truncate (tests & local dev).

Examples:
  ./scripts/load_cog.sh url --url https://www.insee.fr/fr/statistiques/fichier/7766585/v_commune_2024.csv --truncate
  ./scripts/load_cog.sh sample
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/insee/load_raw_cog.py")
SAMPLE_FILES=(
  "$DATA_PLATFORM_ROOT/tests/fixtures/cog_commune_sample.csv"
  "$DATA_PLATFORM_ROOT/tests/fixtures/cog_departement_sample.csv"
  "$DATA_PLATFORM_ROOT/tests/fixtures/cog_region_sample.csv"
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
    echo "error: load_cog.sh file <path> [...]" >&2
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

echo "error: load_cog.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
