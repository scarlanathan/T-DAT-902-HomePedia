#!/usr/bin/env bash
# Load DGFiP taxe foncière into raw_taxe_fonciere (wraps ingestion/fiscalite/load_raw_taxe_fonciere.py).
#
# Usage:
#   load_taxe_fonciere.sh url --url 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fiscalite-locale-des-particuliers/exports/csv?select=insee_com,com,libcom,dep,exercice,e12vote,taux_global_tfb&use_labels=false&delimiter=;' --truncate
#   load_taxe_fonciere.sh file path/to.csv --truncate
#   load_taxe_fonciere.sh sample
#   load_taxe_fonciere.sh --help
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

usage() {
  cat <<'EOF'
Usage: load_taxe_fonciere.sh --help | url <loader-args...> | file <path> [loader-args...] | sample [loader-args...]

  url [args...]            Load a remote DGFiP fiscalité CSV export (use --url or TAXE_FONCIERE_URL).
  file <path> [args...]    Load a local CSV; relative paths are under data_platform/.
  sample [args...]         Load tests/fixtures/taxe_fonciere_sample.csv with --truncate.
EOF
}

homepedia_require_venv_python

LOADER=(python3 "$DATA_PLATFORM_ROOT/ingestion/fiscalite/load_raw_taxe_fonciere.py")
SAMPLE_FILES=("$DATA_PLATFORM_ROOT/tests/fixtures/taxe_fonciere_sample.csv")

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then usage; exit 0; fi

if [[ "${1:-}" == "url" ]]; then
  shift
  exec "${LOADER[@]}" "$@"
fi

if [[ "${1:-}" == "file" ]]; then
  shift
  if [[ $# -lt 1 ]]; then echo "error: load_taxe_fonciere.sh file <path> [...]" >&2; exit 1; fi
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

echo "error: load_taxe_fonciere.sh requires a subcommand: url, file, or sample" >&2
usage >&2
exit 1
