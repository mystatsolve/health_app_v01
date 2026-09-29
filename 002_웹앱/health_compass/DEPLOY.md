# 외부망 서비스 (Linux)

이 서버(사설 <사설IP> / 공인 <공인IP>)에서 **Cloudflare Tunnel**로 외부에 공개한다.
방화벽 인바운드 포트를 열지 않고, 서버가 Cloudflare로 나가는 연결만 사용하므로
기관 방화벽 정책을 바꾸지 않아도 된다. HTTPS는 Cloudflare 엣지에서 자동 종료된다.

```
브라우저 ──HTTPS──> Cloudflare 엣지 ──터널(아웃바운드)──> cloudflared ──> 127.0.0.1:8017 (uvicorn)
```

## 구성 요소

| 항목 | 위치 |
| --- | --- |
| 실행 스크립트 | `run.sh` (HOST/PORT 환경변수, 기본 `0.0.0.0:8017`) |
| 파이썬 환경 | `.venv` (Python 3.10.12, `requirements.txt` 설치 완료) |
| 웹앱 서비스 | `~/.config/systemd/user/health-compass.service` |
| 터널 서비스 | `~/.config/systemd/user/health-compass-tunnel.service` |
| cloudflared | `~/.local/bin/cloudflared` |
| 현재 공개 주소 확인 | `./tunnel-url.sh` |

두 서비스 모두 `enable` 상태이고 `loginctl enable-linger <사용자명>`가 적용되어 있어
로그아웃·재부팅 후에도 자동으로 시작된다. 비정상 종료 시 5초 후 재시작한다.

## 접속 주소

현재는 계정이 필요 없는 **임시 터널(trycloudflare)** 을 사용한다.
주소는 터널 서비스가 재시작될 때마다 바뀌므로 아래 명령으로 확인한다.

```bash
cd <설치폴더>/002_웹앱/health_compass
./tunnel-url.sh        # 예: https://<임의문자열>.trycloudflare.com
```

사내망에서는 `http://<사설IP>:8017` 로도 접속할 수 있다.

## 운영 명령

```bash
systemctl --user status  health-compass health-compass-tunnel
systemctl --user restart health-compass          # 코드 수정 후
systemctl --user restart health-compass-tunnel   # 주소가 바뀐다
systemctl --user stop    health-compass-tunnel   # 외부 공개만 중단
journalctl --user -u health-compass -f           # 앱 로그
journalctl --user -u health-compass-tunnel -f    # 터널 로그
```

앱 로그에는 경로·상태·처리 시간만 남고 요청 본문과 건강 입력은 기록하지 않는다.

## 고정 도메인 (선택)

임시 주소 대신 고정 주소를 쓰려면 Cloudflare 계정과 Cloudflare DNS를 쓰는 도메인이 필요하다.
브라우저 로그인이 필요하므로 아래는 **사용자가 직접** 실행한다.

```bash
cloudflared tunnel login                       # 브라우저에서 도메인 선택
cloudflared tunnel create health-compass       # ~/.cloudflared/<UUID>.json 생성
cloudflared tunnel route dns health-compass health.example.com
```

그런 다음 `~/.cloudflared/config.yml` 을 만들고

```yaml
tunnel: health-compass
credentials-file: ~/.cloudflared/<UUID>.json
ingress:
  - hostname: health.example.com
    service: http://127.0.0.1:8017
  - service: http_status:404
```

터널 서비스의 `ExecStart` 를 아래로 바꾼 뒤 재시작한다.

```
ExecStart=~/.local/bin/cloudflared tunnel --no-autoupdate run health-compass
```

```bash
systemctl --user daemon-reload && systemctl --user restart health-compass-tunnel
```

## 접근 제한 (선택, 현재 비활성)

현재는 주소를 아는 누구나 접속할 수 있다. 아이디·비밀번호를 걸려면
`health-compass.service` 의 주석 처리된 두 줄을 풀고 값을 채운다.

```
Environment=HC_AUTH_USER=원하는아이디
Environment=HC_AUTH_PASS=원하는비밀번호
```

```bash
systemctl --user daemon-reload && systemctl --user restart health-compass
curl -s http://127.0.0.1:8017/api/health   # "auth": true 확인
```

두 값이 모두 있을 때만 전체 페이지와 API에 HTTP Basic 인증이 적용된다(`backend/main.py`).
HTTPS 구간(Cloudflare 엣지 ↔ 브라우저)에서만 자격 증명이 오가도록 터널 주소로 접속한다.

## 직접 포트 개방으로 바꾸려면

터널 대신 공인 IP를 직접 쓰려면 기관/공유기 방화벽에서 8017 인바운드를 허용한 뒤
`http://<공인IP>:8017` 로 접속한다. 이 서버 안에서는 공인 IP로 되돌아오는 접속이
차단되어 있어 도달 여부는 외부 회선에서 확인해야 한다. 이 경로는 평문 HTTP이므로
접근 제한을 함께 켜는 것을 권한다.

## 주의

- 결과는 의사진단 경험에 대한 모델 점수이며 의료 진단이 아니다. 화면의 고지 문구를 유지한다.
- 서버 DB·로그인은 없고 기록은 브라우저 `localStorage`에만 저장된다.
- 외부 공개 중에는 입력이 Cloudflare 엣지를 거쳐 이 서버로 전달된다.
