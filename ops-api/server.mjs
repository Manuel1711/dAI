import { createServer } from 'node:http';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

const PORT = Number(process.env.OPS_API_PORT || 8787);
const TOKEN = process.env.OPS_API_TOKEN || '';
const RATE_LIMIT = Number(process.env.OPS_RATE_LIMIT_PER_MIN || 30);
const AUDIT_LOG = resolve(process.cwd(), process.env.OPS_AUDIT_LOG || './audit.log');

if (!TOKEN) {
  console.error('Missing OPS_API_TOKEN. Set it in .env');
  process.exit(1);
}

const buckets = new Map(); // key -> { tsMinute, count }

function nowMinute() {
  return Math.floor(Date.now() / 60000);
}

function limited(key) {
  const m = nowMinute();
  const hit = buckets.get(key);
  if (!hit || hit.tsMinute !== m) {
    buckets.set(key, { tsMinute: m, count: 1 });
    return false;
  }
  hit.count += 1;
  return hit.count > RATE_LIMIT;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function reply(res, code, payload) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function authOk(req) {
  const h = req.headers['authorization'] || '';
  return h === `Bearer ${TOKEN}`;
}

function required(obj, keys) {
  for (const k of keys) {
    if (obj[k] === undefined || obj[k] === null || obj[k] === '') return k;
  }
  return null;
}

function audit(event) {
  const row = {
    at: new Date().toISOString(),
    ...event,
  };
  appendFileSync(AUDIT_LOG, JSON.stringify(row) + '\n', 'utf-8');
}

async function executeRegister(payload) {
  // TODO: wire to Agent0 SDK register call
  return {
    dryRun: true,
    action: 'register',
    accepted: {
      chainId: payload.chainId,
      name: payload.name,
      metadataUri: payload.metadataUri,
      endpoint: payload.endpoint || null,
    },
  };
}

async function executeGiveFeedback(payload) {
  // TODO: wire to Agent0 SDK giveFeedback call
  return {
    dryRun: true,
    action: 'give_feedback',
    accepted: {
      agentId: payload.agentId,
      value: payload.value,
      tag1: payload.tag1 || null,
      tag2: payload.tag2 || null,
      endpoint: payload.endpoint || null,
      hasFeedbackFile: Boolean(payload.feedbackFile),
    },
  };
}

async function executeRespond(payload) {
  // TODO: wire to Agent0 SDK appendResponse call
  return {
    dryRun: true,
    action: 'append_response',
    accepted: {
      agentId: payload.agentId,
      clientAddress: payload.clientAddress,
      feedbackIndex: payload.feedbackIndex,
      response: payload.response,
    },
  };
}

const server = createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  const method = req.method || 'GET';
  const url = req.url || '/';

  if (method === 'GET' && url === '/health') {
    return reply(res, 200, { ok: true, service: 'erc8004-ops-api', dryRun: true });
  }

  if (method !== 'POST') {
    return reply(res, 404, { ok: false, error: 'Not found' });
  }

  if (!authOk(req)) {
    audit({ ip, method, url, ok: false, reason: 'unauthorized' });
    return reply(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const key = `${ip}:${url}`;
  if (limited(key)) {
    audit({ ip, method, url, ok: false, reason: 'rate_limited' });
    return reply(res, 429, { ok: false, error: 'Rate limit exceeded' });
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch (e) {
    audit({ ip, method, url, ok: false, reason: e.message });
    return reply(res, 400, { ok: false, error: e.message });
  }

  try {
    if (url === '/agents/register') {
      const miss = required(payload, ['chainId', 'name', 'metadataUri']);
      if (miss) return reply(res, 400, { ok: false, error: `Missing field: ${miss}` });
      const out = await executeRegister(payload);
      audit({ ip, method, url, ok: true, action: out.action, ref: payload.name });
      return reply(res, 200, { ok: true, ...out });
    }

    if (url === '/feedback/give') {
      const miss = required(payload, ['agentId', 'value']);
      if (miss) return reply(res, 400, { ok: false, error: `Missing field: ${miss}` });
      const out = await executeGiveFeedback(payload);
      audit({ ip, method, url, ok: true, action: out.action, ref: payload.agentId });
      return reply(res, 200, { ok: true, ...out });
    }

    if (url === '/feedback/respond') {
      const miss = required(payload, ['agentId', 'clientAddress', 'feedbackIndex', 'response']);
      if (miss) return reply(res, 400, { ok: false, error: `Missing field: ${miss}` });
      const out = await executeRespond(payload);
      audit({ ip, method, url, ok: true, action: out.action, ref: payload.agentId });
      return reply(res, 200, { ok: true, ...out });
    }

    return reply(res, 404, { ok: false, error: 'Unknown endpoint' });
  } catch (e) {
    audit({ ip, method, url, ok: false, reason: e.message || 'internal_error' });
    return reply(res, 500, { ok: false, error: 'Internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`erc8004-ops-api listening on :${PORT} (dryRun=true)`);
});
