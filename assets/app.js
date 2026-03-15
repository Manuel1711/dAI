const NAV = `
<nav>
  <a href="./index.html">Home</a>
  <a href="./agents.html">Agents</a>
  <a href="./analytics.html">Analytics</a>
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
async function loadFig00a() {
  try { return await fetchJson('./data/analytics/fig00a.cumulative_activity.json'); }
  catch { return null; }
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

function tickValues(min, max, n = 6){
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + i * step);
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

  const yTicks = tickValues(yMin, yMax, 6);
  const xTicks = tickValues(xMin, xMax, 6);
  const xScale = Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.abs(xMax)))));

  const yTickSvg = yTicks.map((v) => {
    const py = yToPx(v);
    return `
      <line x1='${margin.left}' y1='${py}' x2='${width - margin.right}' y2='${py}' stroke='currentColor' opacity='0.12'/>
      <text x='${margin.left - 10}' y='${py + 4}' text-anchor='end' font-size='12'>${Math.round(v).toLocaleString()}</text>
    `;
  }).join('');

  const xTickSvg = xTicks.map((v) => {
    const px = xToPx(v);
    const scaled = v / xScale;
    return `
      <line x1='${px}' y1='${margin.top}' x2='${px}' y2='${height - margin.bottom}' stroke='currentColor' opacity='0.10'/>
      <text x='${px}' y='${height - margin.bottom + 22}' text-anchor='middle' font-size='12'>${scaled.toFixed(3)}</text>
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

          <text x='${width / 2}' y='${height - 18}' text-anchor='middle' font-size='14'>Block number (×1e${Math.log10(xScale)})</text>
          <text x='22' y='${height / 2}' transform='rotate(-90 22 ${height / 2})' text-anchor='middle' font-size='14'>Cumulative count</text>

          <circle cx='${margin.left + 8}' cy='${margin.top + 8}' r='4' fill='#1d4ed8'></circle>
          <text x='${margin.left + 18}' y='${margin.top + 12}' font-size='12'>Cumulative registrations</text>
          <circle cx='${margin.left + 240}' cy='${margin.top + 8}' r='4' fill='#dc2626'></circle>
          <text x='${margin.left + 250}' y='${margin.top + 12}' font-size='12'>Cumulative feedback events</text>
        </svg>
        <div id='fig00a-tooltip' class='fig-tooltip' style='display:none; position:absolute; pointer-events:none;'></div>
      </div>
    </div>
    <p class='meta-row'>Blocks ${xMin.toLocaleString()}–${xMax.toLocaleString()} · Registrations: <b>${reg[reg.length-1].toLocaleString()}</b> · Feedback events: <b>${fb[fb.length-1].toLocaleString()}</b> · Feedback source: <code>${fig.feedback_source || 'unknown'}</code></p>
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

window.renderAnalytics = async function renderAnalytics(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const data = await loadSnapshot();
  const tagMap = await loadTagMap();
  const fig00a = await loadFig00a();
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

  const allTags = new Map();
  for (const a of enriched) {
    for (const t of a._metrics.topTags || []) {
      allTags.set(t.tag, (allTags.get(t.tag) || 0) + Number(t.count || 0));
    }
  }
  const topTags = [...allTags.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10);

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

  document.getElementById('analytics-top-feedback').innerHTML = `
    <h3>Top agents by feedback volume</h3>
    <ol>${topByFeedback.map((a)=>`<li><a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name || shortAddr(a.agentId)}</a> — ${a.feedbackCount || 0} feedback</li>`).join('') || '<li>No data</li>'}</ol>`;

  document.getElementById('analytics-top-tags').innerHTML = `
    <h3>Most used tags (network-wide)</h3>
    <ol>${topTags.map(([tag,n])=>`<li><code>${tag}</code> — ${n}</li>`).join('') || '<li>No tags</li>'}</ol>`;

  renderFig00a(fig00a);
}
