from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI(title="Mock Tab Backend")

_ACTIONS: list[dict] = []

_TABS: list[dict] = [
    {
        "tab_id": "tab-001",
        "title": "FastAPI - tiangolo",
        "url": "https://fastapi.tiangolo.com/",
        "favicon": "https://fastapi.tiangolo.com/img/favicon.png",
        "window_id": "win-dev",
        "active": False,
        "last_accessed": "2026-09-12T08:10:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 2,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-002",
        "title": "Groq Chat Completions API docs",
        "url": "https://console.groq.com/docs/api-reference",
        "favicon": None,
        "window_id": "win-dev",
        "active": True,
        "last_accessed": "2026-09-12T11:42:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 0,
        "is_duplicate": True,
    },
    {
        "tab_id": "tab-003",
        "title": "Groq Chat Completions API docs",
        "url": "https://console.groq.com/docs/api-reference",
        "favicon": None,
        "window_id": "win-research",
        "active": False,
        "last_accessed": "2026-09-08T16:15:00Z",
        "device_id": "desktop-1",
        "device_name": "Office Desktop",
        "days_open": 4,
        "is_duplicate": True,
    },
    {
        "tab_id": "tab-004",
        "title": "Python logging cookbook",
        "url": "https://docs.python.org/3/howto/logging-cookbook.html",
        "favicon": None,
        "window_id": "win-dev",
        "active": False,
        "last_accessed": "2026-09-01T12:00:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 11,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-005",
        "title": "Pytest fixtures explained",
        "url": "https://docs.pytest.org/en/stable/how-to/fixtures.html",
        "favicon": None,
        "window_id": "win-dev",
        "active": False,
        "last_accessed": "2026-08-25T09:00:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 18,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-006",
        "title": "Docker Compose networking",
        "url": "https://docs.docker.com/compose/networking/",
        "favicon": None,
        "window_id": "win-devops",
        "active": False,
        "last_accessed": "2026-09-10T13:30:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 2,
        "is_duplicate": True,
    },
    {
        "tab_id": "tab-007",
        "title": "Docker Compose networking",
        "url": "https://docs.docker.com/compose/networking/",
        "favicon": None,
        "window_id": "win-devops",
        "active": False,
        "last_accessed": "2026-08-28T13:30:00Z",
        "device_id": "desktop-1",
        "device_name": "Office Desktop",
        "days_open": 15,
        "is_duplicate": True,
    },
    {
        "tab_id": "tab-008",
        "title": "GitHub Actions Python test matrix",
        "url": "https://docs.github.com/actions/automating-builds-and-tests/building-and-testing-python",
        "favicon": None,
        "window_id": "win-devops",
        "active": False,
        "last_accessed": "2026-08-20T07:45:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 23,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-009",
        "title": "News: AI policy roundup",
        "url": "https://example.com/news/ai-policy-roundup",
        "favicon": None,
        "window_id": "win-read",
        "active": False,
        "last_accessed": "2026-08-05T19:00:00Z",
        "device_id": "tablet-1",
        "device_name": "Tablet",
        "days_open": 38,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-010",
        "title": "Local coffee menu",
        "url": "https://example-cafe.test/menu",
        "favicon": None,
        "window_id": "win-personal",
        "active": False,
        "last_accessed": "2026-07-12T14:00:00Z",
        "device_id": "phone-1",
        "device_name": "Phone",
        "days_open": 62,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-011",
        "title": "FastAPI testing",
        "url": "https://fastapi.tiangolo.com/tutorial/testing/",
        "favicon": "https://fastapi.tiangolo.com/img/favicon.png",
        "window_id": "win-dev",
        "active": False,
        "last_accessed": "2026-09-11T10:00:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 1,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-012",
        "title": "SQLModel tutorial",
        "url": "https://sqlmodel.tiangolo.com/tutorial/",
        "favicon": None,
        "window_id": "win-research",
        "active": False,
        "last_accessed": "2026-08-30T10:00:00Z",
        "device_id": "desktop-1",
        "device_name": "Office Desktop",
        "days_open": 13,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-013",
        "title": "Inbox",
        "url": "https://mail.example.test/inbox",
        "favicon": None,
        "window_id": "win-personal",
        "active": True,
        "last_accessed": "2026-09-12T11:50:00Z",
        "device_id": "phone-1",
        "device_name": "Phone",
        "days_open": 0,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-014",
        "title": "Vacation rentals wishlist",
        "url": "https://travel.example.test/wishlist",
        "favicon": None,
        "window_id": "win-personal",
        "active": False,
        "last_accessed": "2026-07-01T08:00:00Z",
        "device_id": "tablet-1",
        "device_name": "Tablet",
        "days_open": 73,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-015",
        "title": "Browser extension MV3 tabs API",
        "url": "https://developer.chrome.com/docs/extensions/reference/api/tabs",
        "favicon": None,
        "window_id": "win-dev",
        "active": False,
        "last_accessed": "2026-09-07T08:20:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 5,
        "is_duplicate": False,
    },
    {
        "tab_id": "tab-016",
        "title": "Pydantic Settings",
        "url": "https://docs.pydantic.dev/latest/concepts/pydantic_settings/",
        "favicon": None,
        "window_id": "win-dev",
        "active": False,
        "last_accessed": "2026-09-03T17:05:00Z",
        "device_id": "laptop-1",
        "device_name": "Don's Laptop",
        "days_open": 9,
        "is_duplicate": False,
    },
]


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True, "service": "mock-backend"}


@app.get("/tabs/current")
async def current_tabs() -> dict:
    return {"tabs": deepcopy(_TABS), "generated_at": datetime.now(timezone.utc).isoformat()}


@app.get("/tabs/duplicates")
async def duplicate_tabs() -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for tab in _TABS:
        if tab["is_duplicate"]:
            groups[tab["url"]].append(tab)
    return [
        {"url": url, "tabs": deepcopy(tabs)}
        for url, tabs in groups.items()
        if len(tabs) > 1
    ]


@app.post("/actions")
async def log_action(action: dict) -> dict:
    recorded = deepcopy(action)
    recorded["received_at"] = datetime.now(timezone.utc).isoformat()
    _ACTIONS.append(recorded)
    return {"ok": True, "status": "logged", "action_count": len(_ACTIONS)}


@app.get("/actions")
async def actions() -> dict:
    return {"actions": deepcopy(_ACTIONS)}
