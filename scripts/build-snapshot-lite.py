#!/usr/bin/env python3
"""
Genera data/agents.snapshot.lite.json per la vista lista/home.
Rimuove solo feedbackHistory (il campo pesante). Mantiene tutti i metadati
necessari per visualizzare nomi, immagini e link degli agenti.
"""
import json, os

SRC  = os.path.join(os.path.dirname(__file__), '..', 'data', 'agents.snapshot.json')
DEST = os.path.join(os.path.dirname(__file__), '..', 'data', 'agents.snapshot.lite.json')
DESC_MAX = 180

with open(SRC) as f:
    data = json.load(f)

lite_agents = []
for a in data.get('agents', []):
    row = {k: v for k, v in a.items() if k != 'feedbackHistory'}
    desc = (row.get('description') or '').strip()
    row['description'] = desc[:DESC_MAX] + ('…' if len(desc) > DESC_MAX else '')
    lite_agents.append(row)

out = {
    'blockNumber': data.get('blockNumber'),
    'generatedAt': data.get('generatedAt'),
    'agentCount':  len(lite_agents),
    'agents':      lite_agents,
}

with open(DEST, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

# Also write meta file (used by sync block — tiny, instant to load)
meta = {'blockNumber': data.get('blockNumber'), 'generatedAt': data.get('generatedAt'), 'agentCount': len(lite_agents)}
meta_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'agents.snapshot.meta.json')
with open(meta_path, 'w') as f:
    json.dump(meta, f, separators=(',', ':'))

src_mb  = os.path.getsize(SRC)  / 1024 / 1024
dest_mb = os.path.getsize(DEST) / 1024 / 1024
meta_b  = os.path.getsize(meta_path)
print(f"Done: {src_mb:.1f} MB → lite {dest_mb:.2f} MB | meta {meta_b} bytes  ({len(lite_agents)} agents)")
