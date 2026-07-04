#!/usr/bin/env bash
# Stop the HDFS + Spark cluster. Pass --wipe to also drop the HDFS volumes (lake data).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

COMPOSE=("docker" "compose" "-f" "$DATA_PLATFORM_ROOT/spark/docker-compose.yml")

if [[ "${1:-}" == "--wipe" ]]; then
  "${COMPOSE[@]}" down -v
  echo "Cluster stopped and HDFS volumes removed."
else
  "${COMPOSE[@]}" down
  echo "Cluster stopped (HDFS volumes kept; use --wipe to remove)."
fi
