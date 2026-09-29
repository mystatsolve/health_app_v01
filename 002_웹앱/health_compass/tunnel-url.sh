#!/usr/bin/env bash
# 현재 Cloudflare 임시 터널(trycloudflare) 주소 출력
set -euo pipefail
journalctl --user -u health-compass-tunnel -n 400 --no-pager 2>/dev/null \
  | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
