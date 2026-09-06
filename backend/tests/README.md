# Running the tests

```
pip install -r requirements-dev.txt
pytest
```

`pytest.ini` at the repo root sets `asyncio_mode = auto`, so async test functions don't need `@pytest.mark.asyncio` (a few files use it anyway for clarity — harmless either way).

## What's here right now

- `tests/conftest.py` — shared fixtures: `FakeLLMProvider` (satisfies `providers.base.LLMProvider` without ever calling a real API) and sample `Claim`/`Case`/`Finding`/`EvidenceItem` fixtures built from the frozen contract.
- `tests/core/test_models.py` — fully runnable the moment `core/models.py` exists. No mocking needed, pure Pydantic validation. Write this one first.
- Everything else (`tests/providers/`, `tests/core/test_loop.py`, `tests/evidence/`, `tests/evaluators/`, `tests/api/`, `tests/eval_set/`) is a **skeleton**: real test function names and docstrings describing exactly what to assert, matching the "Tests:" checklist in each `docs/dev-*-tasks.md` file, but with `pytest.skip(...)` in place of a body until the function/module it tests actually exists. That's deliberate — until your teammate's module exists, `pytest.skip` keeps the suite green instead of red for a reason that has nothing to do with your code.

## The rule going forward

When you finish a task from your `docs/dev-*-tasks.md` checklist, find its matching skeleton test (same filename, matching test name — most line up 1:1), delete the `pytest.skip(...)` line, and fill in the body using the SKELETON comment as a starting point. If a task doesn't have a matching skeleton yet, write the test fresh — the skeletons are a head start, not a ceiling. Then check the task off in `PROGRESS.md`.

A task isn't done until its test is un-skipped and passing.
