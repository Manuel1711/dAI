const NAV = `
<div id="global-sync-block" class="global-sync-block">Sync status: loading…</div>
<nav>
  <a href="./index.html">Home</a>
  <a href="./agents.html">Agents</a>
  <a href="./analytics.html">Analytics</a>
  <a href="./research.html">Research</a>
  <a href="./pipeline.html">Pipeline</a>
  <a href="./deploy.html">Deploy</a>
</nav>`;

function setActiveNav() {
  const page = location.pathname.split('/').pop();
  document.querySelectorAll('nav a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.includes(page)) a.classList.add('active');
  });
  initFuturisticBackground();
  refreshGlobalSyncBlock();
}

function initFuturisticBackground(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('futuristic-bg')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'futuristic-bg';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let raf = 0;
  const DPR_MAX = 1.6;
  const nodes = [];
  const chains = [];
  const pulses = [];
  const pointer = {
    x: window.innerWidth * 0.7,
    y: window.innerHeight * 0.3,
    targetX: window.innerWidth * 0.7,
    targetY: window.innerHeight * 0.3,
    active: false
  };
  const interaction = {
    dragNode: null,
    dragGraph: false,
    lastX: 0,
    lastY: 0
  };

  const rnd = (a, b) => a + Math.random() * (b - a);

  const makeScene = () => {
    nodes.length = 0;
    chains.length = 0;
    const nodeCount = Math.max(30, Math.min(72, Math.floor(w / 24)));
    const aiIcons = ['🤖'];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: rnd(-120, w + 120),
        y: rnd(-120, h + 120),
        vx: rnd(-0.16, 0.16),
        vy: rnd(-0.14, 0.14),
        r: rnd(14, 20),
        hue: rnd(38, 52),
        icon: aiIcons[i % aiIcons.length]
      });
    }

  };

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeScene();
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);

    pointer.x += (pointer.targetX - pointer.x) * 0.07;
    pointer.y += (pointer.targetY - pointer.y) * 0.07;

    ctx.fillStyle = 'rgba(15,22,38,0.42)';
    ctx.fillRect(0, 0, w, h);

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      a.x += a.vx;
      a.y += a.vy;
      if (a.x < -140) a.x = w + 140;
      if (a.x > w + 140) a.x = -140;
      if (a.y < -140) a.y = h + 140;
      if (a.y > h + 140) a.y = -140;

      const px = a.x - pointer.x;
      const py = a.y - pointer.y;
      const p2 = px * px + py * py;
      if (interaction.dragNode === null && p2 < 22000) {
        const pull = (1 - p2 / 22000) * 0.008;
        a.vx += ((pointer.x - a.x) * pull) * 0.001;
        a.vy += ((pointer.y - a.y) * pull) * 0.001;
      }
      a.vx *= 0.994;
      a.vy *= 0.994;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < 30000) {
          const repel = (1 - d2 / 30000) * 0.00045;
          a.vx += dx * repel;
          a.vy += dy * repel;
          b.vx -= dx * repel;
          b.vy -= dy * repel;
        }
        if (d2 > 120000 || d2 < 1800) continue;
        const alpha = 0.62 * (1 - d2 / 120000);
        const palette = [
          `rgba(250,204,21,${alpha})`,
          `rgba(245,158,11,${alpha})`,
          `rgba(255,234,138,${alpha})`
        ];
        ctx.strokeStyle = palette[(i + j) % palette.length];
        ctx.shadowColor = 'rgba(250,204,21,0.62)';
        ctx.shadowBlur = 7;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        for (let s = 0; s < 1; s++) {
          const prog = ((t * (0.00075 + s * 0.00018)) + (((i * 17 + j * 23 + s * 31) % 100) / 100)) % 1;
          const sx = a.x + (b.x - a.x) * prog;
          const sy = a.y + (b.y - a.y) * prog;
          const spark = ctx.createRadialGradient(sx, sy, 0.5, sx, sy, 8.5);
          spark.addColorStop(0, `rgba(255,248,181,${Math.min(0.98, alpha + 0.32)})`);
          spark.addColorStop(1, 'rgba(250,204,21,0)');
          ctx.fillStyle = spark;
          ctx.beginPath();
          ctx.arc(sx, sy, 8.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const nodeGlow = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, a.r + 12);
      nodeGlow.addColorStop(0, 'rgba(255,232,140,0.88)');
      nodeGlow.addColorStop(1, 'rgba(255,232,140,0)');
      ctx.fillStyle = nodeGlow;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r + 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(16,22,38,0.95)';
      ctx.strokeStyle = 'rgba(250,204,21,0.95)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = `${Math.max(14, Math.floor(a.r))}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.fillText(a.icon || '🤖', a.x, a.y + 0.5);
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.life -= 1;
      if (p.life <= 0) {
        pulses.splice(i, 1);
        continue;
      }
      const tt = 1 - p.life / p.maxLife;
      const rr = p.r0 + tt * 42;
      const alpha = 0.20 * (1 - tt);
      ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(pointer.x, pointer.y, 8, pointer.x, pointer.y, 180);
    glow.addColorStop(0, 'rgba(56,189,248,0.22)');
    glow.addColorStop(0.35, 'rgba(99,102,241,0.13)');
    glow.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 180, 0, Math.PI * 2);
    ctx.fill();

    raf = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  window.addEventListener('pointermove', (ev) => {
    pointer.targetX = ev.clientX;
    pointer.targetY = ev.clientY;
    pointer.active = true;

    if (interaction.dragNode !== null && nodes[interaction.dragNode]) {
      const n = nodes[interaction.dragNode];
      n.x = ev.clientX;
      n.y = ev.clientY;
      n.vx = 0;
      n.vy = 0;
    } else if (interaction.dragGraph) {
      const dx = ev.clientX - interaction.lastX;
      const dy = ev.clientY - interaction.lastY;
      interaction.lastX = ev.clientX;
      interaction.lastY = ev.clientY;
      for (const n of nodes) { n.x += dx; n.y += dy; }
      for (const c of chains) { c.y += dy * 0.35; }
    }
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.targetX = w * 0.7;
    pointer.targetY = h * 0.3;
    interaction.dragNode = null;
    interaction.dragGraph = false;
  }, { passive: true });

  window.addEventListener('pointerup', () => {
    interaction.dragNode = null;
    interaction.dragGraph = false;
  }, { passive: true });

  window.addEventListener('pointerdown', (ev) => {
    pulses.push({ x: ev.clientX, y: ev.clientY, life: 46, maxLife: 46, r0: 12 });
    if (pulses.length > 18) pulses.shift();

    let bestIdx = null;
    let bestDist2 = 30 * 30;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x - ev.clientX;
      const dy = n.y - ev.clientY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestIdx = i;
      }
    }

    if (bestIdx !== null) {
      interaction.dragNode = bestIdx;
      interaction.dragGraph = false;
    } else {
      interaction.dragNode = null;
      interaction.dragGraph = true;
      interaction.lastX = ev.clientX;
      interaction.lastY = ev.clientY;
    }
  }, { passive: true });

  raf = requestAnimationFrame(draw);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden && !raf) {
      raf = requestAnimationFrame(draw);
    }
  });
}

async function refreshGlobalSyncBlock() {
  const el = document.getElementById('global-sync-block');
  if (!el) return;
  try {
    const [snapshot, cp] = await Promise.all([loadSnapshot(), loadCheckpoint()]);
    const generatedAt = snapshot?.generatedAt ? new Date(snapshot.generatedAt) : null;
    const ageMin = generatedAt ? Math.max(0, Math.floor((Date.now() - generatedAt.getTime()) / 60000)) : null;
    const live = Number.isFinite(ageMin) ? ageMin <= 20 : false;

    const block = snapshot?.blockNumber ?? cp?.lastSafeBlock ?? '-';
    const stamp = generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt.toLocaleString() : '-';

    el.classList.toggle('live', !!live);
    el.classList.toggle('stale', !live);
    el.innerHTML = `<b>${live ? 'LIVE' : 'STALE'}</b> · block <b>${block}</b> · updated <b>${ageMin ?? '-'}m</b> ago · <span>${stamp}</span>`;
  } catch {
    el.classList.remove('live');
    el.classList.add('stale');
    el.textContent = 'STALE · sync status unavailable';
  }
}

function initFancyUI(){
  const targets = [...document.querySelectorAll('.card, .hero, .fig00a-panel, .agent-tile')]
    .filter((el) => !el.classList.contains('no-reveal'));
  targets.forEach((el) => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('revealed'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('revealed');
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed loading ${path}`);
  return res.json();
}

const clientMetadataCache = new Map();

function isGenericAgentName(v){
  return /^Agent\s+/i.test(String(v || '').trim());
}

function needsClientMetadataHydration(a){
  if (!a) return false;
  const uri = String(a.identityURI || a.agentURI || '').trim();
  if (!uri) return false;
  const hasName = !!(a.name && !isGenericAgentName(a.name));
  const hasImage = !!(a.image || a.imageURI || a.avatar);
  return !hasName || !hasImage;
}

function b64ToBytes(base64){
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function parseDataUriJson(uri){
  try {
    const m = String(uri).match(/^data:application\/json(?:;enc=gzip)?;base64,(.+)$/i);
    if (!m) return null;
    const bytes = b64ToBytes(m[1]);

    if (/;enc=gzip;/i.test(uri)) {
      if (typeof DecompressionStream === 'undefined') return null;
      const ds = new DecompressionStream('gzip');
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }

    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickMdField(md, paths){
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), md);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function extractMetadataFields(md){
  if (!md || typeof md !== 'object') return { name: null, description: null, image: null };
  const name = pickMdField(md, ['name', 'agent.name', 'metadata.name', 'profile.name', 'agentCard.name']);
  const description = pickMdField(md, ['description', 'agent.description', 'metadata.description', 'profile.description', 'agentCard.description']);
  const imageRaw = pickMdField(md, ['image', 'icon', 'avatar', 'logo', 'agent.image', 'agent.icon', 'metadata.image', 'profile.image', 'agentCard.icon']);
  return { name, description, image: imageRaw ? ipfsToHttp(imageRaw) : null };
}

async function fetchJsonWithTimeout(url, timeoutMs = 9000){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function enrichAgentsMetadataClient(agents, cap = 240, concurrency = 12){
  const targets = (agents || []).filter(needsClientMetadataHydration).slice(0, cap);
  let idx = 0;

  async function worker(){
    while (idx < targets.length) {
      const i = idx++;
      const a = targets[i];
      const key = String(a.identityURI || a.agentURI || '').trim();
      if (!key) continue;

      let md = clientMetadataCache.get(key);
      if (!md) {
        if (/^data:application\/json/i.test(key)) md = await parseDataUriJson(key);
        else md = await fetchJsonWithTimeout(ipfsToHttp(key));
        if (md && typeof md === 'object') clientMetadataCache.set(key, md);
      }

      if (!md || typeof md !== 'object') continue;
      const fields = extractMetadataFields(md);
      if ((!a.name || isGenericAgentName(a.name)) && fields.name) a.name = fields.name;
      if ((!a.description || a.description === 'Derived from ERC8004 registries') && fields.description) a.description = fields.description;
      if (!a.image && fields.image) a.image = fields.image;
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, 16)) }, () => worker()));
}

// Load pre-built server-side metadata cache (avoids live IPFS/HTTP fetches in browser)
let serverMetadataCache = null;
async function loadServerMetadataCache() {
  if (serverMetadataCache !== null) return serverMetadataCache;
  try {
    const res = await fetch('./data/metadata-cache.json', { cache: 'default' });
    if (res.ok) serverMetadataCache = await res.json();
    else serverMetadataCache = {};
  } catch { serverMetadataCache = {}; }
  return serverMetadataCache;
}

// Apply server cache to agents before client hydration
function applyServerMetadataCache(agents, cache) {
  if (!cache || !agents) return;
  for (const a of agents) {
    const entry = cache[a.agentId];
    if (!entry) continue;
    if ((!a.name || isGenericAgentName(a.name)) && entry.name) a.name = entry.name;
    if (!a.description && entry.description) a.description = entry.description;
    if (!a.image && entry.image) a.image = entry.image;
  }
}

async function loadSnapshot() {
  const [data, cache] = await Promise.all([
    fetchJson('./data/agents.snapshot.json'),
    loadServerMetadataCache()
  ]);
  // Apply server-side cache first (zero extra fetches)
  applyServerMetadataCache(data?.agents, cache);
  // Only hydrate remaining uncached agents client-side — small fallback cap (server cache handles the bulk)
  await enrichAgentsMetadataClient(data?.agents || [], 30, 4);
  return data;
}
async function loadCheckpoint() {
  try { return await fetchJson('./data/live/checkpoints.json'); } catch { return null; }
}
async function loadTagMap() {
  try {
    const j = await fetchJson('./data/tag1-category-map.json');
    return j?.tags || {};
  } catch {
    return {};
  }
}
async function loadFeedbackEvents() {
  try {
    const txt = await fetch('./data/live/feedback.events.jsonl').then((r) => r.text());
    return txt.split(/\r?\n/).filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}
async function loadFig00a() {
  try { return await fetchJson('./data/analytics/fig00a.cumulative_activity.json'); }
  catch { return null; }
}
async function loadFig00b() {
  try { return await fetchJson('./data/analytics/fig00b.event_intensity.json'); }
  catch { return null; }
}
async function loadFig07() {
  try { return await fetchJson('./data/analytics/fig07.first_feedback_delay_hist.json'); }
  catch { return null; }
}
async function loadFig08() {
  try { return await fetchJson('./data/analytics/fig08.mean_feedback_curve.json'); }
  catch { return null; }
}
async function loadFigTag07() {
  try { return await fetchJson('./data/analytics/fig-tag07.field_completeness.json'); }
  catch { return null; }
}
async function loadFigTag08() {
  try { return await fetchJson('./data/analytics/fig-tag08.composition.json'); }
  catch { return null; }
}
async function loadFigTag09() {
  try { return await fetchJson('./data/analytics/fig-tag09.top_terms.json'); }
  catch { return null; }
}
async function loadTopClientsNetwork() {
  try { return await fetchJson('./data/analytics/fig_top_clients_agents_network.json'); }
  catch { return null; }
}
async function loadTopAgentsNetwork() {
  try { return await fetchJson('./data/analytics/fig_top_agents_clients_network.json'); }
  catch { return null; }
}

function avg(arr){return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0}
function fmtDate(s){ if(!s) return '-'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleString(); }
function shortAddr(a){ return a && a.startsWith('0x') && a.length>12 ? `${a.slice(0,6)}...${a.slice(-4)}` : (a || '-'); }
function agentIdToNumber(agentId){
  if (agentId === null || agentId === undefined) return null;
  const s = String(agentId).trim();
  if (!s) return null;
  try {
    if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s).toString(10);
    if (/^[0-9]+$/.test(s)) return BigInt(s).toString(10);
    return null;
  } catch {
    return null;
  }
}
function displayAgentId(agentId){
  return agentIdToNumber(agentId) || String(agentId || '-');
}
function deriveStatus(a){
  const t = new Date(a.lastActivityAt || a.createdAt || 0).getTime();
  if (!Number.isFinite(t) || t<=0) return 'Inactive';
  const days = (Date.now() - t) / (1000*60*60*24);
  if (days <= 14) return 'Active';
  if (days <= 60) return 'Warm';
  return 'Inactive';
}
function statusPill(status){
  const key = String(status || 'inactive').toLowerCase();
  return `<span class='status-pill ${key}'>${status}</span>`;
}
function ipfsToHttp(u){
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.slice('ipfs://'.length)}`;
  return s;
}
function fallbackAvatar(agentId){
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(agentId||'agent')}`;
}
function pickAgentImage(a){
  const direct = ipfsToHttp(a.image || a.imageURI || a.avatar || null);
  if (direct) return direct;
  const uri = ipfsToHttp(a.identityURI || a.agentURI || null);
  if (uri && /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(uri)) return uri;
  return fallbackAvatar(a.agentId);
}

function deriveAgentMetrics(agent, tagMap) {
  const history = agent.feedbackHistory || [];
  const nonCharacteristic = [];
  const byCharacteristic = new Map();
  const tagFreq = new Map();

  for (const f of history) {
    const n = Number(f.score);
    if (!Number.isFinite(n)) continue;
    const t = String(f.tag1 || '').trim().toLowerCase();
    if (t) tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
    const cat = (tagMap[t]?.category) || 'unclassified';

    if (cat === 'characteristic') {
      const bucket = byCharacteristic.get(t) || [];
      bucket.push(n);
      byCharacteristic.set(t, bucket);
    } else {
      nonCharacteristic.push(n);
    }
  }

  const characteristics = [...byCharacteristic.entries()]
    .map(([tag, vals]) => ({ tag, count: vals.length, mean: Number(avg(vals).toFixed(2)) }))
    .sort((a,b) => b.count - a.count || b.mean - a.mean);

  const topTags = [...tagFreq.entries()]
    .map(([tag,count]) => ({ tag, count, category: tagMap[tag]?.category || 'unclassified' }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 8);

  return {
    scoreMain: Number(avg(nonCharacteristic).toFixed(2)),
    scoreMainCount: nonCharacteristic.length,
    characteristicCount: characteristics.reduce((s,x)=>s+x.count,0),
    characteristics,
    topTags,
  };
}

window.renderHome = async function renderHome(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const data = await loadSnapshot();
  const cp = await loadCheckpoint();
  const tagMap = await loadTagMap();
  const enriched = data.agents.map((a) => ({ ...a, _metrics: deriveAgentMetrics(a, tagMap) }));

  const total = enriched.length;
  const allScores = enriched.map((a)=>a._metrics.scoreMain || 0);
  const mean = avg(allScores).toFixed(2);
  const feedback = enriched.reduce((s,a)=>s+(a.feedbackCount||0),0);
  const now = Date.now();
  const ageMin = Math.floor((now - new Date(data.generatedAt).getTime()) / 60000);
  const live = ageMin <= 20;

  document.getElementById('status-chip').className = `status-chip ${live ? 'status-live' : 'status-stale'}`;
  document.getElementById('status-chip').textContent = live ? `LIVE • updated ${ageMin}m ago` : `STALE • updated ${ageMin}m ago`;

  document.getElementById('home-kpis').innerHTML = `
    <div class='card'><h3>Agents indexed</h3><div class='kpi'>${total}</div></div>
    <div class='card'><h3>Network</h3><div class='kpi'>ETH L1</div></div>
    <div class='card'><h3>Avg Main Score (non-C1)</h3><div class='kpi'>${mean}</div></div>
    <div class='card'><h3>Total Feedback</h3><div class='kpi'>${feedback}</div></div>`;

  const top = [...enriched].sort((a,b)=>(b._metrics.scoreMain||0)-(a._metrics.scoreMain||0)).slice(0,5)
    .map((a)=>`<li><a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name}</a> — ${Number(a._metrics.scoreMain||0).toFixed(2)} (${a._metrics.scoreMainCount} fb used)</li>`).join('');
  document.getElementById('top-agents').innerHTML = `<h3>Top agents by Main Score (non-C1)</h3><ol>${top || '<li>No agents</li>'}</ol>`;

  const cpText = cp ? ` | Last safe block: ${cp.lastSafeBlock ?? '-'} | Checkpoint updated: ${fmtDate(cp.updatedAt)}` : '';
  document.getElementById('meta').textContent = `Snapshot block: ${data.blockNumber} | Generated: ${fmtDate(data.generatedAt)}${cpText}`;
  initFancyUI();
}

window.renderAgents = async function renderAgents(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const data = await loadSnapshot();
  const tagMap = await loadTagMap();
  const enriched = data.agents.map((a) => ({ ...a, _metrics: deriveAgentMetrics(a, tagMap) }));
  const searchEl = document.getElementById('search');
  const sortEl = document.getElementById('sort');
  const metaEl = document.getElementById('agents-meta');
  const paginationEl = document.getElementById('agents-pagination');
  const topFeedbackEl = document.getElementById('agents-top-feedback');
  const latestDeployedEl = document.getElementById('agents-latest-deployed');
  const PAGE_SIZE = 20;
  let currentPage = 1;

  function renderTopFeedbackTiles() {
    if (!topFeedbackEl) return;
    const top = [...enriched]
      .sort((a,b)=>(b.feedbackCount||0)-(a.feedbackCount||0))
      .slice(0, 12);
    const maxFb = Math.max(1, ...top.map((a) => Number(a.feedbackCount || 0)));

    topFeedbackEl.innerHTML = top.map((a, idx) => {
      const fb = Number(a.feedbackCount || 0);
      const pct = Math.max(3, Math.round((fb / maxFb) * 100));
      const score = Number(a._metrics?.scoreMain || 0).toFixed(2);
      const img = pickAgentImage(a);
      return `
        <a class='agent-tile top-feedback-tile' href='./agent.html?id=${encodeURIComponent(a.agentId)}' title='Open agent ${a.name || a.agentId}'>
          <img class='agent-avatar' src='${img}' alt='${(a.name||a.agentId)}' loading='lazy' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
          <div style='min-width:0;flex:1;'>
            <div class='agent-tile-title'>#${idx+1} ${a.name || a.agentId}</div>
            <div class='agent-tile-sub'>${displayAgentId(a.agentId)} · Feedback: <b>${fb.toLocaleString()}</b> · Score: <b>${score}</b></div>
            <div class='mini-bar interactive' data-pct='${pct}'>
              <span style='width:${pct}%'></span>
            </div>
          </div>
        </a>
      `;
    }).join('') || '<p>No agents available yet.</p>';
  }

  function renderLatestDeployedTiles() {
    if (!latestDeployedEl) return;
    const latest = [...enriched]
      .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
      .slice(0, 12);

    const newestTs = latest.length ? Math.max(...latest.map((a) => new Date(a.createdAt || 0).getTime() || 0)) : 0;

    latestDeployedEl.innerHTML = latest.map((a, idx) => {
      const created = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const recencyPct = newestTs > 0 ? Math.max(4, Math.round((created / newestTs) * 100)) : 10;
      const img = pickAgentImage(a);
      const fb = Number(a.feedbackCount || 0);
      return `
        <a class='agent-tile latest-deployed-tile' href='./agent.html?id=${encodeURIComponent(a.agentId)}' title='Open agent ${a.name || a.agentId}'>
          <img class='agent-avatar' src='${img}' alt='${(a.name||a.agentId)}' loading='lazy' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
          <div style='min-width:0;flex:1;'>
            <div class='agent-tile-title'>#${idx+1} ${a.name || a.agentId}</div>
            <div class='agent-tile-sub'>${displayAgentId(a.agentId)} · Created: <b>${fmtDate(a.createdAt)}</b></div>
            <div class='agent-tile-sub'>Feedback: <b>${fb.toLocaleString()}</b> · Status: <b>${deriveStatus(a)}</b></div>
            <div class='mini-bar interactive' data-pct='${recencyPct}'>
              <span style='width:${recencyPct}%'></span>
            </div>
          </div>
        </a>
      `;
    }).join('') || '<p>No deployed agents yet.</p>';
  }

  function applyFilters() {
    const q = (searchEl.value || '').toLowerCase().trim();
    const mode = sortEl.value;
    let rows = [...enriched];

    if (q) {
      rows = rows.filter((a) => [a.name, a.agentId, displayAgentId(a.agentId), a.owner, a.category].filter(Boolean).join(' ').toLowerCase().includes(q));
    }

    if (mode === 'score') rows.sort((a,b)=>(b._metrics.scoreMain||0)-(a._metrics.scoreMain||0));
    if (mode === 'feedback') rows.sort((a,b)=>(b.feedbackCount||0)-(a.feedbackCount||0));
    if (mode === 'recent') rows.sort((a,b)=>new Date(b.lastActivityAt||0)-new Date(a.lastActivityAt||0));
    if (mode === 'name') rows.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    return rows;
  }

  function renderRows(reset = false) {
    const rows = applyFilters();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (reset) currentPage = 1;
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const shown = rows.slice(start, end);

    document.getElementById('agents-table').innerHTML = shown.map((a)=>{
      const st = deriveStatus(a);
      const img = pickAgentImage(a);
      return `<tr>
      <td>
        <div class='agent-cell'>
          <img class='agent-avatar' src='${img}' alt='${(a.name||a.agentId)}' loading='lazy' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
          <div>
            <a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name || a.agentId}</a><br><small>${displayAgentId(a.agentId)}</small>
            <div class='agent-desc'>${(a.description || '').slice(0, 120) || 'No description yet'}</div>
          </div>
        </div>
      </td>
      <td>${a.category || '-'}</td>
      <td class='owner-short' title='${a.owner || '-'}'>${shortAddr(a.owner)}</td>
      <td>${Number(a._metrics.scoreMain || 0).toFixed(2)} /100</td>
      <td>${a.feedbackCount || 0}</td>
      <td>${statusPill(st)}</td>
      <td>${fmtDate(a.lastActivityAt)}</td>
    </tr>`;
    }).join('') || `<tr><td colspan='7'>No agents for this filter</td></tr>`;

    if (metaEl) {
      const from = rows.length ? start + 1 : 0;
      const to = Math.min(end, rows.length);
      metaEl.textContent = `Showing ${from}-${to} / ${rows.length} agents`;
    }

    if (paginationEl) {
      const maxButtons = 7;
      let pStart = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let pEnd = Math.min(totalPages, pStart + maxButtons - 1);
      pStart = Math.max(1, pEnd - maxButtons + 1);

      const pageBtns = [];
      for (let p = pStart; p <= pEnd; p++) {
        pageBtns.push(`<button class='page-btn ${p === currentPage ? 'active' : ''}' data-page='${p}'>${p}</button>`);
      }

      paginationEl.innerHTML = `
        <button class='page-btn' data-page='${Math.max(1, currentPage - 1)}' ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>
        ${pageBtns.join('')}
        <button class='page-btn' data-page='${Math.min(totalPages, currentPage + 1)}' ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
      `;

      paginationEl.querySelectorAll('button[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = Number(btn.getAttribute('data-page') || '1');
          if (!Number.isFinite(p)) return;
          currentPage = p;
          renderRows(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }
  }

  searchEl.addEventListener('input', () => renderRows(true));
  sortEl.addEventListener('change', () => renderRows(true));
  renderTopFeedbackTiles();
  renderLatestDeployedTiles();
  renderRows(true);
  initFancyUI();
}

window.renderAgentDetail = async function renderAgentDetail(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const id = new URLSearchParams(location.search).get('id');
  const data = await loadSnapshot();
  const tagMap = await loadTagMap();
  const a = data.agents.find((x)=>x.agentId===id);
  if (!a) {
    document.getElementById('agent-root').innerHTML = '<div class="card"><p>Agent not found</p></div>';
    return;
  }

  const metrics = deriveAgentMetrics(a, tagMap);
  const numericId = displayAgentId(a.agentId);
  const endpoint = a.endpoint || a.endpointURI || a.serviceEndpoint || a.url || null;
  const identityLink = ipfsToHttp(a.identityURI);
  const endpointLink = ipfsToHttp(endpoint);
  const identityHtml = identityLink ? `<a href='${identityLink}' target='_blank' rel='noopener noreferrer'>${a.identityURI}</a>` : (a.identityURI || '-');
  const endpointHtml = endpointLink ? `<a href='${endpointLink}' target='_blank' rel='noopener noreferrer'>${endpoint}</a>` : (endpoint || 'Not provided');
  const status = deriveStatus(a);
  const displayName = a.name || `Agent #${numericId}`;
  const characteristicsHtml = metrics.characteristics.slice(0, 8)
    .map((x)=>`<li><b>${x.tag}</b><span>${x.mean.toFixed(2)} · n=${x.count}</span></li>`).join('');
  const topTagsHtml = metrics.topTags
    .map((x)=>`<li><b>${x.tag}</b><span>${x.count} · ${x.category}</span></li>`).join('');

  const feedbackRows = (a.feedbackHistory || []).map((f)=> {
    const t = String(f.tag1 || '').trim().toLowerCase();
    const cat = tagMap[t]?.category || 'unclassified';
    return `<tr><td>${fmtDate(f.timestamp)}</td><td>${f.score}</td><td>${f.tag1 || '-'}</td><td>${cat}</td><td>${f.comment || '-'}</td><td><small>${f.txHash}</small></td></tr>`;
  }).join('');

  document.getElementById('agent-root').innerHTML = `
    <section class='agent-detail-wrap'>
      <div class='card agent-hero-card'>
        <div class='agent-hero'>
          <img class='agent-hero-avatar' src='${pickAgentImage(a)}' alt='${displayName}' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
          <div class='agent-hero-main'>
            <div class='agent-hero-title-row'>
              <h2>${displayName}</h2>
              <span class='badge'>ID #${numericId}</span>
              <span class='badge'>${a.category || 'Unknown'}</span>
              ${statusPill(status)}
            </div>
            <p class='agent-hero-desc'>${a.description || 'No description provided for this agent yet.'}</p>
          </div>
        </div>
      </div>
      <div class='agent-detail-grid'>
        <div class='card agent-info-card'><h3>Owner</h3><p class='owner-short'>${a.owner || '-'}</p></div>
        <div class='card agent-info-card'><h3>Identity URI</h3><p class='agent-breakline'>${identityHtml}</p></div>
        <div class='card agent-info-card'><h3>Endpoint</h3><p class='agent-breakline'>${endpointHtml}</p></div>
        <div class='card agent-info-card'><h3>Timeline</h3><p>Created: ${fmtDate(a.createdAt)}</p><p>Last activity: ${fmtDate(a.lastActivityAt)}</p></div>
      </div>

      <div class='agent-kpi-grid'>
        <div class='card agent-kpi-card'><h3>Main score</h3><div class='kpi'>${metrics.scoreMain.toFixed(2)}</div><p>from ${metrics.scoreMainCount} non-C1 feedback</p></div>
        <div class='card agent-kpi-card'><h3>Feedback count</h3><div class='kpi'>${Number(a.feedbackCount || 0).toLocaleString()}</div></div>
        <div class='card agent-kpi-card'><h3>Unique raters</h3><div class='kpi'>${Number(a.uniqueRaters || 0).toLocaleString()}</div></div>
        <div class='card agent-kpi-card'><h3>Characteristic count</h3><div class='kpi'>${Number(metrics.characteristicCount || 0).toLocaleString()}</div></div>
      </div>

      <div class='agent-detail-grid'>
        <div class='card agent-list-card'>
          <h3>Top characteristics</h3>
          <ul class='agent-stat-list'>${characteristicsHtml || '<li><b>None yet</b><span>No characteristic tags yet</span></li>'}</ul>
        </div>
        <div class='card agent-list-card'>
          <h3>Most used tags</h3>
          <ul class='agent-stat-list'>${topTagsHtml || '<li><b>None yet</b><span>No tags yet</span></li>'}</ul>
        </div>
      </div>

      <section class='card agent-feedback-card'>
        <div class='agent-feedback-head'>
          <h3>Feedback Registry History</h3>
          <span class='badge'>Agent #${numericId}</span>
        </div>
        <div class='agents-table-wrap'>
          <table class='table agents-table'>
            <thead><tr><th>Timestamp</th><th>Score</th><th>tag1</th><th>Category</th><th>Comment</th><th>TxHash</th></tr></thead>
            <tbody>${feedbackRows || '<tr><td colspan="6" class="agent-empty">No feedback has been submitted for this agent.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </section>`;
  initFancyUI();
}

window.renderPipeline = async function renderPipeline(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const cp = await loadCheckpoint();
  if (!cp) {
    document.getElementById('pipeline-kpis').innerHTML = `<div class='card'><h3>No checkpoint yet</h3><p>Run indexer to populate data/live/checkpoints.json</p></div>`;
    return;
  }

  document.getElementById('pipeline-kpis').innerHTML = `
    <div class='card'><h3>Last safe block</h3><div class='kpi'>${cp.lastSafeBlock ?? '-'}</div></div>
    <div class='card'><h3>Identity from block</h3><div class='kpi'>${cp.identityFromBlock ?? '-'}</div></div>
    <div class='card'><h3>Feedback from block</h3><div class='kpi'>${cp.feedbackFromBlock ?? '-'}</div></div>
    <div class='card'><h3>Updated at</h3><div>${fmtDate(cp.updatedAt)}</div></div>`;

  document.getElementById('checkpoint-raw').textContent = JSON.stringify(cp, null, 2);
  initFancyUI();
}

function giniFromArray(values){
  const x = (values || []).map(Number).filter((v) => Number.isFinite(v) && v >= 0).sort((a,b) => a - b);
  if (!x.length) return 0;
  const sum = x.reduce((a,b)=>a+b,0);
  if (sum <= 0) return 0;
  let weighted = 0;
  for (let i = 0; i < x.length; i++) weighted += (i + 1) * x[i];
  return (2 * weighted) / (x.length * sum) - (x.length + 1) / x.length;
}

function buildPolyline(xs, ys, xToPx, yToPx){
  return xs.map((x, i) => `${xToPx(x).toFixed(2)},${yToPx(ys[i]).toFixed(2)}`).join(' ');
}

function niceStep(rawStep){
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exp = Math.floor(Math.log10(rawStep));
  const frac = rawStep / Math.pow(10, exp);
  let niceFrac = 1;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * Math.pow(10, exp);
}

function roundTickValues(min, max, n = 6){
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [Math.round(min || 0)];
  const step = niceStep((max - min) / Math.max(1, (n - 1)));
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v));
  if (!ticks.length || ticks[0] !== 0) ticks.unshift(0);
  return [...new Set(ticks)].sort((a,b)=>a-b);
}

function shortNum(v){
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v/1e9).toFixed(1).replace(/\.0$/,'')}B`;
  if (a >= 1e6) return `${(v/1e6).toFixed(1).replace(/\.0$/,'')}M`;
  if (a >= 1e3) return `${(v/1e3).toFixed(1).replace(/\.0$/,'')}K`;
  return `${Math.round(v)}`;
}

function renderFig00a(fig){
  const root = document.getElementById('fig00a-root');
  if (!root) return;
  if (!fig || !fig.x_union?.length) {
    root.innerHTML = `<p>Figure data not available yet.</p>`;
    return;
  }

  const x = fig.x_union.map(Number);
  const reg = fig.reg_y.map(Number);
  const fb = fig.fb_y.map(Number);

  const width = 1040;
  const height = 460;
  const margin = { top: 24, right: 24, bottom: 72, left: 88 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const xMin = Math.min(...x);
  const xMax = Math.max(...x);
  const yMin = 0;
  const yMax = Math.max(...reg, ...fb, 1);

  const xToPx = (v) => margin.left + ((v - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const yToPx = (v) => margin.top + (1 - (v - yMin) / Math.max(1, yMax - yMin)) * plotH;

  const regPoints = buildPolyline(x, reg, xToPx, yToPx);
  const fbPoints = buildPolyline(x, fb, xToPx, yToPx);

  const yTicks = roundTickValues(yMin, yMax, 6);
  const xTicks = roundTickValues(xMin, xMax, 6);

  const yTickSvg = yTicks.map((v) => {
    const py = yToPx(v);
    return `
      <line x1='${margin.left}' y1='${py}' x2='${width - margin.right}' y2='${py}' stroke='currentColor' opacity='0.16'/>
      <text x='${margin.left - 12}' y='${py + 5}' text-anchor='end' font-size='13' font-weight='600'>${shortNum(v)}</text>
    `;
  }).join('');

  const xTickSvg = xTicks.map((v) => {
    const px = xToPx(v);
    return `
      <line x1='${px}' y1='${margin.top}' x2='${px}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.12'/>
      <text x='${px}' y='${height - margin.bottom + 24}' text-anchor='middle' font-size='13' font-weight='600'>${Math.round(v).toLocaleString()}</text>
    `;
  }).join('');

  const regArea = `${margin.left},${height - margin.bottom} ${regPoints} ${width - margin.right},${height - margin.bottom}`;
  const fbArea = `${margin.left},${height - margin.bottom} ${fbPoints} ${width - margin.right},${height - margin.bottom}`;

  root.innerHTML = `
    <div class='fig00a-panel'>
      <div class='fig00a-controls'>
        <label><input type='checkbox' id='fig00a-toggle-reg' checked/> registrations</label>
        <label><input type='checkbox' id='fig00a-toggle-fb' checked/> feedback events</label>
      </div>
      <div class='fig00a-wrap' style='position:relative'>
        <svg viewBox='0 0 ${width} ${height}' width='100%' height='auto' role='img' aria-label='Cumulative registrations and feedback events over block number'>
          <defs>
            <linearGradient id='fig00a-grad-reg' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stop-color='#1d4ed8' stop-opacity='0.32'/>
              <stop offset='100%' stop-color='#1d4ed8' stop-opacity='0.02'/>
            </linearGradient>
            <linearGradient id='fig00a-grad-fb' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stop-color='#dc2626' stop-opacity='0.28'/>
              <stop offset='100%' stop-color='#dc2626' stop-opacity='0.02'/>
            </linearGradient>
            <filter id='fig00a-glow'><feGaussianBlur stdDeviation='2.2' result='blur'/><feMerge><feMergeNode in='blur'/><feMergeNode in='SourceGraphic'/></feMerge></filter>
          </defs>
          ${yTickSvg}
          ${xTickSvg}

          <line x1='${margin.left}' y1='${height - margin.bottom}' x2='${width - margin.right}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
          <line x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>

          <polygon id='fig00a-reg-area' points='${regArea}' fill='url(#fig00a-grad-reg)' />
          <polygon id='fig00a-fb-area' points='${fbArea}' fill='url(#fig00a-grad-fb)' />

          <polyline id='fig00a-reg-line' class='fig-line-anim' fill='none' stroke='#1d4ed8' stroke-width='2.8' filter='url(#fig00a-glow)' points='${regPoints}' />
          <polyline id='fig00a-fb-line' class='fig-line-anim' fill='none' stroke='#dc2626' stroke-width='2.8' filter='url(#fig00a-glow)' points='${fbPoints}' />

          <line id='fig00a-cross' x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0' stroke-dasharray='4 4'/>

          <rect id='fig00a-hitbox' x='${margin.left}' y='${margin.top}' width='${plotW}' height='${plotH}' fill='transparent' style='cursor:crosshair'/>

          <text x='${width / 2}' y='${height - 16}' text-anchor='middle' font-size='16' font-weight='700'>Block number</text>
          <text x='24' y='${height / 2}' transform='rotate(-90 24 ${height / 2})' text-anchor='middle' font-size='16' font-weight='700'>Cumulative count</text>

          <circle cx='${margin.left + 8}' cy='${margin.top + 8}' r='4' fill='#1d4ed8'></circle>
          <text x='${margin.left + 18}' y='${margin.top + 12}' font-size='12'>Cumulative registrations</text>
          <circle cx='${margin.left + 240}' cy='${margin.top + 8}' r='4' fill='#dc2626'></circle>
          <text x='${margin.left + 250}' y='${margin.top + 12}' font-size='12'>Cumulative feedback events</text>
        </svg>
        <div id='fig00a-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
      </div>
    </div>
    <p class='chart-caption'>Cumulative network growth in the ${xMin.toLocaleString()}–${xMax.toLocaleString()} block range · Total registrations <b>${reg[reg.length-1].toLocaleString()}</b> · Total feedback <b>${fb[fb.length-1].toLocaleString()}</b>.</p>
  `;

  const wrap = root.querySelector('.fig00a-wrap');
  const hitbox = root.querySelector('#fig00a-hitbox');
  const cross = root.querySelector('#fig00a-cross');
  const tip = root.querySelector('#fig00a-tooltip');
  const regLine = root.querySelector('#fig00a-reg-line');
  const fbLine = root.querySelector('#fig00a-fb-line');
  const regAreaEl = root.querySelector('#fig00a-reg-area');
  const fbAreaEl = root.querySelector('#fig00a-fb-area');
  const regToggle = root.querySelector('#fig00a-toggle-reg');
  const fbToggle = root.querySelector('#fig00a-toggle-fb');
  if (!wrap || !hitbox || !cross || !tip) return;

  const syncSeriesVisibility = () => {
    const regOn = regToggle ? regToggle.checked : true;
    const fbOn = fbToggle ? fbToggle.checked : true;
    if (regLine) regLine.style.display = regOn ? 'block' : 'none';
    if (regAreaEl) regAreaEl.style.display = regOn ? 'block' : 'none';
    if (fbLine) fbLine.style.display = fbOn ? 'block' : 'none';
    if (fbAreaEl) fbAreaEl.style.display = fbOn ? 'block' : 'none';
  };
  if (regToggle) regToggle.addEventListener('change', syncSeriesVisibility);
  if (fbToggle) fbToggle.addEventListener('change', syncSeriesVisibility);
  syncSeriesVisibility();

  const onMove = (ev) => {
    const bounds = wrap.getBoundingClientRect();
    const svgX = ((ev.clientX - bounds.left) / bounds.width) * width;
    const t = Math.max(0, Math.min(1, (svgX - margin.left) / plotW));
    const idx = Math.max(0, Math.min(x.length - 1, Math.round(t * (x.length - 1))));
    const px = xToPx(x[idx]);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('opacity', '0.7');

    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 210, Math.max(8, (px / width) * bounds.width + 10))}px`;
    tip.style.top = `${Math.max(8, (margin.top / height) * bounds.height + 10)}px`;
    tip.innerHTML = `Block <b>${x[idx].toLocaleString()}</b><br/>Reg: <b>${reg[idx].toLocaleString()}</b><br/>Feedback: <b>${fb[idx].toLocaleString()}</b>`;
  };

  hitbox.addEventListener('mousemove', onMove);
  hitbox.addEventListener('mouseenter', onMove);
  hitbox.addEventListener('mouseleave', () => {
    cross.setAttribute('opacity', '0');
    tip.style.display = 'none';
  });
}

function renderFig00b(fig){
  const root = document.getElementById('fig00b-root');
  if (!root) return;
  if (!fig || !fig.centers?.length) {
    root.innerHTML = `<p>Figure data not available yet.</p>`;
    return;
  }

  const x = fig.centers.map(Number);
  const reg = fig.reg_hist.map(Number);
  const fb = fig.fb_hist.map(Number);
  const ratio = (fig.ratio || []).map((v) => (v == null ? null : Number(v)));

  const width = 1040;
  const height = 460;
  const margin = { top: 24, right: 84, bottom: 72, left: 88 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const xMin = Math.min(...x);
  const xMax = Math.max(...x);
  const yMin = 0;
  const yMax = Math.max(1, ...reg, ...fb);
  const ratioMax = Math.max(1, ...ratio.filter((v) => Number.isFinite(v)));

  const xToPx = (v) => margin.left + ((v - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const yToPx = (v) => margin.top + (1 - (v - yMin) / Math.max(1, yMax - yMin)) * plotH;
  const rToPx = (v) => margin.top + (1 - (v / Math.max(1, ratioMax))) * plotH;

  const regPoints = buildPolyline(x, reg, xToPx, yToPx);
  const fbPoints = buildPolyline(x, fb, xToPx, yToPx);
  const ratioPoints = x.map((v, i) => Number.isFinite(ratio[i]) ? `${xToPx(v)},${rToPx(ratio[i])}` : null).filter(Boolean).join(' ');

  const yTicks = roundTickValues(yMin, yMax, 6);
  const xTicks = roundTickValues(xMin, xMax, 6);
  const rTicks = roundTickValues(0, ratioMax, 5);

  const yTickSvg = yTicks.map((v) => {
    const py = yToPx(v);
    return `
      <line x1='${margin.left}' y1='${py}' x2='${width - margin.right}' y2='${py}' stroke='currentColor' opacity='0.16'/>
      <text x='${margin.left - 12}' y='${py + 5}' text-anchor='end' font-size='13' font-weight='600'>${shortNum(v)}</text>
    `;
  }).join('');

  const xTickSvg = xTicks.map((v) => {
    const px = xToPx(v);
    return `
      <line x1='${px}' y1='${margin.top}' x2='${px}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.12'/>
      <text x='${px}' y='${height - margin.bottom + 24}' text-anchor='middle' font-size='13' font-weight='600'>${Math.round(v).toLocaleString()}</text>
    `;
  }).join('');

  const rTickSvg = rTicks.map((v) => {
    const py = rToPx(v);
    return `<text x='${width - margin.right + 10}' y='${py + 5}' text-anchor='start' font-size='12' font-weight='600'>${v}</text>`;
  }).join('');

  const regArea = `${margin.left},${height - margin.bottom} ${regPoints} ${width - margin.right},${height - margin.bottom}`;
  const fbArea = `${margin.left},${height - margin.bottom} ${fbPoints} ${width - margin.right},${height - margin.bottom}`;

  root.innerHTML = `
    <div class='fig00a-panel'>
      <div class='fig00a-controls'>
        <label><input type='checkbox' id='fig00b-toggle-reg' checked/> registrations/bin</label>
        <label><input type='checkbox' id='fig00b-toggle-fb' checked/> feedback/bin</label>
        <label><input type='checkbox' id='fig00b-toggle-ratio' checked/> ratio (FB/REG)</label>
      </div>
      <div class='fig00a-wrap' style='position:relative'>
        <svg viewBox='0 0 ${width} ${height}' width='100%' height='auto' role='img' aria-label='Event intensity by block bins'>
          <defs>
            <linearGradient id='fig00b-grad-reg' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stop-color='#1d4ed8' stop-opacity='0.28'/>
              <stop offset='100%' stop-color='#1d4ed8' stop-opacity='0.02'/>
            </linearGradient>
            <linearGradient id='fig00b-grad-fb' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stop-color='#dc2626' stop-opacity='0.24'/>
              <stop offset='100%' stop-color='#dc2626' stop-opacity='0.02'/>
            </linearGradient>
            <filter id='fig00b-glow'><feGaussianBlur stdDeviation='2.2' result='blur'/><feMerge><feMergeNode in='blur'/><feMergeNode in='SourceGraphic'/></feMerge></filter>
          </defs>
          ${yTickSvg}
          ${xTickSvg}

          <line x1='${margin.left}' y1='${height - margin.bottom}' x2='${width - margin.right}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
          <line x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
          <line x1='${width - margin.right}' y1='${margin.top}' x2='${width - margin.right}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.45'/>

          <polygon id='fig00b-reg-area' points='${regArea}' fill='url(#fig00b-grad-reg)' />
          <polygon id='fig00b-fb-area' points='${fbArea}' fill='url(#fig00b-grad-fb)' />

          <polyline id='fig00b-reg-line' class='fig-line-anim' fill='none' stroke='#1d4ed8' stroke-width='2.8' filter='url(#fig00b-glow)' points='${regPoints}' />
          <polyline id='fig00b-fb-line' class='fig-line-anim' fill='none' stroke='#dc2626' stroke-width='2.8' filter='url(#fig00b-glow)' points='${fbPoints}' />
          <polyline id='fig00b-ratio-line' class='fig-line-anim' fill='none' stroke='#8a6a2d' stroke-width='2.5' points='${ratioPoints}' />

          <line id='fig00b-cross' x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0' stroke-dasharray='4 4'/>
          <rect id='fig00b-hitbox' x='${margin.left}' y='${margin.top}' width='${plotW}' height='${plotH}' fill='transparent' style='cursor:crosshair'/>

          ${rTickSvg}

          <text x='${width / 2}' y='${height - 16}' text-anchor='middle' font-size='16' font-weight='700'>Block number (bin centers)</text>
          <text x='24' y='${height / 2}' transform='rotate(-90 24 ${height / 2})' text-anchor='middle' font-size='16' font-weight='700'>Events per bin</text>
          <text x='${width - 14}' y='${height / 2}' transform='rotate(-90 ${width - 14} ${height / 2})' text-anchor='middle' font-size='14' font-weight='700'>Ratio (FB/REG)</text>

          <circle cx='${margin.left + 8}' cy='${margin.top + 8}' r='4' fill='#1d4ed8'></circle>
          <text x='${margin.left + 18}' y='${margin.top + 12}' font-size='12'>Registrations per bin</text>
          <circle cx='${margin.left + 190}' cy='${margin.top + 8}' r='4' fill='#dc2626'></circle>
          <text x='${margin.left + 200}' y='${margin.top + 12}' font-size='12'>Feedback per bin</text>
          <circle cx='${margin.left + 330}' cy='${margin.top + 8}' r='4' fill='#8a6a2d'></circle>
          <text x='${margin.left + 340}' y='${margin.top + 12}' font-size='12'>Ratio (FB/REG)</text>
        </svg>
        <div id='fig00b-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
      </div>
    </div>
  `;

  const wrap = root.querySelector('.fig00a-wrap');
  const hitbox = root.querySelector('#fig00b-hitbox');
  const cross = root.querySelector('#fig00b-cross');
  const tip = root.querySelector('#fig00b-tooltip');
  const regLine = root.querySelector('#fig00b-reg-line');
  const fbLine = root.querySelector('#fig00b-fb-line');
  const ratioLine = root.querySelector('#fig00b-ratio-line');
  const regAreaEl = root.querySelector('#fig00b-reg-area');
  const fbAreaEl = root.querySelector('#fig00b-fb-area');
  const regToggle = root.querySelector('#fig00b-toggle-reg');
  const fbToggle = root.querySelector('#fig00b-toggle-fb');
  const ratioToggle = root.querySelector('#fig00b-toggle-ratio');
  if (!wrap || !hitbox || !cross || !tip) return;

  const syncSeriesVisibility = () => {
    const regOn = regToggle ? regToggle.checked : true;
    const fbOn = fbToggle ? fbToggle.checked : true;
    const ratioOn = ratioToggle ? ratioToggle.checked : true;
    if (regLine) regLine.style.display = regOn ? 'block' : 'none';
    if (regAreaEl) regAreaEl.style.display = regOn ? 'block' : 'none';
    if (fbLine) fbLine.style.display = fbOn ? 'block' : 'none';
    if (fbAreaEl) fbAreaEl.style.display = fbOn ? 'block' : 'none';
    if (ratioLine) ratioLine.style.display = ratioOn ? 'block' : 'none';
  };
  if (regToggle) regToggle.addEventListener('change', syncSeriesVisibility);
  if (fbToggle) fbToggle.addEventListener('change', syncSeriesVisibility);
  if (ratioToggle) ratioToggle.addEventListener('change', syncSeriesVisibility);
  syncSeriesVisibility();

  const onMove = (ev) => {
    const bounds = wrap.getBoundingClientRect();
    const svgX = ((ev.clientX - bounds.left) / bounds.width) * width;
    const t = Math.max(0, Math.min(1, (svgX - margin.left) / plotW));
    const idx = Math.max(0, Math.min(x.length - 1, Math.round(t * (x.length - 1))));
    const px = xToPx(x[idx]);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('opacity', '0.7');

    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 230, Math.max(8, (px / width) * bounds.width + 10))}px`;
    tip.style.top = `${Math.max(8, (margin.top / height) * bounds.height + 10)}px`;
    const r = Number.isFinite(ratio[idx]) ? ratio[idx].toFixed(2) : 'n/a';
    tip.innerHTML = `Block <b>${x[idx].toLocaleString()}</b><br/>Reg/bin: <b>${reg[idx].toLocaleString()}</b><br/>Feedback/bin: <b>${fb[idx].toLocaleString()}</b><br/>Ratio: <b>${r}</b>`;
  };

  hitbox.addEventListener('mousemove', onMove);
  hitbox.addEventListener('mouseenter', onMove);
  hitbox.addEventListener('mouseleave', () => {
    cross.setAttribute('opacity', '0');
    tip.style.display = 'none';
  });
}

function renderFig07(fig){
  const root = document.getElementById('fig07-root');
  if (!root) return;
  const d = (fig?.dd || []).map(Number).filter((v) => Number.isFinite(v) && v >= 0);
  if (!d.length) { root.innerHTML = `<p>Figure data not available yet.</p>`; return; }

  const bins = 36;
  const xMax = Math.max(...d);
  const step = Math.max(1, Math.ceil(xMax / bins));
  const counts = Array.from({ length: bins }, () => 0);
  d.forEach((v) => { const i = Math.min(bins - 1, Math.floor(v / step)); counts[i] += 1; });
  const xs = counts.map((_, i) => i * step);

  const width = 1040, height = 420;
  const margin = { top: 24, right: 24, bottom: 64, left: 82 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const yMax = Math.max(...counts, 1);
  const xToPx = (v) => margin.left + (v / Math.max(1, xMax)) * plotW;
  const yToPx = (v) => margin.top + (1 - v / Math.max(1, yMax)) * plotH;

  const yTicks = roundTickValues(0, yMax, 6);
  const xTicks = roundTickValues(0, xMax, 6);

  const yTickSvg = yTicks.map((v) => `<line x1='${margin.left}' y1='${yToPx(v)}' x2='${width - margin.right}' y2='${yToPx(v)}' stroke='currentColor' opacity='0.16'/><text x='${margin.left - 12}' y='${yToPx(v) + 5}' text-anchor='end' font-size='13' font-weight='600'>${shortNum(v)}</text>`).join('');
  const xTickSvg = xTicks.map((v) => `<line x1='${xToPx(v)}' y1='${margin.top}' x2='${xToPx(v)}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.10'/><text x='${xToPx(v)}' y='${height - margin.bottom + 24}' text-anchor='middle' font-size='13' font-weight='600'>${Math.round(v).toLocaleString()}</text>`).join('');
  const barW = Math.max(3, plotW / bins - 2);
  const bars = counts.map((c, i) => {
    const x = margin.left + i * (plotW / bins);
    const y = yToPx(c);
    const h = margin.top + plotH - y;
    return `<rect x='${x}' y='${y}' width='${barW}' height='${h}' rx='2' fill='#1d4ed8' fill-opacity='0.78'/>`;
  }).join('');

  const q50 = Number(fig?.q50 || 0);
  const q50x = xToPx(q50);
  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${width} ${height}' width='100%' height='auto' role='img' aria-label='First feedback delay distribution'>
        ${yTickSvg}${xTickSvg}
        <line x1='${margin.left}' y1='${height - margin.bottom}' x2='${width - margin.right}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
        <line x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
        ${bars}
        <line x1='${q50x}' y1='${margin.top}' x2='${q50x}' y2='${height - margin.bottom}' stroke='#8a6a2d' stroke-width='2.2' stroke-dasharray='6 5'/>
        <line id='fig07-cross' x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0' stroke-dasharray='4 4'/>
        <rect id='fig07-hitbox' x='${margin.left}' y='${margin.top}' width='${plotW}' height='${plotH}' fill='transparent' style='cursor:crosshair'/>
        <text x='${Math.min(width - margin.right - 10, q50x + 8)}' y='${margin.top + 18}' font-size='12' font-weight='700' fill='#8a6a2d'>Median: ${Math.round(q50).toLocaleString()}</text>
        <text x='${width/2}' y='${height - 16}' text-anchor='middle' font-size='16' font-weight='700'>Delay from registration (blocks)</text>
        <text x='24' y='${height/2}' transform='rotate(-90 24 ${height/2})' text-anchor='middle' font-size='16' font-weight='700'>Number of agents</text>
      </svg>
      <div id='fig07-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const hitbox = root.querySelector('#fig07-hitbox');
  const cross = root.querySelector('#fig07-cross');
  const tip = root.querySelector('#fig07-tooltip');
  if (!wrap || !hitbox || !cross || !tip) return;

  const onMove = (ev) => {
    const bounds = wrap.getBoundingClientRect();
    const svgX = ((ev.clientX - bounds.left) / bounds.width) * width;
    const t = Math.max(0, Math.min(1, (svgX - margin.left) / plotW));
    const idx = Math.max(0, Math.min(bins - 1, Math.floor(t * bins)));
    const xStart = idx * step;
    const xEnd = (idx + 1) * step;
    const px = margin.left + (idx + 0.5) * (plotW / bins);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('opacity', '0.7');

    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 220, Math.max(8, (px / width) * bounds.width + 10))}px`;
    tip.style.top = `${Math.max(8, (margin.top / height) * bounds.height + 10)}px`;
    tip.innerHTML = `Delay bin <b>${Math.round(xStart).toLocaleString()}–${Math.round(xEnd).toLocaleString()}</b><br/>Agents: <b>${counts[idx].toLocaleString()}</b>`;
  };

  hitbox.addEventListener('mousemove', onMove);
  hitbox.addEventListener('mouseenter', onMove);
  hitbox.addEventListener('mouseleave', () => {
    cross.setAttribute('opacity', '0');
    tip.style.display = 'none';
  });
}

function renderTopClientsNetwork(fig){
  const root = document.getElementById('fig-top-clients-root');
  if (!root) return;
  const clients = [...(fig?.clients || [])].sort((a, b) => Number(b.totalFeedback || 0) - Number(a.totalFeedback || 0));
  const agents = [...(fig?.agents || [])].sort((a, b) => Number(b.totalFromTopClients || 0) - Number(a.totalFromTopClients || 0));
  const edges = fig?.edges || [];
  if (!clients.length || !agents.length || !edges.length) {
    root.innerHTML = `<p>Figure data not available yet.</p>`;
    return;
  }

  const width = 1120, height = 560;
  const margin = { top: 30, right: 80, bottom: 30, left: 80 };
  const leftX = margin.left + 80;
  const rightX = width - margin.right - 80;

  const maxClient = Math.max(1, ...clients.map((c) => Number(c.totalFeedback || 0)));
  const maxAgent = Math.max(1, ...agents.map((a) => Number(a.totalFromTopClients || 0)));
  const maxEdge = Math.max(1, ...edges.map((e) => Number(e.weight || 0)));

  const clientY = new Map();
  clients.forEach((c, i) => clientY.set(c.id, margin.top + ((i + 0.5) * (height - margin.top - margin.bottom)) / clients.length));
  const agentY = new Map();
  agents.forEach((a, i) => agentY.set(a.id, margin.top + ((i + 0.5) * (height - margin.top - margin.bottom)) / agents.length));

  const edgeSvg = edges.map((e) => {
    const y1 = clientY.get(e.clientId), y2 = agentY.get(e.agentId);
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return '';
    const w = 0.8 + 7 * (Number(e.weight || 0) / maxEdge);
    return `<path class='tc-edge' data-client='${e.clientId}' data-agent='${e.agentId}' data-weight='${Number(e.weight || 0)}' d='M ${leftX + 12} ${y1} C ${leftX + 220} ${y1}, ${rightX - 220} ${y2}, ${rightX - 12} ${y2}' stroke='rgba(79,70,229,0.35)' stroke-width='${w.toFixed(2)}' fill='none'><title>${e.clientId} → ${e.agentId} · ${Number(e.weight || 0)} events</title></path>`;
  }).join('');

  const clientSvg = clients.map((c, i) => {
    const y = clientY.get(c.id);
    const r = 5 + 11 * (Number(c.totalFeedback || 0) / maxClient);
    return `<circle class='tc-client' data-id='${c.id}' data-total='${Number(c.totalFeedback || 0)}' cx='${leftX}' cy='${y}' r='${r.toFixed(2)}' fill='#7c3aed'><title>${c.id} · total feedback ${Number(c.totalFeedback || 0)}</title></circle><text x='${leftX - 14}' y='${y + 4}' text-anchor='end' font-size='12' font-weight='700'>#${i + 1} ${c.label}</text>`;
  }).join('');

  const agentSvg = agents.map((a, i) => {
    const y = agentY.get(a.id);
    const r = 4 + 9 * (Number(a.totalFromTopClients || 0) / maxAgent);
    return `<circle class='tc-agent' data-id='${a.id}' data-total='${Number(a.totalFromTopClients || 0)}' cx='${rightX}' cy='${y}' r='${r.toFixed(2)}' fill='#2563eb'><title>Agent ${a.id} · events from top clients ${Number(a.totalFromTopClients || 0)}</title></circle><text x='${rightX + 14}' y='${y + 4}' text-anchor='start' font-size='12' font-weight='700'>#${i + 1} ${a.label}</text>`;
  }).join('');

  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${width} ${height}' width='100%' height='auto' role='img' aria-label='Top clients connected to agents network'>
        <text x='${leftX}' y='18' text-anchor='middle' font-size='13' font-weight='800' fill='#5b21b6'>Top clients</text>
        <text x='${rightX}' y='18' text-anchor='middle' font-size='13' font-weight='800' fill='#1d4ed8'>Agents reached</text>
        ${edgeSvg}
        ${clientSvg}
        ${agentSvg}
      </svg>
      <div id='tc-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const tip = root.querySelector('#tc-tooltip');
  if (!wrap || !tip) return;

  const showTip = (ev, html) => {
    const bounds = wrap.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 260, Math.max(8, ev.clientX - bounds.left + 12))}px`;
    tip.style.top = `${Math.min(bounds.height - 90, Math.max(8, ev.clientY - bounds.top + 12))}px`;
    tip.innerHTML = html;
  };
  const hideTip = () => { tip.style.display = 'none'; };

  root.querySelectorAll('.tc-edge').forEach((el) => {
    el.addEventListener('mousemove', (ev) => showTip(ev, `Link <b>${el.getAttribute('data-client')}</b> → <b>${el.getAttribute('data-agent')}</b><br/>Events: <b>${Number(el.getAttribute('data-weight') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseenter', (ev) => showTip(ev, `Link <b>${el.getAttribute('data-client')}</b> → <b>${el.getAttribute('data-agent')}</b><br/>Events: <b>${Number(el.getAttribute('data-weight') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseleave', hideTip);
  });
  root.querySelectorAll('.tc-client').forEach((el) => {
    el.addEventListener('mousemove', (ev) => showTip(ev, `Top client <b>${el.getAttribute('data-id')}</b><br/>Total feedback: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseenter', (ev) => showTip(ev, `Top client <b>${el.getAttribute('data-id')}</b><br/>Total feedback: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseleave', hideTip);
  });
  root.querySelectorAll('.tc-agent').forEach((el) => {
    el.addEventListener('mousemove', (ev) => showTip(ev, `Agent <b>${el.getAttribute('data-id')}</b><br/>Events from top clients: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseenter', (ev) => showTip(ev, `Agent <b>${el.getAttribute('data-id')}</b><br/>Events from top clients: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseleave', hideTip);
  });
}

function renderTopAgentsNetwork(fig){
  const root = document.getElementById('fig-top-agents-root');
  if (!root) return;
  const agents = [...(fig?.agents || [])].sort((a, b) => Number(b.totalFeedback || 0) - Number(a.totalFeedback || 0));
  const clients = [...(fig?.clients || [])].sort((a, b) => Number(b.totalFromTopAgents || 0) - Number(a.totalFromTopAgents || 0));
  const edges = fig?.edges || [];
  if (!agents.length || !clients.length || !edges.length) {
    root.innerHTML = `<p>Figure data not available yet.</p>`;
    return;
  }

  const width = 1120, height = 560;
  const margin = { top: 30, right: 80, bottom: 30, left: 80 };
  const leftX = margin.left + 80;
  const rightX = width - margin.right - 80;

  const maxAgent = Math.max(1, ...agents.map((a) => Number(a.totalFeedback || 0)));
  const maxClient = Math.max(1, ...clients.map((c) => Number(c.totalFromTopAgents || 0)));
  const maxEdge = Math.max(1, ...edges.map((e) => Number(e.weight || 0)));

  const agentY = new Map();
  agents.forEach((a, i) => agentY.set(a.id, margin.top + ((i + 0.5) * (height - margin.top - margin.bottom)) / agents.length));
  const clientY = new Map();
  clients.forEach((c, i) => clientY.set(c.id, margin.top + ((i + 0.5) * (height - margin.top - margin.bottom)) / clients.length));

  const edgeSvg = edges.map((e) => {
    const y1 = agentY.get(e.agentId), y2 = clientY.get(e.clientId);
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return '';
    const w = 0.8 + 7 * (Number(e.weight || 0) / maxEdge);
    return `<path class='ta-edge' data-agent='${e.agentId}' data-client='${e.clientId}' data-weight='${Number(e.weight || 0)}' d='M ${leftX + 12} ${y1} C ${leftX + 220} ${y1}, ${rightX - 220} ${y2}, ${rightX - 12} ${y2}' stroke='rgba(37,99,235,0.35)' stroke-width='${w.toFixed(2)}' fill='none'></path>`;
  }).join('');

  const agentSvg = agents.map((a, i) => {
    const y = agentY.get(a.id);
    const r = 5 + 11 * (Number(a.totalFeedback || 0) / maxAgent);
    return `<circle class='ta-agent' data-id='${a.id}' data-total='${Number(a.totalFeedback || 0)}' cx='${leftX}' cy='${y}' r='${r.toFixed(2)}' fill='#2563eb'></circle><text x='${leftX - 14}' y='${y + 4}' text-anchor='end' font-size='12' font-weight='700'>#${i + 1} ${a.label}</text>`;
  }).join('');

  const clientSvg = clients.map((c, i) => {
    const y = clientY.get(c.id);
    const r = 4 + 9 * (Number(c.totalFromTopAgents || 0) / maxClient);
    return `<circle class='ta-client' data-id='${c.id}' data-total='${Number(c.totalFromTopAgents || 0)}' cx='${rightX}' cy='${y}' r='${r.toFixed(2)}' fill='#7c3aed'></circle><text x='${rightX + 14}' y='${y + 4}' text-anchor='start' font-size='12' font-weight='700'>#${i + 1} ${c.label}</text>`;
  }).join('');

  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${width} ${height}' width='100%' height='auto' role='img' aria-label='Top agents connected to clients network'>
        <text x='${leftX}' y='18' text-anchor='middle' font-size='13' font-weight='800' fill='#1d4ed8'>Top agents</text>
        <text x='${rightX}' y='18' text-anchor='middle' font-size='13' font-weight='800' fill='#5b21b6'>Clients reached</text>
        ${edgeSvg}
        ${agentSvg}
        ${clientSvg}
      </svg>
      <div id='ta-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const tip = root.querySelector('#ta-tooltip');
  if (!wrap || !tip) return;

  const showTip = (ev, html) => {
    const bounds = wrap.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 260, Math.max(8, ev.clientX - bounds.left + 12))}px`;
    tip.style.top = `${Math.min(bounds.height - 90, Math.max(8, ev.clientY - bounds.top + 12))}px`;
    tip.innerHTML = html;
  };
  const hideTip = () => { tip.style.display = 'none'; };

  root.querySelectorAll('.ta-edge').forEach((el) => {
    el.addEventListener('mousemove', (ev) => showTip(ev, `Link <b>${el.getAttribute('data-agent')}</b> → <b>${el.getAttribute('data-client')}</b><br/>Events: <b>${Number(el.getAttribute('data-weight') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseenter', (ev) => showTip(ev, `Link <b>${el.getAttribute('data-agent')}</b> → <b>${el.getAttribute('data-client')}</b><br/>Events: <b>${Number(el.getAttribute('data-weight') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseleave', hideTip);
  });
  root.querySelectorAll('.ta-agent').forEach((el) => {
    el.addEventListener('mousemove', (ev) => showTip(ev, `Top agent <b>${el.getAttribute('data-id')}</b><br/>Total feedback: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseenter', (ev) => showTip(ev, `Top agent <b>${el.getAttribute('data-id')}</b><br/>Total feedback: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseleave', hideTip);
  });
  root.querySelectorAll('.ta-client').forEach((el) => {
    el.addEventListener('mousemove', (ev) => showTip(ev, `Client <b>${el.getAttribute('data-id')}</b><br/>Events from top agents: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseenter', (ev) => showTip(ev, `Client <b>${el.getAttribute('data-id')}</b><br/>Events from top agents: <b>${Number(el.getAttribute('data-total') || 0).toLocaleString()}</b>`));
    el.addEventListener('mouseleave', hideTip);
  });
}

function renderFig08(fig){
  const root = document.getElementById('fig08-root');
  if (!root) return;
  const x = (fig?.bin_start_delta_blocks || []).map(Number);
  const y = (fig?.mean_feedback_per_active_agent || []).map(Number);
  const n = (fig?.active_agents_in_bin || []).map(Number);
  if (!x.length || !y.length) { root.innerHTML = `<p>Figure data not available yet.</p>`; return; }

  const width = 1040, height = 450;
  const margin = { top: 24, right: 96, bottom: 70, left: 88 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xMin = Math.min(...x), xMax = Math.max(...x);
  const yMax = Math.max(1, ...y), nMax = Math.max(1, ...n);

  const xToPx = (v) => margin.left + ((v - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const yToPx = (v) => margin.top + (1 - v / yMax) * plotH;
  const nToPx = (v) => margin.top + (1 - v / nMax) * plotH;

  const yTicks = roundTickValues(0, yMax, 6);
  const xTicks = roundTickValues(xMin, xMax, 6);
  const nTicks = roundTickValues(0, nMax, 5);

  const yTickSvg = yTicks.map((v) => `<line x1='${margin.left}' y1='${yToPx(v)}' x2='${width - margin.right}' y2='${yToPx(v)}' stroke='currentColor' opacity='0.16'/><text x='${margin.left - 12}' y='${yToPx(v) + 5}' text-anchor='end' font-size='13' font-weight='600'>${v.toFixed(1)}</text>`).join('');
  const xTickSvg = xTicks.map((v) => `<line x1='${xToPx(v)}' y1='${margin.top}' x2='${xToPx(v)}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.10'/><text x='${xToPx(v)}' y='${height - margin.bottom + 24}' text-anchor='middle' font-size='13' font-weight='600'>${Math.round(v).toLocaleString()}</text>`).join('');
  const nTickSvg = nTicks.map((v) => `<text x='${width - margin.right + 10}' y='${nToPx(v) + 5}' font-size='12' font-weight='600'>${shortNum(v)}</text>`).join('');

  const binW = x.length > 1 ? Math.abs(xToPx(x[1]) - xToPx(x[0])) : 10;
  const bars = x.map((v, i) => {
    const xx = xToPx(v) - Math.max(2, binW * 0.4);
    const yy = nToPx(n[i]);
    return `<rect x='${xx}' y='${yy}' width='${Math.max(3, binW * 0.8)}' height='${margin.top + plotH - yy}' fill='#e2c379' fill-opacity='0.36'/>`;
  }).join('');

  const line = buildPolyline(x, y, xToPx, yToPx);

  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-controls'>
      <label><input type='checkbox' id='fig08-toggle-bars' checked/> active agents (bars)</label>
      <label><input type='checkbox' id='fig08-toggle-line' checked/> mean feedback (line)</label>
    </div>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${width} ${height}' width='100%' height='auto' role='img' aria-label='Mean feedback curve by age bins'>
        ${yTickSvg}${xTickSvg}
        <line x1='${margin.left}' y1='${height - margin.bottom}' x2='${width - margin.right}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
        <line x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.65'/>
        <line x1='${width - margin.right}' y1='${margin.top}' x2='${width - margin.right}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.45'/>
        <g id='fig08-bars'>${bars}</g>
        <polyline id='fig08-line' class='fig-line-anim' fill='none' stroke='#2A9D8F' stroke-width='2.8' points='${line}'/>
        <line id='fig08-cross' x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0' stroke-dasharray='4 4'/>
        <rect id='fig08-hitbox' x='${margin.left}' y='${margin.top}' width='${plotW}' height='${plotH}' fill='transparent' style='cursor:crosshair'/>
        ${nTickSvg}
        <text x='${width/2}' y='${height - 16}' text-anchor='middle' font-size='16' font-weight='700'>Delta blocks since registration</text>
        <text x='24' y='${height/2}' transform='rotate(-90 24 ${height/2})' text-anchor='middle' font-size='16' font-weight='700'>Mean feedback per active agent</text>
        <text x='${width - 14}' y='${height/2}' transform='rotate(-90 ${width - 14} ${height/2})' text-anchor='middle' font-size='14' font-weight='700'>Active agents</text>
      </svg>
      <div id='fig08-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const hitbox = root.querySelector('#fig08-hitbox');
  const cross = root.querySelector('#fig08-cross');
  const tip = root.querySelector('#fig08-tooltip');
  const barsEl = root.querySelector('#fig08-bars');
  const lineEl = root.querySelector('#fig08-line');
  const barsToggle = root.querySelector('#fig08-toggle-bars');
  const lineToggle = root.querySelector('#fig08-toggle-line');
  if (!wrap || !hitbox || !cross || !tip) return;

  const syncVisibility = () => {
    if (barsEl) barsEl.style.display = barsToggle?.checked === false ? 'none' : 'block';
    if (lineEl) lineEl.style.display = lineToggle?.checked === false ? 'none' : 'block';
  };
  barsToggle?.addEventListener('change', syncVisibility);
  lineToggle?.addEventListener('change', syncVisibility);
  syncVisibility();

  const onMove = (ev) => {
    const bounds = wrap.getBoundingClientRect();
    const svgX = ((ev.clientX - bounds.left) / bounds.width) * width;
    const t = Math.max(0, Math.min(1, (svgX - margin.left) / plotW));
    const idx = Math.max(0, Math.min(x.length - 1, Math.round(t * (x.length - 1))));
    const px = xToPx(x[idx]);
    cross.setAttribute('x1', px);
    cross.setAttribute('x2', px);
    cross.setAttribute('opacity', '0.7');

    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 240, Math.max(8, (px / width) * bounds.width + 10))}px`;
    tip.style.top = `${Math.max(8, (margin.top / height) * bounds.height + 10)}px`;
    tip.innerHTML = `Delta blocks <b>${Math.round(x[idx]).toLocaleString()}</b><br/>Mean feedback: <b>${Number(y[idx] || 0).toFixed(2)}</b><br/>Active agents: <b>${Math.round(n[idx] || 0).toLocaleString()}</b>`;
  };

  hitbox.addEventListener('mousemove', onMove);
  hitbox.addEventListener('mouseenter', onMove);
  hitbox.addEventListener('mouseleave', () => {
    cross.setAttribute('opacity', '0');
    tip.style.display = 'none';
  });
}

function renderFigTag07(fig){
  const root = document.getElementById('fig-tag07-root');
  if (!root) return;

  const rows = ['empty', 'unclassified', 'work_area', 'adjectives', 'characteristic'];
  const rowLabel = {
    empty: 'empty',
    unclassified: 'unclassified',
    work_area: 'work area',
    adjectives: 'adjectives',
    characteristic: 'characteristic',
  };

  const nBins = Math.max(1, Number(fig?.matrix?.n_bins || 25));
  let matrix = rows.map(() => Array.from({ length: nBins }, () => 0));

  const sourceRows = Array.isArray(fig?.matrix?.rows) ? fig.matrix.rows.map((x)=>String(x||'').toLowerCase()) : null;
  const sourceVals = Array.isArray(fig?.matrix?.values) ? fig.matrix.values : null;
  if (sourceRows && sourceVals && sourceRows.length && sourceVals.length) {
    const rowIdx = new Map(sourceRows.map((r,i)=>[r,i]));
    matrix = rows.map((rk) => {
      const i = rowIdx.get(rk);
      const arr = i === undefined ? [] : (Array.isArray(sourceVals[i]) ? sourceVals[i] : []);
      return Array.from({ length: nBins }, (_,b)=> Math.max(0, Number(arr[b] || 0)));
    });
  }

  const colTotals = Array.from({ length: nBins }, (_, bi) => matrix.reduce((s, row) => s + Number(row[bi] || 0), 0));
  const shareMatrix = matrix.map((row) => row.map((v, bi) => {
    const d = Number(colTotals[bi] || 0);
    return d > 0 ? Number(v || 0) / d : 0;
  }));

  const W = 1240, H = 520;
  const hm = { x: 210, y: 80, w: 900, h: 320 };
  const cw = hm.w / nBins;
  const ch = hm.h / rows.length;

  const colorAt = (share) => {
    // yellow -> dark blue, normalized 0..1 (within-bin share)
    const t = Math.max(0, Math.min(1, Number(share || 0)));
    const c0 = [250, 204, 21];
    const c1 = [30, 58, 138];
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
    return `rgb(${r},${g},${b})`;
  };

  const cells = matrix.map((row, ri) => row.map((v, bi) => {
    const x = hm.x + bi * cw;
    const y = hm.y + ri * ch;
    const share = shareMatrix[ri]?.[bi] || 0;
    return `<rect class='t7-cell' data-row='${rowLabel[rows[ri]]}' data-bin='${bi+1}' data-val='${v}' data-share='${share.toFixed(4)}' x='${x}' y='${y}' width='${cw}' height='${ch}' rx='0' fill='${colorAt(share)}' stroke='rgba(255,255,255,0)' stroke-width='0'/>`;
  }).join('')).join('');

  const xTicks = [1,5,10,15,20,25].map((q)=>`<text x='${hm.x + (q-0.5)*cw}' y='${hm.y + hm.h + 26}' text-anchor='middle' font-size='13' font-weight='800'>Q${q}</text>`).join('');
  const yTicks = rows.map((rk,i)=>`<text x='${hm.x-12}' y='${hm.y + i*ch + ch/2 + 5}' text-anchor='end' font-size='15' font-weight='900'>${rowLabel[rk]}</text>`).join('');

  const cb = { x: hm.x + hm.w + 30, y: hm.y, w: 26, h: hm.h };
  const gradId = 't7-grad';
  const cTicks = [0,0.25,0.5,0.75,1].map((u)=>({u,v:u.toFixed(2)}));
  const cTickEls = cTicks.map(({u,v})=>`<line x1='${cb.x+cb.w+4}' y1='${cb.y + cb.h*(1-u)}' x2='${cb.x+cb.w+12}' y2='${cb.y + cb.h*(1-u)}' stroke='currentColor' opacity='0.7'/><text x='${cb.x+cb.w+16}' y='${cb.y + cb.h*(1-u)+4}' font-size='12' font-weight='800'>${v}</text>`).join('');

  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${W} ${H}' width='100%' height='auto' role='img' aria-label='Tag1 heatmap by quantiles'>
        <defs><linearGradient id='${gradId}' x1='0' y1='1' x2='0' y2='0'><stop offset='0%' stop-color='${colorAt(0)}'/><stop offset='100%' stop-color='${colorAt(1)}'/></linearGradient><filter id='t7-glow'><feDropShadow dx='0' dy='1.2' stdDeviation='1.2' flood-color='rgba(15,23,42,0.24)'/></filter></defs>
        <text x='${hm.x}' y='42' font-size='20' font-weight='900'>Tag1 category evolution over time (25 quantile bins)</text>
        <text x='${hm.x}' y='62' font-size='13.5' font-weight='700' opacity='0.8'>Color = within-bin share (normalized 0..1)</text>
        ${cells}
        ${xTicks}
        ${yTicks}
        <rect x='${cb.x}' y='${cb.y}' width='${cb.w}' height='${cb.h}' fill='url(#${gradId})' stroke='rgba(15,23,42,0.2)' filter='url(#t7-glow)'/><text x='${cb.x + cb.w/2}' y='${cb.y-10}' text-anchor='middle' font-size='12' font-weight='800'>within-bin share</text>
        ${cTickEls}
      </svg>
      <div id='fig-tag07-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const tip = root.querySelector('#fig-tag07-tooltip');
  if (!wrap || !tip) return;
  root.querySelectorAll('.t7-cell').forEach((el)=>{
    const show = (ev) => {
      root.querySelectorAll('.t7-cell').forEach((x)=>{ x.setAttribute('stroke', x===el ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0)'); x.setAttribute('stroke-width', x===el ? '1.3' : '0'); });
      const b = wrap.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = `${Math.min(b.width - 280, Math.max(8, ev.clientX - b.left + 10))}px`;
      tip.style.top = `${Math.min(b.height - 96, Math.max(8, ev.clientY - b.top + 10))}px`;
      tip.innerHTML = `<b>${el.getAttribute('data-row')}</b><br/>Quantile: <b>${el.getAttribute('data-bin')}</b><br/>Count: <b>${Number(el.getAttribute('data-val')||0).toLocaleString()}</b><br/>Share in bin: <b>${(100*Number(el.getAttribute('data-share')||0)).toFixed(1)}%</b>`;
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('mousemove', show);
    el.addEventListener('mouseleave', ()=>{ root.querySelectorAll('.t7-cell').forEach((x)=>{ x.setAttribute('stroke','rgba(255,255,255,0)'); x.setAttribute('stroke-width','0'); }); tip.style.display='none'; });
  });
}

function renderFigTag08(fig){
  const root = document.getElementById('fig-tag08-root');
  if (!root) return;
  const rows = (fig?.macroareas || [])
    .map((r) => ({ label: String(r.macroarea || 'Unknown'), value: Number(r.frequency || 0) }))
    .filter((r) => r.value > 0);

  const emptyCount = Number(fig?.total_empty || 0);
  if (emptyCount > 0) rows.push({ label: 'Empty tag1', value: emptyCount });

  rows.sort((a,b) => b.value - a.value);
  const total = Math.max(1, Number(fig?.total_rows || rows.reduce((s,r)=>s+r.value,0)));
  if (!rows.length) { root.innerHTML = `<p>Figure data not available yet.</p>`; return; }

  const W = 1040, H = 440;
  const cx = 280, cy = 220, rOuter = 156, rInner = 76;
  const palette = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#14b8a6','#64748b'];

  const arcPath = (a0, a1) => {
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = cx + rOuter * Math.cos(a0), y0 = cy + rOuter * Math.sin(a0);
    const x1 = cx + rOuter * Math.cos(a1), y1 = cy + rOuter * Math.sin(a1);
    const x2 = cx + rInner * Math.cos(a1), y2 = cy + rInner * Math.sin(a1);
    const x3 = cx + rInner * Math.cos(a0), y3 = cy + rInner * Math.sin(a0);
    return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
  };

  let acc = -Math.PI/2;
  const slices = rows.map((r, i) => {
    const a0 = acc;
    const da = (r.value / total) * Math.PI * 2;
    const a1 = a0 + da;
    acc = a1;
    const mid = (a0 + a1) / 2;
    const ox = 12 * Math.cos(mid), oy = 12 * Math.sin(mid);
    return `<path class='t8-slice' data-idx='${i}' data-label='${r.label.replace(/'/g, '&apos;')}' data-value='${r.value}' data-share='${(100*r.value/total).toFixed(2)}' data-ox='${ox.toFixed(2)}' data-oy='${oy.toFixed(2)}' d='${arcPath(a0,a1)}' fill='${palette[i % palette.length]}' opacity='0.90'/>`;
  }).join('');

  const legend = rows.map((r,i)=>`<g class='t8-item' data-idx='${i}'><rect x='560' y='${56+i*42}' width='18' height='18' rx='4' fill='${palette[i % palette.length]}'/><text x='588' y='${71+i*42}' font-size='16' font-weight='800'>${r.label}</text><text x='1012' y='${71+i*42}' text-anchor='end' font-size='15' font-weight='800'>${r.value.toLocaleString()} · ${(100*r.value/total).toFixed(1)}%</text></g>`).join('');

  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${W} ${H}' width='100%' height='auto' role='img' aria-label='Tag1 composition pie chart'>
        ${slices}
        <circle cx='${cx}' cy='${cy}' r='${rInner-2}' fill='var(--panel, #fff)' opacity='0.96'/>
        <text x='${cx}' y='${cy-6}' text-anchor='middle' font-size='16' font-weight='800' opacity='0.85'>Tag1</text>
        <text x='${cx}' y='${cy+18}' text-anchor='middle' font-size='18' font-weight='900'>n=${total.toLocaleString()}</text>
        ${legend}
      </svg>
      <div id='fig-tag08-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const tip = root.querySelector('#fig-tag08-tooltip');
  if (!wrap || !tip) return;

  const setActive = (idx, ev, srcEl) => {
    root.querySelectorAll('.t8-slice').forEach((el) => {
      const on = Number(el.getAttribute('data-idx')) === idx;
      const ox = on ? Number(el.getAttribute('data-ox') || 0) : 0;
      const oy = on ? Number(el.getAttribute('data-oy') || 0) : 0;
      el.setAttribute('transform', `translate(${ox} ${oy})`);
      el.setAttribute('opacity', on ? '1' : '0.35');
      el.setAttribute('stroke', on ? 'white' : 'none');
      el.setAttribute('stroke-width', on ? '2.5' : '0');
    });
    const bounds = wrap.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left = `${Math.min(bounds.width - 260, Math.max(8, ev.clientX - bounds.left + 10))}px`;
    tip.style.top = `${Math.min(bounds.height - 88, Math.max(8, ev.clientY - bounds.top + 10))}px`;
    tip.innerHTML = `<b>${srcEl.getAttribute('data-label')}</b><br/>Frequency: <b>${Number(srcEl.getAttribute('data-value') || 0).toLocaleString()}</b><br/>Share: <b>${Number(srcEl.getAttribute('data-share') || 0).toFixed(1)}%</b>`;
  };
  const clear = () => {
    root.querySelectorAll('.t8-slice').forEach((el) => {
      el.setAttribute('transform', 'translate(0 0)');
      el.setAttribute('opacity', '0.90');
      el.setAttribute('stroke', 'none');
    });
    tip.style.display = 'none';
  };

  root.querySelectorAll('.t8-slice').forEach((el) => {
    const idx = Number(el.getAttribute('data-idx'));
    const on = (ev) => setActive(idx, ev, el);
    el.addEventListener('mousemove', on);
    el.addEventListener('mouseenter', on);
    el.addEventListener('mouseleave', clear);
  });
  root.querySelectorAll('.t8-item').forEach((el) => {
    const idx = Number(el.getAttribute('data-idx'));
    const slice = root.querySelector(`.t8-slice[data-idx='${idx}']`);
    if (!slice) return;
    const on = (ev) => setActive(idx, ev, slice);
    el.addEventListener('mousemove', on);
    el.addEventListener('mouseenter', on);
    el.addEventListener('mouseleave', clear);
  });
}

function renderFigTag09(fig){
  const root = document.getElementById('fig-tag09-root');
  if (!root) return;
  const groups = [
    { key:'characteristic', title:'Characteristic to evaluate', color:'#2563eb' },
    { key:'adjectives', title:'Adjectives only', color:'#10b981' },
    { key:'work_area', title:'Work area', color:'#f59e0b' },
    { key:'unclassified', title:'Unclassified', color:'#6b7280' },
  ];

  const W = 1120, H = 600;
  const panelW = 530, panelH = 268;
  const offset = [{x:20,y:20},{x:570,y:20},{x:20,y:310},{x:570,y:310}];

  const blocks = groups.map((g,gi) => {
    const items = (fig?.[g.key] || []).slice(0,8).map((x) => ({ tag: String(x.tag || ''), value: Number(x.frequency || 0) }));
    const maxV = Math.max(1, ...items.map((x) => x.value));
    const o = offset[gi];
    const y0 = o.y + 48;
    const x0 = o.x + 200;
    const x1 = o.x + panelW - 24;
    const bw = x1 - x0;
    const ticks = roundTickValues(0, maxV, 4);
    const grid = ticks.map((t) => {
      const xx = x0 + (Number(t || 0) / maxV) * bw;
      return `<line x1='${xx}' y1='${y0-16}' x2='${xx}' y2='${o.y+panelH-18}' stroke='currentColor' opacity='0.08'/><text x='${xx}' y='${o.y+panelH-6}' text-anchor='middle' font-size='10' font-weight='600'>${Math.round(t)}</text>`;
    }).join('');
    const rows = items.map((x,i) => {
      const yy = y0 + i*24;
      const w = Math.max(2, bw * x.value / maxV);
      return `<text x='${x0-8}' y='${yy+11}' text-anchor='end' font-size='11' font-weight='600'>${x.tag}</text><rect class='t9-bar' data-group='${g.title.replace(/'/g, '&apos;')}' data-tag='${x.tag.replace(/'/g, '&apos;')}' data-value='${x.value}' x='${x0}' y='${yy}' width='${w}' height='14' rx='4' fill='${g.color}' opacity='0.82'/><text x='${x0+w+6}' y='${yy+11}' font-size='10.5' font-weight='700'>${x.value}</text>`;
    }).join('');
    return `<rect x='${o.x}' y='${o.y}' width='${panelW}' height='${panelH}' rx='10' fill='none' stroke='currentColor' opacity='0.15'/><text x='${o.x+10}' y='${o.y+20}' font-size='13' font-weight='800'>${g.title}</text>${grid}${rows}`;
  }).join('');

  root.innerHTML = `<div class='fig00a-panel'>
    <div class='fig00a-wrap' style='position:relative'>
      <svg viewBox='0 0 ${W} ${H}' width='100%' height='auto' role='img' aria-label='Top terms by tag category'>
        ${blocks}
      </svg>
      <div id='fig-tag09-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
    </div>
  </div>`;

  const wrap = root.querySelector('.fig00a-wrap');
  const tip = root.querySelector('#fig-tag09-tooltip');
  if (!wrap || !tip) return;

  root.querySelectorAll('.t9-bar').forEach((el) => {
    const show = (ev) => {
      root.querySelectorAll('.t9-bar').forEach((b) => b.setAttribute('opacity', b === el ? '1' : '0.28'));
      const bounds = wrap.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.left = `${Math.min(bounds.width - 260, Math.max(8, ev.clientX - bounds.left + 10))}px`;
      tip.style.top = `${Math.min(bounds.height - 88, Math.max(8, ev.clientY - bounds.top + 10))}px`;
      tip.innerHTML = `<b>${el.getAttribute('data-group')}</b><br/>Tag: <b>${el.getAttribute('data-tag')}</b><br/>Frequency: <b>${Number(el.getAttribute('data-value') || 0).toLocaleString()}</b>`;
    };
    el.addEventListener('mousemove', show);
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', () => {
      root.querySelectorAll('.t9-bar').forEach((b) => b.setAttribute('opacity', '0.82'));
      tip.style.display = 'none';
    });
  });
}


window.renderAnalytics = async function renderAnalytics(){ 
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const data = await loadSnapshot();
  const tagMap = await loadTagMap();
  const fig00a = await loadFig00a();
  const fig00b = await loadFig00b();
  const fig07 = await loadFig07();
  const fig08 = await loadFig08();
  const figTag07 = await loadFigTag07();
  const figTag08 = await loadFigTag08();
  const figTag09 = await loadFigTag09();
  const figTopClients = await loadTopClientsNetwork();
  const figTopAgents = await loadTopAgentsNetwork();
  const agents = data.agents || [];
  const enriched = agents.map((a) => ({ ...a, _metrics: deriveAgentMetrics(a, tagMap) }));

  const feedbackCounts = enriched.map((a) => Number(a.feedbackCount || 0));
  const scoreMain = enriched.map((a) => Number(a._metrics.scoreMain || 0)).filter((v) => Number.isFinite(v) && v > 0);
  const active = enriched.filter((a) => deriveStatus(a) === 'Active').length;
  const warm = enriched.filter((a) => deriveStatus(a) === 'Warm').length;
  const inactive = Math.max(0, enriched.length - active - warm);

  const topByFeedback = [...enriched]
    .sort((a,b) => (b.feedbackCount || 0) - (a.feedbackCount || 0))
    .slice(0, 8);


  const avgScore = scoreMain.length ? avg(scoreMain).toFixed(2) : '0.00';
  const p90Feedback = feedbackCounts.length
    ? [...feedbackCounts].sort((a,b)=>a-b)[Math.floor(0.9 * (feedbackCounts.length - 1))]
    : 0;
  const giniFeedback = giniFromArray(feedbackCounts).toFixed(3);

  document.getElementById('analytics-kpis').innerHTML = `
    <div class='card'><h3>Agents indexed</h3><div class='kpi'>${enriched.length}</div></div>
    <div class='card'><h3>Avg Main Score</h3><div class='kpi'>${avgScore}</div></div>
    <div class='card'><h3>Feedback concentration (Gini)</h3><div class='kpi'>${giniFeedback}</div></div>
    <div class='card'><h3>P90 feedback / agent</h3><div class='kpi'>${p90Feedback}</div></div>`;

  document.getElementById('analytics-status').innerHTML = `
    <div class='card'><h3>Activity status mix</h3>
      <p>Active: <b>${active}</b> · Warm: <b>${warm}</b> · Inactive: <b>${inactive}</b></p>
      <p class='meta-row'>Snapshot generated: ${fmtDate(data.generatedAt)} · Block ${data.blockNumber}</p>
    </div>`;

  const maxFb = Math.max(1, ...topByFeedback.map((a) => Number(a.feedbackCount || 0)));
  document.getElementById('analytics-top-feedback').innerHTML = `
    <div class='agent-tiles'>
      ${topByFeedback.map((a) => {
        const fb = Number(a.feedbackCount || 0);
        const w = Math.max(6, Math.round((fb / maxFb) * 100));
        const img = pickAgentImage(a);
        return `<a class='agent-tile' href='./agent.html?id=${encodeURIComponent(a.agentId)}'>
          <img class='agent-avatar' src='${img}' alt='${a.name || a.agentId}' loading='lazy' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
          <div>
            <div class='agent-tile-title'>${a.name || ('#' + displayAgentId(a.agentId))}</div>
            <div class='agent-tile-sub'>${fb.toLocaleString()} feedback</div>
            <div class='mini-bar'><span style='width:${w}%'></span></div>
          </div>
        </a>`;
      }).join('')}
    </div>`;

  renderFig00a(fig00a);
  renderFig00b(fig00b);
  renderFig07(fig07);
  renderFig08(fig08);
  renderTopClientsNetwork(figTopClients);
  renderTopAgentsNetwork(figTopAgents);
  renderFigTag07(figTag07);
  renderFigTag08(figTag08);
  renderFigTag09(figTag09);
  initFancyUI();
}

window.renderDeployOps = function renderDeployOps(){
  const navEl = document.getElementById('nav');
  if (navEl) {
    navEl.innerHTML = NAV;
    setActiveNav();
  }

  const $ = (id) => document.getElementById(id);
  const out = $('ops-output');
  const status = $('ops-connection-status');
  const baseEl = $('ops-base-url');
  const tokenEl = $('ops-token');

  if (!out || !baseEl || !tokenEl) return;

  const savedBase = localStorage.getItem('opsApiBaseUrl') || '';
  const savedToken = localStorage.getItem('opsApiToken') || '';
  baseEl.value = savedBase;
  tokenEl.value = savedToken;

  const print = (payload) => {
    out.textContent = JSON.stringify(payload, null, 2);
  };

  const getCfg = () => ({
    base: (baseEl.value || '').trim().replace(/\/$/, ''),
    token: (tokenEl.value || '').trim(),
  });

  const setStatus = (text, ok = false) => {
    status.textContent = text;
    status.style.color = ok ? 'var(--ok)' : 'var(--warn)';
  };

  const request = async (path, method = 'GET', payload = null) => {
    const { base, token } = getCfg();
    if (!base) throw new Error('Missing Ops API base URL');

    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.data = data;
      err.status = res.status;
      throw err;
    }
    return data;
  };

  $('ops-save-config')?.addEventListener('click', () => {
    const { base, token } = getCfg();
    localStorage.setItem('opsApiBaseUrl', base);
    localStorage.setItem('opsApiToken', token);
    setStatus('Config salvata in localStorage.', true);
    print({ ok: true, saved: { base, token: token ? '***' : '' } });
  });

  $('ops-check-health')?.addEventListener('click', async () => {
    try {
      print({ status: 'checking /health...' });
      const data = await request('/health', 'GET');
      setStatus('Health check OK', true);
      print(data);
    } catch (e) {
      setStatus(`Health check failed: ${e.message}`, false);
      print({ ok: false, error: e.message, details: e.data || null });
    }
  });

  $('register-submit')?.addEventListener('click', async () => {
    const payload = {
      chainId: Number(($('register-chainId')?.value || '').trim()),
      name: ($('register-name')?.value || '').trim(),
      metadataUri: ($('register-metadataUri')?.value || '').trim(),
      endpoint: ($('register-endpoint')?.value || '').trim() || undefined,
    };
    try {
      print({ status: 'sending /agents/register...', payload });
      const data = await request('/agents/register', 'POST', payload);
      setStatus('Register sent successfully', true);
      print(data);
    } catch (e) {
      setStatus(`Register failed: ${e.message}`, false);
      print({ ok: false, error: e.message, details: e.data || null });
    }
  });

  $('feedback-submit')?.addEventListener('click', async () => {
    const payload = {
      agentId: ($('feedback-agentId')?.value || '').trim(),
      value: Number(($('feedback-value')?.value || '').trim()),
      tag1: ($('feedback-tag1')?.value || '').trim() || undefined,
      tag2: ($('feedback-tag2')?.value || '').trim() || undefined,
      endpoint: ($('feedback-endpoint')?.value || '').trim() || undefined,
    };
    try {
      print({ status: 'sending /feedback/give...', payload });
      const data = await request('/feedback/give', 'POST', payload);
      setStatus('Feedback sent successfully', true);
      print(data);
    } catch (e) {
      setStatus(`Feedback failed: ${e.message}`, false);
      print({ ok: false, error: e.message, details: e.data || null });
    }
  });

  $('respond-submit')?.addEventListener('click', async () => {
    const payload = {
      agentId: ($('respond-agentId')?.value || '').trim(),
      clientAddress: ($('respond-clientAddress')?.value || '').trim(),
      feedbackIndex: Number(($('respond-feedbackIndex')?.value || '').trim()),
      response: ($('respond-response')?.value || '').trim(),
    };
    try {
      print({ status: 'sending /feedback/respond...', payload });
      const data = await request('/feedback/respond', 'POST', payload);
      setStatus('Response sent successfully', true);
      print(data);
    } catch (e) {
      setStatus(`Response failed: ${e.message}`, false);
      print({ ok: false, error: e.message, details: e.data || null });
    }
  });

  initFancyUI();
};
