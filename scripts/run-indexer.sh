#!/usr/bin/env bash
# run-indexer.sh — avvia indexer per una o più chain
# Usage:
#   bash scripts/run-indexer.sh                  # entrambe le chain (eth + base) in parallelo
#   bash scripts/run-indexer.sh --chain ethereum  # solo Ethereum
#   bash scripts/run-indexer.sh --chain base      # solo Base
#   bash scripts/run-indexer.sh --once            # one-shot entrambe
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load env files if present
[[ -f "$ROOT/.env" ]]      && { set -a; source "$ROOT/.env";      set +a; }
[[ -f "$ROOT/.env.base" ]] && { set -a; source "$ROOT/.env.base"; set +a; }

CHAIN="${CHAIN:-all}"
ONCE=""
for arg in "$@"; do
  case "$arg" in
    --chain) ;;
    ethereum|base|all) CHAIN="$arg" ;;
    --once) ONCE="--once" ;;
    *) [[ "${PREV:-}" == "--chain" ]] && CHAIN="$arg" ;;
  esac
  PREV="$arg"
done

run_chain() {
  local chain="$1"
  shift
  node "$ROOT/scripts/indexer-loop.mjs" --chain "$chain" $@
}

if [[ "$CHAIN" == "all" ]]; then
  if [[ -n "$ONCE" ]]; then
    echo "[indexer] Running one-shot for ethereum + base"
    run_chain ethereum --once &
    run_chain base     --once &
    wait
  else
    echo "[indexer] Starting continuous indexer: ethereum + base"
    run_chain ethereum &
    run_chain base     &
    wait
  fi
elif [[ "$CHAIN" == "ethereum" || "$CHAIN" == "base" ]]; then
  run_chain "$CHAIN" $ONCE
else
  echo "Unknown chain: $CHAIN. Use ethereum, base, or all." >&2
  exit 1
fi
