#!/usr/bin/env bash
# Stop and remove containers from data_platform/docker-compose.yml.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

docker compose -f "$DATA_PLATFORM_ROOT/docker-compose.yml" down "$@"
