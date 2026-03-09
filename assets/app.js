const NAV = `
<nav>
  <a href="./index.html">Home</a>
  <a href="./agents.html">Agents</a>
</nav>`;

function setActiveNav() {
  const page = location.pathname.split('/').pop();
  document.querySelectorAll('nav a').forEach(a => {
    if (a.getAttribute('href').includes(page)) a.classList.add('active');
  });
}

async function loadSnapshot() {
  const res = await fetch('./data/agents.snapshot.json');
  return res.json();
}

function avg(arr){return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0}

window.renderHome = async function renderHome(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();
  const data = await loadSnapshot();
  const total = data.agents.length;
  const allScores = data.agents.map(a=>a.scoreV1);
  const mean = avg(allScores).toFixed(2);
  const feedback = data.agents.reduce((s,a)=>s+a.feedbackCount,0);
  document.getElementById('home-kpis').innerHTML = `
    <div class='card'><h3>Agents indexed</h3><div class='kpi'>${total}</div></div>
    <div class='card'><h3>Network</h3><div class='kpi'>ETH L1</div></div>
    <div class='card'><h3>Avg Score v1</h3><div class='kpi'>${mean}</div></div>
    <div class='card'><h3>Total Feedback</h3><div class='kpi'>${feedback}</div></div>`;
  document.getElementById('meta').textContent = `Snapshot block: ${data.blockNumber} | Generated: ${data.generatedAt}`;
}

window.renderAgents = async function renderAgents(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();
  const data = await loadSnapshot();
  const rows = data.agents.map(a=>`<tr>
    <td><a href='./agent.html?id=${encodeURIComponent(a.agentId)}'>${a.name}</a><br><small>${a.agentId}</small></td>
    <td>${a.category}</td>
    <td>${a.feedbackCount}</td>
    <td>${a.scoreV1.toFixed(2)}</td>
  </tr>`).join('');
  document.getElementById('agents-table').innerHTML = rows;
}

window.renderAgentDetail = async function renderAgentDetail(){
  document.getElementById('nav').innerHTML = NAV;
  setActiveNav();
  const id = new URLSearchParams(location.search).get('id');
  const data = await loadSnapshot();
  const a = data.agents.find(x=>x.agentId===id);
  if (!a) { document.getElementById('agent-root').innerHTML = '<p>Agent not found</p>'; return; }
  const feedbackRows = a.feedbackHistory.map(f=>`<tr><td>${f.timestamp}</td><td>${f.score}</td><td>${f.comment}</td><td>${f.txHash}</td></tr>`).join('');
  document.getElementById('agent-root').innerHTML = `
    <div class='card'>
      <h2>${a.name}</h2>
      <p>${a.description}</p>
      <p><span class='badge'>${a.category}</span> <span class='badge'>${a.agentId}</span></p>
      <p>Owner: ${a.owner}</p>
      <p>Identity URI: ${a.identityURI}</p>
      <p><b>Score v1:</b> ${a.scoreV1.toFixed(2)} (${a.feedbackCount} feedback)</p>
    </div>
    <h3 style='margin-top:16px;'>Feedback Registry History</h3>
    <table class='table'>
      <thead><tr><th>Timestamp</th><th>Score</th><th>Comment</th><th>TxHash</th></tr></thead>
      <tbody>${feedbackRows || '<tr><td colspan="4">No feedback</td></tr>'}</tbody>
    </table>`;
}
