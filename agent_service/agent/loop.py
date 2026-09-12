from __future__ import annotations

import json
import logging
import uuid

import httpx

from agent_service.config import settings
from agent_service.models import Plan, ProposedAction
from agent_service.prompts import SYSTEM_PROMPT
from agent_service.tools.schemas import TOOL_SCHEMAS, READ_TOOL_NAMES, ACTION_TOOL_NAMES
from agent_service.tools.backend_client import BackendClient
from agent_service.tools.local_ops import search_tabs
from agent_service.agent.guardrails import apply_guardrails

logger = logging.getLogger(__name__)


def _groq_tool_schemas() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": schema["name"],
                "description": schema["description"],
                "parameters": schema["input_schema"],
            },
        }
        for schema in TOOL_SCHEMAS
    ]


class GroqChatClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def create(self, **payload) -> dict:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()


_client = GroqChatClient(
    api_key=settings.groq_api_key,
    base_url=settings.groq_base_url,
)


class AgentLoop:
    def __init__(self, backend: BackendClient):
        self.backend = backend
        # Cache the current snapshot within a single run so list_tabs and
        # search_tabs don't each round-trip the backend separately.
        self._tabs_cache: list[dict] | None = None
        self.pending_actions: list[ProposedAction] = []

    async def _get_tabs(self) -> list[dict]:
        if self._tabs_cache is None:
            self._tabs_cache = await self.backend.get_current_tabs()
        return self._tabs_cache

    async def _execute_read_tool(self, name: str, tool_input: dict) -> dict:
        if name == "list_tabs":
            return {"tabs": await self._get_tabs()}
        if name == "search_tabs":
            tabs = await self._get_tabs()
            return {"tabs": search_tabs(tabs, tool_input.get("query", ""))}
        raise ValueError(f"Unknown read tool: {name}")

    def _queue_action_tool(self, name: str, tool_input: dict) -> dict:
        """Action tools never execute here. Record a proposal and return a
        synthetic ack so the model can keep planning."""
        action_id = str(uuid.uuid4())
        reason = tool_input.get("reason", "")
        if name == "close_tab":
            params = {"tab_id": tool_input["tab_id"]}
        elif name == "group_tabs":
            params = {
                "tab_ids": tool_input["tab_ids"],
                "group_name": tool_input["group_name"],
            }
        elif name == "bookmark_tab":
            params = {"tab_id": tool_input["tab_id"], "folder": tool_input["folder"]}
        else:
            raise ValueError(f"Unknown action tool: {name}")

        self.pending_actions.append(
            ProposedAction(
                action_id=action_id,
                type=name,
                params=params,
                reason=reason,
            )
        )
        return {
            "status": "queued_for_user_confirmation",
            "action_id": action_id,
        }

    async def _run_tool(self, name: str, tool_input: dict) -> dict:
        logger.info("Running agent tool", extra={"tool_name": name})
        if name in READ_TOOL_NAMES:
            return await self._execute_read_tool(name, tool_input)
        if name in ACTION_TOOL_NAMES:
            return self._queue_action_tool(name, tool_input)
        raise ValueError(f"Unknown tool: {name}")

    async def run(self, user_query: str) -> Plan:
        query = user_query or (
            "Review my open tabs and propose a cleanup: close stale or "
            "duplicate tabs, and group related ones."
        )
        messages: list[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": query},
        ]
        summary_text = ""

        for _ in range(settings.max_tool_loop_iterations):
            response = await _client.create(
                model=settings.agent_model,
                max_tokens=1500,
                tools=_groq_tool_schemas(),
                messages=messages,
            )
            message = response["choices"][0]["message"]
            tool_calls = message.get("tool_calls") or []

            # Capture any prose the model wrote this turn as the running
            # summary — the last turn's text is what we surface to the user.
            if message.get("content"):
                summary_text = message["content"]

            if not tool_calls:
                break

            messages.append(
                {
                    "role": "assistant",
                    "content": message.get("content"),
                    "tool_calls": tool_calls,
                }
            )

            for tool_call in tool_calls:
                function = tool_call["function"]
                name = function["name"]
                try:
                    tool_input = json.loads(function.get("arguments") or "{}")
                except json.JSONDecodeError as e:
                    content = json.dumps({"error": f"Invalid tool arguments: {e}"})
                else:
                    try:
                        result = await self._run_tool(name, tool_input)
                        content = json.dumps(result)
                    except Exception as e:  # noqa: BLE001
                        content = json.dumps({"error": str(e)})

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": content,
                    }
                )
        else:
            summary_text = summary_text or (
                "Stopped after reaching the max reasoning steps for this run."
            )

        actions, batch_warning, truncated = apply_guardrails(self.pending_actions)

        # Log every proposed action for #4's audit/eval view (non-blocking).
        for a in actions:
            await self.backend.log_action(
                {
                    "action_id": a.action_id,
                    "type": a.type,
                    "params": a.params,
                    "reason": a.reason,
                    "status": "proposed",
                }
            )

        return Plan(
            plan_id=str(uuid.uuid4()),
            summary=summary_text or "No changes proposed.",
            actions=actions,
            batch_warning=batch_warning,
            truncated_action_count=truncated,
        )
