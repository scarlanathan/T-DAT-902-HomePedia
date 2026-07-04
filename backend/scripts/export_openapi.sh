#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

cd "$(backend_dir)"
load_env_if_present

if [[ ! -d node_modules ]]; then
  npm install
fi

exec npm run openapi:export

