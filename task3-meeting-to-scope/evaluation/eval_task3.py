from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from agents.feasibility import ProductFeasibilityAgent
from agents.estimation import EstimationAgent
from agents.proposal import ProposalAgent
from agents.scope import ScopeAgent
from agents.transcript_analyst import TranscriptAnalyst
from approval import ApprovalRequiredError, HumanApprovalGate
from models import FeasibilityStatus, KnowledgeResult, Requirement, RequirementCategory, TranscriptAnalysis
from scope_diff.diff_engine import ScopeDiffEngine

ROOT = Path(__file__).parents[1]
ANALYST = TranscriptAnalyst()


@pytest.fixture
def meeting_a() -> TranscriptAnalysis:
    return ANALYST.analyze_file(ROOT / "transcripts" / "meeting_a.txt", "meeting_a")


@pytest.fixture
def meeting_c() -> TranscriptAnalysis:
    return ANALYST.analyze_file(ROOT / "transcripts" / "meeting_c_followup.txt", "meeting_c_followup")


def test_01_transcript_is_chunked(meeting_a: TranscriptAnalysis) -> None:
    assert len(meeting_a.chunks) > 1


def test_02_requirements_have_sequential_ids(meeting_a: TranscriptAnalysis) -> None:
    assert [item.id for item in meeting_a.requirements] == [f"REQ-{i:03d}" for i in range(1, len(meeting_a.requirements) + 1)]


def test_03_search_requirement_is_extracted(meeting_a: TranscriptAnalysis) -> None:
    assert any("search" in item.text.lower() for item in meeting_a.requirements)


def test_04_combined_filters_are_extracted(meeting_a: TranscriptAnalysis) -> None:
    assert any("filters" in item.text.lower() for item in meeting_a.requirements)


def test_05_mobile_requirements_are_ux(meeting_a: TranscriptAnalysis) -> None:
    assert any(item.category == RequirementCategory.UX and "mobile" in item.text.lower() for item in meeting_a.requirements)


def test_06_decisions_are_preserved(meeting_a: TranscriptAnalysis) -> None:
    assert any("visual identity" in item.text.lower() for item in meeting_a.decisions)


def test_07_client_assumptions_are_preserved(meeting_a: TranscriptAnalysis) -> None:
    assert any("synonym" in item.lower() or "provide" in item.lower() for item in meeting_a.client_assumptions)


def test_08_meeting_b_extracts_payment_integration() -> None:
    analysis = ANALYST.analyze_file(ROOT / "transcripts" / "meeting_b.txt", "meeting_b")
    assert any("stripe" in item.text.lower() for item in analysis.requirements)


def test_09_task1_failure_is_human_reviewable() -> None:
    agent = ProductFeasibilityAgent(base_url="http://127.0.0.1:1", timeout=0.01)
    result = asyncio.run(agent.query_task1("test"))
    assert result.needs_human is True
    assert result.confidence == 0


def test_10_native_answer_is_classified_native() -> None:
    class NativeAgent(ProductFeasibilityAgent):
        async def query_task1(self, question: str) -> KnowledgeResult:
            return KnowledgeResult(answer="This is available in the admin settings as a built-in configuration.", source_urls=[], confidence=0.9, needs_human=False)

    requirement = Requirement(id="REQ-001", text="Configure the catalogue setting", category=RequirementCategory.FUNCTIONAL, source_meeting="test")
    assert asyncio.run(NativeAgent().verify(requirement)).status == FeasibilityStatus.NATIVE


def test_11_custom_answer_is_classified_custom() -> None:
    class CustomAgent(ProductFeasibilityAgent):
        async def query_task1(self, question: str) -> KnowledgeResult:
            return KnowledgeResult(answer="This requires custom code and JavaScript.", source_urls=[], confidence=0.9, needs_human=False)

    requirement = Requirement(id="REQ-001", text="Build a custom search", category=RequirementCategory.FUNCTIONAL, source_meeting="test")
    assert asyncio.run(CustomAgent().verify(requirement)).status == FeasibilityStatus.CUSTOM


def test_12_scope_contains_a_task_per_requirement(meeting_a: TranscriptAnalysis) -> None:
    scope = ScopeAgent().generate(meeting_a, [])
    assert len(scope.deliverables) == len(meeting_a.requirements)


def test_13_estimates_are_three_point_and_ordered(meeting_a: TranscriptAnalysis) -> None:
    scope = EstimationAgent().attach(ScopeAgent().generate(meeting_a, []))
    for task in scope.deliverables:
        assert task.estimate is not None
        assert task.estimate.low_hours <= task.estimate.likely_hours <= task.estimate.high_hours


def test_14_unapproved_scope_cannot_be_used_for_proposal(meeting_a: TranscriptAnalysis) -> None:
    scope = ScopeAgent().generate(meeting_a, [])
    with pytest.raises(ApprovalRequiredError):
        ProposalAgent().generate(scope)


def test_15_human_can_approve_scope(meeting_a: TranscriptAnalysis) -> None:
    scope = ScopeAgent().generate(meeting_a, [])
    approved = HumanApprovalGate().approve_scope(scope, "Maya Chen")
    assert approved.approved is True
    assert approved.approved_by == "Maya Chen"


def test_16_approved_scope_produces_proposal(meeting_a: TranscriptAnalysis) -> None:
    scope = EstimationAgent().attach(ScopeAgent().generate(meeting_a, []))
    approved = HumanApprovalGate().approve_scope(scope, "Maya Chen")
    proposal = ProposalAgent().generate(approved)
    assert proposal.approval_required is True
    assert proposal.estimated_hours["likely"] > 0


def test_17_diff_detects_added_delivery_filter(meeting_a: TranscriptAnalysis, meeting_c: TranscriptAnalysis) -> None:
    diff = ScopeDiffEngine().compare(meeting_a, meeting_c)
    assert any(item.status.value == "Added" and "delivery" in item.description for item in diff.items)


def test_18_diff_detects_modified_mobile_behavior(meeting_a: TranscriptAnalysis, meeting_c: TranscriptAnalysis) -> None:
    diff = ScopeDiffEngine().compare(meeting_a, meeting_c)
    assert any(item.status.value == "Modified" and "bottom sheet" in item.description for item in diff.items)


def test_19_diff_detects_removed_synonym_deliverable(meeting_a: TranscriptAnalysis, meeting_c: TranscriptAnalysis) -> None:
    diff = ScopeDiffEngine().compare(meeting_a, meeting_c)
    assert any(item.status.value == "Removed" and "synonym" in item.description.lower() for item in diff.items)


def test_20_diff_flags_checkout_as_out_of_scope(meeting_a: TranscriptAnalysis, meeting_c: TranscriptAnalysis) -> None:
    diff = ScopeDiffEngine().compare(meeting_a, meeting_c)
    assert any(item.status.value == "Out-of-Scope" for item in diff.items)
