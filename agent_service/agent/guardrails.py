"""
Guardrails applied AFTER the reasoning loop finishes proposing actions,
before the Plan goes back to the extension. Nothing here executes anything —
these only shape/limit what gets shown for confirmation.
"""
from __future__ import annotations

import logging

from agent_service.config import settings
from agent_service.models import ProposedAction

logger = logging.getLogger(__name__)


def enforce_confirmation_flag(actions: list[ProposedAction]) -> list[ProposedAction]:
    """Every action tool is destructive or state-changing enough that it
    must require explicit confirmation. The model can't opt out of this —
    we force it here regardless of what came back from the loop."""
    for a in actions:
        if not a.requires_confirmation:
            logger.info(
                "Forcing requires_confirmation=true for proposed action",
                extra={"action_id": a.action_id, "action_type": a.type},
            )
        a.requires_confirmation = True
    return actions


def enforce_batch_cap(
    actions: list[ProposedAction],
) -> tuple[list[ProposedAction], str | None, int]:
    """Cap the number of close_tab actions in a single plan. Rather than
    silently dropping the rest, we truncate and surface a clear warning so
    the user can approve in batches."""
    cap = settings.max_close_actions_per_plan
    close_actions = [a for a in actions if a.type == "close_tab"]
    if len(close_actions) <= cap:
        return actions, None, 0

    kept_close_ids = {a.action_id for a in close_actions[:cap]}
    kept = [
        a for a in actions
        if a.type != "close_tab" or a.action_id in kept_close_ids
    ]
    truncated = len(close_actions) - cap
    warning = (
        f"Found {len(close_actions)} candidate tabs to close — showing the "
        f"first {cap} for review. Approve this batch, then re-run to see "
        f"the rest."
    )
    logger.info(
        "Truncated close_tab proposals to batch cap",
        extra={
            "close_action_count": len(close_actions),
            "max_close_actions_per_plan": cap,
            "truncated_action_count": truncated,
        },
    )
    return kept, warning, truncated


def apply_guardrails(
    actions: list[ProposedAction],
) -> tuple[list[ProposedAction], str | None, int]:
    actions = enforce_confirmation_flag(actions)
    actions, warning, truncated = enforce_batch_cap(actions)
    return actions, warning, truncated
