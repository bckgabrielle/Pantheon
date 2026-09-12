from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agent_service.config import settings
from agent_service.models import AgentRunRequest, Plan
from agent_service.tools.backend_client import BackendClient
from agent_service.agent.loop import AgentLoop
from agent_service.agent.rate_limit import rate_limiter, RateLimitExceeded

app = FastAPI(title="Tab Agent Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.post("/agent/run", response_model=Plan)
async def run_agent(req: AgentRunRequest) -> Plan:
    """
    Called by the extension popup (chat query) or the scheduled digest
    trigger. Never called with a Groq key from the client — this
    service holds that key.
    """
    try:
        rate_limiter.check(req.session_id)
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail=str(e)) from e

    backend = BackendClient()
    try:
        loop = AgentLoop(backend=backend)
        plan = await loop.run(req.query)
        return plan
    finally:
        await backend.aclose()


@app.get("/healthz")
async def healthz():
    return {"ok": True}
