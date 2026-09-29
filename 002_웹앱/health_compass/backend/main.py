# -*- coding: utf-8 -*-
"""건강나침반 — FastAPI 앱.

실행: uvicorn backend.main:app --port 8017  (health_compass 루트에서)
"""
import base64
import binascii
import os
import logging
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from . import codebook
from .contrib import compute_contrib
from .engine import CAUTION_TARGETS, FEMALE_ONLY_TARGETS, Engine
from .schemas import (ContribRequest, ContribResponse, PredictRequest,
                      PredictResponse, SuggestRequest, SuggestResponse)
from .suggest import compute_suggestions

engine = Engine()
logger = logging.getLogger('uvicorn.error')


@asynccontextmanager
async def lifespan(app):
    if not engine.ready:
        engine.load()
    logger.info('Models ready: count=%d version=%s', len(engine.models), engine.model_version)
    yield


app = FastAPI(title="건강나침반", lifespan=lifespan)

# 선택적 HTTP Basic 인증 — 두 환경변수가 모두 설정된 경우에만 활성화된다.
# 외부망 공개 시 접근을 제한하려면 HC_AUTH_USER / HC_AUTH_PASS 를 지정한다.
_AUTH_USER = os.environ.get('HC_AUTH_USER', '')
_AUTH_PASS = os.environ.get('HC_AUTH_PASS', '')
_AUTH_ON = bool(_AUTH_USER and _AUTH_PASS)


def _authorized(header: str) -> bool:
    scheme, _, payload = (header or '').partition(' ')
    if scheme.lower() != 'basic':
        return False
    try:
        user, _, password = base64.b64decode(payload, validate=True).decode('utf-8').partition(':')
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return False
    # 사용자명과 비밀번호 모두 상수 시간 비교로 확인한다.
    return (secrets.compare_digest(user, _AUTH_USER)
            & secrets.compare_digest(password, _AUTH_PASS))


@app.middleware('http')
async def basic_auth(request, call_next):
    if _AUTH_ON and not _authorized(request.headers.get('authorization', '')):
        return Response(status_code=401, content='인증이 필요합니다\n',
                        headers={'WWW-Authenticate': 'Basic realm="health-compass", charset="UTF-8"'})
    return await call_next(request)


@app.middleware('http')
async def request_timing(request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception('Request failed: %s %s', request.method, request.url.path)
        raise
    elapsed = (time.perf_counter() - started) * 1000
    response.headers['Server-Timing'] = f'app;dur={elapsed:.1f}'
    if request.url.path.startswith('/api/'):
        # 건강 입력, 요청 본문, 쿼리 문자열은 기록하지 않는다.
        logger.info('%s %s status=%d duration_ms=%.1f', request.method,
                    request.url.path, response.status_code, elapsed)
    return response


@app.get("/api/health")
def health():
    if not engine.ready:
        raise HTTPException(status_code=503, detail="모델이 준비되지 않았습니다")
    return {"status": "ok", "ready": True, "auth": _AUTH_ON, "models": len(engine.models),
            "expected_models": len(engine.meta['targets']),
            "meta_features": len(engine.meta['features']),
            "algorithms": engine.algorithms}


@app.get("/api/meta")
def meta():
    m = engine.meta
    direct_total = len(codebook.FEATURES)
    model_total = len(m['features'])
    return {
        "app": {"name": "건강나침반", "feature_total": direct_total,
                "model_version": engine.model_version,
                "input_total": direct_total - 2,
                "model_feature_total": model_total,
                "derived_total": model_total - direct_total},
        "targets": [{"code": t, "name": name,
                     "caution": t in CAUTION_TARGETS,
                     "female_only": t in FEMALE_ONLY_TARGETS}
                    for t, name in m['targets'].items()],
        "steps": codebook.STEPS,
        "features": codebook.FEATURES,
        "grade_rule": {"low": "mult<1", "mid": "1<=mult<2", "high": "mult>=2"},
        "disclaimer": codebook.DISCLAIMER,
    }


@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    try:
        return engine.predict(req.inputs, targets=req.targets)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/contrib", response_model=ContribResponse)
def contrib(req: ContribRequest):
    try:
        return compute_contrib(engine, req.inputs, req.target, req.top_k)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/suggest", response_model=SuggestResponse)
def suggest(req: SuggestRequest):
    try:
        return compute_suggestions(engine, req.inputs)
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))


# 프론트 정적 서빙 (마지막에 마운트 — /api/* 우선)
_FRONT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend')
app.mount("/", StaticFiles(directory=_FRONT, html=True), name="frontend")
