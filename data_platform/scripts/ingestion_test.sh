#!/usr/bin/env bash
# Run ingestion unit + integration tests (requires Postgres for integration tests).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_require_venv_python
homepedia_ensure_test_database
homepedia_use_test_db
export TEST_DATABASE_URL

if ! python3 -c "import pytest" 2>/dev/null; then
  pip install -q -r "$DATA_PLATFORM_ROOT/requirements-dev.txt"
fi

exec python3 -m pytest "$DATA_PLATFORM_ROOT/tests" "$@"
