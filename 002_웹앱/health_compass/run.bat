@echo off
cd /d "%~dp0"
if defined HEALTH_COMPASS_PYTHON (
  "%HEALTH_COMPASS_PYTHON%" -m uvicorn backend.main:app --host 127.0.0.1 --port 8017
) else (
  if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8017
  ) else (
    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8017
  )
)
