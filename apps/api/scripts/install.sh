#!/usr/bin/env bash
# Instala el backend en un venv local con Python 3.12 (pyenv).
set -euo pipefail

cd "$(dirname "$0")/.."

# Asegurar que pyenv esté inicializado en esta shell
if command -v pyenv >/dev/null 2>&1; then
  eval "$(pyenv init -)"
fi

# Usar la versión declarada en .python-version del repo
PY_BIN="$(pyenv which python3.12 2>/dev/null || command -v python3.12 || command -v python3)"

if [ ! -d .venv ]; then
  echo "▶ Creando venv con $PY_BIN..."
  "$PY_BIN" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "▶ Actualizando pip + instalando dependencias..."
pip install --upgrade pip wheel setuptools
pip install -e ".[dev]"

if [ ! -f .env ]; then
  echo "▶ Copiando .env.example → .env"
  cp .env.example .env
fi

echo "✔ API lista. Activá el venv con: source apps/api/.venv/bin/activate"
echo "  o usá: pnpm api:dev"
