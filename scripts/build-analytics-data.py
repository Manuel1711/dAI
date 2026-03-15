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
OUT_FILE_00A = OUT_DIR / 'fig00a.cumulative_activity.json'
OUT_FILE_00B = OUT_DIR / 'fig00b.event_intensity.json'


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


def load_feedback_blocks_from_events(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame(columns=['blockNumber'])
    rows = []
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            bn = obj.get('blockNumber')
            if bn is None:
                continue
            rows.append({'blockNumber': int(bn)})
    return pd.DataFrame(rows, columns=['blockNumber'])


def main():
    empirics = load_empirics_module(EMPIRICS_SOURCE)
    reg_first = load_reg_first(IDENTITY_EVENTS)

    feedback_events_path = ROOT / 'data/live/feedback.events.jsonl'
    fb_events = load_feedback_blocks_from_events(feedback_events_path)
    if len(fb_events):
        fb = fb_events
        feedback_source = str(feedback_events_path)
    else:
        fb = load_feedback_blocks_from_snapshot(SNAPSHOT)
        feedback_source = str(SNAPSHOT)

    out00a = empirics.compute_fig00a_cumulative_activity_data(reg_first, fb)

    block_min = int(min(reg_first['reg_block'].min(), fb['blockNumber'].min())) if len(fb) else int(reg_first['reg_block'].min())
    block_max = int(max(reg_first['reg_block'].max(), fb['blockNumber'].max())) if len(fb) else int(reg_first['reg_block'].max())
    out00b = empirics.compute_fig00b_event_intensity_data(reg_first, fb, block_min=block_min, block_max=block_max, bin_width=5000)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    payload00a = {
        'source': str(EMPIRICS_SOURCE),
        'feedback_source': feedback_source,
        'figure': 'fig00a_cumulative_activity_data',
        'n_registered_agents': int(len(reg_first)),
        'n_feedback_events': int(len(fb)),
        'x_union': [int(x) for x in out00a['x_union']],
        'reg_y': [int(y) for y in out00a['reg_y']],
        'fb_y': [int(y) for y in out00a['fb_y']],
    }
    OUT_FILE_00A.write_text(json.dumps(payload00a, ensure_ascii=False), encoding='utf-8')
    print(f'Wrote {OUT_FILE_00A}')

    payload00b = {
        'source': str(EMPIRICS_SOURCE),
        'figure': 'fig00b_event_intensity_data',
        'bin_width': int(out00b['bin_width']),
        'block_min': int(block_min),
        'block_max': int(block_max),
        'centers': [int(round(x)) for x in out00b['centers']],
        'reg_hist': [int(x) for x in out00b['reg_hist']],
        'fb_hist': [int(x) for x in out00b['fb_hist']],
        'ratio': [None if pd.isna(x) else float(x) for x in out00b['ratio']],
    }
    OUT_FILE_00B.write_text(json.dumps(payload00b, ensure_ascii=False), encoding='utf-8')
    print(f'Wrote {OUT_FILE_00B}')


if __name__ == '__main__':
    main()
