#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

cd "$(backend_dir)"
load_env_if_present

if [[ ! -d node_modules ]]; then
  npm install
fi

# Default: dev mode (tsc watch + node --watch dist/)
exec npm run start:dev

