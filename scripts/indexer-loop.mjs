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

if (!CFG.rpcUrl) { console.error('Missing ETH_RPC_URL env'); process.exit(1); }
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
const utf8Hex = (s) => '0x' + Buffer.from(s, 'utf8').toString('hex');

async function rpc(method, params) {
  const r = await fetch(CFG.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

async function topic0(signature) { return rpc('web3_sha3', [utf8Hex(signature)]); }

async function findDeployBlock(address, latest) {
  const codeLatest = await rpc('eth_getCode', [address, toHex(latest)]);
  if (!codeLatest || codeLatest === '0x') throw new Error(`No code at ${address}`);
  let lo = 0, hi = latest;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const code = await rpc('eth_getCode', [address, toHex(mid)]);
    if (!code || code === '0x') lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function words(data) { return ((data || '0x').slice(2).match(/.{1,64}/g) || []); }
function wordToBigInt(word) { try { return BigInt('0x' + (word || '0')); } catch { return null; } }
function wordToNumber(word) { const b = wordToBigInt(word); return b == null ? null : Number(b); }
function decodeAbiString(w, offsetWordIdx) {
  const off = wordToNumber(w[offsetWordIdx]);
  if (!Number.isFinite(off) || off < 0) return null;
  const start = Math.floor(off / 32);
  const len = wordToNumber(w[start]);
  if (!Number.isFinite(len) || len < 0) return null;
  const hexLen = len * 2;
  const dataHex = w.slice(start + 1).join('').slice(0, hexLen);
  try { return Buffer.from(dataHex, 'hex').toString('utf8'); } catch { return null; }
}

function parseIdentityRegistered(log) {
  const t = log.topics || [];
  return {
    kind: 'identity_registered',
    blockNumber: hexToInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: hexToInt(log.logIndex),
    eventKey: `${log.transactionHash}:${hexToInt(log.logIndex)}`,
    agentId: safeUint(t[1]),
    owner: safeAddr(t[2]),
    agentURI: null,
    rawData: log.data,
    ingestedAt: new Date().toISOString(),
  };
}

function parseIdentityTransfer(log) {
  const t = log.topics || [];
  return {
    kind: 'identity_transfer',
    blockNumber: hexToInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: hexToInt(log.logIndex),
    eventKey: `${log.transactionHash}:${hexToInt(log.logIndex)}`,
    from: safeAddr(t[1]),
    to: safeAddr(t[2]),
    agentId: safeUint(t[3]),
    rawData: log.data,
    ingestedAt: new Date().toISOString(),
  };
}

function parseFeedbackNew(log) {
  const t = log.topics || [];
  const w = words(log.data);
  const tag1 = decodeAbiString(w, 3);
  const tag2 = decodeAbiString(w, 4);
  const endpoint = decodeAbiString(w, 5);
  const feedbackURI = decodeAbiString(w, 6);
  const feedbackHash = w[7] ? ('0x' + w[7].toLowerCase()) : null;
  return {
    kind: 'feedback_new',
    blockNumber: hexToInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: hexToInt(log.logIndex),
    eventKey: `${log.transactionHash}:${hexToInt(log.logIndex)}`,
    agentId: safeUint(t[1]),
    clientAddress: safeAddr(t[2]),
    indexedTag1Hash: t[3] || null,
    indexedTag1: tag1,
    feedbackIndex: w[0] ? safeUint('0x' + w[0]) : null,
    valueRaw: w[1] ? safeUint('0x' + w[1]) : null,
    valueDecimals: w[2] ? Number(BigInt('0x' + w[2])) : null,
    tag1,
    tag2,
    endpoint,
    feedbackURI,
    feedbackHash,
    rawData: log.data,
    ingestedAt: new Date().toISOString(),
  };
}

function parseFeedbackRevoked(log) {
  const t = log.topics || [];
  const w = words(log.data);
  return {
    kind: 'feedback_revoked',
    blockNumber: hexToInt(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: hexToInt(log.logIndex),
    eventKey: `${log.transactionHash}:${hexToInt(log.logIndex)}`,
    agentId: safeUint(t[1]),
    clientAddress: safeAddr(t[2]),
    feedbackIndex: w[0] ? safeUint('0x' + w[0]) : null,
    rawData: log.data,
    ingestedAt: new Date().toISOString(),
  };
}

function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function normalizeAgentId(v) { try { return '0x' + BigInt(v).toString(16).toUpperCase(); } catch { return null; } }

function buildMaterializedView(checkpoints) {
  const byAgent = new Map();
  const seen = new Set();

  for (const row of readJsonl(identityJsonlPath)) {
    if (!row.eventKey || seen.has(`i:${row.eventKey}`)) continue;
    seen.add(`i:${row.eventKey}`);

    if (row.kind === 'identity_registered' || row.kind === 'identity_transfer') {
      const aid = normalizeAgentId(row.agentId);
      if (!aid) continue;
      const a = byAgent.get(aid) || { agentId: aid, name: `Agent ${aid}`, owner: null, category: 'Unknown', description: 'Derived from ERC8004 registries', identityURI: null, createdAt: null, feedbackHistory: [], raters: new Set() };
      if (row.kind === 'identity_registered') {
        if (row.owner) a.owner = row.owner;
        if (!a.createdAt) a.createdAt = new Date((row.blockNumber || 0) * 12 * 1000).toISOString();
      }
      if (row.kind === 'identity_transfer' && row.to) a.owner = row.to;
      byAgent.set(aid, a);
    }
  }

  const revoked = new Set();
  for (const row of readJsonl(feedbackJsonlPath)) {
    if (row.kind !== 'feedback_revoked') continue;
    const aid = normalizeAgentId(row.agentId);
    if (!aid) continue;
    revoked.add(`${aid}:${(row.clientAddress || '').toLowerCase()}:${row.feedbackIndex || ''}`);
  }

  for (const row of readJsonl(feedbackJsonlPath)) {
    if (!row.eventKey || seen.has(`f:${row.eventKey}`)) continue;
    seen.add(`f:${row.eventKey}`);
    if (row.kind !== 'feedback_new') continue;

    const aid = normalizeAgentId(row.agentId);
    if (!aid) continue;
    const revKey = `${aid}:${(row.clientAddress || '').toLowerCase()}:${row.feedbackIndex || ''}`;
    if (revoked.has(revKey)) continue;

    const a = byAgent.get(aid) || { agentId: aid, name: `Agent ${aid}`, owner: null, category: 'Unknown', description: 'Derived from ERC8004 registries', identityURI: null, createdAt: null, feedbackHistory: [], raters: new Set() };
    const n = Number(row.valueRaw);
    const scaled = Number.isFinite(n) ? (row.valueDecimals != null && row.valueDecimals > 0 ? n / (10 ** row.valueDecimals) : n) : null;
    if (scaled != null && Number.isFinite(scaled)) {
      a.feedbackHistory.push({
        timestamp: new Date((row.blockNumber || 0) * 12 * 1000).toISOString(),
        score: scaled,
        tag1: row.tag1 || null,
        tag2: row.tag2 || null,
        comment: 'on-chain NewFeedback',
        txHash: row.transactionHash,
        blockNumber: row.blockNumber,
      });
      if (row.clientAddress) a.raters.add(row.clientAddress.toLowerCase());
    }
    byAgent.set(aid, a);
  }

  const agents = [...byAgent.values()].map((a) => {
    const scores = a.feedbackHistory.map((x) => x.score);
    const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
    a.feedbackHistory.sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));
    return { ...a, raters: undefined, uniqueRaters: a.raters.size, scoreV1: Number(avg.toFixed(4)), feedbackCount: a.feedbackHistory.length, lastActivityAt: a.feedbackHistory[0]?.timestamp || a.createdAt || null };
  }).sort((a, b) => b.feedbackCount - a.feedbackCount || a.agentId.localeCompare(b.agentId));

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
      maxChunksPerTick: CFG.maxChunksPerTick,
      fromBlockIdentity: checkpoints.identityFromBlock,
      fromBlockFeedback: checkpoints.feedbackFromBlock,
      deployBlockIdentity: checkpoints.identityDeployBlock,
      deployBlockFeedback: checkpoints.feedbackDeployBlock,
    },
    agents,
  });
}

async function fetchLogsRange(address, fromBlock, toBlock, topic) {
  return rpc('eth_getLogs', [{ address, fromBlock: toHex(fromBlock), toBlock: toHex(toBlock), topics: [topic] }]);
}

async function pumpTopic({ address, fromStart, safe, topic, parser, outPath }) {
  let from = fromStart;
  let chunks = 0;
  while (from <= safe && chunks < CFG.maxChunksPerTick) {
    const to = Math.min(from + CFG.chunkSize - 1, safe);
    const logs = await fetchLogsRange(address, from, to, topic);
    appendJsonl(outPath, logs.map(parser));
    from = to + 1;
    chunks += 1;
  }
  return from;
}

async function tick(topics) {
  const cp = readJson(checkpointsPath, { identityFromBlock: null, feedbackFromBlock: null, lastSafeBlock: null, updatedAt: null, identityDeployBlock: null, feedbackDeployBlock: null });
  const latest = hexToInt(await rpc('eth_blockNumber', []));
  const safe = Math.max(0, latest - CFG.confirmations);

  if (cp.identityDeployBlock == null) cp.identityDeployBlock = await findDeployBlock(CFG.identityRegistry, safe);
  if (cp.feedbackDeployBlock == null) cp.feedbackDeployBlock = await findDeployBlock(CFG.feedbackRegistry, safe);

  if (cp.identityFromBlock == null) cp.identityFromBlock = Math.max(CFG.startBlock, cp.identityDeployBlock);
  if (cp.feedbackFromBlock == null) cp.feedbackFromBlock = Math.max(CFG.startBlock, cp.feedbackDeployBlock);

  const idStart = cp.identityFromBlock;
  const fbStart = cp.feedbackFromBlock;

  cp.identityFromBlock = await pumpTopic({ address: CFG.identityRegistry, fromStart: cp.identityFromBlock, safe, topic: topics.REGISTERED, parser: parseIdentityRegistered, outPath: identityJsonlPath });
  cp.identityFromBlock = await pumpTopic({ address: CFG.identityRegistry, fromStart: idStart, safe: cp.identityFromBlock - 1, topic: topics.TRANSFER, parser: parseIdentityTransfer, outPath: identityJsonlPath });

  cp.feedbackFromBlock = await pumpTopic({ address: CFG.feedbackRegistry, fromStart: cp.feedbackFromBlock, safe, topic: topics.NEW_FEEDBACK, parser: parseFeedbackNew, outPath: feedbackJsonlPath });
  cp.feedbackFromBlock = await pumpTopic({ address: CFG.feedbackRegistry, fromStart: fbStart, safe: cp.feedbackFromBlock - 1, topic: topics.FEEDBACK_REVOKED, parser: parseFeedbackRevoked, outPath: feedbackJsonlPath });

  cp.lastSafeBlock = safe;
  cp.updatedAt = new Date().toISOString();
  writeJson(checkpointsPath, cp);

  buildMaterializedView(cp);
  const lag = Math.max(0, safe - Math.min(cp.identityFromBlock, cp.feedbackFromBlock));
  console.log(`[tick] safe=${safe} deploy(identity=${cp.identityDeployBlock},feedback=${cp.feedbackDeployBlock}) next(identity=${cp.identityFromBlock},feedback=${cp.feedbackFromBlock}) lag=${lag}`);
}

(async function main() {
  const topics = {
    REGISTERED: await topic0('Registered(uint256,string,address)'),
    TRANSFER: await topic0('Transfer(address,address,uint256)'),
    NEW_FEEDBACK: await topic0('NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)'),
    FEEDBACK_REVOKED: await topic0('FeedbackRevoked(uint256,address,uint64)'),
  };

  console.log(`Starting ERC8004 indexer (${ONCE ? 'one-shot' : 'continuous'})`);
  if (ONCE) { await tick(topics); return; }

  while (true) {
    try { await tick(topics); } catch (e) { console.error('[tick:error]', e.message); }
    await new Promise((r) => setTimeout(r, CFG.pollMs));
  }
})();
