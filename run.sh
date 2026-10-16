#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK1_PID=""
TASK2_PID=""
if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python.exe >/dev/null 2>&1; then
  PYTHON_BIN="python.exe"
else
  echo "Python 3.11+ was not found" >&2
  exit 1
fi
cleanup() {
  if command -v taskkill.exe >/dev/null 2>&1; then
    [[ -n "$TASK2_PID" ]] && taskkill.exe /PID "$TASK2_PID" /T /F >/dev/null 2>&1 || true
    [[ -n "$TASK1_PID" ]] && taskkill.exe /PID "$TASK1_PID" /T /F >/dev/null 2>&1 || true
  else
    [[ -n "$TASK2_PID" ]] && kill "$TASK2_PID" 2>/dev/null || true
    [[ -n "$TASK1_PID" ]] && kill "$TASK1_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  for _ in {1..30}; do
    if "$PYTHON_BIN" -c "import sys, urllib.request; response = urllib.request.urlopen('$url', timeout=2); sys.exit(0 if response.status == 200 else 1)" >/dev/null 2>&1; then return 0; fi
    sleep 1
done
  echo "Health check failed: $url" >&2
  return 1
}

cd "$ROOT/task2-inbox-agent"
npm run build

cd "$ROOT/task1-knowledge-brain"
nohup "$PYTHON_BIN" -m uvicorn app.api:app --host 127.0.0.1 --port 8000 > "$ROOT/task1.log" 2>&1 &
TASK1_PID=$!
wait_for_url "http://127.0.0.1:8000/health"

cd "$ROOT/task2-inbox-agent"
nohup npm start > "$ROOT/task2.log" 2>&1 &
TASK2_PID=$!
wait_for_url "http://127.0.0.1:3000/stats"

cd "$ROOT"
(cd task1-knowledge-brain && "$PYTHON_BIN" -m pytest -q)
echo "Task 1 passed"
(cd task2-inbox-agent && npm test -- --runInBand)
echo "Task 2 passed"
(cd task3-meeting-to-scope && "$PYTHON_BIN" -m pytest -q)
echo "Task 3 passed"
