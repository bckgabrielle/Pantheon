from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class AgentRunRequest(BaseModel):
    # Free-text ask from the popup chat, or empty for a scheduled digest run.
    query: str = ""
    session_id: str = Field(
        ..., description="Stable per-user/session id, used for rate limiting."
    )


class ProposedAction(BaseModel):
    action_id: str
    type: Literal["close_tab", "group_tabs", "bookmark_tab"]
    params: dict
    reason: str
    requires_confirmation: bool = True


class Plan(BaseModel):
    plan_id: str
    summary: str
    actions: list[ProposedAction]
    batch_warning: str | None = None
    truncated_action_count: int = 0
