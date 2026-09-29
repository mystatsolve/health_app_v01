# 건강나침반

국민건강영양조사로 학습한 14개 질환 모델을 제공하는 로컬 웹앱입니다.
직접 입력 42개(필수 성별·나이 + 선택 40개), 자동 파생 특성 5개를 사용합니다.
결과는 의사진단 경험에 대한 모델 점수이며 미래 발병 확률이나 의료 진단이 아닙니다.

## 실행

Linux에서는 이 폴더의 `run.sh`를 실행하면 `0.0.0.0:8017`에서 서비스합니다.
`HEALTH_COMPASS_HOST` / `HEALTH_COMPASS_PORT`로 바꿀 수 있습니다.
상시 실행과 외부망 공개(Cloudflare Tunnel) 구성은 `DEPLOY.md`를 참고하세요.

```bash
./run.sh                                   # 수동 실행
systemctl --user status health-compass     # 상시 실행 서비스 상태
./tunnel-url.sh                            # 외부 공개 주소 확인
```

Windows에서는 `run.bat`을 실행하면 http://127.0.0.1:8017 로 접속할 수 있습니다.
Python 선택 순서는 `HEALTH_COMPASS_PYTHON` 환경변수 → 프로젝트 `.venv` → PATH의 Python입니다.
현재 작업 컴퓨터에는 검증한 `.venv`가 준비되어 있습니다.

```powershell
rtk proxy .venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8017
```

다른 컴퓨터에서는 Python 3.10 환경을 만들고 패키지를 설치하세요. 아래 `python`은
Python 3.10을 가리켜야 합니다. RTK를 사용하지 않는 환경에서는 `rtk proxy`를 생략합니다.

```powershell
rtk proxy python -m venv .venv
rtk proxy .venv\Scripts\python.exe -m pip install -r requirements.txt
rtk proxy .venv\Scripts\python.exe -m pip check
```

- `requirements.txt`: 실행에 필요한 의존성(버전 고정). 테스트에는 `pytest`, `httpx`를 추가로 설치합니다.
- 모델 위치는 프로젝트 루트의 `008_models`; `MODEL_DIR`로 변경할 수 있습니다.
- XGBoost는 저장 파일의 CUDA 학습 설정과 관계없이 웹 추론 시 `device='cpu', n_jobs=1`을 사용합니다.
  Windows HTTP 작업 스레드에서 CUDA 모델을 사용한 뒤 종료할 때 발생하던 중단을 방지합니다.
- LightGBM 4.6에서는 4.7의 `decision_function`과 같은 raw score 경로를 제공하여 기존 보정기를 유지합니다.

## 구조와 동작

- `backend/engine.py`: 검증·파생·대체·단일/배치 예측. 모델 파일과 메타의 해시를 모델 버전으로 제공합니다.
- `backend/contrib.py`: 원본과 입력 제거 시나리오를 묶어 타깃 모델을 한 번 호출합니다.
- `backend/suggest.py`: 발동된 모든 규칙을 배치로 계산하며 질환별 상승·하락·변화 없음을 모두 반환합니다.
- `backend/codebook.py`: 입력 라벨·단위·범위·선택지의 공통 출처.
- `backend/schemas.py`: 요청과 응답 계약. 잘못된 입력은 HTTP 422.
- `frontend/js/api.js`: 최대 64개, 5분 수명의 메모리 캐시. 동일한 진행 중 요청도 합칩니다.
- `frontend/js/prediction.js`: 최신 입력의 계산 완료를 보장하고 바뀐 입력에 오래된 응답이 연결되는 것을 막습니다.
- `frontend/js/state.js`: 입력·예측 연결, BMI 모드, 기록 검증과 백업.
- `/api/health`: 모델 준비 상태와 개수. `/api/meta`: 코드북·질환·모델 버전.
- 응답의 `Server-Timing` 및 서버 로그에 경로·상태·처리 시간을 남깁니다. 요청 본문과 건강 입력은 기록하지 않습니다.

온보딩은 **바로 결과 보기 / 자세히 입력**으로 나뉩니다. 모바일 위저드는 하단 실시간 패널을
접거나 펼칠 수 있습니다. BMI 자동 모드에서는 신장·체중 변경과 삭제가 즉시 반영되고,
직접 입력 모드에서는 사용자가 입력한 BMI를 보존합니다.

요약의 정렬 변경은 카드를 재정렬하며 기여도를 다시 요청하지 않습니다. 상세 화면도 같은 입력·질환의
기여도 캐시를 공유합니다. 입력이 달라지면 다른 키로 계산하며 최종 결과 표시와 저장 전 최신성을 확인합니다.

기록은 `localStorage`의 `hc:v1:*` 키에 저장됩니다. JSON 내보내기는 **저장한 기록의 입력과 결과**를 포함하며,
가져오기는 기존 기록에 병합하고 현재 입력은 바꾸지 않습니다. 같은 기록은 중복 저장하지 않고,
손상·ID 충돌·100개 초과 파일은 적용 전에 거부합니다. 100개가 찼을 때 기존 기록을 자동 삭제하지 않습니다.
새 기록에는 모델 버전도 저장합니다. 차트는 저장 순서대로 점을 배치하며 실제 시간 간격에 비례하지 않습니다.

서버 DB나 로그인은 없습니다. 입력은 계산을 위해 연결된 서버로 전송됩니다.
외부 폰트·프론트 CDN 의존성을 제거해 서버에 연결할 수 있으면 인터넷 없이도 화면을 표시할 수 있습니다.
검진 결과지 OCR은 아직 구현하지 않았으며 화면에 준비 중으로 명시합니다.

## 검증

```powershell
rtk proxy .venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
rtk proxy node --test tests/frontend.test.mjs
```

브라우저가 설치되지 않은 환경에서는 먼저 아래 명령을 실행합니다. 기존 공유 브라우저 캐시를
정리하지 않도록 `PLAYWRIGHT_SKIP_BROWSER_GC=1`을 지정하는 예시입니다.

```powershell
rtk proxy .venv\Scripts\python.exe -c "import os,subprocess,sys; subprocess.run([sys.executable,'-m','playwright','install','chromium','--only-shell'],env=dict(os.environ,PLAYWRIGHT_SKIP_BROWSER_GC='1'),check=True)"
```

- `test_api.py`: TestClient로 정적 파일, JSON 직렬화, 422, 14개 실제 모델, 상승 효과의 누락 여부 확인.
- `test_batch.py`: 배치와 단일 행 결과 비교, 모델 호출 수, 파생 입력 제거, 연령 경계, CPU 추론 설정 확인.
- `test_parity.py`: 노트북 예시 B의 13개 질환 확률·배수·순서, A·C의 구조 확인.
- `test_runtime.py`: 별도 프로세스에서 HTTP 추론 후 종료 코드 0 확인.
- `test_frontend_smoke.py`: 실제 Chromium에서 BMI, 마지막 입력, 모바일 패널, 캐시,
  상승·범주 라벨, 백업 병합, 결측 배수, 늦게 도착한 응답 확인. 임시 서버는 검사 후 종료합니다.
- `frontend.test.mjs`: 상태 최신성, 수동 BMI 보존, 저장 실패, 손상 백업, 캐시·디바운스 회귀 검사.

벤치마크는 HTTP·화면 캐시를 제외한 엔진 함수의 반복 실행 시간을 측정합니다.

```powershell
rtk proxy .venv\Scripts\python.exe scripts\benchmark.py --baseline-zip ..\수정전_백업_2026-09-13.zip
```

## 모델·데이터의 남은 제약

이번 변경은 웹앱의 정확한 표시, 최신성, 추론 성능과 실행 안정성을 개선했습니다.
원자료·정제 CSV·저장 모델을 덮어쓰거나 재학습하지 않았습니다.

- 걷기 변수의 원자료→학습 데이터 코딩 오류, 연도별 지역 코드 통합, 파생값 불일치 등은 데이터 파이프라인에서 별도 교정해야 합니다.
- 학력 선택지 라벨은 원자료에 맞춰 정정했습니다. 이전 사용자는 저장된 학력 선택을 다시 확인해야 합니다.
- 평가셋으로 모델·임계값을 선택한 점, 전체 기간에서 대체값·비교 유병률을 산출한 점은 이번 수정으로 해소되지 않습니다.
- 최소 입력·부분 입력 조건의 성능과 외부 임상 성능은 검증되지 않았습니다.
- 입력 제거 기여도는 SHAP이나 인과효과가 아닙니다. 시뮬레이션은 다른 직접 입력을 고정하며,
  BMI·체중 같은 관련 입력을 현실적인 개입으로 함께 바꾸는 모형도 아닙니다.
- 제안 표시 순서는 참고용 암을 제외한 절대 확률 변화량 합계 기준입니다. 건강 개선의 우선순위로 해석하지 않습니다.

자세한 원인과 데이터 분석은 프로젝트 루트의 `011_프로젝트_상세분석_2026-09-13.md`,
이번 수정·검증 결과는 `012_웹앱_수정결과_2026-09-13.md`를 참고하세요.
