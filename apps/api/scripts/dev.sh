#!/usr/bin/env bash
# Levanta el servidor FastAPI con autoreload.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  echo "✖ No existe .venv. Corre: pnpm api:install"
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

# Cargar .env si existe
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

HOST="${API_HOST:-0.0.0.0}"
PORT="${API_PORT:-8000}"

exec uvicorn ahora.main:app --reload --host "$HOST" --port "$PORT"
