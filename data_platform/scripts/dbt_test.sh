#!/usr/bin/env bash
# Run dbt test against the isolated test database (homepedia_test).
# Passes through extra args, e.g. --select test_name.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"
homepedia_ensure_test_database
homepedia_use_test_db
exec "$SCRIPT_DIR/dbt.sh" test "$@"
