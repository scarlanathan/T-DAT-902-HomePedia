#!/usr/bin/env bash
# Start PostGIS via docker compose and wait until Postgres accepts connections.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

docker compose -f "$DATA_PLATFORM_ROOT/docker-compose.yml" up -d

container="${POSTGRES_CONTAINER_NAME:-homepedia-postgres}"
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DEV_DB" >/dev/null 2>&1; then
    homepedia_ensure_test_database
    echo "Postgres is ready ($container)."
    echo "  dev database : $POSTGRES_DEV_DB"
    echo "  test database: $POSTGRES_TEST_DB"
    exit 0
  fi
  sleep 1
done
echo "error: Postgres did not become ready in time (container: $container)" >&2
exit 1
