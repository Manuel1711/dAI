#!/usr/bin/env python3
import json
from pathlib import Path
import importlib.util
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EMPIRICS_SOURCE = Path('/home/manuel/.openclaw/workspace/workspaces/erc8004-specialist/working/analysis/empirics/empirics_source.py')
IDENTITY_EVENTS = ROOT / 'data/live/identity.events.jsonl'
SNAPSHOT = ROOT / 'data/agents.snapshot.json'
OUT_DIR = ROOT / 'data/analytics'
OUT_FILE = OUT_DIR / 'fig00a.cumulative_activity.json'


def load_empirics_module(path: Path):
    spec = importlib.util.spec_from_file_location('empirics_source', str(path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {path}')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_reg_first(path: Path) -> pd.DataFrame:
    rows = []
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            agent_id = obj.get('agentId')
            block = obj.get('blockNumber')
            if agent_id is None or block is None:
                continue
            rows.append({'agentId': str(agent_id), 'reg_block': int(block)})
    if not rows:
        return pd.DataFrame(columns=['agentId', 'reg_block'])
    df = pd.DataFrame(rows)
    return df.groupby('agentId', as_index=False)['reg_block'].min()


def load_feedback_blocks_from_snapshot(path: Path) -> pd.DataFrame:
    data = json.loads(path.read_text(encoding='utf-8'))
    rows = []
    for agent in data.get('agents', []):
        for fb in agent.get('feedbackHistory', []) or []:
            bn = fb.get('blockNumber')
            if bn is None:
                continue
            rows.append({'blockNumber': int(bn)})
    return pd.DataFrame(rows, columns=['blockNumber'])


def main():
    empirics = load_empirics_module(EMPIRICS_SOURCE)
    reg_first = load_reg_first(IDENTITY_EVENTS)
    fb = load_feedback_blocks_from_snapshot(SNAPSHOT)

    out = empirics.compute_fig00a_cumulative_activity_data(reg_first, fb)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        'source': str(EMPIRICS_SOURCE),
        'figure': 'fig00a_cumulative_activity_data',
        'n_registered_agents': int(len(reg_first)),
        'n_feedback_events': int(len(fb)),
        'x_union': [int(x) for x in out['x_union']],
        'reg_y': [int(y) for y in out['reg_y']],
        'fb_y': [int(y) for y in out['fb_y']],
    }
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    print(f'Wrote {OUT_FILE}')


if __name__ == '__main__':
    main()
