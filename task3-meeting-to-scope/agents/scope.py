from __future__ import annotations

from models import FeasibilityResult, ScopeOfWork, ScopeTask, TranscriptAnalysis


class ScopeAgent:
    def generate(
        self,
        analysis: TranscriptAnalysis,
        feasibility: list[FeasibilityResult],
    ) -> ScopeOfWork:
        by_requirement = {item.requirement_id: item for item in feasibility}
        tasks: list[ScopeTask] = []
        for index, requirement in enumerate(analysis.requirements, start=1):
            evidence = by_requirement.get(requirement.id)
            status = evidence.status if evidence else "unclear"
            tasks.append(ScopeTask(
                id=f"TASK-{index:03d}",
                requirement_ids=[requirement.id],
                deliverable=requirement.text,
                exclusions=["Unrequested changes to checkout, payment, or unrelated templates"],
                dependencies=requirement.assumptions,
                acceptance_criteria=[f"Demonstrate that the delivered behavior satisfies {requirement.id}", "Confirm responsive and accessible behavior where applicable"],
                feasibility=status,
            ))
        return ScopeOfWork(
            title=f"Scope of Work: {analysis.meeting_id}",
            source_meeting_ids=[analysis.meeting_id],
            deliverables=tasks,
            exclusions=["Checkout and payment changes unless explicitly included in the approved scope", "Production deployment and third-party fees"],
            dependencies=analysis.client_assumptions,
            acceptance_criteria=["Client reviews the demonstrated deliverables", "No requirement is finalized without human approval"],
        )
