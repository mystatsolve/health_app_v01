# 건강나침반 (Health Compass)

국민건강영양조사 데이터로 학습한 **14개 질환 예측 모델**을 웹 브라우저에서 사용하는 앱입니다.
성별·나이 등 건강 정보를 입력하면 질환별 모델 점수와 "평균 대비 몇 배"인지를 보여줍니다.

> ⚠️ 결과는 **의사진단 경험에 대한 통계 모델 점수**입니다. 미래 발병 확률이나 의료 진단이 아닙니다.

---

## 목차

1. [폴더 구성](#1-폴더-구성)
2. [준비물](#2-준비물)
3. [설치 — Windows](#3-설치--windows)
4. [설치 — Linux (Ubuntu)](#4-설치--linux-ubuntu)
5. [설치 — macOS](#5-설치--macos)
6. [접속하기](#6-접속하기)
7. [끄기 / 다시 켜기](#7-끄기--다시-켜기)
8. [설정 바꾸기 (포트, 모델 위치, 비밀번호)](#8-설정-바꾸기)
9. [설치가 잘 됐는지 확인하기](#9-설치가-잘-됐는지-확인하기)
10. [자주 생기는 문제](#10-자주-생기는-문제)

---

## 1. 폴더 구성

```
health_app_v01/
├── 002_웹앱/
│   └── health_compass/        ← 웹앱 본체 (여기서 실행)
│       ├── backend/           ← 서버 (FastAPI, 예측 엔진)
│       ├── frontend/          ← 화면 (HTML/CSS/JS)
│       ├── tests/             ← 테스트
│       ├── requirements.txt   ← 설치할 파이썬 패키지 목록 (버전 고정)
│       ├── run.bat            ← Windows 실행 파일
│       ├── run.sh             ← Linux/macOS 실행 파일
│       └── DEPLOY.md          ← 서버 상시 실행·외부 공개 방법 (고급)
└── 008_models/                ← 학습된 AI 모델 (필수!)
    ├── DC1_DG_XGBoost.joblib … (질환별 모델 14개)
    └── inference_meta.joblib  ← 입력 변수·대체값·유병률 정보
```

**중요:** `002_웹앱` 과 `008_models` 는 **같은 폴더 안에 나란히** 있어야 합니다.
웹앱이 자기 위치에서 세 단계 위의 `008_models` 를 자동으로 찾기 때문입니다.
폴더 이름이나 위치를 바꾸면 모델을 찾지 못해 실행되지 않습니다
(위치를 바꾸고 싶다면 [8. 설정 바꾸기](#8-설정-바꾸기)의 `MODEL_DIR` 참고).

---

## 2. 준비물

| 항목 | 설명 |
|---|---|
| **Python 3.10, 3.11 또는 3.12** | 3.9 이하는 동작하지 않습니다. 3.13 이상은 검증하지 않았습니다. **3.10 권장** |
| 인터넷 | **설치할 때만** 필요 (패키지 다운로드). 실행 중에는 필요 없음 |
| 디스크 여유 공간 | 약 1.5GB (파이썬 패키지 포함) |
| Git (선택) | 저장소를 내려받을 때. 없으면 GitHub에서 ZIP으로 받아도 됩니다 |

---

## 3. 설치 — Windows

### 3-1. Python 설치

1. <https://www.python.org/downloads/release/python-31011/> 에 접속합니다.
2. 페이지 아래 **Files** 에서 `Windows installer (64-bit)` 를 내려받아 실행합니다.
3. 설치 첫 화면에서 **`Add python.exe to PATH` 에 반드시 체크**한 뒤 `Install Now` 를 누릅니다.
4. 설치가 끝나면 **명령 프롬프트**(시작 메뉴 → `cmd` 검색)를 열고 확인합니다.

   ```bat
   python --version
   ```

   `Python 3.10.x` 처럼 나오면 성공입니다.

### 3-2. 프로젝트 내려받기

**방법 A — Git 사용**

```bat
cd %USERPROFILE%\Desktop
git clone https://github.com/mystatsolve/health_app_v01.git
```

**방법 B — ZIP 다운로드 (Git이 없을 때)**

1. <https://github.com/mystatsolve/health_app_v01> 접속
2. 초록색 **`Code`** 버튼 → **`Download ZIP`**
3. 바탕화면에 압축을 풉니다. (폴더 이름이 `health_app_v01-main` 이어도 괜찮습니다)

### 3-3. 가상환경 만들기 + 패키지 설치

명령 프롬프트에서 한 줄씩 입력합니다. (경로는 내려받은 위치에 맞게 바꾸세요)

```bat
cd %USERPROFILE%\Desktop\health_app_v01\002_웹앱\health_compass

python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

- `python -m venv .venv` : 이 앱 전용 파이썬 환경(`.venv` 폴더)을 만듭니다. 다른 프로그램과 섞이지 않습니다.
- 마지막 줄은 몇 분 걸릴 수 있습니다. `Successfully installed ...` 가 나오면 완료입니다.

### 3-4. 실행

```bat
run.bat
```

또는 탐색기에서 `health_compass` 폴더의 **`run.bat` 을 더블클릭**해도 됩니다.
아래와 비슷한 메시지가 나오면 실행 중입니다. **이 창을 닫으면 앱이 꺼집니다.**

```
INFO:     Uvicorn running on http://127.0.0.1:8017 (Press CTRL+C to quit)
```

→ [6. 접속하기](#6-접속하기)로 이동하세요.

> Windows의 `run.bat` 은 **이 컴퓨터에서만** 접속할 수 있게(127.0.0.1) 실행합니다.
> 같은 네트워크의 다른 기기에서도 접속하려면 [8. 설정 바꾸기](#8-설정-바꾸기)를 보세요.

---

## 4. 설치 — Linux (Ubuntu)

### 4-1. Python 확인 / 설치

```bash
python3 --version
```

- Ubuntu 22.04는 기본이 3.10이라 그대로 쓰면 됩니다.
- 가상환경 도구가 없다면 설치합니다.

  ```bash
  sudo apt update
  sudo apt install -y python3-venv python3-pip git
  ```

### 4-2. 내려받기 + 설치

```bash
cd ~
git clone https://github.com/mystatsolve/health_app_v01.git
cd health_app_v01/002_웹앱/health_compass

python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

> Linux에서는 XGBoost 설치 시 GPU 통신 라이브러리(`nvidia-nccl`, 약 200MB)가 함께 내려받아집니다.
> GPU가 없어도 정상이며, 앱은 항상 CPU로 계산합니다.

### 4-3. 실행

```bash
chmod +x run.sh      # 처음 한 번만
./run.sh
```

기본으로 `0.0.0.0:8017` 에서 실행되어 **같은 네트워크의 다른 기기에서도 접속**할 수 있습니다.
터미널을 닫으면 꺼집니다. 서버를 재부팅해도 계속 켜 두려면 `002_웹앱/health_compass/DEPLOY.md` 를 참고하세요.

---

## 5. 설치 — macOS

```bash
# 1) Homebrew가 없다면 https://brew.sh 의 설치 명령을 먼저 실행
# 2) Python과 OpenMP(LightGBM·XGBoost에 필요) 설치
brew install python@3.10 libomp git

# 3) 내려받기 + 설치
cd ~
git clone https://github.com/mystatsolve/health_app_v01.git
cd health_app_v01/002_웹앱/health_compass

python3.10 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

# 4) 실행
chmod +x run.sh
./run.sh
```

---

## 6. 접속하기

실행 중인 상태에서 웹 브라우저(Chrome, Edge 등) 주소창에 입력합니다.

| 어디서 접속? | 주소 |
|---|---|
| 앱을 실행한 그 컴퓨터 | <http://127.0.0.1:8017> |
| 같은 네트워크의 다른 PC·휴대폰 (Linux/macOS `run.sh` 기준) | `http://<실행한 컴퓨터의 IP>:8017` |

실행한 컴퓨터의 IP 확인 방법: Windows `ipconfig` / Linux `hostname -I` / macOS `ipconfig getifaddr en0`

**사용 순서**

1. 첫 화면에서 **바로 결과 보기**(성별·나이만) 또는 **자세히 입력**(최대 42개 항목)을 고릅니다.
2. 입력하는 대로 오른쪽(모바일은 하단) 패널에 결과가 바로 바뀝니다.
3. 결과 화면에서 질환 카드를 누르면 어떤 입력이 점수에 영향을 줬는지 볼 수 있습니다.
4. 기록은 **내 브라우저에만** 저장됩니다(서버에 저장 안 됨). 기록 화면에서 JSON으로 내보내고 가져올 수 있습니다.

---

## 7. 끄기 / 다시 켜기

- **끄기:** 실행 중인 창(명령 프롬프트/터미널)에서 **`Ctrl + C`**, 또는 창을 닫습니다.
- **다시 켜기:** 설치는 다시 할 필요 없습니다. `run.bat`(Windows) 또는 `./run.sh`(Linux/macOS)만 실행하면 됩니다.

---

## 8. 설정 바꾸기

환경변수로 설정합니다. 설정하지 않으면 기본값이 사용됩니다.

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `HEALTH_COMPASS_PORT` | `8017` | 접속 포트 (`run.sh` 전용) |
| `HEALTH_COMPASS_HOST` | `0.0.0.0` | `127.0.0.1` 로 바꾸면 이 컴퓨터에서만 접속 가능 (`run.sh` 전용) |
| `MODEL_DIR` | `../../008_models` | 모델 폴더를 다른 곳에 둘 때 그 경로 |
| `HC_AUTH_USER`, `HC_AUTH_PASS` | (없음) | **둘 다** 지정하면 접속 시 아이디/비밀번호를 물어봅니다 |

**Linux/macOS 예시** — 포트 9000, 비밀번호 설정

```bash
HEALTH_COMPASS_PORT=9000 HC_AUTH_USER=admin HC_AUTH_PASS=원하는비밀번호 ./run.sh
```

**Windows 예시** — 모델 위치 변경 + 다른 기기에서도 접속 허용

```bat
set MODEL_DIR=D:\models\008_models
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8017
```

> 외부(인터넷)에 공개할 때는 반드시 `HC_AUTH_USER` / `HC_AUTH_PASS` 를 설정하세요.
> 설정하지 않으면 주소를 아는 누구나 접속할 수 있습니다.

---

## 9. 설치가 잘 됐는지 확인하기

**방법 1 — 브라우저:** 앱을 켠 상태에서 <http://127.0.0.1:8017/api/health> 에 접속합니다.

```json
{"status":"ok","ready":true, ... "models":14,"expected_models":14, ...}
```

`"ready":true` 와 `"models":14` 가 보이면 모델까지 정상입니다.

**방법 2 — 자동 테스트** (`health_compass` 폴더에서)

```bash
# Linux / macOS
.venv/bin/pip install pytest httpx
.venv/bin/python -m pytest -q

# Windows
.venv\Scripts\python.exe -m pip install pytest httpx
.venv\Scripts\python.exe -m pytest -q
```

`1 passed` 가 나오면 성공입니다.

---

## 10. 자주 생기는 문제

| 증상 | 원인 / 해결 |
|---|---|
| `'python'은(는) 내부 또는 외부 명령...이 아닙니다` | Python 설치 때 `Add python.exe to PATH` 를 체크하지 않았습니다. Python을 다시 설치하며 체크하세요. |
| `RuntimeError: 추론 메타 파일을 찾을 수 없습니다 …008_models…` | `008_models` 폴더가 `002_웹앱` 옆에 없습니다. [1. 폴더 구성](#1-폴더-구성)대로 배치하거나 `MODEL_DIR` 를 지정하세요. |
| `ERROR: Could not find a version that satisfies the requirement scikit-learn==1.7.2` 등 | Python 버전이 너무 낮습니다(3.9 이하). **Python 3.10 이상**으로 가상환경을 다시 만드세요. `.venv` 폴더를 지우고 3-3/4-2 단계를 반복합니다. |
| `[Errno 98] Address already in use` / `10048` | 8017 포트를 이미 다른 프로그램(또는 이미 켜 둔 앱)이 쓰고 있습니다. 기존 창을 끄거나 포트를 바꾸세요. |
| 다른 PC에서 접속이 안 됨 | ① Windows `run.bat` 은 127.0.0.1 전용입니다(8번 예시 참고). ② 방화벽에서 8017 포트 허용이 필요할 수 있습니다. |
| macOS에서 `Library not loaded: libomp.dylib` | `brew install libomp` 를 실행하세요. |
| `InconsistentVersionWarning` / 모델 로드 오류 | 패키지 버전이 `requirements.txt` 와 다릅니다. 반드시 `pip install -r requirements.txt` 로 설치하세요(모델 파일은 라이브러리 버전에 민감합니다). |
| `.\run.sh: Permission denied` | `chmod +x run.sh` 를 한 번 실행하세요. |
| 다른 컴퓨터에서 가져온 `.venv` 가 동작하지 않음 | `.venv` 는 만든 컴퓨터 전용입니다. 폴더를 지우고 새 컴퓨터에서 다시 만드세요. |

---

## 참고

- 앱 내부 구조와 동작 설명: `002_웹앱/health_compass/README.md`
- 서버 상시 실행(systemd), 외부 공개(Cloudflare Tunnel): `002_웹앱/health_compass/DEPLOY.md`
- 사용 패키지(버전 고정): FastAPI 0.110.2, uvicorn 0.40.0, pandas 2.3.3, numpy 2.0.2,
  scikit-learn 1.7.2, XGBoost 3.2.0, LightGBM 4.6.0
