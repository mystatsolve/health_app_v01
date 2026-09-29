# -*- coding: utf-8 -*-
"""Pydantic 요청/응답 스키마와 API 입력 검증."""
import math
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .codebook import FEATURES


def _validate_inputs(value):
    """코드북을 단일 출처로 사용해 모델 입력을 정규화한다."""
    if not isinstance(value, dict):
        raise ValueError("inputs는 특성 코드와 숫자 값으로 구성된 객체여야 합니다")

    unknown = sorted(set(value) - set(FEATURES))
    if unknown:
        raise ValueError(f"알 수 없는 특성 코드: {', '.join(unknown)}")

    normalized = {}
    for code, raw in value.items():
        if raw is None:
            continue
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            raise ValueError(f"{code} 값은 숫자여야 합니다")
        number = float(raw)
        if not math.isfinite(number):
            raise ValueError(f"{code} 값은 유한한 숫자여야 합니다")

        spec = FEATURES[code]
        if 'min' in spec and number < float(spec['min']):
            raise ValueError(f"{code} 값은 {spec['min']} 이상이어야 합니다")
        if 'max' in spec and number > float(spec['max']):
            raise ValueError(f"{code} 값은 {spec['max']} 이하여야 합니다")
        if (code == 'AGE' or spec.get('integer')) and not number.is_integer():
            raise ValueError(f"{code} 값은 정수여야 합니다")

        choices = spec.get('choices')
        if choices:
            allowed = {float(choice['value']) for choice in choices}
            if number not in allowed:
                labels = ', '.join(str(int(v) if v.is_integer() else v) for v in sorted(allowed))
                raise ValueError(f"{code} 값은 다음 중 하나여야 합니다: {labels}")
            normalized[code] = int(number) if number.is_integer() else number
        else:
            normalized[code] = int(number) if code == 'AGE' else number

    return normalized


class InputsRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    inputs: dict[str, int | float] = Field(..., description="특성 코드 → 값. 최소 SEX·AGE")

    @field_validator('inputs', mode='before')
    @classmethod
    def validate_inputs(cls, value):
        return _validate_inputs(value)


class PredictRequest(InputsRequest):
    targets: Optional[list[str]] = Field(None, description="지정 시 해당 질환만 계산")


class RiskResult(BaseModel):
    code: str
    name: str
    prob: float
    base: Optional[float]
    mult: Optional[float]
    grade: Optional[str]
    caution: bool


class PredictResponse(BaseModel):
    model_version: Optional[str] = None
    input_count: int
    provided_count: int
    derived_count: int
    imputed_count: int
    imputed: list[str]
    sex: int
    age: float
    age_group: int
    results: list[RiskResult]
    skipped: list[str]


class ContribRequest(InputsRequest):
    target: str
    top_k: int = Field(8, ge=1, le=20)


class ContribItem(BaseModel):
    code: str
    label: str
    value: float
    replaced_with: Optional[float]
    delta: float
    direction: Literal['up', 'down', 'neutral']


class ContribResponse(BaseModel):
    target: str
    name: str
    prob: float
    base: Optional[float]
    mult: Optional[float]
    contribs: list[ContribItem]


class SuggestRequest(InputsRequest):
    pass


class SuggestEffect(BaseModel):
    code: str
    name: str
    mult_before: Optional[float]
    mult_after: Optional[float]
    prob_before: float
    prob_after: float
    delta: float
    direction: Literal['up', 'down', 'neutral']
    caution: bool


class Suggestion(BaseModel):
    id: str
    priority: int
    feature: str
    label: str
    current: float
    target: float
    unit: str
    title: str
    method: str
    effects: list[SuggestEffect]
    increase_count: int
    decrease_count: int
    unchanged_count: int


class OtherSuggestion(BaseModel):
    id: str
    title: str
    text: str
    effects: list[SuggestEffect] = Field(default_factory=list)
    increase_count: int = 0
    decrease_count: int = 0
    unchanged_count: int = 0


class SuggestResponse(BaseModel):
    suggestions: list[Suggestion]
    others: list[OtherSuggestion]
    methodology: str
    disclaimer: str
