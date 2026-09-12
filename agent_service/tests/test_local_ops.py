from __future__ import annotations

from agent_service.tools.local_ops import search_tabs


TABS = [
    {"tab_id": "1", "title": "FastAPI Docs", "url": "https://fastapi.tiangolo.com"},
    {"tab_id": "2", "title": "Inbox", "url": "https://mail.example.test"},
    {"tab_id": "3", "title": "Pytest Guide", "url": "https://docs.pytest.org"},
]


def test_search_tabs_matches_title():
    assert [tab["tab_id"] for tab in search_tabs(TABS, "FastAPI")] == ["1"]


def test_search_tabs_matches_url():
    assert [tab["tab_id"] for tab in search_tabs(TABS, "mail.example")] == ["2"]


def test_search_tabs_is_case_insensitive():
    assert [tab["tab_id"] for tab in search_tabs(TABS, "pytest")] == ["3"]


def test_search_tabs_empty_query_returns_empty_list():
    assert search_tabs(TABS, "   ") == []
