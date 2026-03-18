#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from collections import Counter
import importlib.util

REPO = Path(__file__).resolve().parents[1]
DATA_LIVE = REPO / 'data' / 'live' / 'feedback.events.jsonl'
OUT_DIR = REPO / 'data' / 'analytics'

TAG_SOURCE_PATH = Path('/home/manuel/.openclaw/workspace/workspaces/erc8004-specialist/working/analysis/tag/tag_source.py')


def load_tag_source(path: Path):
    if not path.exists():
      raise FileNotFoundError(f'tag_source not found: {path}')
    spec = importlib.util.spec_from_file_location('tag_source', str(path))
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def read_events(path: Path):
    events = []
    if not path.exists():
        return events
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except Exception:
                continue
    return events


def main():
    tag_source = load_tag_source(TAG_SOURCE_PATH)
    events = read_events(DATA_LIVE)

    category_order = ['empty', 'unclassified', 'work_area', 'adjectives', 'characteristic']
    category_counts = Counter()
    top_terms = {
        'characteristic': Counter(),
        'adjectives': Counter(),
        'work_area': Counter(),
        'unclassified': Counter(),
    }

    n_total = len(events)
    n_empty = 0
    for ev in events:
        raw_tag1 = ev.get('tag1', '')
        tag = tag_source.canonicalize_tag(raw_tag1)
        if not tag:
            n_empty += 1
            category_counts['empty'] += 1
            continue

        cls = tag_source.classify_tag1(tag)
        label = cls.get('assigned_labels', 'Unclassified')
        if label == 'Characteristic to evaluate (no adjectives)':
            ck = 'characteristic'
        elif label == 'Work area (no adjectives)':
            ck = 'work_area'
        elif label == 'Adjectives only':
            ck = 'adjectives'
        else:
            ck = 'unclassified'

        category_counts[ck] += 1
        top_terms[ck][tag] += 1

    n_nonempty = max(0, n_total - n_empty)

    # fig-tag07: completeness + category summary + 25-quantile matrix
    n_bins = 25
    matrix = [[0 for _ in range(n_bins)] for _ in category_order]
    if n_total > 0:
        for i, ev in enumerate(events):
            raw_tag1 = ev.get('tag1', '')
            tag = tag_source.canonicalize_tag(raw_tag1)
            if not tag:
                rk = 'empty'
            else:
                cls = tag_source.classify_tag1(tag)
                label = cls.get('assigned_labels', 'Unclassified')
                if label == 'Characteristic to evaluate (no adjectives)':
                    rk = 'characteristic'
                elif label == 'Work area (no adjectives)':
                    rk = 'work_area'
                elif label == 'Adjectives only':
                    rk = 'adjectives'
                else:
                    rk = 'unclassified'
            r = category_order.index(rk)
            b = min(n_bins - 1, (i * n_bins) // n_total)
            matrix[r][b] += 1

    payload07 = {
        'source': 'tag_source',
        'field_completeness': [
            {
                'status': 'tag1_nonempty',
                'label': 'Non-empty tag1',
                'count': int(n_nonempty),
                'share': round((n_nonempty / n_total), 3) if n_total else 0,
            },
            {
                'status': 'tag1_empty',
                'label': 'Empty tag1',
                'count': int(n_empty),
                'share': round((n_empty / n_total), 3) if n_total else 0,
            },
        ],
        'category_summary': [
            {'category': 'Characteristic to evaluate', 'count': int(category_counts['characteristic']), 'share': round((category_counts['characteristic'] / n_nonempty), 3) if n_nonempty else 0},
            {'category': 'Adjectives only', 'count': int(category_counts['adjectives']), 'share': round((category_counts['adjectives'] / n_nonempty), 3) if n_nonempty else 0},
            {'category': 'Work area', 'count': int(category_counts['work_area']), 'share': round((category_counts['work_area'] / n_nonempty), 3) if n_nonempty else 0},
            {'category': 'Unclassified', 'count': int(category_counts['unclassified']), 'share': round((category_counts['unclassified'] / n_nonempty), 3) if n_nonempty else 0},
        ],
        'matrix': {
            'rows': category_order,
            'n_bins': n_bins,
            'values': matrix,
        },
        'total_nonempty': int(n_nonempty),
        'total_rows': int(n_total),
    }

    # fig-tag08: composition from tag_source categories
    payload08 = {
        'source': 'tag_source',
        'macroareas': [
            {'macroarea': 'Characteristic to evaluate', 'frequency': int(category_counts['characteristic'])},
            {'macroarea': 'Adjectives only', 'frequency': int(category_counts['adjectives'])},
            {'macroarea': 'Work area', 'frequency': int(category_counts['work_area'])},
            {'macroarea': 'Unclassified', 'frequency': int(category_counts['unclassified'])},
        ],
        'total_nonempty': int(n_nonempty),
        'total_empty': int(n_empty),
        'total_rows': int(n_total),
    }

    # fig-tag09: top terms by tag_source category
    def topn(counter: Counter, n=12):
        return [{'tag': t, 'frequency': int(c)} for t, c in counter.most_common(n)]

    payload09 = {
        'source': 'tag_source',
        'characteristic': topn(top_terms['characteristic']),
        'adjectives': topn(top_terms['adjectives']),
        'work_area': topn(top_terms['work_area']),
        'unclassified': topn(top_terms['unclassified']),
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'fig-tag07.field_completeness.json').write_text(json.dumps(payload07, ensure_ascii=False), encoding='utf-8')
    (OUT_DIR / 'fig-tag08.composition.json').write_text(json.dumps(payload08, ensure_ascii=False), encoding='utf-8')
    (OUT_DIR / 'fig-tag09.top_terms.json').write_text(json.dumps(payload09, ensure_ascii=False), encoding='utf-8')

    print('Wrote tag analytics from tag_source')


if __name__ == '__main__':
    main()
