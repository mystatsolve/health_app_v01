import pytest
from fastapi.testclient import TestClient

from backend.main import app, engine


@pytest.fixture(scope='session')
def client():
    # 세션 전체에서 같은 모델을 사용하고 startup 재진입 시 중복 로드를 피한다.
    engine.load()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope='session')
def loaded_engine(client):
    return engine


@pytest.fixture
def full_inputs():
    # 모든 직접 입력 + 11개 시뮬레이션 조건. 실제 개인정보가 아닌 합성 입력.
    return {
        'SEX': 2, 'AGE': 58, 'HE_HT': 171.2, 'HE_WT': 79.4, 'HE_BMI': 27.1,
        'REGION': 9, 'TOWN_T': 1, 'HO_INCM': 3, 'EDUC': 7, 'CFAM': 2,
        'MARRI_1': 1, 'EC1_1': 1, 'OCCP': 2, 'SMOKE': 2, 'BD1_11': 5,
        'BE3_31': 1, 'BE5_1': 0, 'BP1': 2, 'D_1_1': 4, 'HE_WC': 93.5,
        'HE_SBP': 142, 'HE_DBP': 88, 'HE_GLU': 118, 'HE_HBA1C': 6.2,
        'HE_CHOL': 225, 'HE_TG': 210, 'HE_HDL_ST2': 45, 'HE_HB': 13.5,
        'HE_CREA': 0.8, 'HE_ALT': 25, 'HE_AST': 24, 'FH_HP': 1, 'FH_DM': 1,
        'FH_HL': 0, 'FH_IHD': 0, 'FH_STR': 0, 'N_EN': 2200, 'N_NA': 4200,
        'N_K': 3000, 'N_FAT': 70, 'N_PROT': 80, 'N_CHO': 300,
    }
