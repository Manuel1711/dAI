import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), 'data');
const identityPath = path.join(root, 'identity_registry.snapshot.json');
const feedbackPath = path.join(root, 'feedback_registry.snapshot.json');
const outputPath = path.join(root, 'agents.snapshot.json');

const identities = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));

const byAgent = new Map();
for (const f of feedback.feedback) {
  if (!byAgent.has(f.agentId)) byAgent.set(f.agentId, []);
  byAgent.get(f.agentId).push(f);
}

const agents = identities.agents.map((a) => {
  const logs = byAgent.get(a.agentId) || [];
  const avg = logs.length ? logs.reduce((s, x) => s + x.score, 0) / logs.length : 0;
  return {
    ...a,
    scoreV1: Number(avg.toFixed(2)),
    feedbackCount: logs.length,
    feedbackHistory: logs.sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp))
  };
});

const out = {
  network: identities.network,
  blockNumber: identities.blockNumber,
  generatedAt: new Date().toISOString(),
  scoreFormula: 'scoreV1 = arithmetic mean(feedback.score)',
  agents
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
console.log(`Built ${outputPath} with ${agents.length} agents`);
