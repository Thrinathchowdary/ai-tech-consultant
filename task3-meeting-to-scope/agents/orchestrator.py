from __future__ import annotations

from pathlib import Path

from approval import HumanApprovalGate
from models import Proposal, ScopeOfWork, ScopeDiff, TranscriptAnalysis
from scope_diff.diff_engine import ScopeDiffEngine
from .estimation import EstimationAgent
from .feasibility import ProductFeasibilityAgent
from .proposal import ProposalAgent
from .scope import ScopeAgent
from .transcript_analyst import TranscriptAnalyst


class MeetingToScopeWorkflow:
    def __init__(self, task1_url: str = "http://127.0.0.1:8000") -> None:
        self.analyst = TranscriptAnalyst()
        self.feasibility = ProductFeasibilityAgent(task1_url)
        self.scope_agent = ScopeAgent()
        self.estimator = EstimationAgent()
        self.approval = HumanApprovalGate()
        self.proposal_agent = ProposalAgent(self.approval)
        self.diff_engine = ScopeDiffEngine()

    def analyze_file(self, path: str | Path, meeting_id: str | None = None) -> TranscriptAnalysis:
        return self.analyst.analyze_file(path, meeting_id)

    async def build_scope(self, analysis: TranscriptAnalysis) -> ScopeOfWork:
        feasibility = await self.feasibility.verify_all(analysis.requirements)
        return self.estimator.attach(self.scope_agent.generate(analysis, feasibility))

    def approve_scope(self, scope: ScopeOfWork, approver: str) -> ScopeOfWork:
        return self.approval.approve_scope(scope, approver)

    def build_proposal(self, approved_scope: ScopeOfWork) -> Proposal:
        return self.proposal_agent.generate(approved_scope)

    def approve_proposal(self, proposal: Proposal, approver: str) -> Proposal:
        approved = self.approval.approve_proposal(proposal, approver)
        return self.proposal_agent.finalize(approved)

    def diff_follow_up(self, baseline: TranscriptAnalysis, follow_up: TranscriptAnalysis) -> ScopeDiff:
        return self.diff_engine.compare(baseline, follow_up)
