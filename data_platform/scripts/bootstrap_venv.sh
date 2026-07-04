#!/usr/bin/env bash
# Create .venv and install ingestion + dbt dependencies.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

if [[ ! -d "$DATA_PLATFORM_ROOT/.venv" ]]; then
  python3 -m venv "$DATA_PLATFORM_ROOT/.venv"
fi
homepedia_activate_venv
pip install -U pip
pip install -r "$DATA_PLATFORM_ROOT/requirements.txt"
pip install -r "$DATA_PLATFORM_ROOT/requirements-dev.txt"
pip install -r "$DATA_PLATFORM_ROOT/requirements-dbt.txt"
echo "venv ready at $DATA_PLATFORM_ROOT/.venv"
