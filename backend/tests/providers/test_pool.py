"""
Owner: Dev A. The claim this pool exists to make good on: given N keys, N
concurrent calls run on N different keys instead of queueing behind one.
"""
from __future__ import annotations

import asyncio

import pytest

from providers.pool import KeyPool, KeySlot, PoolExhaustedError


def make_pool(n: int, rpm: int = 0, max_inflight: int = 1, **kwargs) -> KeyPool:
    slots = [KeySlot(key_id=i, secret=f"secret-{i}", label=f"k{i}") for i in range(n)]
    return KeyPool("gemini", slots, rpm=rpm, max_inflight_per_key=max_inflight, **kwargs)


@pytest.mark.asyncio
async def test_concurrent_callers_land_on_different_keys():
    pool = make_pool(5)

    async def take() -> int:
        slot = await pool.acquire()
        await asyncio.sleep(0.01)  # hold it, so nobody can reuse this key
        await pool.report_success(slot)
        await pool.release(slot)
        return slot.key_id

    used = await asyncio.gather(*(take() for _ in range(5)))
    assert sorted(used) == [0, 1, 2, 3, 4]


@pytest.mark.asyncio
async def test_capacity_accounts_for_inflight_limit():
    pool = make_pool(4, max_inflight=2)
    assert pool.capacity == 8


@pytest.mark.asyncio
async def test_more_callers_than_keys_queue_and_all_complete():
    pool = make_pool(2)
    order: list[int] = []

    async def take() -> None:
        slot = await pool.acquire()
        order.append(slot.key_id)
        await asyncio.sleep(0.005)
        await pool.report_success(slot)
        await pool.release(slot)

    await asyncio.gather(*(take() for _ in range(6)))
    assert len(order) == 6
    assert set(order) == {0, 1}


@pytest.mark.asyncio
async def test_rate_limited_key_is_skipped_until_cooldown_expires():
    pool = make_pool(2)

    first = await pool.acquire()
    await pool.report_rate_limited(first, retry_after=30)
    await pool.release(first)

    # Next callers must all route to the other key, not the benched one.
    for _ in range(3):
        slot = await pool.acquire()
        assert slot.key_id != first.key_id
        await pool.report_success(slot)
        await pool.release(slot)


@pytest.mark.asyncio
async def test_short_cooldown_expires_and_the_key_comes_back():
    pool = make_pool(1)

    slot = await pool.acquire()
    await pool.report_rate_limited(slot, retry_after=0.05)
    await pool.release(slot)

    revived = await pool.acquire(timeout=2.0)
    assert revived.key_id == slot.key_id
    await pool.release(revived)


@pytest.mark.asyncio
async def test_acquire_raises_when_every_key_is_benched_past_the_timeout():
    pool = make_pool(2)

    for _ in range(2):
        slot = await pool.acquire()
        await pool.report_rate_limited(slot, retry_after=60)
        await pool.release(slot)

    with pytest.raises(PoolExhaustedError):
        await pool.acquire(timeout=0.2)


@pytest.mark.asyncio
async def test_repeated_failures_retire_a_key_and_then_the_pool():
    pool = make_pool(1)
    slot = pool.slots[0]

    for _ in range(4):
        await pool.report_error(slot, retry_after=0.01)

    assert slot.dead is True
    assert pool.has_keys() is False
    with pytest.raises(PoolExhaustedError):
        await pool.acquire(timeout=0.1)


@pytest.mark.asyncio
async def test_fatal_credential_error_retires_the_key_immediately():
    pool = make_pool(2)
    bad = await pool.acquire()
    await pool.report_fatal(bad)
    await pool.release(bad)

    assert bad.dead is True
    for _ in range(3):
        slot = await pool.acquire()
        assert slot.key_id != bad.key_id
        await pool.release(slot)


@pytest.mark.asyncio
async def test_success_clears_the_failure_streak():
    pool = make_pool(1)
    slot = pool.slots[0]

    await pool.report_error(slot, retry_after=0.01)
    await pool.report_error(slot, retry_after=0.01)
    await pool.report_success(slot)

    assert slot.consecutive_failures == 0
    assert slot.cooldown_until == 0.0


@pytest.mark.asyncio
async def test_rpm_pacing_spaces_calls_on_the_same_key():
    # 600 rpm -> one request per 0.1s on a single key.
    pool = make_pool(1, rpm=600)
    loop = asyncio.get_running_loop()

    start = loop.time()
    for _ in range(3):
        slot = await pool.acquire()
        await pool.report_success(slot)
        await pool.release(slot)
    elapsed = loop.time() - start

    # First call is free; the two after it each wait out the interval.
    assert elapsed >= 0.18


@pytest.mark.asyncio
async def test_pacing_is_per_key_so_more_keys_means_more_throughput():
    pool = make_pool(3, rpm=600)
    loop = asyncio.get_running_loop()

    async def take() -> None:
        slot = await pool.acquire()
        await pool.report_success(slot)
        await pool.release(slot)

    start = loop.time()
    await asyncio.gather(*(take() for _ in range(3)))
    # Three keys absorb three simultaneous calls without any pacing wait.
    assert loop.time() - start < 0.09


@pytest.mark.asyncio
async def test_stats_report_per_key_outcomes():
    pool = make_pool(2)

    good = await pool.acquire()
    await pool.report_success(good)
    await pool.release(good)

    bad = await pool.acquire()
    await pool.report_rate_limited(bad, retry_after=30)
    await pool.release(bad)

    stats = pool.stats()
    assert stats.keys == 2
    assert stats.successes == 1
    assert stats.rate_limits == 1
    assert len(stats.per_key) == 2


@pytest.mark.asyncio
async def test_empty_pool_fails_fast():
    pool = KeyPool("gemini", [])
    assert pool.has_keys() is False
    with pytest.raises(PoolExhaustedError):
        await pool.acquire(timeout=0.1)
