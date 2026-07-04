#!/usr/bin/env bash
# Submit the PySpark cleaning pipeline to the cluster.
#
# Usage:
#   spark_clean.sh                 # run every job (cog, dvf, filosofi, bpe, analyse)
#   spark_clean.sh dvf             # run a single step
#   spark_clean.sh dvf filosofi    # run a subset
#
# Reads /lake/raw/* from HDFS, writes /lake/curated/* back to HDFS.
set -euo pipefail
# Git Bash on Windows: keep /opt/homepedia and hdfs:// args intact for the container.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

MASTER_CONTAINER="${SPARK_MASTER_CONTAINER:-homepedia-spark-master}"

# Inside the container: code is mounted at /opt/homepedia, HDFS is the lake root.
docker exec \
  -e LAKE_ROOT="hdfs://namenode:9000/lake" \
  "$MASTER_CONTAINER" \
  /spark/bin/spark-submit \
    --master spark://spark-master:7077 \
    /opt/homepedia/run_all.py "$@"
