from __future__ import annotations

import json

import httpx
import pytest

from agent_service.tools.backend_client import BackendClient


@pytest.mark.asyncio
async def test_backend_client_normalizes_pantheon_tabs(monkeypatch):
    monkeypatch.setattr("agent_service.tools.backend_client.settings.backend_api_key", "key")
    monkeypatch.setattr("agent_service.tools.backend_client.settings.backend_user_id", "default")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-api-key"] == "key"
        return httpx.Response(
            200,
            json={
                "tabs": [
                    {
                        "id": 42,
                        "external_tab_id": "123",
                        "title": "Example",
                        "url": "https://example.test",
                        "device_name": "This Chrome",
                        "active": True,
                        "last_accessed_at": "2026-09-12T09:00:00Z",
                        "days_open": 3,
                        "likely_duplicate": True,
                    }
                ]
            },
        )

    client = BackendClient(base_url="https://backend.test")
    await client._client.aclose()
    client._client = httpx.AsyncClient(
        base_url=client.base_url,
        transport=httpx.MockTransport(handler),
    )

    tabs = await client.get_current_tabs()
    await client.aclose()

    assert tabs == [
        {
            "tab_id": "123",
            "title": "Example",
            "url": "https://example.test",
            "favicon": None,
            "window_id": "",
            "active": True,
            "last_accessed": "2026-09-12T09:00:00Z",
            "device_id": "This Chrome",
            "device_name": "This Chrome",
            "days_open": 3,
            "is_duplicate": True,
            "backend_tab_id": 42,
        }
    ]


@pytest.mark.asyncio
async def test_backend_client_logs_agent_action_as_pantheon_action(monkeypatch):
    monkeypatch.setattr("agent_service.tools.backend_client.settings.backend_api_key", "key")
    monkeypatch.setattr("agent_service.tools.backend_client.settings.backend_user_id", "default")
    posted: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        posted.append(json.loads(request.content))
        return httpx.Response(201, json={"id": 1, "status": "proposed"})

    client = BackendClient(base_url="https://backend.test")
    await client._client.aclose()
    client._tab_id_to_backend_id["123"] = 42
    client._client = httpx.AsyncClient(
        base_url=client.base_url,
        transport=httpx.MockTransport(handler),
    )

    await client.log_action(
        {
            "action_id": "proposal-1",
            "type": "close_tab",
            "params": {"tab_id": "123"},
            "reason": "Duplicate tab.",
            "status": "proposed",
        }
    )
    await client.aclose()

    assert posted == [
        {
            "user_id": "default",
            "tab_id": 42,
            "action_type": "close_tab",
            "status": "proposed",
            "proposed": True,
            "rationale": "Duplicate tab.",
            "payload": {
                "action_id": "proposal-1",
                "params": {"tab_id": "123"},
            },
            "outcome": None,
        }
    ]
