# -*- coding: utf-8 -*-
"""변수 코드북 — 노트북 007 셀 3 주석의 데이터화.

/api/meta로 프론트에 내려가 위저드 폼 생성의 단일 출처가 된다.
type: number(숫자 입력) | radio(버튼 선택) | select(드롭다운)
"""

REGION_NAMES = {1: '서울', 2: '부산', 3: '대구', 4: '인천', 5: '광주', 6: '대전',
                7: '울산', 8: '세종', 9: '경기', 10: '강원', 11: '충북', 12: '충남',
                13: '전북', 14: '전남', 15: '경북', 16: '경남', 17: '제주'}

OCCP_NAMES = {1: '관리자·전문가', 2: '사무종사자', 3: '서비스·판매', 4: '농림어업',
              5: '기능원·장치조작', 6: '단순노무', 7: '무직(주부·학생 등)', 99: '무응답'}

EDUC_NAMES = {1: '서당·한학', 2: '무학', 3: '초등학교', 4: '중학교', 5: '고등학교',
              6: '2·3년제 대학', 7: '4년제 대학', 8: '대학원'}


def _choices(d):
    return [{'value': k, 'label': v} for k, v in d.items()]


FEATURES = {
    # ── 필수 ──
    'SEX': dict(label='성별', group='basic', type='radio', required=True,
                choices=[{'value': 1, 'label': '남성'}, {'value': 2, 'label': '여성'}]),
    'AGE': dict(label='만 나이', group='basic', type='number', required=True,
                unit='세', min=19, max=110, step=1, hint='19세 이상'),
    # ── 신체 기본 (위저드 1단계에 함께 배치) ──
    'HE_HT': dict(label='신장', group='basic', type='number', unit='cm', min=100, max=220, step=0.1),
    'HE_WT': dict(label='체중', group='basic', type='number', unit='kg', min=25, max=200, step=0.1),
    'HE_BMI': dict(label='체질량지수', group='basic', type='number', unit='kg/m²',
                   min=12, max=60, step=0.1, hint='자동 계산 / 직접 입력 선택 가능'),
    # ── 인구·사회경제 ──
    'REGION': dict(label='거주 시도', group='basic', type='select', choices=_choices(REGION_NAMES)),
    'TOWN_T': dict(label='지역 유형', group='basic', type='radio',
                   choices=[{'value': 1, 'label': '동(도시)'}, {'value': 2, 'label': '읍·면(농어촌)'}]),
    'HO_INCM': dict(label='가구소득', group='basic', type='radio',
                    choices=[{'value': 1, 'label': '하'}, {'value': 2, 'label': '중하'},
                             {'value': 3, 'label': '중상'}, {'value': 4, 'label': '상'}]),
    'EDUC': dict(label='학력', group='basic', type='select', choices=_choices(EDUC_NAMES),
                 note='학력 선택지를 원자료 기준으로 정정했습니다. 이전에 입력했다면 다시 확인해주세요.'),
    'CFAM': dict(label='가구원 수', group='basic', type='number', unit='명', min=1, max=15, step=1, integer=True,
                 hint='1명 입력 시 1인가구로 자동 반영'),
    'MARRI_1': dict(label='결혼 여부', group='basic', type='radio',
                    choices=[{'value': 1, 'label': '기혼'}, {'value': 2, 'label': '미혼'}]),
    'EC1_1': dict(label='경제활동', group='basic', type='radio',
                  choices=[{'value': 1, 'label': '취업'}, {'value': 2, 'label': '미취업'}]),
    'OCCP': dict(label='직업', group='basic', type='select', choices=_choices(OCCP_NAMES)),
    # ── 건강행태 ──
    'SMOKE': dict(label='흡연', group='lifestyle', type='radio',
                  choices=[{'value': 0, 'label': '비흡연'}, {'value': 1, 'label': '과거 흡연'},
                           {'value': 2, 'label': '현재 흡연'}]),
    'BD1_11': dict(label='1년간 음주 빈도', group='lifestyle', type='select',
                   choices=[{'value': 0, 'label': '평생 비음주'}, {'value': 1, 'label': '최근 1년 없음'},
                            {'value': 2, 'label': '월 1회 미만'}, {'value': 3, 'label': '월 1회 정도'},
                            {'value': 4, 'label': '월 2~4회'}, {'value': 5, 'label': '주 2~3회'},
                            {'value': 6, 'label': '주 4회 이상'}]),
    'BE3_31': dict(label='1주일 걷기', group='lifestyle', type='number', unit='일', min=0, max=7, step=1, integer=True),
    'BE5_1': dict(label='1주일 근력운동', group='lifestyle', type='number', unit='일', min=0, max=5, step=1, integer=True, hint='5일은 5일 이상'),
    'BP1': dict(label='평소 스트레스', group='lifestyle', type='radio',
                choices=[{'value': 1, 'label': '대단히 많이'}, {'value': 2, 'label': '많이'},
                         {'value': 3, 'label': '조금'}, {'value': 4, 'label': '거의 안 느낌'}]),
    'D_1_1': dict(label='스스로 느끼는 건강', group='lifestyle', type='radio',
                  choices=[{'value': 1, 'label': '매우 좋음'}, {'value': 2, 'label': '좋음'},
                           {'value': 3, 'label': '보통'}, {'value': 4, 'label': '나쁨'},
                           {'value': 5, 'label': '매우 나쁨'}]),
    # ── 검진 수치 ──
    'HE_WC': dict(label='허리둘레', group='exam', type='number', unit='cm', min=40, max=200, step=0.1),
    'HE_SBP': dict(label='수축기혈압', group='exam', type='number', unit='mmHg', min=60, max=260, step=1,
                   note='고혈압 모델에서는 제외(누수 방지)'),
    'HE_DBP': dict(label='이완기혈압', group='exam', type='number', unit='mmHg', min=30, max=160, step=1,
                   note='고혈압 모델에서는 제외(누수 방지)'),
    'HE_GLU': dict(label='공복혈당', group='exam', type='number', unit='mg/dL', min=40, max=500, step=1,
                   note='당뇨병 모델에서는 제외(누수 방지)'),
    'HE_HBA1C': dict(label='당화혈색소', group='exam', type='number', unit='%', min=3, max=18, step=0.1,
                     note='당뇨병 모델에서는 제외(누수 방지)'),
    'HE_CHOL': dict(label='총콜레스테롤', group='exam', type='number', unit='mg/dL', min=60, max=500, step=1,
                    note='고지혈증 모델에서는 제외(누수 방지)'),
    'HE_TG': dict(label='중성지방', group='exam', type='number', unit='mg/dL', min=20, max=1500, step=1,
                  note='고지혈증 모델에서는 제외(누수 방지)'),
    'HE_HDL_ST2': dict(label='HDL콜레스테롤', group='exam', type='number', unit='mg/dL', min=10, max=150, step=1,
                       note='고지혈증 모델에서는 제외(누수 방지)'),
    'HE_HB': dict(label='헤모글로빈', group='exam', type='number', unit='g/dL', min=4, max=22, step=0.1),
    'HE_CREA': dict(label='크레아티닌', group='exam', type='number', unit='mg/dL', min=0.2, max=15, step=0.01),
    'HE_ALT': dict(label='ALT(GPT)', group='exam', type='number', unit='IU/L', min=1, max=1000, step=1),
    'HE_AST': dict(label='AST(GOT)', group='exam', type='number', unit='IU/L', min=1, max=1000, step=1),
    # ── 가족력 ──
    'FH_HP': dict(label='고혈압 가족력', group='family', type='radio', hint='부모·형제자매 중 진단자',
                  choices=[{'value': 0, 'label': '없음'}, {'value': 1, 'label': '있음'}]),
    'FH_DM': dict(label='당뇨병 가족력', group='family', type='radio',
                  choices=[{'value': 0, 'label': '없음'}, {'value': 1, 'label': '있음'}]),
    'FH_HL': dict(label='고지혈증 가족력', group='family', type='radio',
                  choices=[{'value': 0, 'label': '없음'}, {'value': 1, 'label': '있음'}]),
    'FH_IHD': dict(label='허혈성심장질환 가족력', group='family', type='radio',
                   choices=[{'value': 0, 'label': '없음'}, {'value': 1, 'label': '있음'}]),
    'FH_STR': dict(label='뇌졸중 가족력', group='family', type='radio',
                   choices=[{'value': 0, 'label': '없음'}, {'value': 1, 'label': '있음'}]),
    # ── 영양 (1일) ──
    'N_EN': dict(label='에너지', group='nutrition', type='number', unit='kcal', min=200, max=8000, step=10),
    'N_NA': dict(label='나트륨', group='nutrition', type='number', unit='mg', min=100, max=15000, step=10),
    'N_K': dict(label='칼륨', group='nutrition', type='number', unit='mg', min=100, max=10000, step=10),
    'N_FAT': dict(label='지방', group='nutrition', type='number', unit='g', min=0, max=400, step=1),
    'N_PROT': dict(label='단백질', group='nutrition', type='number', unit='g', min=0, max=400, step=1),
    'N_CHO': dict(label='탄수화물', group='nutrition', type='number', unit='g', min=0, max=1000, step=1),
}

# 위저드 5단계 (목업 2b~2f)
STEPS = [
    dict(id=1, screen='2b', title='기본·인구 정보', headline='기본 정보부터\n확인할게요.',
         features=['SEX', 'AGE', 'HE_HT', 'HE_WT', 'HE_BMI'],
         optional_section=dict(title='거주·가구 정보',
                               features=['REGION', 'TOWN_T', 'HO_INCM', 'EDUC', 'CFAM',
                                         'MARRI_1', 'EC1_1', 'OCCP'])),
    dict(id=2, screen='2c', title='생활습관', headline='평소 생활은\n어떤 편인가요?',
         features=['SMOKE', 'BD1_11', 'BE3_31', 'BE5_1', 'BP1', 'D_1_1']),
    dict(id=3, screen='2d', title='건강검진 수치', headline='검진 결과지가 있다면\n가장 큰 도움이 돼요.',
         features=['HE_WC', 'HE_SBP', 'HE_DBP', 'HE_GLU', 'HE_HBA1C', 'HE_CHOL',
                   'HE_TG', 'HE_HDL_ST2', 'HE_HB', 'HE_CREA', 'HE_ALT', 'HE_AST'],
         note='혈압·혈당·지질 수치는 각각 고혈압·당뇨병·고지혈증 모델에서는 제외되고(누수 방지), '
              '다른 질환 모델에서 동반질환 위험으로 활용됩니다.'),
    dict(id=4, screen='2e', title='가족력', headline='부모님이나 형제자매 중\n진단받은 분이 있나요?',
         features=['FH_HP', 'FH_DM', 'FH_HL', 'FH_IHD', 'FH_STR'],
         note='가족력은 심혈관·대사질환 예측에 기여도가 큰 항목이에요. 모르면 비워두세요.'),
    dict(id=5, screen='2f', title='영양섭취 (1일)', headline='하루 식사량을\n대략 알고 있다면.',
         features=['N_EN', 'N_NA', 'N_K', 'N_FAT', 'N_PROT', 'N_CHO'],
         note='식단 앱 기록이나 영양사 상담 자료가 있으면 옮겨 적어보세요. 없으면 건너뛰어도 괜찮아요.'),
]

DISCLAIMER = ('예측값은 조사에서 해당 질환의 의사진단 경험이 있다고 응답할 가능성에 대한 모델 점수이며 '
              '미래 발병 확률이 아닙니다. 의학적 진단이 아닌 통계 모델의 결과이므로 '
              '실제 건강 판단은 의료진과 상담하세요. ⚠ 표시 질환(암 5종·자궁경부암)은 '
              '학습 표본이 적어 참고용입니다. 모델은 내부 시간 분할로만 검증되었으며 외부 임상 검증을 '
              '거치지 않았습니다. 입력 제거 기여도와 값 변경 시뮬레이션은 인과관계나 치료 효과를 뜻하지 않습니다.')
