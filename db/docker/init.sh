#!/bin/bash
# Runs on first container start. Loads schema then seed, in filename order.
set -euo pipefail

echo "=== Loading schema ==="
for f in /sql/schema/*.sql; do
    echo "-> $f"
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done

echo "=== Loading seed ==="
for f in /sql/seed/*.sql; do
    echo "-> $f"
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done

echo "=== Done ==="
