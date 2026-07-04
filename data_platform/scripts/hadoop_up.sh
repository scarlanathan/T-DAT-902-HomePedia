#!/usr/bin/env bash
# Start the HDFS + Spark cluster and create the lake directory layout in HDFS.
set -euo pipefail
# Git Bash on Windows rewrites leading-slash args (e.g. /lake) into C:\... paths
# before they reach the container. Disable that conversion for our docker exec calls.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

COMPOSE=("docker" "compose" "-f" "$DATA_PLATFORM_ROOT/spark/docker-compose.yml")
NAMENODE="${NAMENODE_CONTAINER:-homepedia-namenode}"

"${COMPOSE[@]}" up -d

echo "Waiting for HDFS namenode to leave safe mode..."
for _ in $(seq 1 60); do
  if docker exec "$NAMENODE" hdfs dfsadmin -safemode get 2>/dev/null | grep -q "OFF"; then
    break
  fi
  sleep 2
done

echo "Creating /lake structure in HDFS..."
docker exec "$NAMENODE" hdfs dfs -mkdir -p \
  /lake/raw/dvf /lake/raw/cog /lake/raw/filosofi /lake/raw/bpe /lake/curated

echo "Cluster is up:"
echo "  HDFS UI         http://localhost:9870"
echo "  Spark master UI http://localhost:8080"
echo "Next: ./scripts/hdfs_put_raw.sh   then   ./scripts/spark_clean.sh"
