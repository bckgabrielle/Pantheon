"""
Thin client for the Backend/Storage service's query API (owned by #2).

Only wraps the endpoints the agent needs to READ. The agent never writes
tab state directly — action tools are proposals, executed later by the
extension (#1) after user confirmation.
"""
from __future__ import annotations

import logging

import httpx

from agent_service.config import settings

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self, base_url: str | None = None, timeout: float = 10.0):
        self.base_url = (base_url or settings.backend_base_url).rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout)
        self._tab_id_to_backend_id: dict[str, int] = {}

    def _headers(self) -> dict[str, str]:
        if not settings.backend_api_key:
            return {}
        return {
            "Authorization": f"Bearer {settings.backend_api_key}",
            "X-API-Key": settings.backend_api_key,
        }

    def _normalize_tab(self, tab: dict) -> dict:
        """Translate backend-specific tab fields into the agent tool contract."""
        tab_id = str(tab.get("tab_id") or tab.get("external_tab_id") or tab.get("id"))
        backend_id = tab.get("id")
        if isinstance(backend_id, int):
            self._tab_id_to_backend_id[tab_id] = backend_id

        normalized = {
            "tab_id": tab_id,
            "title": tab.get("title") or "",
            "url": tab.get("url") or "",
            "favicon": tab.get("favicon"),
            "window_id": str(tab.get("window_id") or ""),
            "active": bool(tab.get("active", False)),
            "last_accessed": tab.get("last_accessed") or tab.get("last_accessed_at"),
            "device_id": str(tab.get("device_id") or tab.get("device_name") or ""),
            "device_name": tab.get("device_name") or "",
            "days_open": tab.get("days_open", 0),
            "is_duplicate": bool(tab.get("is_duplicate", tab.get("likely_duplicate", False))),
        }
        if backend_id is not None:
            normalized["backend_tab_id"] = backend_id
        for key in ("normalized_url", "career", "has_form", "form_check_status", "snoozed", "snoozed_at"):
            if key in tab:
                normalized[key] = tab[key]
        return normalized

    def _normalize_action_log(self, action: dict) -> dict:
        """Translate an agent proposal into Pantheon's audit-log contract."""
        params = action.get("params") or {}
        raw_tab_id = params.get("tab_id")
        backend_tab_id = None
        if raw_tab_id is not None:
            backend_tab_id = self._tab_id_to_backend_id.get(str(raw_tab_id))
            if backend_tab_id is None:
                try:
                    backend_tab_id = int(raw_tab_id)
                except (TypeError, ValueError):
                    backend_tab_id = None

        return {
            "user_id": settings.backend_user_id,
            "tab_id": backend_tab_id,
            "action_type": action.get("type"),
            "status": action.get("status", "proposed"),
            "proposed": True,
            "rationale": action.get("reason"),
            "payload": {
                "action_id": action.get("action_id"),
                "params": params,
            },
            "outcome": None,
        }

    async def get_current_tabs(self) -> list[dict]:
        """GET /tabs/current -> latest known tab snapshot, all devices."""
        resp = await self._client.get(
            "/tabs/current",
            params={"user_id": settings.backend_user_id},
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        # Expect {"tabs": [...]}; tolerate a bare list too.
        tabs = data["tabs"] if isinstance(data, dict) else data
        return [self._normalize_tab(tab) for tab in tabs]

    async def get_duplicates(self) -> list[dict]:
        """GET /tabs/duplicates -> precomputed duplicate groups."""
        resp = await self._client.get(
            "/tabs/duplicates",
            params={"user_id": settings.backend_user_id},
            headers=self._headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        groups = data.get("duplicate_groups", data) if isinstance(data, dict) else data
        normalized_groups = []
        for group in groups:
            tabs = [self._normalize_tab(tab) for tab in group.get("tabs", [])]
            normalized_groups.append({**group, "tabs": tabs})
        return normalized_groups

    async def log_action(self, action: dict) -> None:
        """POST /actions -> log a proposed/executed action for #4's audit view."""
        try:
            await self._client.post(
                "/actions",
                json=self._normalize_action_log(action),
                headers=self._headers(),
            )
        except httpx.HTTPError:
            # Logging failures shouldn't break the agent response; the audit
            # trail is important but non-blocking for v1.
            logger.exception(
                "Failed to log proposed action to backend",
                extra={"action_id": action.get("action_id"), "action_type": action.get("type")},
            )
            pass

    async def aclose(self):
        await self._client.aclose()
