const NAV = `
<nav>
  <a href="./index.html">Home</a>
  <a href="./agents.html">Agents</a>
  <a href="./research.html">Research</a>
  <a href="./pipeline.html">Pipeline</a>
</nav>`;

function setActiveNav() {
  const page = location.pathname.split('/').pop();
  document.querySelectorAll('nav a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.includes(page)) a.classList.add('active');
  });
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed loading ${path}`);
  return res.json();
}

async function loadSnapshot() { return fetchJson('./data/agents.snapshot.json'); }
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

function avg(arr){return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0}
function fmtDate(s){ if(!s) return '-'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleString(); }
function shortAddr(a){ return a && a.startsWith('0x') && a.length>12 ? `${a.slice(0,6)}...${a.slice(-4)}` : (a || '-'); }
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
  const moreBtn = document.getElementById('load-more');
  const PAGE_SIZE = 120;
  let visible = PAGE_SIZE;

  function applyFilters() {
    const q = (searchEl.value || '').toLowerCase().trim();
    const mode = sortEl.value;
    let rows = [...enriched];

    if (q) {
      rows = rows.filter((a) => [a.name, a.agentId, a.owner, a.category].filter(Boolean).join(' ').toLowerCase().includes(q));
    }

    if (mode === 'score') rows.sort((a,b)=>(b._metrics.scoreMain||0)-(a._metrics.scoreMain||0));
    if (mode === 'feedback') rows.sort((a,b)=>(b.feedbackCount||0)-(a.feedbackCount||0));
    if (mode === 'recent') rows.sort((a,b)=>new Date(b.lastActivityAt||0)-new Date(a.lastActivityAt||0));
    if (mode === 'name') rows.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    return rows;
  }

  function renderRows(reset = false) {
    if (reset) visible = PAGE_SIZE;
    const rows = applyFilters();
    const shown = rows.slice(0, visible);

    document.getElementById('agents-table').innerHTML = shown.map((a)=>{
      const st = deriveStatus(a);
      const img = pickAgentImage(a);
      return `<tr>
      <td>
        <div class='agent-cell'>
          <img class='agent-avatar' src='${img}' alt='${(a.name||a.agentId)}' loading='lazy' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
          <div>
            <a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name || a.agentId}</a><br><small>${a.agentId}</small>
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

    if (metaEl) metaEl.textContent = `Showing ${Math.min(shown.length, rows.length)} / ${rows.length} agents`;
    if (moreBtn) {
      moreBtn.style.display = rows.length > shown.length ? 'inline-block' : 'none';
      moreBtn.textContent = `Load more (+${Math.min(PAGE_SIZE, rows.length - shown.length)})`;
    }
  }

  searchEl.addEventListener('input', () => renderRows(true));
  sortEl.addEventListener('change', () => renderRows(true));
  if (moreBtn) moreBtn.addEventListener('click', () => { visible += PAGE_SIZE; renderRows(false); });
  renderRows(true);
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
  const characteristicsHtml = metrics.characteristics.slice(0, 8)
    .map((x)=>`<li><b>${x.tag}</b>: ${x.mean.toFixed(2)} (n=${x.count})</li>`).join('');
  const topTagsHtml = metrics.topTags
    .map((x)=>`<li><b>${x.tag}</b> — ${x.count} (${x.category})</li>`).join('');

  const feedbackRows = (a.feedbackHistory || []).map((f)=> {
    const t = String(f.tag1 || '').trim().toLowerCase();
    const cat = tagMap[t]?.category || 'unclassified';
    return `<tr><td>${fmtDate(f.timestamp)}</td><td>${f.score}</td><td>${f.tag1 || '-'}</td><td>${cat}</td><td>${f.comment || '-'}</td><td><small>${f.txHash}</small></td></tr>`;
  }).join('');

  document.getElementById('agent-root').innerHTML = `
    <div class='card'>
      <div class='agent-detail-head'>
        <img class='agent-avatar-lg' src='${pickAgentImage(a)}' alt='${(a.name||a.agentId)}' referrerpolicy='no-referrer' onerror="this.onerror=null;this.src='${fallbackAvatar(""+a.agentId)}'" />
        <h2>${a.name || a.agentId}</h2>
      </div>
      <p>${a.description || 'No description'}</p>
      <p><span class='badge'>${a.category || 'Unknown'}</span> <span class='badge'>${a.agentId}</span></p>
      <p><b>Owner:</b> ${a.owner || '-'}</p>
      <p><b>Status:</b> ${statusPill(deriveStatus(a))}</p>
      <p><b>Identity URI:</b> ${a.identityURI || '-'}</p>
      <p><b>Created At:</b> ${fmtDate(a.createdAt)}</p>
      <p><b>Main Score (non-C1):</b> ${metrics.scoreMain.toFixed(2)} /100 (${metrics.scoreMainCount} feedback used)</p>
      <p><b>Legacy Score v1:</b> ${Number(a.scoreV1 || 0).toFixed(2)} /100</p>
      <p><b>Total Feedback:</b> ${a.feedbackCount || 0}</p>
      <p><b>Characteristic feedback (C1):</b> ${metrics.characteristicCount}</p>
      <p><b>Unique raters:</b> ${a.uniqueRaters ?? '-'}</p>
      <p><b>Last activity:</b> ${fmtDate(a.lastActivityAt)}</p>
      <h3 style='margin-top:14px;'>Characteristics evaluated (top)</h3>
      <ol>${characteristicsHtml || '<li>No characteristic tags yet</li>'}</ol>
      <h3 style='margin-top:14px;'>Most used tags</h3>
      <ol>${topTagsHtml || '<li>No tags yet</li>'}</ol>
    </div>
    <h3 style='margin-top:16px;'>Feedback Registry History</h3>
    <table class='table'>
      <thead><tr><th>Timestamp</th><th>Score</th><th>tag1</th><th>Category</th><th>Comment</th><th>TxHash</th></tr></thead>
      <tbody>${feedbackRows || '<tr><td colspan="6">No feedback</td></tr>'}</tbody>
    </table>`;
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
}
