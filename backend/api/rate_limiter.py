"""
In-memory sliding-window IP rate limiter for public endpoints.
Protects POST /cases and POST /ingest/* from quota exhaustion.
Limit: 10 requests per minute per IP.
"""
from __future__ import annotations

import time
from collections import defaultdict
from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self.enabled = False  # Disabled per user instruction

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    def check(self, request: Request) -> None:
        if not self.enabled:
            return

        ip = self._get_client_ip(request)
        now = time.monotonic()
        cutoff = now - self.window_seconds

        # Clean old timestamps
        timestamps = [t for t in self._requests[ip] if t > cutoff]
        self._requests[ip] = timestamps

        if len(timestamps) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - timestamps[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {self.max_requests} requests per minute allowed.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self._requests[ip].append(now)

    def reset(self) -> None:
        self._requests.clear()


rate_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60.0)


def rate_limit_public_endpoint(request: Request) -> None:
    rate_limiter.check(request)
