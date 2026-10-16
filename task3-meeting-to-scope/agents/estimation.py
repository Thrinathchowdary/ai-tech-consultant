from __future__ import annotations

from models import Estimate, ScopeOfWork


class EstimationAgent:
    def estimate_task(self, task_id: str, requirement_id: str, description: str) -> Estimate:
        words = description.lower().split()
        integration = any(term in words for term in ("stripe", "payment", "integrate", "integration", "api"))
        complex_ux = any(term in words for term in ("mobile", "filter", "checkout", "responsive", "search"))
        low, likely, high = (16, 28, 44) if integration else (8, 14, 24) if complex_ux else (4, 8, 14)
        return Estimate(
            requirement_id=requirement_id,
            task=task_id,
            low_hours=low,
            likely_hours=likely,
            high_hours=high,
            assumptions=["Existing project access and representative test data are available", "Estimate excludes third-party subscription fees", "One review cycle is included"],
        )

    def attach(self, scope: ScopeOfWork) -> ScopeOfWork:
        updated = []
        for task in scope.deliverables:
            updated.append(task.model_copy(update={
                "estimate": self.estimate_task(task.id, task.requirement_ids[0], task.deliverable)
            }))
        return scope.model_copy(update={"deliverables": updated})
