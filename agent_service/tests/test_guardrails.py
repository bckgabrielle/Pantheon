from __future__ import annotations

from agent_service.agent.guardrails import apply_guardrails
from agent_service.models import ProposedAction


def _close_action(index: int) -> ProposedAction:
    return ProposedAction(
        action_id=f"close-{index}",
        type="close_tab",
        params={"tab_id": f"tab-{index}"},
        reason="Duplicate tab.",
        requires_confirmation=False,
    )


def test_guardrails_force_confirmation_and_truncate_close_batches(monkeypatch):
    monkeypatch.setattr(
        "agent_service.agent.guardrails.settings.max_close_actions_per_plan", 3
    )
    actions = [_close_action(i) for i in range(5)]
    actions.append(
        ProposedAction(
            action_id="group-1",
            type="group_tabs",
            params={"tab_ids": ["tab-1", "tab-2"], "group_name": "Docs"},
            reason="Related docs.",
            requires_confirmation=False,
        )
    )

    guarded, warning, truncated = apply_guardrails(actions)

    assert [action.action_id for action in guarded] == [
        "close-0",
        "close-1",
        "close-2",
        "group-1",
    ]
    assert all(action.requires_confirmation for action in guarded)
    assert truncated == 2
    assert warning == (
        "Found 5 candidate tabs to close — showing the first 3 for review. "
        "Approve this batch, then re-run to see the rest."
    )


def test_guardrails_leave_under_cap_actions_intact(monkeypatch):
    monkeypatch.setattr(
        "agent_service.agent.guardrails.settings.max_close_actions_per_plan", 10
    )
    actions = [_close_action(0)]

    guarded, warning, truncated = apply_guardrails(actions)

    assert guarded == actions
    assert guarded[0].requires_confirmation is True
    assert warning is None
    assert truncated == 0
