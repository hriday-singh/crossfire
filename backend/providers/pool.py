"""
Owner: Dev A. Work-splitting scheduler across N API keys of one provider.

Why this exists: a full Crossfire panel is ~20 concurrent LLM calls, and a
free-tier Gemini key allows ~10 requests/minute. One key serialises the whole
run into rate-limit purgatory. Given ten keys, this pool spreads those calls
across all of them so the run finishes at ten times the per-key ceiling.

Three mechanisms, all per key:

* least-inflight dispatch — each caller takes the least-loaded healthy key, so
  concurrent evaluators land on different keys instead of stacking on one;
* RPM pacing — a key is handed out at most once per 60/rpm seconds, which
  avoids the 429 instead of reacting to it (rpm=0 disables pacing);
* failure cooldown — a key that answers 429 (or repeatedly 5xx) is benched for
  Retry-After, or an exponential backoff, and the next caller skips it.

The pool hands out keys. It does not make HTTP calls and knows nothing about
wire formats — providers/routing.py drives it.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

#: A key benched this many times in a row is assumed dead for the run.
MAX_CONSECUTIVE_FAILURES = 4
BASE_COOLDOWN_SECONDS = 20.0
MAX_COOLDOWN_SECONDS = 300.0
DEFAULT_MAX_INFLIGHT_PER_KEY = 2


class PoolExhaustedError(RuntimeError):
    """Every key in the pool is cooling down, disabled, or the pool is empty."""


@dataclass
class KeySlot:
    key_id: int
    secret: str
    label: str = ""
    inflight: int = 0
    #: monotonic deadline before which this key must not be used again
    cooldown_until: float = 0.0
    #: monotonic time the RPM gate next permits a request on this key
    next_allowed_at: float = 0.0
    consecutive_failures: int = 0
    successes: int = 0
    rate_limits: int = 0
    errors: int = 0
    dead: bool = False


@dataclass
class PoolStats:
    provider: str
    keys: int
    healthy: int
    successes: int
    rate_limits: int
    errors: int
    per_key: list[dict] = field(default_factory=list)


class KeyPool:
    """Async scheduler over the enabled keys of a single provider."""

    def __init__(
        self,
        provider: str,
        slots: list[KeySlot],
        rpm: int = 0,
        max_inflight_per_key: int = DEFAULT_MAX_INFLIGHT_PER_KEY,
        acquire_timeout: float = 120.0,
    ) -> None:
        self.provider = provider
        self._slots = slots
        self._interval = 60.0 / rpm if rpm > 0 else 0.0
        self._max_inflight = max(1, max_inflight_per_key)
        self._acquire_timeout = acquire_timeout
        self._cond = asyncio.Condition()

    # ------------------------------------------------------------------ shape

    def __len__(self) -> int:
        return len(self._slots)

    @property
    def slots(self) -> list[KeySlot]:
        return list(self._slots)

    def has_keys(self) -> bool:
        return any(not s.dead for s in self._slots)

    @property
    def capacity(self) -> int:
        """Requests this pool can have in flight at once."""
        return sum(self._max_inflight for s in self._slots if not s.dead)

    # ------------------------------------------------------------- scheduling

    async def acquire(self, timeout: float | None = None) -> KeySlot:
        """Reserve the least-loaded healthy key, honouring pacing and cooldown.

        The slot is reserved (inflight incremented, RPM gate advanced) while the
        pool lock is held, so two callers never reserve the same capacity; any
        pacing delay is then awaited outside the lock. Always pair with
        `release`.
        """
        loop = asyncio.get_running_loop()
        budget = self._acquire_timeout if timeout is None else timeout
        deadline = loop.time() + budget
        pacing_delay = 0.0

        async with self._cond:
            while True:
                now = loop.time()
                ready = [
                    s
                    for s in self._slots
                    if not s.dead and s.cooldown_until <= now and s.inflight < self._max_inflight
                ]
                if ready:
                    # least loaded first; ties go to whichever key the RPM gate
                    # frees up soonest, then to a stable key id.
                    slot = min(ready, key=lambda s: (s.inflight, s.next_allowed_at, s.key_id))
                    slot.inflight += 1
                    pacing_delay = max(0.0, slot.next_allowed_at - now)
                    if self._interval:
                        slot.next_allowed_at = max(now, slot.next_allowed_at) + self._interval
                    break

                waiting = [
                    s for s in self._slots if not s.dead and s.inflight < self._max_inflight
                ]
                if not waiting and not any(not s.dead for s in self._slots):
                    raise PoolExhaustedError(
                        f"{self.provider}: no usable API keys "
                        f"({len(self._slots)} configured, all disabled or dead)"
                    )

                now = loop.time()
                if now >= deadline:
                    raise PoolExhaustedError(
                        f"{self.provider}: all {len(self._slots)} keys busy or rate-limited "
                        f"after waiting {budget:.0f}s"
                    )

                # Wake on the earlier of: a key being released, or the soonest
                # cooldown expiring.
                soonest = min((s.cooldown_until for s in waiting), default=deadline)
                wait_for = max(0.05, min(soonest, deadline) - now)
                try:
                    await asyncio.wait_for(self._cond.wait(), timeout=wait_for)
                except TimeoutError:
                    pass  # re-evaluate: a cooldown may have expired

        if pacing_delay > 0:
            await asyncio.sleep(pacing_delay)
        return slot

    async def release(self, slot: KeySlot) -> None:
        async with self._cond:
            slot.inflight = max(0, slot.inflight - 1)
            self._cond.notify_all()

    # ---------------------------------------------------------------- outcomes

    async def report_success(self, slot: KeySlot) -> None:
        async with self._cond:
            slot.successes += 1
            slot.consecutive_failures = 0
            slot.cooldown_until = 0.0
            self._cond.notify_all()

    async def report_rate_limited(self, slot: KeySlot, retry_after: float | None = None) -> None:
        """Bench a key that returned 429 so the next caller skips straight past it."""
        async with self._cond:
            slot.rate_limits += 1
            slot.consecutive_failures += 1
            self._bench(slot, retry_after)
            self._cond.notify_all()

    async def report_error(self, slot: KeySlot, retry_after: float | None = None) -> None:
        """Bench a key on a transient upstream/connection failure."""
        async with self._cond:
            slot.errors += 1
            slot.consecutive_failures += 1
            self._bench(slot, retry_after)
            self._cond.notify_all()

    async def report_fatal(self, slot: KeySlot) -> None:
        """Retire a key permanently for this process (401/403 — bad credential)."""
        async with self._cond:
            slot.errors += 1
            slot.dead = True
            self._cond.notify_all()

    def _bench(self, slot: KeySlot, retry_after: float | None) -> None:
        loop = asyncio.get_running_loop()
        if retry_after is not None and retry_after > 0:
            cooldown = min(retry_after, MAX_COOLDOWN_SECONDS)
        else:
            cooldown = min(
                BASE_COOLDOWN_SECONDS * (2 ** (slot.consecutive_failures - 1)),
                MAX_COOLDOWN_SECONDS,
            )
        slot.cooldown_until = loop.time() + cooldown
        if slot.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            slot.dead = True
            logger.warning(
                "%s key %s retired after %d consecutive failures",
                self.provider,
                slot.label or slot.key_id,
                slot.consecutive_failures,
            )
        else:
            logger.info(
                "%s key %s benched for %.0fs",
                self.provider,
                slot.label or slot.key_id,
                cooldown,
            )

    # ------------------------------------------------------------------ status

    def stats(self) -> PoolStats:
        return PoolStats(
            provider=self.provider,
            keys=len(self._slots),
            healthy=sum(1 for s in self._slots if not s.dead),
            successes=sum(s.successes for s in self._slots),
            rate_limits=sum(s.rate_limits for s in self._slots),
            errors=sum(s.errors for s in self._slots),
            per_key=[
                {
                    "key_id": s.key_id,
                    "label": s.label,
                    "inflight": s.inflight,
                    "successes": s.successes,
                    "rate_limits": s.rate_limits,
                    "errors": s.errors,
                    "dead": s.dead,
                }
                for s in self._slots
            ],
        )
