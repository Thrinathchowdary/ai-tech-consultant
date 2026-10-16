from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class RequirementCategory(StrEnum):
    FUNCTIONAL = "functional"
    UX = "ux"
    INTEGRATION = "integration"
    BUSINESS_RULE = "business-rule"
    NON_FUNCTIONAL = "non-functional"


class Requirement(BaseModel):
    id: str = Field(pattern=r"^REQ-\d{3}$")
    text: str = Field(min_length=10)
    category: RequirementCategory
    source_meeting: str
    source_quotes: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)


class Decision(BaseModel):
    text: str
    source_meeting: str
    source_quote: str


class TranscriptAnalysis(BaseModel):
    meeting_id: str
    chunks: list[str]
    requirements: list[Requirement]
    decisions: list[Decision]
    client_assumptions: list[str]


class KnowledgeResult(BaseModel):
    answer: str
    source_urls: list[str]
    confidence: float = Field(ge=0, le=1)
    needs_human: bool


class FeasibilityStatus(StrEnum):
    NATIVE = "native-setting"
    CUSTOM = "custom-code"
    UNCLEAR = "unclear"


class FeasibilityResult(BaseModel):
    requirement_id: str
    status: FeasibilityStatus
    rationale: str
    knowledge: KnowledgeResult


class Estimate(BaseModel):
    requirement_id: str
    task: str
    low_hours: float = Field(ge=0)
    likely_hours: float = Field(ge=0)
    high_hours: float = Field(ge=0)
    assumptions: list[str] = Field(min_length=1)


class ScopeTask(BaseModel):
    id: str = Field(pattern=r"^TASK-\d{3}$")
    requirement_ids: list[str] = Field(min_length=1)
    deliverable: str
    exclusions: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(min_length=1)
    feasibility: FeasibilityStatus
    estimate: Estimate | None = None


class ScopeOfWork(BaseModel):
    title: str
    source_meeting_ids: list[str]
    deliverables: list[ScopeTask] = Field(min_length=1)
    exclusions: list[str]
    dependencies: list[str]
    acceptance_criteria: list[str]
    approved: bool = False
    approved_by: str | None = None


class Proposal(BaseModel):
    title: str
    executive_summary: str
    objectives: list[str]
    deliverables: list[str]
    assumptions: list[str]
    exclusions: list[str]
    estimated_hours: dict[Literal["low", "likely", "high"], float]
    approval_required: bool = True
    approved_by: str | None = None


class DiffStatus(StrEnum):
    ADDED = "Added"
    MODIFIED = "Modified"
    REMOVED = "Removed"
    OUT_OF_SCOPE = "Out-of-Scope"


class ScopeDiffItem(BaseModel):
    status: DiffStatus
    requirement_id: str
    description: str
    source_quote: str


class ScopeDiff(BaseModel):
    baseline_meeting: str
    follow_up_meeting: str
    items: list[ScopeDiffItem]
