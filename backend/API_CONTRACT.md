# Pantheon backend contract

Base URL: `http://localhost:8000`. Every endpoint except `GET /health` needs `X-API-Key: <PANTHEON_API_KEY>`.

## `POST /snapshots`

The extension sends a full snapshot for a single device. Full snapshots keep reconciliation simple: any tab omitted from the next snapshot is marked closed, while `tab_observations` preserves history.

```json
{
  "user_id": "uuid-returned-by-POST-users",
  "device_id": "chrome-uuid-or-session-device-id",
  "device_name": "Henriette's MacBook",
  "captured_at": "2026-09-12T09:00:00Z",
  "source": "extension",
  "tabs": [{
    "tab_id": 123, "title": "Database indexing notes",
    "url": "https://example.com/postgres-indexing", "favicon": "https://...",
    "window_id": 9, "active": true, "last_accessed": "2026-09-12T08:58:00Z",
    "career": null
  }]
}
```

Snapshots represent all browser tabs, not only job tabs. `career` is optional job-specific enrichment and may be omitted for articles, research, shopping, travel, and other tab types.

Returns `201`: `{ "snapshot_id": 12, "device_id": 2, "tabs_upserted": 1 }`.

## Read endpoints

- `GET /tabs/current` — latest cross-device state. Adds deterministic `days_open` and `likely_duplicate`.
- `GET /tabs/current?user_id=<id>&include_closed=true` — includes tabs no longer in the latest snapshot.
- `GET /tabs/history?user_id=<id>&since=2026-09-01T00:00:00Z` — raw observation history for staleness reasoning.
- `GET /tabs/duplicates?user_id=<id>` — groups currently open tabs by normalized URL (tracking params/fragments removed).

`user_id` is optional only for the original single-user demo (`default`). In multi-user deployments, the ID returned by `POST /users` identifies every user-scoped operation.

## Reminders and optional career tracking

All use the same `X-API-Key` header and Pydantic-validated JSON bodies.

- `POST /users` — creates a user and empty profile: `{ "email": "name@example.com", "name": "Name" }`.
- `PUT` / `GET /users/{user_id}/profile` — saves and reads profile context such as `skills`, `resume_url`, and job preferences.
- `POST /jobs` / `GET /jobs/{user_id}` — persists extracted job data, including externally computed `match_score` and `recommendation` values.
- `POST /applications` / `GET /applications/{user_id}` — persists draft, review-ready, and submitted application states. One application per user/job is enforced.
- `POST /reminders` / `GET /reminders/{user_id}` — stores follow-up reminders for any tab (`tab_id`), a job (`job_id`), or both. Use `kind` values such as `tab_return`, `job_continue`, or `follow_up`.
- `GET /dashboard/{user_id}` — returns counts for saved jobs, applications, strong matches, review-ready applications, and pending reminders.

Every `POST /snapshots` also writes a `tab_sessions` record. The detailed state stays in `snapshots`, `tabs`, and `tab_observations`.

## `POST /actions`

Stores both proposed and executed actions. Logging an action does not execute it.

```json
{
  "tab_id": 42,
  "action_type": "group_tabs",
  "status": "proposed",
  "proposed": true,
  "rationale": "These tabs cover the same research topic.",
  "payload": {"group_name": "Research"},
  "outcome": null
}
```

Final application submissions and destructive tab actions require explicit user confirmation before execution.

`GET /actions?limit=100` returns this audit log newest first for the popup/dashboard. It supports tab actions such as `group_tabs`, `bookmark_tab`, and `close_tab`, as well as application milestones when career tracking is used.
