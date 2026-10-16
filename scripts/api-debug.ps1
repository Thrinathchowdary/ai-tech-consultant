Set-Location (Join-Path $PSScriptRoot "..\task1-knowledge-brain")
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000 --reload