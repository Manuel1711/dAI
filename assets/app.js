const NAV = `
<nav>
  <a href="./index.html">Home</a>
  <a href="./agents.html">Agents</a>
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

function avg(arr){return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0}
function fmtDate(s){ if(!s) return '-'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleString(); }

window.renderHome = async function renderHome(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const data = await loadSnapshot();
  const cp = await loadCheckpoint();

  const total = data.agents.length;
  const allScores = data.agents.map((a)=>a.scoreV1 || 0);
  const mean = avg(allScores).toFixed(2);
  const feedback = data.agents.reduce((s,a)=>s+(a.feedbackCount||0),0);
  const now = Date.now();
  const ageMin = Math.floor((now - new Date(data.generatedAt).getTime()) / 60000);
  const live = ageMin <= 20;

  document.getElementById('status-chip').className = `status-chip ${live ? 'status-live' : 'status-stale'}`;
  document.getElementById('status-chip').textContent = live ? `LIVE • updated ${ageMin}m ago` : `STALE • updated ${ageMin}m ago`;

  document.getElementById('home-kpis').innerHTML = `
    <div class='card'><h3>Agents indexed</h3><div class='kpi'>${total}</div></div>
    <div class='card'><h3>Network</h3><div class='kpi'>ETH L1</div></div>
    <div class='card'><h3>Avg Score v1</h3><div class='kpi'>${mean}</div></div>
    <div class='card'><h3>Total Feedback</h3><div class='kpi'>${feedback}</div></div>`;

  const top = [...data.agents].sort((a,b)=>(b.scoreV1||0)-(a.scoreV1||0)).slice(0,5)
    .map((a)=>`<li><a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name}</a> — ${a.scoreV1?.toFixed?.(2) ?? a.scoreV1} (${a.feedbackCount} fb)</li>`).join('');
  document.getElementById('top-agents').innerHTML = `<h3>Top agents by score</h3><ol>${top || '<li>No agents</li>'}</ol>`;

  const cpText = cp ? ` | Last safe block: ${cp.lastSafeBlock ?? '-'} | Checkpoint updated: ${fmtDate(cp.updatedAt)}` : '';
  document.getElementById('meta').textContent = `Snapshot block: ${data.blockNumber} | Generated: ${fmtDate(data.generatedAt)}${cpText}`;
}

window.renderAgents = async function renderAgents(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const data = await loadSnapshot();
  const searchEl = document.getElementById('search');
  const sortEl = document.getElementById('sort');

  function renderRows() {
    const q = (searchEl.value || '').toLowerCase().trim();
    const mode = sortEl.value;
    let rows = [...data.agents];

    if (q) {
      rows = rows.filter((a) => [a.name, a.agentId, a.owner, a.category].filter(Boolean).join(' ').toLowerCase().includes(q));
    }

    if (mode === 'score') rows.sort((a,b)=>(b.scoreV1||0)-(a.scoreV1||0));
    if (mode === 'feedback') rows.sort((a,b)=>(b.feedbackCount||0)-(a.feedbackCount||0));
    if (mode === 'recent') rows.sort((a,b)=>new Date(b.lastActivityAt||0)-new Date(a.lastActivityAt||0));
    if (mode === 'name') rows.sort((a,b)=>(a.name||'').localeCompare(b.name||''));

    document.getElementById('agents-table').innerHTML = rows.map((a)=>`<tr>
      <td><a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name || a.agentId}</a><br><small>${a.agentId}</small></td>
      <td>${a.category || '-'}</td>
      <td>${a.feedbackCount || 0}</td>
      <td>${Number(a.scoreV1 || 0).toFixed(2)}</td>
      <td>${fmtDate(a.lastActivityAt)}</td>
    </tr>`).join('') || `<tr><td colspan='5'>No agents for this filter</td></tr>`;
  }

  searchEl.addEventListener('input', renderRows);
  sortEl.addEventListener('change', renderRows);
  renderRows();
}

window.renderAgentDetail = async function renderAgentDetail(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();

  const id = new URLSearchParams(location.search).get('id');
  const data = await loadSnapshot();
  const a = data.agents.find((x)=>x.agentId===id);
  if (!a) {
    document.getElementById('agent-root').innerHTML = '<div class="card"><p>Agent not found</p></div>';
    return;
  }

  const feedbackRows = (a.feedbackHistory || []).map((f)=>
    `<tr><td>${fmtDate(f.timestamp)}</td><td>${f.score}</td><td>${f.comment || '-'}</td><td><small>${f.txHash}</small></td></tr>`).join('');

  document.getElementById('agent-root').innerHTML = `
    <div class='card'>
      <h2>${a.name || a.agentId}</h2>
      <p>${a.description || 'No description'}</p>
      <p><span class='badge'>${a.category || 'Unknown'}</span> <span class='badge'>${a.agentId}</span></p>
      <p>Owner: ${a.owner || '-'}</p>
      <p>Identity URI: ${a.identityURI || '-'}</p>
      <p><b>Score v1:</b> ${Number(a.scoreV1 || 0).toFixed(2)} (${a.feedbackCount || 0} feedback)</p>
      <p><b>Unique raters:</b> ${a.uniqueRaters ?? '-'}</p>
      <p><b>Last activity:</b> ${fmtDate(a.lastActivityAt)}</p>
    </div>
    <h3 style='margin-top:16px;'>Feedback Registry History</h3>
    <table class='table'>
      <thead><tr><th>Timestamp</th><th>Score</th><th>Comment</th><th>TxHash</th></tr></thead>
      <tbody>${feedbackRows || '<tr><td colspan="4">No feedback</td></tr>'}</tbody>
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
