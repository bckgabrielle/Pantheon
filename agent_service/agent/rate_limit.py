"""
In-memory rate limiter, good enough for v1 / single-instance deployment.
Swap for Redis if this service ever runs with >1 worker/replica.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque

from agent_service.config import settings

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    pass


class RateLimiter:
    def __init__(self, max_requests: int | None = None, window_seconds: int | None = None):
        self.max_requests = max_requests or settings.rate_limit_requests
        self.window_seconds = window_seconds or settings.rate_limit_window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    def check(self, session_id: str) -> None:
        now = time.monotonic()
        hits = self._hits[session_id]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()
        if len(hits) >= self.max_requests:
            logger.warning(
                "Rate limit rejected request",
                extra={
                    "session_id": session_id,
                    "max_requests": self.max_requests,
                    "window_seconds": self.window_seconds,
                },
            )
            raise RateLimitExceeded(
                f"Rate limit exceeded: {self.max_requests} requests per "
                f"{self.window_seconds}s per session."
            )
        hits.append(now)


rate_limiter = RateLimiter()
