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
    "tab_id": 123, "title": "Software QA Engineer — Tana",
    "url": "https://jobs.example.com/tana/qa", "favicon": "https://...",
    "window_id": 9, "active": true, "last_accessed": "2026-09-12T08:58:00Z",
    "career": {"company": "Tana", "role": "Software QA Engineer", "location": "Remote", "skills": ["QA", "API testing"], "status": "NOT_APPLIED", "match_score": 91}
  }]
}
```

`career` is optional. It may be filled by the extension extractor or later by the career agent.

Returns `201`: `{ "snapshot_id": 12, "device_id": 2, "tabs_upserted": 1 }`.

## Read endpoints

- `GET /tabs/current` — latest cross-device state. Adds deterministic `days_open` and `likely_duplicate`.
- `GET /tabs/current?user_id=<id>&include_closed=true` — includes tabs no longer in the latest snapshot.
- `GET /tabs/history?user_id=<id>&since=2026-09-01T00:00:00Z` — raw observation history for staleness reasoning.
- `GET /tabs/duplicates?user_id=<id>` — groups currently open tabs by normalized URL (tracking params/fragments removed).

`user_id` is optional only for the original single-user demo (`default`). After `POST /users`, the extension and agent must send the returned ID with every user-scoped operation.

## Career-memory storage endpoints

All use the same `X-API-Key` header and Pydantic-validated JSON bodies.

- `POST /users` — creates a user and empty profile: `{ "email": "name@example.com", "name": "Name" }`.
- `PUT` / `GET /users/{user_id}/profile` — saves and reads profile context such as `skills`, `resume_url`, and job preferences.
- `POST /jobs` / `GET /jobs/{user_id}` — persists extracted job data. The agent may supply `match_score` and `recommendation`; the storage API does not invent either value.
- `POST /applications` / `GET /applications/{user_id}` — persists draft, review-ready, and submitted application states. One application per user/job is enforced.
- `POST /reminders` / `GET /reminders/{user_id}` — stores follow-up reminders for any tab (`tab_id`), a job (`job_id`), or both. Use `kind` values such as `tab_return`, `job_continue`, or `follow_up`.
- `GET /dashboard/{user_id}` — returns counts for saved jobs, applications, strong matches, review-ready applications, and pending reminders.

Every `POST /snapshots` also writes a `tab_sessions` record. The detailed state stays in `snapshots`, `tabs`, and `tab_observations`.

## `POST /actions`

Use this for both proposed and executed actions; never treat it as permission to execute an extension action.

```json
{
  "tab_id": 42,
  "action_type": "prepare_application",
  "status": "ready_for_review",
  "proposed": true,
  "rationale": "91% profile match; application not completed.",
  "payload": {"company": "Tana"},
  "outcome": null
}
```

The extension/UX must require explicit user confirmation before a final application submission or destructive tab action.

`GET /actions?limit=100` returns this audit log newest first for the popup/dashboard. Store application milestones (`prepare_application`, `submitted`, `rejected`) here to provide the initial application-memory feature without coupling it to a particular job board.
