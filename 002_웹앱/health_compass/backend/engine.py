# -*- coding: utf-8 -*-
"""추론 엔진 — 007_ML_질환예측_추론.ipynb 셀 5의 충실한 이식.

파리티(노트북과 동일 결과)가 최우선이므로 타입 변환(sex=float(int()),
ag=float(pd.cut(...)))까지 노트북과 동일하게 유지한다.
"""
import glob
import hashlib
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from .codebook import FEATURES

DEFAULT_MODEL_DIR = Path(__file__).resolve().parents[3] / '008_models'
MODEL_DIR = os.environ.get("MODEL_DIR", str(DEFAULT_MODEL_DIR))

# 표본이 적어 참고용(⚠)인 타깃: 암 5종 + 자궁경부암
CAUTION_TARGETS = {'DC1_DG', 'DC2_DG', 'DC3_DG', 'DC5_DG', 'DC6_DG', 'DC7_DG'}
FEMALE_ONLY_TARGETS = {'DC5_DG'}  # 자궁경부암

# 원천 입력 → 자동 계산되는 파생변수 (노트북 셀 5와 동일)
ENERGY_PCT_DERIVED = {'FAT_PCT_EN': ('N_FAT', 9), 'PROT_PCT_EN': ('N_PROT', 4),
                      'CHO_PCT_EN': ('N_CHO', 4)}
DERIVED_FEATURES = {'ALONE', 'NA_K_RATIO', *ENERGY_PCT_DERIVED}


def _lgbm_decision_function(self, X):
    """lightgbm<4.7 호환: 4.7에서 추가된 decision_function(raw log-odds)을 재현."""
    return self.predict_proba(X, raw_score=True)


def _prepare_model_for_inference(model):
    """모델은 lightgbm 4.7(decision_function 존재) 환경에서 학습·보정되어,
    CalibratedClassifierCV의 isotonic 보정기가 raw log-odds 위에서 학습됨.
    decision_function이 없는 lightgbm(<4.7)에서는 predict_proba가 보정기에
    들어가 결과가 왜곡되므로, 내부 LGBMClassifier에 동등한 decision_function을
    부착해 학습 시 예측 경로를 재현한다. (4.7 이상에서는 아무것도 하지 않음)"""
    for cc in getattr(model, 'calibrated_classifiers_', []):
        est = cc.estimator
        # 작은 추론 배치와 동시 HTTP 요청에서 OpenMP 스레드 과다 생성을 피한다.
        if type(est).__name__ == 'XGBClassifier':
            # 학습 파일의 device='cuda'를 그대로 쓰면 Windows HTTP 작업
            # 스레드에서 사용한 GPU 자원 정리 때 프로세스가 중단될 수 있다.
            # 웹앱의 작은 pandas 배치는 CPU에서 계산한다. 트리·보정기는 유지한다.
            est.set_params(n_jobs=1, device='cpu')
        elif type(est).__name__ == 'LGBMClassifier':
            est.set_params(n_jobs=1)
        if type(est).__name__ == 'LGBMClassifier' \
                and not hasattr(type(est), 'decision_function'):
            # 인스턴스에 bound method를 저장하면 est → method → est 순환 참조가
            # 생겨 native Booster 해제가 인터프리터 종료까지 지연된다.
            type(est).decision_function = _lgbm_decision_function
    return model


def grade_of(mult):
    """배수 → 등급. <1 낮음 / 1~2 보통 / ≥2 높음. NaN이면 None."""
    if mult is None or (isinstance(mult, float) and np.isnan(mult)):
        return None
    if mult >= 2:
        return 'high'
    if mult >= 1:
        return 'mid'
    return 'low'


class Engine:
    def __init__(self, model_dir=MODEL_DIR):
        self.model_dir = model_dir
        self.meta = None
        self.models = {}
        self.target_features = {}  # 타깃별 (leakage 제외한) 특성 리스트 사전계산
        self.model_files = {}
        self.algorithms = {}
        self.model_version = None
        self._group_defaults = {}
        self.ready = False

    def load(self):
        self.ready = False
        self.models.clear()
        self.model_files.clear()
        self.algorithms.clear()
        self.target_features.clear()
        self._group_defaults.clear()
        meta_path = os.path.join(self.model_dir, 'inference_meta.joblib')
        if not os.path.isfile(meta_path):
            raise RuntimeError(f"추론 메타 파일을 찾을 수 없습니다: {meta_path}")
        self.meta = joblib.load(meta_path)
        for path in sorted(glob.glob(os.path.join(self.model_dir, '*_DG_*.joblib'))):
            tgt = '_'.join(os.path.basename(path).split('_')[:2])
            if tgt in self.models:
                raise RuntimeError(f"중복 모델 파일이 있습니다: {tgt}")
            self.models[tgt] = _prepare_model_for_inference(joblib.load(path))
            self.model_files[tgt] = os.path.basename(path)
            algo = Path(path).stem.rsplit('_', 1)[-1]
            self.algorithms[algo] = self.algorithms.get(algo, 0) + 1

        expected = set(self.meta['targets'])
        loaded = set(self.models)
        if expected != loaded:
            missing = ', '.join(sorted(expected - loaded)) or '-'
            unexpected = ', '.join(sorted(loaded - expected)) or '-'
            raise RuntimeError(f"모델 집합 불일치 (누락: {missing}, 예상 밖: {unexpected})")
        for tgt in self.meta['targets']:
            leak = self.meta['leakage'].get(tgt, [])
            self.target_features[tgt] = [f for f in self.meta['features'] if f not in leak]
        digest = hashlib.sha256()
        for path in [meta_path] + [os.path.join(self.model_dir, self.model_files[t])
                                   for t in sorted(self.model_files)]:
            with open(path, 'rb') as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(chunk)
        self.model_version = digest.hexdigest()[:16]
        # 로드 성공만으로 준비 완료로 보지 않고 두 성별의 실제 추론 경로를 확인한다.
        self.predict({'SEX': 1, 'AGE': 50})
        self.predict({'SEX': 2, 'AGE': 50}, targets=['DC5_DG'])
        self.ready = True
        return self

    # ── 노트북 _default와 동일 ──────────────────────────────────────
    def _default(self, feat, sex, ag):
        META = self.meta
        if feat in META['cat_cols']:
            try:
                return META['grp_mode'].loc[(sex, ag), feat]
            except KeyError:
                return META['all_mode'][feat]
        try:
            v = META['grp_median'].loc[(sex, ag), feat]
        except KeyError:
            v = np.nan
        return v if pd.notna(v) else META['all_median'][feat]

    def build_full(self, user_info):
        """입력 검증→연령군→파생→대체. 반환: (full, imputed, sex, age, ag)"""
        META = self.meta
        if not isinstance(user_info, dict):
            raise ValueError("입력은 특성 코드와 숫자 값으로 구성된 객체여야 합니다")
        if 'SEX' not in user_info or user_info['SEX'] is None \
                or 'AGE' not in user_info or user_info['AGE'] is None:
            raise ValueError("SEX(1=남,2=여)와 AGE(만나이)는 필수입니다")
        unknown = sorted(set(user_info) - set(META['features']))
        if unknown:
            raise ValueError(f"알 수 없는 특성 코드: {', '.join(unknown)}")

        ui = {}
        for code, raw in user_info.items():
            if raw is None:
                continue
            if isinstance(raw, (bool, np.bool_)):
                raise ValueError(f"{code} 값은 숫자여야 합니다")
            try:
                number = float(raw)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{code} 값은 숫자여야 합니다") from exc
            if not np.isfinite(number):
                raise ValueError(f"{code} 값은 유한한 숫자여야 합니다")
            spec = FEATURES.get(code)
            if spec:
                if spec.get('integer') and not number.is_integer():
                    raise ValueError(f"{code} 값은 정수여야 합니다")
                if 'min' in spec and number < float(spec['min']):
                    raise ValueError(f"{code} 값은 {spec['min']} 이상이어야 합니다")
                if 'max' in spec and number > float(spec['max']):
                    raise ValueError(f"{code} 값은 {spec['max']} 이하여야 합니다")
                choices = spec.get('choices')
                if choices and number not in {float(c['value']) for c in choices}:
                    raise ValueError(f"{code} 값이 허용 범위를 벗어났습니다")
            ui[code] = number

        sex, age = ui['SEX'], ui['AGE']
        if sex not in (1.0, 2.0) or not age.is_integer() or not 19 <= age <= 110:
            raise ValueError("SEX는 1 또는 2, AGE는 19~110 사이의 정수여야 합니다")
        ag = float(next(i for i, upper in enumerate((29, 39, 49, 59, 69, 200), 1)
                        if age <= upper))
        group = (sex, ag)
        if group not in self._group_defaults:
            self._group_defaults[group] = {
                f: float(self._default(f, sex, ag))
                for f in META['features'] if f not in {'SEX', 'AGE'}
            }
        defaults = self._group_defaults[group]
        # 파생변수: 원천 입력값이 있으면 자동 계산 (노트북과 동일)
        if 'ALONE' not in ui and 'CFAM' in ui:
            ui['ALONE'] = int(float(ui['CFAM']) == 1)
        if 'NA_K_RATIO' not in ui and {'N_NA', 'N_K'} <= ui.keys() and float(ui['N_K']) > 0:
            ui['NA_K_RATIO'] = float(ui['N_NA']) / float(ui['N_K'])
        for dv, (src, mult) in ENERGY_PCT_DERIVED.items():
            if dv not in ui and {src, 'N_EN'} <= ui.keys() and float(ui['N_EN']) > 0:
                ui[dv] = 100 * float(ui[src]) * mult / float(ui['N_EN'])
        full, imputed = {}, []
        for f in META['features']:
            if f == 'SEX':
                full[f] = sex
            elif f == 'AGE':
                full[f] = age
            elif f in ui:
                full[f] = float(ui[f])
            else:
                full[f] = defaults[f]
                imputed.append(f)
        return full, imputed, sex, age, ag

    def _predict_one(self, tgt, full):
        """단일 타깃의 예측확률 p."""
        return float(self._predict_many(tgt, [full])[0])

    def _predict_many(self, tgt, full_rows):
        """동일 타깃의 원본·교란 입력을 한 번의 모델 호출로 계산한다."""
        META = self.meta
        feats = self.target_features[tgt]
        x = pd.DataFrame(full_rows, columns=feats)
        for c in META['cat_cols']:
            if c in feats:
                x[c] = pd.Categorical(x[c].astype(int), categories=META['cat_levels'][c])
        return self.models[tgt].predict_proba(x)[:, 1]

    def predict(self, user_info, targets=None):
        """추론 실행. 반환 dict:
        {input_count, imputed_count, sex, age, age_group, results, skipped}
        results는 배수 내림차순(NaN 마지막) 정렬."""
        return self.predict_many([user_info], targets=targets)[0]

    def predict_many(self, user_infos, targets=None):
        """入力順の予測を返す。女性限定モデルには対象行だけを渡す。"""
        META = self.meta
        wanted = list(META['targets']) if targets is None else list(targets)
        unknown_targets = sorted(set(wanted) - set(META['targets']))
        if unknown_targets:
            raise ValueError(f"알 수 없는 질환 코드: {', '.join(unknown_targets)}")
        wanted = list(dict.fromkeys(wanted))
        prepared = [self.build_full(ui) for ui in user_infos]
        predictions = [{} for _ in prepared]
        for tgt in wanted:
            indices = [i for i, (_, _, sex, _, _) in enumerate(prepared)
                       if not (tgt in FEMALE_ONLY_TARGETS and sex == 1.0)]
            if indices:
                values = self._predict_many(tgt, [prepared[i][0] for i in indices])
                for i, value in zip(indices, values):
                    predictions[i][tgt] = float(value)
        return [self._format_prediction(ui, built, wanted, probs)
                for ui, built, probs in zip(user_infos, prepared, predictions)]

    def _format_prediction(self, user_info, prepared, wanted, probabilities):
        META = self.meta
        _, imputed, sex, age, ag = prepared
        results, skipped = [], []
        for tgt in wanted:
            name = META['targets'][tgt]
            if tgt in FEMALE_ONLY_TARGETS and sex == 1.0:
                skipped.append(tgt)
                continue
            p = probabilities[tgt]
            base = float(META['prevalence'][tgt].get((sex, ag), np.nan))
            mult = round(p / base, 2) if pd.notna(base) and base > 0 else float('nan')
            results.append({
                'code': tgt, 'name': name,
                'prob': p,
                'base': base if pd.notna(base) else None,
                'mult': mult if not np.isnan(mult) else None,
                'grade': grade_of(mult),
                'caution': tgt in CAUTION_TARGETS,
            })
        results.sort(key=lambda r: (-r['mult'] if r['mult'] is not None else float('inf')))
        provided_count = sum(
            1 for code, value in user_info.items()
            if value is not None and code in META['features'] and code not in DERIVED_FEATURES
        )
        derived_count = sum(1 for code in DERIVED_FEATURES if code in META['features'] and code not in imputed)
        return {
            'model_version': self.model_version,
            'input_count': len(META['features']) - len(imputed),
            'provided_count': provided_count,
            'derived_count': derived_count,
            'imputed_count': len(imputed),
            'imputed': imputed,
            'sex': int(sex), 'age': age, 'age_group': int(ag),
            'results': results, 'skipped': skipped,
        }
