"""FastAPI interface for the Knowledge Brain."""

import json
import os
import threading
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, status

from app.models import (
    EscalationRequest,
    EscalationResponse,
    IngestionRequest,
    IngestionStatus,
    QueryRequest,
    QueryResponse,
)
from app.retrieval import KnowledgeBase
from scripts.ingest import DEFAULT_SITEMAP, run_ingestion

app = FastAPI(title="AI Tech Consultant - Knowledge Brain", version="1.0.0")
DATA_DIR = os.getenv("KNOWLEDGE_DATA_DIR", "data")
knowledge_base = KnowledgeBase(DATA_DIR)
_ingestion_lock = threading.Lock()
_ingestion_state: Dict[str, Any] = {
    "running": False,
    "completed": 0,
    "discovered": 0,
    "failed": 0,
    "last_url": None,
    "message": "idle",
}


def _ingest_in_background(request: IngestionRequest) -> None:
    try:
        result = run_ingestion(
            sitemap_url=request.sitemap_url or DEFAULT_SITEMAP,
            data_dir=DATA_DIR,
            max_pages=request.max_pages,
            force=request.force,
        )
        knowledge_base.reload()
        with _ingestion_lock:
            _ingestion_state.update(
                running=False,
                completed=len(result.get("completed", [])),
                discovered=len(result.get("discovered", [])),
                failed=len(result.get("failed", [])),
                last_url=result.get("last_url"),
                message="completed",
            )
    except Exception as exc:
        with _ingestion_lock:
            _ingestion_state.update(running=False, message=f"failed: {exc}")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "knowledge-brain", "chunks": len(knowledge_base._chunks)}


@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    result = knowledge_base.answer(request.question, request.top_k)
    return QueryResponse(
        answer=result["answer"],
        source_urls=result["sources"],
        confidence=result["confidence"],
        needs_human=result["needs_human"],
    )


@app.post("/ingestion/run", response_model=IngestionStatus, status_code=status.HTTP_202_ACCEPTED)
def start_ingestion(request: IngestionRequest) -> IngestionStatus:
    with _ingestion_lock:
        if _ingestion_state["running"]:
            raise HTTPException(status_code=409, detail="Ingestion is already running")
        _ingestion_state.update(running=True, message="started", last_url=None)
    threading.Thread(target=_ingest_in_background, args=(request,), daemon=True).start()
    return IngestionStatus(**_ingestion_state)


@app.get("/ingestion/status", response_model=IngestionStatus)
def ingestion_status() -> IngestionStatus:
    with _ingestion_lock:
        return IngestionStatus(**_ingestion_state)


@app.post("/escalations", response_model=EscalationResponse, status_code=status.HTTP_201_CREATED)
def create_escalation(request: EscalationRequest) -> EscalationResponse:
    escalation_id = str(uuid.uuid4())
    path = Path(DATA_DIR) / "escalations.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps({"id": escalation_id, **request.model_dump()}) + "\n")
    return EscalationResponse(
        escalation_id=escalation_id,
        status="queued",
        message="Question queued for human review.",
    )
