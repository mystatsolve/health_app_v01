# -*- coding: utf-8 -*-
"""엔진 파리티 테스트 — 노트북 007 예시 A/B/C와 결과 대조.

실행: python tests/test_parity.py  (health_compass 루트에서)
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.engine import Engine

EX_A = {'SEX': 2, 'AGE': 25}
EX_B = {'SEX': 1, 'AGE': 58, 'HE_BMI': 26.4, 'HE_WC': 92, 'HE_SBP': 138,
        'HE_DBP': 88, 'HE_GLU': 91, 'HE_CHOL': 120, 'HE_TG': 210, 'SMOKE': 1}
EX_C = {'SEX': 2, 'AGE': 45, 'HE_BMI': 21, 'SMOKE': 2, 'BD1_11': 5, 'BE3_31': 0,
        'BP1': 1, 'D_1_1': 4, 'CFAM': 1, 'FH_DM': 1, 'FH_HP': 1}

# 예시 B 정답 (노트북/직접 실행으로 확보: 질환명, 확률%, 또래평균%, 배수) — 배수 내림차순
EXPECTED_B = [
    ('협심증', 9.7, 2.1, 4.71), ('심근경색', 5.3, 1.3, 4.0), ('뇌졸중', 9.2, 2.4, 3.85),
    ('당뇨병', 41.6, 13.0, 3.2), ('갑상샘암', 1.5, 0.5, 2.69), ('갑상선장애', 4.8, 2.2, 2.19),
    ('폐암', 0.2, 0.1, 1.95), ('고혈압', 49.8, 29.7, 1.67), ('고지혈증', 27.4, 24.0, 1.14),
    ('대장암', 0.6, 0.6, 1.02), ('위암', 0.8, 0.9, 0.94), ('우울증', 2.4, 3.0, 0.82),
    ('간암', 0.1, 0.2, 0.59),
]


def show(tag, out):
    print(f"\n[{tag}] 입력 {out['input_count']} / 대체 {out['imputed_count']} "
          f"(sex={out['sex']}, age_group={out['age_group']}, skipped={out['skipped']})")
    for r in out['results']:
        base = f"{100*r['base']:.1f}%" if r['base'] is not None else '-'
        mult = f"{r['mult']:.2f}" if r['mult'] is not None else 'NaN'
        print(f"  {r['name']:6s} {100*r['prob']:5.1f}%  또래 {base:>6s}  x{mult}"
              f"  {r['grade'] or '-'}{' ⚠' if r['caution'] else ''}")


def main():
    eng = Engine().load()
    assert len(eng.models) == 14, f"모델 14개 필요, 로드됨 {len(eng.models)}"
    print(f"모델 {len(eng.models)}개 로드 OK")

    out_b = eng.predict(EX_B)
    show('예시 B: 58세 남성, 검진수치 10개', out_b)
    assert out_b['input_count'] == 10 and out_b['imputed_count'] == 37, \
        f"카운트 불일치: {out_b['input_count']}/{out_b['imputed_count']} (기대 10/37)"
    assert out_b['skipped'] == ['DC5_DG'], f"skipped 불일치: {out_b['skipped']}"
    fails = []
    for exp, got in zip(EXPECTED_B, out_b['results']):
        name, p, base, mult = exp
        if (got['name'] != name or round(100 * got['prob'], 1) != p
                or round(100 * got['base'], 1) != base or round(got['mult'], 2) != mult):
            fails.append((exp, (got['name'], round(100*got['prob'], 1),
                                round(100*got['base'], 1), round(got['mult'], 2))))
    if fails:
        print("\n*** 파리티 불일치 ***")
        for e, g in fails:
            print(f"  기대 {e}  실제 {g}")
        sys.exit(1)
    print("\n예시 B 파리티: 13개 질환 확률·또래평균·배수·순서 전부 일치 ✔")

    # 예시 A/C는 정답표 없이 구조 검증(실행 성공 + 카운트 + 여성 14행)
    out_a = eng.predict(EX_A)
    show('예시 A: 25세 여성, 추가 정보 없음', out_a)
    assert out_a['input_count'] == 2 and len(out_a['results']) == 14

    out_c = eng.predict(EX_C)
    show('예시 C: 45세 여성, 생활습관·가족력', out_c)
    # CFAM 입력 → ALONE 자동 계산되므로 입력 12개(11 + ALONE)
    assert out_c['input_count'] == 12, f"예시 C 카운트: {out_c['input_count']}"
    assert len(out_c['results']) == 14

    # 오류 케이스
    for bad in [{'AGE': 58}, {'SEX': 1}, {'SEX': 3, 'AGE': 30}, {'SEX': 1, 'AGE': 18}]:
        try:
            eng.predict(bad)
            raise AssertionError(f"오류가 나야 함: {bad}")
        except ValueError:
            pass
    print("\n오류 케이스(SEX/AGE 검증) 4건 OK — 전체 파리티 테스트 통과")


def test_parity(loaded_engine):
    """pytest에서도 노트북 기준값 파리티 검증을 수집한다."""
    out = loaded_engine.predict(EX_B)
    actual = [(r['name'], round(r['prob'] * 100, 1), round(r['base'] * 100, 1), r['mult'])
              for r in out['results']]
    assert actual == EXPECTED_B
    assert out['input_count'] == 10 and out['imputed_count'] == 37
    assert out['skipped'] == ['DC5_DG']
    assert len(loaded_engine.predict(EX_A)['results']) == 14
    out_c = loaded_engine.predict(EX_C)
    assert out_c['input_count'] == 12 and len(out_c['results']) == 14


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
