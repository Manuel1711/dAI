# ERC8004 Agents dApp (Live + Fancy)

GitHub Pages dApp that shows ERC8004 agents and keeps dataset refreshed from Ethereum logs.

## What changed
- Fancy UI (hero, status chip, top agents, search/sort, pipeline page)
- Incremental indexer with checkpoint persistence
- One-shot mode for CI refresh (`--once`)
- Scheduled GitHub Action to refresh live data every 15 minutes

## Core files
- `assets/app.js` → frontend logic (home, agents, detail, pipeline)
- `assets/styles.css` → enhanced visual style
- `pipeline.html` → indexer health/checkpoint page
- `scripts/indexer-loop.mjs` → incremental ETH log indexer
- `scripts/run-indexer.sh` → run continuous or one-shot mode
- `data/agents.snapshot.json` → materialized view consumed by UI
- `data/live/checkpoints.json` → incremental state

## Why only 3 agents before?
Because old dataset was built from mock snapshot examples. 
Now the indexer can backfill from chain (set `START_BLOCK`) and keep updating from checkpoints.

## Local run
```bash
cd /home/manuel/.openclaw/workspace/workspaces/ai-agent-specialist/working/erc8004-dapp-mvp
cp .env.example .env
# set ETH_RPC_URL (recommended: your own provider key)
./scripts/run-indexer.sh --once      # one ingestion pass
./scripts/run-indexer.sh             # continuous mode
python3 -m http.server 5173
```

## Environment variables
- `ETH_RPC_URL` (required)
- `IDENTITY_REGISTRY`
- `FEEDBACK_REGISTRY`
- `POLL_MS`
- `CONFIRMATIONS`
- `BLOCK_CHUNK`
- `MAX_CHUNKS_PER_TICK`
- `START_BLOCK` (important for initial backfill depth)

## Make GitHub Pages truly "live"
Use workflow: `.github/workflows/live-indexer.yml`

### Required repo settings
1. **Secrets and variables → Actions → New repository secret**
   - `ETH_RPC_URL` = your RPC endpoint
2. **Repository variables** (optional but recommended)
   - `START_BLOCK` (e.g. `21000000`)
   - `BLOCK_CHUNK` (`2000`)
   - `MAX_CHUNKS_PER_TICK` (`50`)
   - `CONFIRMATIONS` (`5`)

Then the workflow runs every 15 minutes, updates `data/agents.snapshot.json`, commits, and Pages redeploys.

## Data flow
1. Read latest block via `eth_blockNumber`
2. Compute `safeBlock = latest - confirmations`
3. Read from checkpoint `identityFromBlock/feedbackFromBlock`
4. Fetch logs in chunks from both registries
5. Append normalized events to JSONL
6. Rebuild `agents.snapshot.json`
7. Update checkpoint for next run

## Limitations (next hardening)
- ABI strict decoding + topic allowlist
- Reorg rollback strategy beyond confirmation window
- More deterministic identity metadata enrichment
