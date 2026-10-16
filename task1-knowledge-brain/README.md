# Task 1: The Knowledge Brain

A small, production-shaped FastAPI service for ingesting Brilliant Directories support content and answering questions with cited retrieval results.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.api:app --reload
```

The Anthropic client is optional at runtime. Without `ANTHROPIC_API_KEY`, the service returns a grounded extractive answer from retrieved chunks. ChromaDB is used when installed and falls back to an in-memory index for development environments where its native dependency is unavailable.

## Ingest

```powershell
python scripts/ingest.py --max-pages 25 --delay 1.0
```

Progress is saved in `data/ingestion_state.json`; rerunning resumes from the next URL. Use `--force` to reprocess discovered URLs.

## API

- `GET /health`
- `POST /query`
- `POST /ingestion/run`
- `GET /ingestion/status`
- `POST /escalations`

## Tests

```powershell
pytest -q
```
