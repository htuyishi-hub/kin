#!/usr/bin/env bash
set -euo pipefail

# Run all app parts concurrently (api-server, kin-web, kin Expo app)
# Usage:
#   chmod +x run-all-dev.sh
#   ./run-all-dev.sh

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but was not found in PATH" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Load local environment variables from root .env if available.
if [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# Default values for local development.
export BASE_PATH="${BASE_PATH:-/}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARNING: DATABASE_URL is not set. @workspace/api-server may fail until you provide a database connection string."
fi

pids=()

cleanup() {
  # Stop child processes on exit / Ctrl+C
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup INT TERM

start() {
  local name="$1"
  shift
  (
    echo "Starting ${name}..."
    # shellcheck disable=SC2068
    "$@"
  ) 2>&1 | sed -u "s/^/[${name}] /" &
  pids+=("$!")
}

# API server
start "api-server" env PORT="${API_SERVER_PORT:-8080}" pnpm --filter "@workspace/api-server" dev

# Web app
start "kin-web" env PORT="${KIN_WEB_PORT:-4173}" BASE_PATH="${BASE_PATH}" pnpm --filter "@workspace/kin-web" dev

# Expo app
if [ -n "${REPLIT_EXPO_DEV_DOMAIN:-}" ]; then
  export EXPO_PACKAGER_PROXY_URL="https://${REPLIT_EXPO_DEV_DOMAIN}"
fi

if [ -n "${REPLIT_DEV_DOMAIN:-}" ]; then
  export EXPO_PUBLIC_DOMAIN="${REPLIT_DEV_DOMAIN}"
  export REACT_NATIVE_PACKAGER_HOSTNAME="${REPLIT_DEV_DOMAIN}"
fi

if [ -n "${REPL_ID:-}" ]; then
  export EXPO_PUBLIC_REPL_ID="${REPL_ID}"
fi

start "kin" env PORT="${KIN_PORT:-19000}" BASE_PATH="${BASE_PATH}" pnpm --filter "@workspace/kin" dev


# Wait for any process to exit (and then exit the script)
wait -n
exit 0

