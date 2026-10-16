@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
set "TASK1_PID="
set "TASK2_PID="
set "EXIT_CODE=1"
set "PYTHON_EXE="

if exist "%ROOT%.venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
if not defined PYTHON_EXE for /f "delims=" %%P in ('where python 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
if not defined PYTHON_EXE (
  echo Python 3.11+ was not found. Expected .venv\Scripts\python.exe or an active python.
  exit /b 1
)

call :ensure_dependencies
if errorlevel 1 goto :cleanup

pushd "%ROOT%task2-inbox-agent"
call npm run build
if errorlevel 1 exit /b 1
popd

powershell -NoProfile -Command "$p = Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList '-m','uvicorn','app.api:app','--app-dir','%ROOT%task1-knowledge-brain','--host','127.0.0.1','--port','8000' -WorkingDirectory '%ROOT%task1-knowledge-brain' -RedirectStandardOutput '%ROOT%task1.log' -RedirectStandardError '%ROOT%task1-error.log' -PassThru; Set-Content -Path '%ROOT%task1.pid' -Value $p.Id"
call :wait_for_url "http://127.0.0.1:8000/health"
if errorlevel 1 goto :cleanup

powershell -NoProfile -Command "$p = Start-Process -FilePath 'node.exe' -ArgumentList 'dist/src/server.js' -WorkingDirectory '%ROOT%task2-inbox-agent' -RedirectStandardOutput '%ROOT%task2.log' -RedirectStandardError '%ROOT%task2-error.log' -PassThru; Set-Content -Path '%ROOT%task2.pid' -Value $p.Id"
call :wait_for_url "http://127.0.0.1:3000/stats"
if errorlevel 1 goto :cleanup

pushd "%ROOT%task1-knowledge-brain"
"%PYTHON_EXE%" -m pytest -q
if errorlevel 1 goto :cleanup
popd
pushd "%ROOT%"
pushd task2-inbox-agent
call npm test -- --runInBand
if errorlevel 1 goto :cleanup
popd
pushd task3-meeting-to-scope
"%PYTHON_EXE%" -m pytest -q
if errorlevel 1 goto :cleanup
popd
popd
set "EXIT_CODE=0"
echo All capstone evaluations passed.
goto :cleanup

:wait_for_url
for /l %%I in (1,1,90) do (
  powershell -NoProfile -Command "$r = try { Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 2 } catch { $null }; if ($r -and $r.StatusCode -eq 200) { exit 0 } else { exit 1 }"
  if not errorlevel 1 exit /b 0
  >nul timeout /t 1
)
echo Health check failed: %~1
exit /b 1

:ensure_dependencies
"%PYTHON_EXE%" -c "import fastapi, uvicorn, requests, bs4, anthropic, chromadb, pydantic, pytest" >nul 2>&1
if not errorlevel 1 exit /b 0
echo Installing missing Task 1 Python dependencies...
"%PYTHON_EXE%" -m pip install -r "%ROOT%task1-knowledge-brain\requirements.txt"
if errorlevel 1 (
  echo Failed to install Task 1 Python dependencies.
  exit /b 1
)
"%PYTHON_EXE%" -c "import fastapi, uvicorn, requests, bs4, anthropic, chromadb, pydantic, pytest" >nul 2>&1
if errorlevel 1 (
  echo Task 1 dependency verification failed.
  exit /b 1
)
exit /b 0

:cleanup
popd 2>nul
powershell -NoProfile -Command "foreach ($file in @('%ROOT%task1.pid','%ROOT%task2.pid')) { if (Test-Path $file) { $processId = Get-Content $file; Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue; Remove-Item $file -Force } }" >nul 2>&1
exit /b %EXIT_CODE%
