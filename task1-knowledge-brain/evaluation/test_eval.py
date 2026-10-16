"""Twenty deterministic retrieval evaluation cases for the Knowledge Brain."""

import pytest

from app.retrieval import KnowledgeBase

CASES = [
    ("How do I reset my password?", "password"),
    ("Where can I edit my profile?", "profile"),
    ("How do members sign in?", "login"),
    ("Can I change my email address?", "email"),
    ("How do I upload a logo?", "logo"),
    ("Where are billing settings?", "billing"),
    ("How can I cancel a subscription?", "cancel"),
    ("How do I add a team member?", "team"),
    ("Where can I manage notifications?", "notification"),
    ("How do I configure a domain?", "domain"),
    ("Can I export member data?", "export"),
    ("How are support tickets opened?", "ticket"),
    ("Where can I update company details?", "company"),
    ("How do I add a directory listing?", "listing"),
    ("How can I change the site theme?", "theme"),
    ("Where do I find analytics?", "analytics"),
    ("How do I invite a user?", "invite"),
    ("Can I enable two factor authentication?", "authentication"),
    ("How do I update payment details?", "payment"),
    ("Where can I contact support?", "support"),
]


@pytest.fixture()
def knowledge_base(tmp_path):
    knowledge_base = KnowledgeBase(str(tmp_path))
    knowledge_base.add_chunks([
        {
            "id": str(index),
            "url": f"https://support.example.test/article-{index}",
            "title": keyword.title(),
            "text": f"To manage {keyword}, open the {keyword} settings in your dashboard.",
            "kind": "article",
        }
        for index, (_, keyword) in enumerate(CASES)
    ])
    return knowledge_base


@pytest.mark.parametrize("question, keyword", CASES)
def test_grounded_answer_has_relevant_citation(knowledge_base, question, keyword):
    result = knowledge_base.answer(question)
    assert result["sources"]
    assert keyword in result["answer"].lower()
    assert 0 <= result["confidence"] <= 1
    assert result["needs_human"] is False
