from __future__ import annotations

import pytest

from agent_service.agent.rate_limit import RateLimitExceeded, RateLimiter


def test_rate_limiter_allows_limit_then_blocks():
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    limiter.check("session-a")
    limiter.check("session-a")

    with pytest.raises(RateLimitExceeded):
        limiter.check("session-a")


def test_rate_limiter_resets_after_window(monkeypatch):
    now = 100.0
    monkeypatch.setattr("agent_service.agent.rate_limit.time.monotonic", lambda: now)
    limiter = RateLimiter(max_requests=1, window_seconds=10)

    limiter.check("session-a")

    now = 111.0
    limiter.check("session-a")
