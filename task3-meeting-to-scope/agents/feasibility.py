from __future__ import annotations

import httpx

from models import FeasibilityResult, FeasibilityStatus, KnowledgeResult, Requirement


class ProductFeasibilityAgent:
    """Uses Task 1 knowledge retrieval to classify native settings vs custom work."""

    def __init__(self, base_url: str = "http://127.0.0.1:8000", timeout: float = 5.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def query_task1(self, question: str) -> KnowledgeResult:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as client:
                response = await client.post("/query", json={"question": question, "top_k": 5})
                response.raise_for_status()
                return KnowledgeResult.model_validate(response.json())
        except (httpx.HTTPError, ValueError) as error:
            return KnowledgeResult(
                answer=f"Task 1 was unavailable: {error}",
                source_urls=[],
                confidence=0,
                needs_human=True,
            )

    async def verify(self, requirement: Requirement) -> FeasibilityResult:
        knowledge = await self.query_task1(
            f"For Brilliant Directories, is this requirement supported by a native setting or does it require custom code? Requirement: {requirement.text}"
        )
        answer = knowledge.answer.lower()
        custom_terms = ("custom code", "custom development", "not supported", "api", "javascript", "developer")
        native_terms = ("native setting", "built-in", "configuration", "settings", "admin panel")
        if knowledge.needs_human or knowledge.confidence < 0.45:
            status = FeasibilityStatus.UNCLEAR
            rationale = "Task 1 did not provide sufficiently confident product evidence; confirm with a specialist."
        elif any(term in answer for term in custom_terms):
            status = FeasibilityStatus.CUSTOM
            rationale = "Task 1 knowledge indicates implementation beyond standard settings."
        elif any(term in answer for term in native_terms):
            status = FeasibilityStatus.NATIVE
            rationale = "Task 1 knowledge indicates the behavior can be configured in the product."
        else:
            status = FeasibilityStatus.UNCLEAR
            rationale = "The retrieved product answer did not identify a reliable implementation path."
        return FeasibilityResult(requirement_id=requirement.id, status=status, rationale=rationale, knowledge=knowledge)

    async def verify_all(self, requirements: list[Requirement]) -> list[FeasibilityResult]:
        results: list[FeasibilityResult] = []
        for requirement in requirements:
            results.append(await self.verify(requirement))
        return results
