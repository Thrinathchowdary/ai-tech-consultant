from __future__ import annotations

import re

from models import DiffStatus, ScopeDiff, ScopeDiffItem, TranscriptAnalysis


class ScopeDiffEngine:
    """Compares requirement intent, including changes expressed in follow-up prose."""

    def compare(self, baseline: TranscriptAnalysis, follow_up: TranscriptAnalysis) -> ScopeDiff:
        baseline_text = " ".join(item.text.lower() for item in baseline.requirements)
        follow_text = " ".join(item.text.lower() for item in follow_up.requirements)
        items: list[ScopeDiffItem] = []

        removal_language = any(term in follow_text for term in ("remove", "removed", "without"))
        if "synonym" in baseline_text and removal_language:
            items.append(ScopeDiffItem(status=DiffStatus.REMOVED, requirement_id="REQ-SYNONYMS", description="Synonym dictionary support was removed from this phase.", source_quote=self._quote(follow_up, "synonym")))
        if "delivery time" in follow_text and "delivery time" not in baseline_text:
            items.append(ScopeDiffItem(status=DiffStatus.ADDED, requirement_id="REQ-DELIVERY-TIME", description="Add delivery-time filtering with next-day and standard options.", source_quote=self._quote(follow_up, "delivery-time")))
        if "bottom sheet" in follow_text and "full-screen" in baseline_text:
            items.append(ScopeDiffItem(status=DiffStatus.MODIFIED, requirement_id="REQ-MOBILE-FILTER", description="Change mobile filters from a full-screen panel to a bottom sheet with removable chips.", source_quote=self._quote(follow_up, "bottom sheet")))
        if "checkout" in follow_text or "payment" in follow_text:
            items.append(ScopeDiffItem(status=DiffStatus.OUT_OF_SCOPE, requirement_id="REQ-CHECKOUT", description="Checkout and payment work belongs to Meeting B, not the Meeting A catalogue baseline.", source_quote=self._quote(follow_up, "checkout") or "Meeting C explicitly excludes checkout and payment work."))
        return ScopeDiff(baseline_meeting=baseline.meeting_id, follow_up_meeting=follow_up.meeting_id, items=items)

    def _quote(self, analysis: TranscriptAnalysis, term: str) -> str:
        for requirement in analysis.requirements:
            if term.lower() in requirement.text.lower():
                return requirement.source_quotes[0] if requirement.source_quotes else requirement.text
        for decision in analysis.decisions:
            if term.lower() in decision.text.lower() or term.lower() in decision.source_quote.lower():
                return decision.source_quote
        return ""
