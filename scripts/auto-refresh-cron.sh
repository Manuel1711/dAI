#!/usr/bin/env bash
set -euo pipefail

REPO="/home/manuel/.openclaw/workspace/workspaces/ai-agent-specialist/working/erc8004-dapp-mvp"
LOCK_FILE="/tmp/dai-auto-refresh.lock"
LOG_FILE="/home/manuel/.openclaw/workspace/workspaces/ai-agent-specialist/working/erc8004-dapp-mvp/data/live/auto-refresh.log"

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] auto-refresh start"

# Prevent overlap
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] skip: lock busy"
  exit 0
fi

cd "$REPO"

# Refresh remote refs (do not rebase upfront; local unstaged changes may exist)
git fetch origin main || true

export ETH_RPC_URL="${ETH_RPC_URL:-https://ethereum-rpc.publicnode.com}"
export CONFIRMATIONS="${CONFIRMATIONS:-12}"
export BLOCK_CHUNK="${BLOCK_CHUNK:-1000}"
export MAX_CHUNKS_PER_TICK="${MAX_CHUNKS_PER_TICK:-50}"
export START_BLOCK="${START_BLOCK:-0}"

# Refresh live data + analytics
node scripts/indexer-loop.mjs --once
python3 scripts/build-analytics-data.py

# Commit/push only if changed
if ! git diff --quiet -- data/agents.snapshot.json data/live data/analytics; then
  git add data/agents.snapshot.json data/live/*.json data/live/*.jsonl data/analytics/*.json || true
  if ! git diff --staged --quiet; then
    git commit -m "chore: auto refresh live index + analytics snapshot"
    git pull --rebase --autostash origin main
    git push origin main
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pushed refresh"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] no staged changes"
  fi
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] no data changes"
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] auto-refresh end"