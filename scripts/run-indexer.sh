#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

if [[ "${1:-}" == "--once" ]]; then
  node "$ROOT/scripts/indexer-loop.mjs" --once
else
  node "$ROOT/scripts/indexer-loop.mjs"
fi
