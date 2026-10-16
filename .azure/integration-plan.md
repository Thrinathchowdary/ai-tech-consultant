# Integration Plan

## Backend

- Folder: `task1-knowledge-brain/`
- Run: `python -m uvicorn app.api:app --reload`
- Port: `8000`
- Build/check: `python -m compileall -q app scripts evaluation`; `python -m pytest -q`
- Health: `GET /health`
- Runtime data: `KNOWLEDGE_DATA_DIR` (default `data/`)

## Frontend

- None. This is an API-only project.

## API routes

- `GET /health`
- `POST /query`
- `POST /ingestion/run`
- `GET /ingestion/status`
- `POST /escalations`

## Database and migrations

- No relational database selected.
- Persistence is local JSONL/JSON under `KNOWLEDGE_DATA_DIR`; ChromaDB is optional and local/self-hosted.
- Migration tool/directory: none.
- Connection environment variables: none.
- **Do not create seed data.**

## Shared types

- No separate shared package; Pydantic contracts live in `task1-knowledge-brain/app/models.py`.

## Services

- ChromaDB/local JSONL knowledge index: Essential.
- Anthropic client: optional Enhancement; extractive grounded answers remain the local fallback when no API key is configured.

## Integration Results

- Migrations: N/A. The approved project uses local JSONL persistence with optional local ChromaDB; no relational database or migration runner is configured.
- Backend build/tests: `python -m compileall -q app scripts evaluation` passed; `python -m pytest -q` passed with 20 tests.
- Backend smoke test: uvicorn started successfully with `PYTHONPATH=task1-knowledge-brain`. `GET /health` and `GET /ingestion/status` returned 200, `POST /query` returned 200, `POST /ingestion/run` returned 202, and `POST /escalations` returned 201. The ingestion failure probe used an unreachable local URL and settled to a handled failure status without a server error.
- Frontend/live-data wiring: N/A. This is an API-only project with no frontend, mock client, or frontend dev server.
- End-to-end frontend/backend verification: N/A because no frontend exists. Backend runtime verification completed and the smoke-test server was stopped cleanly.
- No seed data or migration files were created.
