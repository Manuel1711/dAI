# ERC8004 Agents dApp MVP (ETH L1)

MVP statico, GitHub-ready, per visualizzare agenti ERC8004 con:
- identità agente,
- feedback registry,
- score sintetico `v1` calcolato come media aritmetica dei feedback.

Questo README descrive **in modo esteso** cosa fa ogni file importante, come gira il flusso dati end-to-end e cosa manca per produzione.

---

## 1) Obiettivo del progetto

Questo progetto serve a validare rapidamente una UX tipo “8004agents” con 3 viste base:
1. **Home**: KPI sintetici della rete/snapshot.
2. **Agents list**: elenco agenti con identità + score.
3. **Agent detail**: dettaglio singolo agente con storico feedback.

Per velocità, il progetto supporta due modalità dati:
- **Snapshot locale** (veloce, stabile, ideale per demo/MVP)
- **Indexer continuo ETH L1** (scaffold operativo, aggiornamento periodico da RPC)

---

## 2) Struttura directory

```text
erc8004-dapp-mvp/
├─ index.html
├─ agents.html
├─ agent.html
├─ README.md
├─ .env.example
├─ assets/
│  ├─ app.js
│  └─ styles.css
├─ data/
│  ├─ identity_registry.snapshot.json
│  ├─ feedback_registry.snapshot.json
│  ├─ agents.snapshot.json
│  └─ live/                     # generata runtime dall’indexer
│     ├─ checkpoints.json
│     ├─ identity.events.jsonl
│     └─ feedback.events.jsonl
└─ scripts/
   ├─ build-snapshot.mjs
   ├─ indexer-loop.mjs
   └─ run-indexer.sh
```

---

## 3) Cosa fa ogni file importante (estensivo)

## `index.html`
Pagina Home del sito.
- Carica CSS (`assets/styles.css`) e logica JS (`assets/app.js`).
- Invoca `renderHome()`.
- Mostra KPI aggregati:
  - numero agenti,
  - network (ETH L1),
  - score medio,
  - totale feedback,
  - metadati snapshot (block/timestamp).

**Ruolo**: dashboard sintetica del dataset attivo (`data/agents.snapshot.json`).

## `agents.html`
Pagina elenco agenti.
- Invoca `renderAgents()`.
- Mostra tabella con:
  - identità (`name`, `agentId`),
  - categoria,
  - numero feedback,
  - score `v1`.
- Linka ogni riga a `agent.html?id=<agentId>`.

**Ruolo**: punto di navigazione principale per trovare agenti e confrontare score.

## `agent.html`
Pagina dettaglio agente.
- Invoca `renderAgentDetail()`.
- Legge query param `id`.
- Cerca l’agente nel dataset snapshot e renderizza:
  - info identità,
  - owner,
  - identity URI,
  - score e feedback count,
  - tabella cronologica feedback (`timestamp`, `score`, `comment`, `txHash`).

**Ruolo**: vista analitica per singolo agente.

## `assets/app.js`
È il **core frontend**.

Responsabilità principali:
1. Rendering nav condivisa (Home/Agents).
2. Fetch del dataset `data/agents.snapshot.json`.
3. Calcolo KPI Home.
4. Render tabella Agents.
5. Render dettaglio agente con feedback history.

In altre parole, questo file collega UI e modello dati senza framework (vanilla JS), per minimizzare complessità e tempi.

## `assets/styles.css`
Tema UI base (dark mode), layout responsive, stili tabella/card/badge/KPI.

**Ruolo**: garantire leggibilità e uniformità visiva con asset minimo.

## `data/identity_registry.snapshot.json`
Snapshot locale identità agenti.

Contiene tipicamente:
- metadati network (`ethereum-mainnet`),
- blockNumber di riferimento,
- lista agenti con campi identità (`agentId`, `name`, `owner`, `category`, `description`, `identityURI`, `createdAt`).

**Ruolo**: sorgente canonica per anagrafica agente nella modalità snapshot.

## `data/feedback_registry.snapshot.json`
Snapshot locale feedback.

Contiene tipicamente:
- metadati network,
- blockNumber,
- lista eventi feedback (`agentId`, `rater`, `score`, `comment`, `txHash`, `timestamp`).

**Ruolo**: sorgente canonica feedback nella modalità snapshot.

## `data/agents.snapshot.json`
Dataset aggregato finale usato dalla UI.

Viene generato da pipeline/build e contiene, per ogni agente:
- profilo identità,
- `feedbackCount`,
- `feedbackHistory` ordinata,
- `scoreV1`.

**Ruolo**: “materialized view” pronta frontend, evitando calcoli pesanti nel browser.

## `scripts/build-snapshot.mjs`
Script batch di aggregazione snapshot.

Flusso:
1. Legge `identity_registry.snapshot.json`.
2. Legge `feedback_registry.snapshot.json`.
3. Raggruppa feedback per `agentId`.
4. Calcola `scoreV1 = mean(feedback.score)`.
5. Ordina history per timestamp discendente.
6. Scrive `data/agents.snapshot.json`.

**Ruolo**: pipeline deterministica, ripetibile, semplice da auditare.

## `scripts/indexer-loop.mjs`
Scaffold indexer continuo ETH L1.

Cosa fa ad ogni tick:
1. Legge latest block da RPC.
2. Calcola `safeBlock = latest - confirmations`.
3. Usa checkpoint persistenti per sapere da dove riprendere.
4. Fa `eth_getLogs` sui due registri in chunk (`BLOCK_CHUNK`).
5. Normalizza i log e li appende in JSONL (`data/live/*.jsonl`).
6. Ricostruisce `data/agents.snapshot.json` raggruppando per `agentId`.

Output runtime:
- `data/live/checkpoints.json`
- `data/live/identity.events.jsonl`
- `data/live/feedback.events.jsonl`

**Ruolo**: ponte verso near-real-time senza backend complesso.

> Nota: attualmente decode ABI è volutamente light/euristico per velocità MVP.

## `scripts/run-indexer.sh`
Wrapper di avvio indexer.
- Carica `.env` se presente.
- Esegue `node scripts/indexer-loop.mjs`.

**Ruolo**: command entrypoint stabile per uso operativo.

## `.env.example`
Template variabili ambiente:
- `ETH_RPC_URL` (obbligatorio)
- `IDENTITY_REGISTRY`
- `FEEDBACK_REGISTRY`
- `POLL_MS`
- `CONFIRMATIONS`
- `BLOCK_CHUNK`

**Ruolo**: configurazione rapida senza hardcodare parametri sensibili.

---

## 4) Data flow completo (end-to-end)

## Modalità A — Snapshot
1. Si aggiornano i due file snapshot sorgente (`identity`, `feedback`).
2. Si lancia `node scripts/build-snapshot.mjs`.
3. Si genera `data/agents.snapshot.json`.
4. Frontend legge quel file e renderizza pagine.

**Quando usarla**: demo, QA UI, presentazioni, sviluppo veloce.

## Modalità B — Continuous indexing
1. Si configura RPC in `.env`.
2. Si lancia `./scripts/run-indexer.sh`.
3. L’indexer aggiorna continuamente i JSONL e il checkpoint.
4. A ogni ciclo rigenera `agents.snapshot.json`.
5. Frontend riflette i nuovi dati al refresh.

**Quando usarla**: monitoraggio continuo e pre-produzione tecnica.

---

## 5) Comandi operativi

## Build snapshot
```bash
cd /home/manuel/.openclaw/workspace/workspaces/ai-agent-specialist/working/erc8004-dapp-mvp
node scripts/build-snapshot.mjs
```

## Avvio web locale
```bash
python3 -m http.server 5173
# apri http://localhost:5173
```

## Avvio indexer continuo
```bash
cp .env.example .env
# imposta ETH_RPC_URL in .env
./scripts/run-indexer.sh
```

---

## 6) Cosa è già “buono” e cosa no

## Già buono per MVP
- Architettura semplice, leggibile, file-based.
- UI funzionante con 3 viste richieste.
- Pipeline score `v1` chiara e verificabile.
- Scaffold indexer continuo già attivo.

## Non ancora production-grade
- Decode ABI non ancora strict su tutti i campi evento.
- Manca allowlist robusta `topic0` per evento.
- Dedup forte `(txHash, logIndex)` da rafforzare.
- Reorg handling avanzato da implementare.
- Mancano API backend, auth, rate limit, observability.
- Mancano protezioni anti-spam/Sybil sui feedback.

---

## 7) Deploy GitHub Pages

1. Inizializza/pusha repository su GitHub.
2. Vai in `Settings → Pages`.
3. Seleziona `Deploy from a branch`.
4. Branch `main`, folder `/ (root)`.
5. URL finale: `https://<user>.github.io/<repo>/`.

Per Pages, il modello statico corrente è ideale: nessun server richiesto.

---

## 8) Next step consigliati (priorità)

1. **ABI-strict parser** (Identity/Feedback) con campi tipizzati.
2. **Dedup + reorg-safe replay** con finestra rollback.
3. **Backfill command** separato dal loop continuo.
4. **Metriche qualità ingest** (lag blocchi, error rate, throughput).
5. **API read layer** (anche minimale) per filtri/paginazione.

---

## 9) Sintesi in una riga

Questo progetto è una base MVP completa per visualizzare agenti ERC8004 con score e feedback, già pronta per GitHub Pages e con indexer continuo scaffold per evoluzione verso produzione.
