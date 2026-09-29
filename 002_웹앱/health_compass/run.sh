#!/usr/bin/env bash
# 건강나침반 실행 (Linux) — 기본 0.0.0.0:8017
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

HOST="${HEALTH_COMPASS_HOST:-0.0.0.0}"
PORT="${HEALTH_COMPASS_PORT:-8017}"
PY="${HEALTH_COMPASS_PYTHON:-}"
if [ -z "$PY" ]; then
  if [ -x .venv/bin/python ]; then PY=".venv/bin/python"; else PY="$(command -v python3)"; fi
fi

# 리버스 프록시·터널(로컬 연결)이 보낸 X-Forwarded-* 만 신뢰한다.
exec "$PY" -m uvicorn backend.main:app \
  --host "$HOST" --port "$PORT" \
  --proxy-headers --forwarded-allow-ips "${HEALTH_COMPASS_FORWARDED_IPS:-127.0.0.1}"
