#!/usr/bin/env python3
"""
Build Base snapshot files from ERC8004-Specialist raw CSV data.
Outputs:
  data/identity_registry.base.snapshot.json
  data/feedback_registry.base.snapshot.json

Run from erc8004-dapp-mvp/ root:
  python3 scripts/build-snapshot-base.py
"""
import io, csv, json, base64, re, sys
from pathlib import Path
from datetime import datetime, timezone

# --- Paths ---
RAW_BASE = Path("/home/manuel/.openclaw/workspace/workspaces/erc8004-specialist/working/data/raw/2026-03-17_base/base_8453")
OUT_DIR  = Path(__file__).parent.parent / "data"

IDENTITY_REGISTERED   = RAW_BASE / "identity_registered.csv"
REPUTATION_NEWFEEDBACK = RAW_BASE / "reputation_newfeedback.csv"

NETWORK    = "base-mainnet"
CHAIN_ID   = 8453
CONTRACT   = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"

# --- Helpers ---
def read_csv_nullsafe(path: Path) -> list[dict]:
    raw = path.read_bytes().replace(b"\x00", b"")
    return list(csv.DictReader(io.StringIO(raw.decode("utf-8", "replace"))))

def decode_agent_uri(uri: str) -> dict:
    if not uri:
        return {}
    try:
        # data:application/json;base64,...
        m = re.match(r"data:[^;]*(?:;[^,]*)?,(.+)$", uri, re.DOTALL | re.IGNORECASE)
        if m:
            payload = base64.b64decode(m.group(1) + "==")
            return json.loads(payload.decode("utf-8", "replace"))
    except Exception:
        pass
    # plain https URL → return minimal card with just the URI
    if uri.startswith("http"):
        return {"identityURI": uri}
    return {}

def blocknum_to_approx_ts(block: int) -> str:
    # Base ~2s block time; genesis block 0 ≈ 2023-07-13T00:00:00Z (approx)
    BASE_GENESIS_TS = 1689206400  # 2023-07-13
    BASE_GENESIS_BLOCK = 0
    BLOCK_TIME = 2.0
    ts = BASE_GENESIS_TS + (block - BASE_GENESIS_BLOCK) * BLOCK_TIME
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# --- Build identity snapshot ---
def build_identity_snapshot():
    rows = read_csv_nullsafe(IDENTITY_REGISTERED)
    print(f"  identity_registered: {len(rows)} rows")

    # dedup: keep last Registered per agentId
    seen = {}
    for r in rows:
        aid = r.get("agentId", "").strip()
        if aid:
            seen[aid] = r

    agents = []
    for aid, r in seen.items():
        card = decode_agent_uri(r.get("agentURI", ""))
        block = int(r.get("blockNumber", 0) or 0)
        agents.append({
            "agentId": aid,
            "name":        card.get("name") or None,
            "owner":       r.get("owner", ""),
            "category":    _first_domain(card),
            "description": card.get("description") or None,
            "image":       card.get("image") or None,
            "identityURI": r.get("agentURI", ""),
            "createdAt":   blocknum_to_approx_ts(block),
            "blockNumber": block,
        })

    # sort by blockNumber
    agents.sort(key=lambda a: a["blockNumber"])

    out = {
        "network":     NETWORK,
        "chainId":     CHAIN_ID,
        "contract":    CONTRACT,
        "blockNumber": agents[-1]["blockNumber"] if agents else 0,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "agents":      agents,
    }
    p = OUT_DIR / "identity_registry.base.snapshot.json"
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"  → {p} ({len(agents)} agents)")
    return out

def _first_domain(card: dict) -> str | None:
    """Extract first domain label from services[].domains or card.domains."""
    services = card.get("services") or []
    for svc in services:
        if isinstance(svc, dict):
            domains = svc.get("domains") or []
            if domains:
                raw = domains[0]
                return raw.split("/")[-1].replace("_", " ").title() if raw else None
    return None

# --- Build feedback snapshot ---
def build_feedback_snapshot():
    rows = read_csv_nullsafe(REPUTATION_NEWFEEDBACK)
    print(f"  reputation_newfeedback: {len(rows)} rows")

    feedback = []
    max_block = 0
    for r in rows:
        block = int(r.get("blockNumber", 0) or 0)
        max_block = max(max_block, block)
        raw_value = r.get("value", "0") or "0"
        decimals  = int(r.get("valueDecimals", "0") or 0)
        try:
            score = int(raw_value) / (10 ** decimals) if decimals else int(raw_value)
        except Exception:
            score = 0

        feedback.append({
            "agentId":       r.get("agentId", "").strip(),
            "rater":         r.get("clientAddress", ""),
            "score":         score,
            "tag1":          r.get("tag1", "") or "",
            "tag2":          r.get("tag2", "") or "",
            "feedbackIndex": r.get("feedbackIndex", ""),
            "txHash":        r.get("transactionHash", ""),
            "blockNumber":   block,
            "timestamp":     blocknum_to_approx_ts(block),
        })

    out = {
        "network":     NETWORK,
        "chainId":     CHAIN_ID,
        "blockNumber": max_block,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "feedback":    feedback,
    }
    p = OUT_DIR / "feedback_registry.base.snapshot.json"
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"  → {p} ({len(feedback)} feedback)")
    return out

if __name__ == "__main__":
    print("[build-snapshot-base] Building identity snapshot...")
    identity = build_identity_snapshot()
    print("[build-snapshot-base] Building feedback snapshot...")
    feedback = build_feedback_snapshot()
    print("[build-snapshot-base] Done.")
