# Tab Agent Service (Agent/Tools Engineer — #3)

FastAPI service that holds the Groq API key, runs the tool-use
reasoning loop, and hands back a **Plan** (proposed actions, never
auto-executed) for the extension's confirmation UI (#4).

## Run locally

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in GROQ_API_KEY and BACKEND_API_KEY
uvicorn agent_service.main:app --reload --port 8000
```

## Run with the mock backend

```bash
cp .env.example .env   # fill in GROQ_API_KEY for agent runs
docker compose up --build
```

This starts `agent_service` on port 8000 and the lightweight
`mock_backend` on port 8001. In Docker Compose, `BACKEND_BASE_URL` is wired
to `http://mock-backend:8001`.

## Run with Pantheon backend

```bash
cp .env.example .env   # fill in GROQ_API_KEY and PANTHEON_API_KEY
docker compose -f docker-compose.pantheon.yml up --build
```

This starts `agent_service` on port 8000 and Pantheon's Python backend on
port 8001. The agent normalizes Pantheon tab fields into the published
tool contract and logs proposed actions back to Pantheon's `/actions`
audit endpoint. Logging still does not execute browser actions.

## The contract (publish this early to #1 and #2)

- **Tool schemas**: `tools/schemas.py` — exact names/params/return shapes.
  - `list_tabs`, `search_tabs` are **read** tools — resolved live against
    #2's `GET /tabs/current` during the loop.
  - `close_tab`, `group_tabs`, `bookmark_tab` are **action** tools — calling
    them from the model NEVER executes anything. Each call is queued as a
    `ProposedAction` and only becomes real once #1 executes it after the
    user approves it in #4's confirmation UI.
- **API this service exposes**: `POST /agent/run` — see `models.py` for
  `AgentRunRequest` / `Plan` shapes. This is what #4 calls (directly or
  via #1's background worker) to get a fresh plan.
- **API this service calls**: `GET /tabs/current`, `GET /tabs/duplicates`,
  `POST /actions` on #2's backend — see `tools/backend_client.py`.

## Guardrails (v1)

- Every action tool call is forced to `requires_confirmation: true` —
  the model cannot opt out of this (`agent/guardrails.py`).
- Plans are capped at `MAX_CLOSE_ACTIONS_PER_PLAN` (default 10) close
  proposals; extras are truncated with a `batch_warning` in the response
  rather than silently executed or dropped.
- The tool loop itself is capped at `MAX_TOOL_LOOP_ITERATIONS` (default 8)
  round-trips to bound latency and API spend per run.
- Per-session sliding-window rate limiting on `/agent/run`
  (`agent/rate_limit.py`), defaults 20 requests / 60s.

## v2 note

Once this works end-to-end, the same `TOOL_SCHEMAS` should port directly to
an MCP server if the team migrates to a hosted agent SDK — the read/action
split maps cleanly onto SDK hooks (confirm-before-close becomes a
pre-tool-use hook instead of the hand-rolled `_queue_action_tool` logic
here).
