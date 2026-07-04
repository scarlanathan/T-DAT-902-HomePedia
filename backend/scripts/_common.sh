#!/usr/bin/env bash
set -euo pipefail

# Resolve once at source time: BASH_SOURCE[0] can be relative and breaks after cd.
_BACKEND_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_BACKEND_ROOT="$(cd "${_BACKEND_SCRIPTS_DIR}/.." && pwd)"

backend_dir() {
  printf '%s\n' "${_BACKEND_ROOT}"
}

load_env_if_present() {
  local dir
  dir="$(backend_dir)"
  if [[ -f "${dir}/.env" ]]; then
    # shellcheck disable=SC2046
    export $(grep -v '^\s*#' "${dir}/.env" | grep -v '^\s*$' | xargs -0 2>/dev/null || true)
    # Fallback for shells without -0 xargs behavior on some distros
    # (re-export with normal xargs if the above exported nothing)
    if [[ -z "${PORT:-}" && -z "${POSTGRES_HOST:-}" ]]; then
      # shellcheck disable=SC2046
      export $(grep -v '^\s*#' "${dir}/.env" | grep -v '^\s*$' | xargs || true)
    fi
  fi
}

