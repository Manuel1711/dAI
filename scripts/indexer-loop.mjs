import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, 'data');
const LIVE_DIR = path.join(DATA_DIR, 'live');

const CFG = {
  rpcUrl: process.env.ETH_RPC_URL || '',
  pollMs: Number(process.env.POLL_MS || 60000),
  confirmations: Number(process.env.CONFIRMATIONS || 5),
  chunkSize: Number(process.env.BLOCK_CHUNK || 2000),
  maxChunksPerTick: Number(process.env.MAX_CHUNKS_PER_TICK || 50),
  startBlock: Number(process.env.START_BLOCK || 0),
  identityRegistry: (process.env.IDENTITY_REGISTRY || '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432').toLowerCase(),
  feedbackRegistry: (process.env.FEEDBACK_REGISTRY || '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63').toLowerCase(),
};

if (!CFG.rpcUrl) {
  console.error('Missing ETH_RPC_URL env');
  process.exit(1);
}

const ONCE = process.argv.includes('--once');
fs.mkdirSync(LIVE_DIR, { recursive: true });

const checkpointsPath = path.join(LIVE_DIR, 'checkpoints.json');
const identityJsonlPath = path.join(LIVE_DIR, 'identity.events.jsonl');
const feedbackJsonlPath = path.join(LIVE_DIR, 'feedback.events.jsonl');

const readJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));
const appendJsonl = (p, rows) => rows.length && fs.appendFileSync(p, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const hexToInt = (hex) => parseInt(hex, 16);
const toHex = (n) => '0x' + n.toString(16);
const safeAddr = (topic) => topic && topic !== '0x' ? '0x' + topic.slice(-40).toLowerCase() : null;
const safeUint = (v) => { try { return BigInt(v).toString(); } catch { return null; } };

async function rpc(method, params) {
  const r = await fetch(CFG.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

function parseIdentityLog(log) {
  const t = log.topics || [];
  return {
    kind: 'identity',
    blockNumber: hexToInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: hexToInt(log.logIndex),
    eventKey: `${log.transactionHash}:${hexToInt(log.logIndex)}`,
    topic0: t[0] || null,
    agentId: safeUint(t[1]),
    owner: safeAddr(t[2]),
    rawData: log.data,
    ingestedAt: new Date().toISOString()
  };
}

function parseFeedbackLog(log) {
  const t = log.topics || [];
  const words = ((log.data || '0x').slice(2).match(/.{1,64}/g) || []);
  return {
    kind: 'feedback',
    blockNumber: hexToInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: hexToInt(log.logIndex),
    eventKey: `${log.transactionHash}:${hexToInt(log.logIndex)}`,
    topic0: t[0] || null,
    agentId: safeUint(t[1]),
    rater: safeAddr(t[2]),
    valueRaw: words[0] ? safeUint('0x' + words[0]) : null,
    rawData: log.data,
    ingestedAt: new Date().toISOString()
  };
}

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

function buildMaterializedView(checkpoints) {
  const byAgent = new Map();
  const seen = new Set();

  for (const row of readJsonl(identityJsonlPath)) {
    if (!row.eventKey || seen.has(`i:${row.eventKey}`)) continue;
    seen.add(`i:${row.eventKey}`);
    const aid = normalizeAgentId(row.agentId);
    if (!aid) continue;
    const a = byAgent.get(aid) || {
      agentId: aid,
      name: `Agent ${aid}`,
      owner: null,
      category: 'Unknown',
      description: 'Derived from on-chain registry events',
      identityURI: null,
      createdAt: null,
      feedbackHistory: [],
      raters: new Set()
    };
    if (row.owner) a.owner = row.owner;
    if (!a.createdAt) a.createdAt = new Date((row.blockNumber || 0) * 12 * 1000).toISOString();
    byAgent.set(aid, a);
  }

  for (const row of readJsonl(feedbackJsonlPath)) {
    if (!row.eventKey || seen.has(`f:${row.eventKey}`)) continue;
    seen.add(`f:${row.eventKey}`);
    const aid = normalizeAgentId(row.agentId);
    if (!aid) continue;
    const a = byAgent.get(aid) || {
      agentId: aid,
      name: `Agent ${aid}`,
      owner: null,
      category: 'Unknown',
      description: 'Derived from on-chain registry events',
      identityURI: null,
      createdAt: null,
      feedbackHistory: [],
      raters: new Set()
    };
    const n = Number(row.valueRaw);
    if (Number.isFinite(n)) {
      a.feedbackHistory.push({
        timestamp: new Date((row.blockNumber || 0) * 12 * 1000).toISOString(),
        score: n,
        comment: 'on-chain feedback event',
        txHash: row.transactionHash,
        blockNumber: row.blockNumber
      });
      if (row.rater) a.raters.add(row.rater);
    }
    byAgent.set(aid, a);
  }

  const agents = [...byAgent.values()]
    .map((a) => {
      const scores = a.feedbackHistory.map((x) => x.score);
      const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
      a.feedbackHistory.sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));
      return {
        ...a,
        raters: undefined,
        uniqueRaters: a.raters.size,
        scoreV1: Number(avg.toFixed(2)),
        feedbackCount: a.feedbackHistory.length,
        lastActivityAt: a.feedbackHistory[0]?.timestamp || a.createdAt || null
      };
    })
    .sort((a, b) => b.feedbackCount - a.feedbackCount || a.agentId.localeCompare(b.agentId));

  writeJson(path.join(DATA_DIR, 'agents.snapshot.json'), {
    network: 'ethereum-mainnet',
    blockNumber: checkpoints.lastSafeBlock || null,
    generatedAt: new Date().toISOString(),
    scoreFormula: 'scoreV1 = arithmetic mean(feedback.score)',
    indexer: {
      mode: ONCE ? 'one-shot' : 'continuous',
      pollMs: CFG.pollMs,
      confirmations: CFG.confirmations,
      chunkSize: CFG.chunkSize,
      startBlock: CFG.startBlock
    },
    agents
  });
}

async function fetchLogsRange(address, fromBlock, toBlock) {
  return rpc('eth_getLogs', [{ address, fromBlock: toHex(fromBlock), toBlock: toHex(toBlock) }]);
}

async function pump(address, fromStart, safe, parser, outPath) {
  let from = fromStart;
  let chunks = 0;
  while (from <= safe && chunks < CFG.maxChunksPerTick) {
    const to = Math.min(from + CFG.chunkSize - 1, safe);
    const logs = await fetchLogsRange(address, from, to);
    appendJsonl(outPath, logs.map(parser));
    from = to + 1;
    chunks += 1;
  }
  return from;
}

async function tick() {
  const cp = readJson(checkpointsPath, {
    identityFromBlock: null,
    feedbackFromBlock: null,
    lastSafeBlock: null,
    updatedAt: null
  });

  const latest = hexToInt(await rpc('eth_blockNumber', []));
  const safe = Math.max(0, latest - CFG.confirmations);
  if (cp.identityFromBlock == null) cp.identityFromBlock = CFG.startBlock || safe;
  if (cp.feedbackFromBlock == null) cp.feedbackFromBlock = CFG.startBlock || safe;

  cp.identityFromBlock = await pump(CFG.identityRegistry, cp.identityFromBlock, safe, parseIdentityLog, identityJsonlPath);
  cp.feedbackFromBlock = await pump(CFG.feedbackRegistry, cp.feedbackFromBlock, safe, parseFeedbackLog, feedbackJsonlPath);

  cp.lastSafeBlock = safe;
  cp.updatedAt = new Date().toISOString();
  writeJson(checkpointsPath, cp);
  buildMaterializedView(cp);

  const lag = Math.max(0, safe - Math.min(cp.identityFromBlock, cp.feedbackFromBlock));
  console.log(`[tick] safe=${safe} next(identity=${cp.identityFromBlock},feedback=${cp.feedbackFromBlock}) lag=${lag}`);
}

(async function main() {
  console.log(`Starting ERC8004 indexer (${ONCE ? 'one-shot' : 'continuous'})`);
  if (ONCE) {
    await tick();
    return;
  }
  while (true) {
    try { await tick(); } catch (e) { console.error('[tick:error]', e.message); }
    await new Promise((r) => setTimeout(r, CFG.pollMs));
  }
})();
