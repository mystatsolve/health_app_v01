# -*- coding: utf-8 -*-
"""룰 기반 모델 민감도 시뮬레이션 (목업 2i).

사용자가 직접 입력한 수치에만 발동한다(대체값에는 제안하지 않음).
발동된 룰마다 목표값 적용 후 재예측 → 모델 출력 배수의 변화를 제시한다.
관찰 데이터 모델의 출력 변화이므로 인과적 건강 효과로 해석하지 않는다.
표시 순서 = 참고용 암을 제외한 Σ|확률 변화량| 내림차순. 의료적 우선순위가 아니다.
"""
from .codebook import FEATURES
from .engine import CAUTION_TARGETS

# (id, feature, 발동조건(v, sex), 목표값(v, sex), 제목, 방법)
RULES = [
    ('bmi', 'HE_BMI', lambda v, s: v >= 25, lambda v, s: 24.9,
     '체질량지수 낮추기', '주 150분 이상 유산소 운동과 식사량 조절로 체중을 단계적으로 줄여보세요.'),
    ('wc', 'HE_WC', lambda v, s: v >= (90 if s == 1 else 85),
     lambda v, s: 89.0 if s == 1 else 84.0,
     '허리둘레 줄이기', '복부비만 기준(남 90cm·여 85cm) 아래로. 걷기·근력운동 병행이 효과적이에요.'),
    ('sbp', 'HE_SBP', lambda v, s: v >= 120, lambda v, s: 119.0,
     '수축기혈압 낮추기', '저염식·규칙적 운동·절주. 지속되면 의료진과 상담하세요.'),
    ('dbp', 'HE_DBP', lambda v, s: v >= 80, lambda v, s: 79.0,
     '이완기혈압 낮추기', '저염식·체중 관리·스트레스 관리가 도움이 돼요.'),
    ('glu', 'HE_GLU', lambda v, s: v >= 100, lambda v, s: 99.0,
     '공복혈당 낮추기', '정제 탄수화물·당류 줄이기, 식후 걷기. 100mg/dL 미만이 목표예요.'),
    ('tg', 'HE_TG', lambda v, s: v >= 150, lambda v, s: 149.0,
     '중성지방 낮추기', '당류·정제탄수화물·음주 줄이기, 유산소 운동. 150mg/dL 미만이 목표예요.'),
    ('na', 'N_NA', lambda v, s: v > 2000, lambda v, s: 2000.0,
     '나트륨 줄이기', '국물 남기기·저염 조리로 1일 2,000mg 이하(WHO 권장)로.'),
    ('smoke', 'SMOKE', lambda v, s: v == 2, lambda v, s: 1.0,
     '금연하기', '금연은 폐암·심혈관 위험을 낮추는 가장 확실한 방법이에요. 금연클리닉 지원을 활용하세요.'),
    ('walk', 'BE3_31', lambda v, s: v < 5, lambda v, s: 5.0,
     '걷기 늘리기', '주 5일 이상, 하루 30분 걷기를 목표로 조금씩 늘려보세요.'),
    ('alcohol', 'BD1_11', lambda v, s: v >= 5, lambda v, s: 3.0,
     '음주 줄이기', '주 2회 이상 음주를 월 1회 수준으로 줄여보세요.'),
    ('strength', 'BE5_1', lambda v, s: v < 2, lambda v, s: 2.0,
     '근력운동 시작', '주 2회 이상 근력운동은 대사질환 예방에 도움이 돼요.'),
]


def format_value(feature, value):
    spec = FEATURES.get(feature, {})
    for choice in spec.get('choices', []):
        if float(choice['value']) == float(value):
            return choice['label']
    return f"{value:g}{spec.get('unit', '')}"


def compute_suggestions(engine, inputs, max_suggestions=3):
    sex = int(inputs.get('SEX', 0))
    fired = []
    variants = [inputs]
    for rid, feat, cond, goal, title, method in RULES:
        if feat not in inputs or inputs[feat] is None:
            continue  # 입력한 수치에만 발동
        v = float(inputs[feat])
        if not cond(v, sex):
            continue
        target_v = goal(v, sex)
        mod = dict(inputs)
        mod[feat] = target_v
        variants.append(mod)
        fired.append(dict(id=rid, feature=feat,
                          label=FEATURES.get(feat, {}).get('label', feat),
                          current=v, target=target_v,
                          unit=FEATURES.get(feat, {}).get('unit', ''),
                          title=title, method=method))

    outputs = engine.predict_many(variants)
    base_out = outputs[0]
    before = {r['code']: r for r in base_out['results']}
    for item, output in zip(fired, outputs[1:]):
        effects = []
        for after in output['results']:
            old = before[after['code']]
            delta = after['prob'] - old['prob']
            direction = 'up' if delta > 1e-9 else 'down' if delta < -1e-9 else 'neutral'
            effects.append(dict(code=after['code'], name=after['name'],
                                mult_before=old['mult'], mult_after=after['mult'],
                                prob_before=old['prob'], prob_after=after['prob'],
                                delta=delta, direction=direction, caution=after['caution']))
        # 상승·중립도 유지한다. 작은 분모의 희소 질환에 순위가 좌우되지 않게 확률차를 사용한다.
        effects.sort(key=lambda e: -abs(e['delta']))
        item.update(effects=effects,
                    increase_count=sum(e['direction'] == 'up' for e in effects),
                    decrease_count=sum(e['direction'] == 'down' for e in effects),
                    unchanged_count=sum(e['direction'] == 'neutral' for e in effects),
                    _score=sum(abs(e['delta']) for e in effects if e['code'] not in CAUTION_TARGETS))
    fired.sort(key=lambda f: -f['_score'])
    suggestions = []
    for i, f in enumerate(fired[:max_suggestions], 1):
        f.pop('_score')
        f['priority'] = i
        suggestions.append(f)
    others = [dict(id=f['id'], title=f['title'],
                   text=f"{f['label']} {format_value(f['feature'], f['current'])} → "
                        f"{format_value(f['feature'], f['target'])}",
                   effects=f['effects'], increase_count=f['increase_count'],
                   decrease_count=f['decrease_count'], unchanged_count=f['unchanged_count'])
              for f in fired[max_suggestions:]]
    if base_out['imputed_count'] > 0:
        others.append(dict(id='more_input', title='미입력 항목 채우기',
                           text=f"아직 {base_out['imputed_count']}개 모델 특성이 대체값이에요. "
                                '검진 수치를 추가하면 모델 입력이 더 개인화됩니다.'))
    return {
        'suggestions': suggestions,
        'others': others,
        'methodology': ('다른 입력은 고정하고 한 항목만 예시 값으로 바꾸는 민감도 시뮬레이션입니다. '
                        '상승·하락을 모두 표시하며, 변화가 큰 순서이지 건강 개선의 우선순위가 아닙니다.'),
        'disclaimer': ('관찰 데이터 모델의 출력 변화이며 실제 위험 감소, 치료 효과 또는 인과관계를 뜻하지 않습니다. '
                       '생활습관과 치료 결정은 의료진과 상의하세요.'),
    }
