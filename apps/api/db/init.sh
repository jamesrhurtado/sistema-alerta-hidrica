#!/usr/bin/env bash
# Postgres entrypoint hook: corre tras 01-schema.sql. Carga seeds.
set -euo pipefail

SEEDS_DIR="/docker-entrypoint-initdb.d/seeds"
if [ -d "$SEEDS_DIR" ]; then
  for f in "$SEEDS_DIR"/*.sql; do
    [ -f "$f" ] || continue
    echo "▶ seed: $f"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  done
fi
