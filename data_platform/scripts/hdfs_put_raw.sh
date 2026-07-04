#!/usr/bin/env bash
# Land raw source files into the HDFS lake (/lake/raw/<source>/).
#
# Usage:
#   hdfs_put_raw.sh                       # put the four sample fixtures (dev default)
#   hdfs_put_raw.sh dvf /path/to/dvf.csv  # put one real file into /lake/raw/dvf/
#
# HDFS is the immutable landing zone: files go in exactly as published. Spark reads
# from here; it never mutates these files.
set -euo pipefail
# Git Bash on Windows: keep /lake and /tmp container paths from becoming C:\... paths.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_common.sh"

NAMENODE="${NAMENODE_CONTAINER:-homepedia-namenode}"
FIX="$DATA_PLATFORM_ROOT/tests/fixtures"

put_one() {
  local source="$1" local_path="$2"
  if [[ ! -f "$local_path" ]]; then
    echo "error: file not found: $local_path" >&2
    exit 1
  fi
  local base
  base="$(basename "$local_path")"
  echo "  $source <- $base"
  docker exec -i "$NAMENODE" hdfs dfs -mkdir -p "/lake/raw/$source"
  # Stream the file in over stdin (-put -). Avoids `docker cp` host-path quirks on Windows.
  docker exec -i "$NAMENODE" hdfs dfs -put -f - "/lake/raw/$source/$base" < "$local_path"
}

if [[ $# -eq 2 ]]; then
  put_one "$1" "$2"
  exit 0
fi
if [[ $# -ne 0 ]]; then
  echo "usage: hdfs_put_raw.sh [<source> <local_file>]" >&2
  exit 1
fi

echo "Putting sample fixtures into HDFS /lake/raw ..."
put_one dvf      "$FIX/dvf_sample.csv"
put_one cog      "$FIX/cog_commune_sample.csv"
put_one filosofi "$FIX/filosofi_sample.csv"
put_one bpe      "$FIX/bpe_sample.csv"
echo "Done. Inspect with: docker exec $NAMENODE hdfs dfs -ls -R /lake/raw"
