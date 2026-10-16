from typing import List, Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(min_length=3)
    top_k: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    answer: str
    source_urls: List[str]
    confidence: float = Field(ge=0, le=1)
    needs_human: bool


class IngestionRequest(BaseModel):
    sitemap_url: Optional[str] = None
    max_pages: Optional[int] = Field(default=None, ge=1)
    force: bool = False


class IngestionStatus(BaseModel):
    running: bool
    completed: int
    discovered: int
    failed: int
    last_url: Optional[str] = None
    message: str = ""


class EscalationRequest(BaseModel):
    question: str = Field(min_length=3)
    context: Optional[str] = None
    source_urls: List[str] = Field(default_factory=list)


class EscalationResponse(BaseModel):
    escalation_id: str
    status: str
    message: str
