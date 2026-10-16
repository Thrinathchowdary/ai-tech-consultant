# Project Plan

**Status**: Integrated
**Created**: 2026-10-16
**Mode**: AUGMENT

---

## 1. Project Overview

**Goal**: Extend the existing `task1-knowledge-brain` service into a production-shaped FastAPI knowledge consultant that ingests Brilliant Directories support content, retrieves grounded chunks with citations, answers questions, tracks ingestion progress, and queues low-confidence questions for human review. The project is designed so that every module is independently testable.

**App Type**: API only

**API Login**: No

**Mode**: AUGMENT

**Deployment Plan**: No deployment plan found

---

## 2. Backend — FastAPI Knowledge Brain API

| Component           | Technology               |
| ------------------- | ------------------------ |
| **Language**        | Python                   |
| **Framework**       | FastAPI with Pydantic AI |
| **Runtime**         | CPython                  |
| **Package Manager** | pip                      |
| **Test Runner**     | pytest                   |
| **Mocking Library** | unittest.mock            |
| **Test Command**    | pytest -q                |
| **Orchestration**   | docker-compose           |

The backend preserves the existing domain boundaries: `app/api.py` owns HTTP routes and background ingestion coordination, `app/models.py` owns Pydantic request and response contracts, `app/retrieval.py` owns lexical plus ChromaDB retrieval and grounded answers, and `scripts/ingest.py` owns resumable sitemap ingestion and HTML chunk extraction. ChromaDB remains optional at runtime, with the JSONL-backed in-memory index as the development fallback.

---

## 3. Services Required

| Azure Service                | Role in App                                                             | Environment Variable | Default Value (Local) | Classification |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------- | --------------------- | -------------- |
| ChromaDB (self-hosted/local) | Persist and retrieve support-content chunks and metadata for hybrid RAG | `KNOWLEDGE_DATA_DIR` | `data/`               | Essential      |

No Azure-managed service is selected by the confirmed requirements. The API stores ingestion state and escalation records under the configured local knowledge-data directory, and can run without an Anthropic key by returning a grounded extractive answer.

---

## 4. Prerequisites

### Run

| Tool   | Service(s) | Installed | Version     |
| ------ | ---------- | --------- | ----------- |
| Python | backend    | ✅        | 3.11.5      |
| pip    | backend    | ✅        | 25.3        |
| pytest | backend    | ❓        | Unconfirmed |

The `pytest` command was not confirmed in the host shell; verify it in the project virtual environment before running the test suite.

### Debug

| Tool                               | Service(s) | Installed | Version |
| ---------------------------------- | ---------- | --------- | ------- |
| No additional debug tools required | backend    | ✅        | N/A     |

This API-only plan has no browser frontend, Azure emulator dependency, or Azure Functions service requiring a separate debug integration extension.

---

## 5. Project Structure

```
task1-knowledge-brain/
├── README.md
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── api.py                 # FastAPI application and route orchestration
│   ├── models.py              # Pydantic request and response contracts
│   └── retrieval.py           # Lexical/semantic retrieval and grounded answers
├── data/
│   ├── chunks.jsonl           # Persisted extracted support chunks
│   ├── chroma/                # Optional ChromaDB persistent collection
│   ├── ingestion_state.json   # Resumable sitemap progress
│   └── escalations.jsonl      # Human-review queue records
├── evaluation/
│   ├── __init__.py
│   └── test_eval.py          # Deterministic retrieval evaluation cases
└── scripts/
    ├── __init__.py
    └── ingest.py              # Sitemap discovery, extraction, and ingestion
```

Keep generated runtime data out of source control, preserve the existing import boundaries, and add focused tests for API validation, ingestion state transitions, retrieval fallback behavior, citations, and escalation persistence.

---

## 6. Route Definitions

| #   | Method | Path                | Description                                             | Request Body                           | Response Body                                                   | Status Codes  |
| --- | ------ | ------------------- | ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- | ------------- |
| 1   | GET    | `/health`           | Report service readiness and indexed chunk count        | —                                      | `{ status, service, chunks }`                                   | 200           |
| 2   | POST   | `/query`            | Answer a support question using cited hybrid retrieval  | `{ question, top_k? }`                 | `{ answer, source_urls, confidence, needs_human }`              | 200, 422      |
| 3   | POST   | `/ingestion/run`    | Start resumable sitemap ingestion in the background     | `{ sitemap_url?, max_pages?, force? }` | `{ running, completed, discovered, failed, last_url, message }` | 202, 409, 422 |
| 4   | GET    | `/ingestion/status` | Return the current background ingestion state           | —                                      | `{ running, completed, discovered, failed, last_url, message }` | 200           |
| 5   | POST   | `/escalations`      | Queue a question and retrieval context for human review | `{ question, context?, source_urls? }` | `{ escalation_id, status, message }`                            | 201, 422      |

All validation failures use FastAPI's standard 422 response contract. The ingestion route returns 409 when another ingestion is already running, and escalation records receive a generated UUID and append-only JSONL persistence.

---

## 7. Next Steps

1. Run **azure-project-scaffold** to execute this augment plan in `task1-knowledge-brain`
2. Run **azure-project-integrate** to verify the API against live data, smoke-test the routes, and create any required migrations
3. Run **azure-debug-plan** → **azure-debug-generate** only if containerized local debugging is needed later
4. Run the **azure-deploy** agent when a deployment target and Azure resource plan are approved
