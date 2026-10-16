from __future__ import annotations

from approval import HumanApprovalGate
from models import Proposal, ScopeOfWork


class ProposalAgent:
    def __init__(self, approval_gate: HumanApprovalGate | None = None) -> None:
        self.approval_gate = approval_gate or HumanApprovalGate()

    def generate(self, scope: ScopeOfWork) -> Proposal:
        self.approval_gate.require_scope(scope)
        estimates = [task.estimate for task in scope.deliverables if task.estimate]
        return Proposal(
            title=scope.title,
            executive_summary="This proposal translates the approved client discovery into a prioritized, testable implementation scope.",
            objectives=[task.deliverable for task in scope.deliverables],
            deliverables=[task.deliverable for task in scope.deliverables],
            assumptions=scope.dependencies,
            exclusions=scope.exclusions,
            estimated_hours={
                "low": sum(item.low_hours for item in estimates),
                "likely": sum(item.likely_hours for item in estimates),
                "high": sum(item.high_hours for item in estimates),
            },
        )

    def finalize(self, proposal: Proposal) -> Proposal:
        self.approval_gate.require_proposal(proposal)
        return proposal
