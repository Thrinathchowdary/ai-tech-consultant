from __future__ import annotations

from models import Proposal, ScopeOfWork


class ApprovalRequiredError(RuntimeError):
    """Raised when a document is used before a human has approved it."""


class HumanApprovalGate:
    def approve_scope(self, scope: ScopeOfWork, approver: str) -> ScopeOfWork:
        if not approver.strip():
            raise ValueError("An approver name is required")
        return scope.model_copy(update={"approved": True, "approved_by": approver.strip()})

    def approve_proposal(self, proposal: Proposal, approver: str) -> Proposal:
        if not approver.strip():
            raise ValueError("An approver name is required")
        return proposal.model_copy(update={"approval_required": False, "approved_by": approver.strip()})

    def require_scope(self, scope: ScopeOfWork) -> None:
        if not scope.approved or not scope.approved_by:
            raise ApprovalRequiredError("Scope of Work requires human approval before finalization")

    def require_proposal(self, proposal: Proposal) -> None:
        if proposal.approval_required or not proposal.approved_by:
            raise ApprovalRequiredError("Proposal requires human approval before finalization")
