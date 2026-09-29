# -*- coding: utf-8 -*-
"""perturbation 기여도 (목업 2h).

사용자가 직접 입력한 특성 각각에 대해, 그 키만 뺀 입력으로 전체 파이프라인을
재실행(→ 동성·동연령 대체값 + 파생변수 재계산 자동 반영)했을 때의 확률 변화
delta = p_full − p_without 를 기여도로 삼는다. delta>0 = 내 값이 위험을 올림.
"""
from .codebook import FEATURES
from .engine import FEMALE_ONLY_TARGETS

# 파생의 원천이 되는 키 (빼면 파생도 함께 대체 경로를 탐)
NEVER_PERTURB = {'SEX', 'AGE'}


def compute_contrib(engine, inputs, target, top_k=8):
    if not 1 <= top_k <= 20:
        raise ValueError("top_k는 1~20 사이여야 합니다")
    meta = engine.meta
    if target not in meta['targets']:
        raise ValueError(f"알 수 없는 질환 코드: {target}")
    if target in FEMALE_ONLY_TARGETS and inputs.get('SEX') == 1:
        raise ValueError("해당 질환은 이 성별에서 예측하지 않습니다")
    leak = set(meta['leakage'].get(target, []))
    keys = [k for k in inputs
            if k not in NEVER_PERTURB and k not in leak
            and inputs[k] is not None and k in FEATURES]
    variants = [inputs] + [{kk: v for kk, v in inputs.items() if kk != k} for k in keys]
    outputs = engine.predict_many(variants, targets=[target])
    base_out = outputs[0]
    if not base_out['results']:
        raise ValueError("해당 질환은 이 성별에서 예측하지 않습니다")
    r0 = base_out['results'][0]
    p_full = r0['prob']
    contribs = []
    for k, output in zip(keys, outputs[1:]):
        p_wo = output['results'][0]['prob']
        delta = p_full - p_wo
        # 대체됐다면 어떤 값으로 대체되는지 (프론트 표시용)
        replacement = engine._default(k, float(base_out['sex']), float(base_out['age_group']))
        eps = 1e-9
        direction = 'up' if delta > eps else 'down' if delta < -eps else 'neutral'
        contribs.append({
            'code': k,
            'label': FEATURES.get(k, {}).get('label', k),
            'value': float(inputs[k]),
            'replaced_with': round(float(replacement), 2),
            'delta': delta,
            'direction': direction,
        })
    contribs.sort(key=lambda c: -abs(c['delta']))
    return {
        'target': target,
        'name': meta['targets'][target],
        'prob': p_full,
        'base': r0['base'],
        'mult': r0['mult'],
        'contribs': contribs[:top_k],
    }
