from __future__ import annotations

import re
from pathlib import Path

from models import Decision, Requirement, RequirementCategory, TranscriptAnalysis


class TranscriptAnalyst:
    """Extracts repeatable, reviewable facts from a role-played transcript."""

    def __init__(self, chunk_size: int = 900) -> None:
        self.chunk_size = chunk_size

    def chunk(self, transcript: str) -> list[str]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", transcript) if part.strip()]
        chunks: list[str] = []
        current = ""
        for paragraph in paragraphs:
            if current and len(current) + len(paragraph) + 2 > self.chunk_size:
                chunks.append(current)
                current = ""
            current = f"{current}\n\n{paragraph}".strip()
        if current:
            chunks.append(current)
        return chunks

    def analyze_file(self, path: str | Path, meeting_id: str | None = None) -> TranscriptAnalysis:
        file_path = Path(path)
        return self.analyze(file_path.read_text(encoding="utf-8"), meeting_id or file_path.stem)

    def analyze(self, transcript: str, meeting_id: str = "meeting") -> TranscriptAnalysis:
        chunks = self.chunk(transcript)
        requirements: list[Requirement] = []
        decisions: list[Decision] = []
        assumptions: list[str] = []

        for line in transcript.splitlines():
            clean = line.strip()
            if not clean or ":" not in clean:
                continue
            speaker, statement = clean.split(":", 1)
            statement = statement.strip()
            lower = statement.lower()
            if "decision noted" in lower or "we approve" in lower or "correct." in lower:
                decisions.append(Decision(text=statement, source_meeting=meeting_id, source_quote=clean))
            if any(marker in lower for marker in ("will provide", "can provide", "subject to", "not yet", "depends on", "dependency")):
                assumptions.append(statement)
            if self._is_requirement(statement):
                requirements.append(Requirement(
                    id=f"REQ-{len(requirements) + 1:03d}",
                    text=statement,
                    category=self._category(lower),
                    source_meeting=meeting_id,
                    source_quotes=[clean],
                    assumptions=[statement] if "need" in lower and "provide" in lower else [],
                ))

        return TranscriptAnalysis(
            meeting_id=meeting_id,
            chunks=chunks,
            requirements=requirements,
            decisions=decisions,
            client_assumptions=sorted(set(assumptions)),
        )

    def _is_requirement(self, statement: str) -> bool:
        lower = statement.lower()
        if lower.endswith("?"):
            return False
        return any(token in lower for token in (
            " need ", " want ", " should ", " must ", " require ", " keep ",
            " add ", " integrate ", " preserve ", " remain ", " become ",
            " filter ", " search ", " checkout", " payment", " guest checkout",
        ))

    def _category(self, statement: str) -> RequirementCategory:
        if any(word in statement for word in ("mobile", "phone", "tap", "keyboard", "contrast", "responsive", "drawer", "panel", "sheet", "chips")):
            return RequirementCategory.UX
        if any(word in statement for word in ("stripe", "payment", "calendar", "integration", "API", "CRM")):
            return RequirementCategory.INTEGRATION
        if any(word in statement for word in ("must", "cannot", "only", "before payment", "one valid", "age-restricted", "guest checkout")):
            return RequirementCategory.BUSINESS_RULE
        return RequirementCategory.FUNCTIONAL
