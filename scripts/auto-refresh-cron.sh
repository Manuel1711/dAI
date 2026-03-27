#!/usr/bin/env bash
set -euo pipefail

REPO="/home/manuel/.openclaw/workspace/workspaces/ai-agent-specialist/working/erc8004-dapp-mvp"
LOCK_FILE="/tmp/dai-auto-refresh.lock"
LOG_FILE="$REPO/data/live/auto-refresh.log"

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

# Ensure modern Node in cron environment
export NVM_DIR="/home/manuel/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] node=$(node -v 2>/dev/null || echo missing)"

git fetch origin main || true

# --- RPC config ---
export ETH_RPC_URL="${ETH_RPC_URL:-https://mainnet.infura.io/v3/9d56d557b8ff4247a4928c5b368de038}"
export BASE_RPC_URL="${BASE_RPC_URL:-https://base-mainnet.infura.io/v3/9d56d557b8ff4247a4928c5b368de038}"
# Conservative settings: small chunks, never full reindex
export CONFIRMATIONS="${CONFIRMATIONS:-12}"
export BLOCK_CHUNK="${BLOCK_CHUNK:-500}"
export MAX_CHUNKS_PER_TICK="${MAX_CHUNKS_PER_TICK:-20}"
export FULL_REINDEX_ONCE=0   # IMPORTANT: incremental only, never restart from block 0

# Incremental indexing — Ethereum + Base in parallelo
node scripts/indexer-loop.mjs --chain ethereum --once &
node scripts/indexer-loop.mjs --chain base     --once &
wait

# Analytics + tag (Ethereum-based, non-critical)
python3 scripts/build-analytics-data.py          || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] analytics warn"
python3 scripts/build-tag-analytics-from-tag-source.py || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] tag-analytics warn"

# Metadata cache (capped fetches, non-blocking)
node scripts/build-metadata-cache.mjs      || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] metadata-cache eth warn"
node scripts/build-metadata-cache-base.mjs || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] metadata-cache base warn"

# Lite snapshot Ethereum
python3 scripts/build-snapshot-lite.py || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] snapshot-lite warn"

# Rebuild BASE snapshot from JSONL (deduped, compact — avoids GitHub 100MB limit)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] rebuilding base snapshot..."
node scripts/rebuild-snapshot-base.mjs || echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] rebuild-base warn"

# Commit/push only if changed
CHANGED_FILES=(
  data/agents.snapshot.json data/agents.snapshot.lite.json data/agents.snapshot.meta.json
  data/agents.base.snapshot.json data/agents.base.snapshot.lite.json
)
LIVE_GLOBS=(
  "data/live/*.json" "data/live/*.jsonl"
  "data/live-base/*.json" "data/live-base/*.jsonl"
  "data/analytics/*.json"
  "data/metadata-cache.json" "data/metadata-cache.base.json"
)

if ! git diff --quiet -- "${CHANGED_FILES[@]}"; then
  git add "${CHANGED_FILES[@]}" ${LIVE_GLOBS[@]} || true
  if ! git diff --staged --quiet; then
    git commit -m "chore: incremental refresh eth+base"
    git pull --rebase --autostash origin main
    git push origin main
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pushed"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] no staged changes"
  fi
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] no data changes"
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] auto-refresh end"
