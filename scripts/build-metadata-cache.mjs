#!/usr/bin/env node
/**
 * build-metadata-cache.mjs
 * Pre-fetches agent metadata (name, description, image) from identityURI/agentURI
 * and saves to data/metadata-cache.json for fast browser rendering.
 *
 * Handles:
 *   - data:application/json;base64,...  → decode locally, zero fetch
 *   - data:application/json;enc=gzip;level=6;base64,...  → decompress locally
 *   - https?://...  → HTTP fetch with timeout
 *   - ipfs://...  → fetch via ipfs.io gateway
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(REPO, 'data', 'agents.snapshot.json');
const CACHE_PATH = path.join(REPO, 'data', 'metadata-cache.json');
const EXISTING_CACHE_PATH = CACHE_PATH; // same file, merge mode

const TIMEOUT_MS = 8000;
const CONCURRENCY = 16;
const MAX_AGENTS = 5000; // process top N agents per run (incremental)

// ---------- helpers ----------

function ipfsToHttp(u) {
  if (!u) return null;
  const s = u.trim();
  if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.slice(7)}`;
  return s;
}

function pickField(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const parts = k.split('.');
    let v = obj;
    for (const p of parts) { v = v?.[p]; }
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function extractMeta(md) {
  if (!md || typeof md !== 'object') return null;
  const name = pickField(md, ['name', 'agent.name', 'metadata.name', 'profile.name', 'agentCard.name']);
  const description = pickField(md, ['description', 'agent.description', 'metadata.description', 'profile.description', 'agentCard.description']);
  const imageRaw = pickField(md, ['image', 'icon', 'avatar', 'logo', 'agent.image', 'agent.icon', 'metadata.image', 'profile.image', 'agentCard.icon']);
  const image = imageRaw ? ipfsToHttp(imageRaw) : null;
  if (!name && !image) return null;
  return { name, description, image };
}

async function decompressGzip(buf) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const gunzip = createGunzip();
    const readable = Readable.from(buf);
    readable.pipe(gunzip);
    gunzip.on('data', c => chunks.push(c));
    gunzip.on('end', () => resolve(Buffer.concat(chunks)));
    gunzip.on('error', reject);
  });
}

async function decodeDataUri(uri) {
  try {
    // data:application/json;base64,...
    if (uri.startsWith('data:application/json;base64,')) {
      const b64 = uri.slice('data:application/json;base64,'.length);
      const json = Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(json);
    }
    // data:application/json;enc=gzip;level=N;base64,...
    if (uri.includes(';enc=gzip;')) {
      const b64idx = uri.lastIndexOf(';base64,');
      if (b64idx === -1) return null;
      const b64 = uri.slice(b64idx + 8);
      const compressed = Buffer.from(b64, 'base64');
      const decompressed = await decompressGzip(compressed);
      return JSON.parse(decompressed.toString('utf8'));
    }
    // data:application/json,{url-encoded-json}
    if (uri.startsWith('data:application/json,')) {
      const encoded = uri.slice('data:application/json,'.length);
      const json = decodeURIComponent(encoded);
      return JSON.parse(json);
    }
    // data:application/json (no encoding marker — try raw)
    if (uri.startsWith('data:application/json')) {
      const commaIdx = uri.indexOf(',');
      if (commaIdx !== -1) {
        const raw = uri.slice(commaIdx + 1);
        try { return JSON.parse(decodeURIComponent(raw)); } catch { return JSON.parse(raw); }
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function resolveAgentMeta(agent) {
  const uri = agent.identityURI || agent.agentURI;
  if (!uri) return null;

  // data URI: decode locally
  if (uri.startsWith('data:')) {
    const md = await decodeDataUri(uri);
    return extractMeta(md);
  }

  // HTTP / IPFS: fetch
  const url = ipfsToHttp(uri);
  if (!url || !url.startsWith('http')) return null;
  const md = await fetchWithTimeout(url);
  return extractMeta(md);
}

function needsHydration(agent) {
  const name = agent.name || '';
  const isGeneric = /^agent\s+0x/i.test(name) || name.trim() === '';
  return isGeneric || !agent.image;
}

// ---------- main ----------

async function main() {
  console.log(`[metadata-cache] start — ${new Date().toISOString()}`);

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const agents = snapshot.agents || [];
  console.log(`[metadata-cache] snapshot agents: ${agents.length}`);

  // Load existing cache (merge mode — preserve previous fetches)
  let existing = {};
  if (fs.existsSync(EXISTING_CACHE_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(EXISTING_CACHE_PATH, 'utf8'));
      console.log(`[metadata-cache] loaded existing cache: ${Object.keys(existing).length} entries`);
    } catch { existing = {}; }
  }

  // Find agents that need work: no cache entry OR cached entry has no name/image
  // Skip agents with no URI (nothing to fetch)
  const targets = agents
    .filter(a => {
      if (!needsHydration(a)) return false; // already has good data in snapshot
      const uri = a.identityURI || a.agentURI;
      if (!uri) return false; // no URI → nothing to fetch
      const cached = existing[a.agentId];
      if (cached && (cached.name || cached.image)) return false; // already cached
      return true;
    })
    .slice(0, MAX_AGENTS);

  console.log(`[metadata-cache] agents to process: ${targets.length}`);

  let processed = 0;
  let hits = 0;

  // Worker pool
  const queue = [...targets];
  async function worker() {
    while (queue.length > 0) {
      const agent = queue.shift();
      const meta = await resolveAgentMeta(agent);
      processed++;
      if (meta && (meta.name || meta.image)) {
        existing[agent.agentId] = meta;
        hits++;
      }
      if (processed % 100 === 0) {
        console.log(`[metadata-cache] ${processed}/${targets.length} processed, ${hits} hits`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`[metadata-cache] done — ${hits} hits out of ${processed} processed`);
  console.log(`[metadata-cache] total cache entries: ${Object.keys(existing).length}`);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(existing, null, 0));
  console.log(`[metadata-cache] saved to ${CACHE_PATH}`);
}

main().catch(err => {
  console.error('[metadata-cache] ERROR:', err);
  process.exit(1);
});
