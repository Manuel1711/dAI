/**
 * build-snapshot-base.mjs
 * Merges identity_registry.base.snapshot.json + feedback_registry.base.snapshot.json
 * → data/agents.base.snapshot.json
 *
 * Run: node scripts/build-snapshot-base.mjs
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), 'data');
const identityPath = path.join(root, 'identity_registry.base.snapshot.json');
const feedbackPath = path.join(root, 'feedback_registry.base.snapshot.json');
const outputPath   = path.join(root, 'agents.base.snapshot.json');

const identities = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
const feedback   = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));

// Group feedback by agentId
const byAgent = new Map();
for (const f of feedback.feedback) {
  if (!byAgent.has(f.agentId)) byAgent.set(f.agentId, []);
  byAgent.get(f.agentId).push(f);
}

const agents = identities.agents.map((a) => {
  const logs = byAgent.get(a.agentId) || [];
  const avg  = logs.length ? logs.reduce((s, x) => s + x.score, 0) / logs.length : 0;
  const lastActivity = logs.length
    ? logs.reduce((latest, x) => (x.timestamp > latest ? x.timestamp : latest), '')
    : a.createdAt;
  return {
    ...a,
    scoreV1:         Number(avg.toFixed(2)),
    feedbackCount:   logs.length,
    lastActivityAt:  lastActivity,
    feedbackHistory: logs.sort((x, y) => y.timestamp.localeCompare(x.timestamp)),
  };
});

const out = {
  network:      identities.network,
  chainId:      identities.chainId,
  blockNumber:  identities.blockNumber,
  generatedAt:  new Date().toISOString(),
  scoreFormula: 'scoreV1 = arithmetic mean(feedback.score)',
  agents,
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
console.log(`Built ${outputPath} with ${agents.length} agents`);

// Lite version (no feedbackHistory)
const litePath = path.join(root, 'agents.base.snapshot.lite.json');
const liteAgents = agents.map(({ feedbackHistory, identityURI, blockNumber, ...rest }) => {
  const fh = feedbackHistory || [];
  const uniqueRaters = new Set(fh.map(f => f.rater)).size;
  return { ...rest, uniqueRaters };
});
const liteOut = {
  network:     out.network,
  chainId:     out.chainId,
  blockNumber: out.blockNumber,
  generatedAt: out.generatedAt,
  agentCount:  liteAgents.length,
  agents:      liteAgents,
};
fs.writeFileSync(litePath, JSON.stringify(liteOut));
console.log(`Built ${litePath} (lite, ${Math.round(fs.statSync(litePath).size / 1024)}KB)`);
