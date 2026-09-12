from __future__ import annotations

import pytest

from agent_service.agent.loop import AgentLoop


class FakeGroqClient:
    def __init__(self):
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "tool-1",
                                    "type": "function",
                                    "function": {
                                        "name": "list_tabs",
                                        "arguments": "{}",
                                    },
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ]
            }
        if self.calls == 2:
            return {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "tool-2",
                                    "type": "function",
                                    "function": {
                                        "name": "close_tab",
                                        "arguments": (
                                            '{"tab_id": "tab-duplicate", '
                                            '"reason": "Duplicate."}'
                                        ),
                                    },
                                },
                                {
                                    "id": "tool-3",
                                    "type": "function",
                                    "function": {
                                        "name": "group_tabs",
                                        "arguments": (
                                            '{"tab_ids": ["tab-docs-1", "tab-docs-2"], '
                                            '"group_name": "Docs", '
                                            '"reason": "Related documentation."}'
                                        ),
                                    },
                                },
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ]
            }
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "I queued cleanup proposals.",
                    },
                    "finish_reason": "stop",
                }
            ]
        }


class FakeBackend:
    def __init__(self):
        self.logged_actions: list[dict] = []
        self.executed_actions: list[dict] = []

    async def get_current_tabs(self) -> list[dict]:
        return [
            {"tab_id": "tab-duplicate", "title": "Docs", "url": "https://example.test"},
            {"tab_id": "tab-docs-1", "title": "FastAPI", "url": "https://fastapi.tiangolo.com"},
            {"tab_id": "tab-docs-2", "title": "Pytest", "url": "https://docs.pytest.org"},
        ]

    async def log_action(self, action: dict) -> None:
        self.logged_actions.append(action)

    async def close_tab(self, action: dict) -> None:
        self.executed_actions.append(action)

    async def group_tabs(self, action: dict) -> None:
        self.executed_actions.append(action)


@pytest.mark.asyncio
async def test_loop_queues_action_tools_and_logs_proposals(monkeypatch):
    fake_client = FakeGroqClient()
    monkeypatch.setattr("agent_service.agent.loop._client", fake_client)
    backend = FakeBackend()

    plan = await AgentLoop(backend=backend).run("Clean up my tabs.")

    assert plan.summary == "I queued cleanup proposals."
    assert [action.type for action in plan.actions] == ["close_tab", "group_tabs"]
    assert plan.actions[0].params == {"tab_id": "tab-duplicate"}
    assert plan.actions[1].params == {
        "tab_ids": ["tab-docs-1", "tab-docs-2"],
        "group_name": "Docs",
    }
    assert all(action.requires_confirmation for action in plan.actions)
    assert backend.executed_actions == []
    assert [action["type"] for action in backend.logged_actions] == [
        "close_tab",
        "group_tabs",
    ]
    assert all(action["status"] == "proposed" for action in backend.logged_actions)
