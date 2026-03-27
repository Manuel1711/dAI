/**
 * rebuild-snapshot-base.mjs
 *
 * Rebuilds agents.base.snapshot.json and agents.base.snapshot.lite.json
 * directly from the JSONL event files, using existing local caches
 * (block_times, owners, agent_metadata) — NO RPC calls required.
 *
 * Usage:
 *   node scripts/rebuild-snapshot-base.mjs
 */

import fs from 'fs';
import path from 'path';

const ROOT     = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, 'data');
const LIVE_DIR = path.join(DATA_DIR, 'live-base');

const identityJsonlPath     = path.join(LIVE_DIR, 'identity.events.jsonl');
const feedbackJsonlPath     = path.join(LIVE_DIR, 'feedback.events.jsonl');
const ownersCachePath       = path.join(LIVE_DIR, 'owners.cache.json');
const blockTimesCachePath   = path.join(LIVE_DIR, 'block_times.cache.json');
const agentMetadataCachePath = path.join(LIVE_DIR, 'agent_metadata.cache.json');
const checkpointsPath       = path.join(LIVE_DIR, 'checkpoints.json');

const readJson  = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));

function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function normalizeAgentId(v) {
  try { return '0x' + BigInt(v).toString(16).toUpperCase(); } catch { return null; }
}

function blockIsoFromCache(blockNumber, tsCache) {
  const ts = tsCache[String(blockNumber)];
  if (ts == null) return null;
  return new Date(ts * 1000).toISOString();
}

function ipfsToHttp(u) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.slice('ipfs://'.length)}`;
  return s;
}

function looksLikeJsonUrl(u) {
  if (!u) return false;
  return /\.json(\?|$)/i.test(u) || u.startsWith('ipfs://') || /^https?:\/\//i.test(u);
}

console.log('[rebuild] Reading JSONL files...');
const identityRows = readJsonl(identityJsonlPath);
const feedbackRows = readJsonl(feedbackJsonlPath);
console.log(`[rebuild] identity events: ${identityRows.length}, feedback events: ${feedbackRows.length}`);

console.log('[rebuild] Loading caches...');
const blockTsCache    = readJson(blockTimesCachePath, {});
const ownersCache     = readJson(ownersCachePath, {});
const metadataCache   = readJson(agentMetadataCachePath, {});
const checkpoints     = readJson(checkpointsPath, {});
console.log(`[rebuild] blockTsCache entries: ${Object.keys(blockTsCache).length}`);
console.log(`[rebuild] ownersCache entries: ${Object.keys(ownersCache).length}`);
console.log(`[rebuild] metadataCache entries: ${Object.keys(metadataCache).length}`);

// ---- Build byAgent map from identity events ----
const byAgent = new Map();
const seen = new Set();

for (const row of identityRows) {
  if (!row.eventKey || seen.has(`i:${row.eventKey}`)) continue;
  seen.add(`i:${row.eventKey}`);
  if (row.kind !== 'identity_registered' && row.kind !== 'identity_transfer') continue;
  const aid = normalizeAgentId(row.agentId);
  if (!aid) continue;
  const a = byAgent.get(aid) || {
    agentId: aid, name: null, owner: null,
    category: 'Unknown',
    description: 'Derived from ERC8004 registries',
    identityURI: null, createdAt: null,
    feedbackHistory: [], raters: new Set(), image: null,
  };
  if (row.kind === 'identity_registered') {
    if (row.owner) a.owner = row.owner;
    const eventCreatedAt = blockIsoFromCache(row.blockNumber, blockTsCache);
    if (!a.createdAt || (eventCreatedAt && new Date(eventCreatedAt) < new Date(a.createdAt))) {
      a.createdAt = eventCreatedAt;
    }
    if (row.agentURI) a.identityURI = row.agentURI;
  }
  if (row.kind === 'identity_transfer' && row.to) a.owner = row.to;
  byAgent.set(aid, a);
}
console.log(`[rebuild] Agents from identity events: ${byAgent.size}`);

// ---- Apply owners cache for missing owners ----
for (const a of byAgent.values()) {
  if (!a.owner && ownersCache[a.agentId]) a.owner = ownersCache[a.agentId];
}

// ---- Build revoked set ----
const revoked = new Set();
for (const row of feedbackRows) {
  if (row.kind !== 'feedback_revoked') continue;
  const aid = normalizeAgentId(row.agentId);
  if (!aid) continue;
  revoked.add(`${aid}:${(row.clientAddress || '').toLowerCase()}:${row.feedbackIndex || ''}`);
}
console.log(`[rebuild] Revoked feedback entries: ${revoked.size}`);

// ---- Process feedback_new events ----
let feedbackAdded = 0;
let feedbackSkipped = 0;
for (const row of feedbackRows) {
  if (!row.eventKey || seen.has(`f:${row.eventKey}`)) continue;
  seen.add(`f:${row.eventKey}`);
  if (row.kind !== 'feedback_new') continue;
  const aid = normalizeAgentId(row.agentId);
  if (!aid) continue;
  const revKey = `${aid}:${(row.clientAddress || '').toLowerCase()}:${row.feedbackIndex || ''}`;
  if (revoked.has(revKey)) { feedbackSkipped++; continue; }
  const n = Number(row.valueRaw);
  const scaled = Number.isFinite(n)
    ? (row.valueDecimals != null && row.valueDecimals > 0 ? n / (10 ** row.valueDecimals) : n)
    : null;
  if (scaled == null || !Number.isFinite(scaled)) continue;
  const a = byAgent.get(aid) || {
    agentId: aid, name: null, owner: null,
    category: 'Unknown',
    description: 'Derived from ERC8004 registries',
    identityURI: null, createdAt: null,
    feedbackHistory: [], raters: new Set(), image: null,
  };
  a.feedbackHistory.push({
    timestamp: blockIsoFromCache(row.blockNumber, blockTsCache),
    score: scaled,
    tag1: row.tag1 || null,
    tag2: row.tag2 || null,
    comment: 'on-chain NewFeedback',
    txHash: row.transactionHash,
    blockNumber: row.blockNumber,
  });
  if (row.clientAddress) a.raters.add(row.clientAddress.toLowerCase());
  byAgent.set(aid, a);
  feedbackAdded++;
}
console.log(`[rebuild] Feedback added: ${feedbackAdded}, skipped (revoked): ${feedbackSkipped}`);

// ---- Apply metadata cache ----
for (const a of byAgent.values()) {
  const key = a.identityURI || '';
  if (!key || !looksLikeJsonUrl(key)) continue;
  const cached = metadataCache[key];
  if (!cached) continue;
  if (!a.name && cached.name) a.name = cached.name;
  if ((!a.description || a.description === 'Derived from ERC8004 registries') && cached.description) a.description = cached.description;
  if (!a.image && cached.image) a.image = cached.image;
}

// ---- Finalize agents array ----
const agents = [...byAgent.values()].map((a) => {
  const scores = a.feedbackHistory.map((x) => x.score);
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  a.feedbackHistory.sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));
  return {
    ...a,
    name: a.name || `Agent ${a.agentId}`,
    raters: undefined,
    uniqueRaters: a.raters.size,
    scoreV1: Number(avg.toFixed(4)),
    feedbackCount: a.feedbackHistory.length,
    lastActivityAt: a.feedbackHistory[0]?.timestamp || a.createdAt || null,
  };
}).sort((a, b) => b.feedbackCount - a.feedbackCount || a.agentId.localeCompare(b.agentId));

const agentsWithFeedback = agents.filter(a => a.feedbackCount > 0).length;
console.log(`[rebuild] Total agents: ${agents.length}, with feedback: ${agentsWithFeedback}`);

// ---- Write full snapshot ----
const snapshotPath = path.join(DATA_DIR, 'agents.base.snapshot.json');
writeJson(snapshotPath, {
  network: 'base-mainnet',
  blockNumber: checkpoints.lastSafeBlock || null,
  generatedAt: new Date().toISOString(),
  scoreFormula: 'scoreV1 = arithmetic mean(feedback.score)',
  indexer: {
    chain: 'base',
    mode: 'rebuild-from-jsonl',
    rebuiltAt: new Date().toISOString(),
  },
  agents,
});
console.log(`[rebuild] Written: ${snapshotPath}`);

// ---- Write lite snapshot ----
const liteAgents = agents.map(({ feedbackHistory, blockNumber, ...rest }) => {
  const fh = feedbackHistory || [];
  const uniqueRaters = new Set(fh.map(f => f.clientAddress || f.rater)).size;
  return { ...rest, uniqueRaters, chainScope: 'base' };
});
const liteSnapshotPath = path.join(DATA_DIR, 'agents.base.snapshot.lite.json');
writeJson(liteSnapshotPath, {
  network: 'base-mainnet',
  chainId: 8453,
  blockNumber: checkpoints.lastSafeBlock || null,
  generatedAt: new Date().toISOString(),
  agentCount: liteAgents.length,
  agents: liteAgents,
});
console.log(`[rebuild] Written: ${liteSnapshotPath}`);
console.log('[rebuild] Done.');
