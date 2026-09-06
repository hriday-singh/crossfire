# Crossfire Backend — Build Instructions

Keep this light. Read this file, your own `docs/dev-*-tasks.md` file, and `docs/00-CONTRACTS.md`. That's it — don't go pulling in the other two devs' task files unless something in `docs/05-PARALLEL-WORKFLOW.md` says you need to.

---

## 1. Core Workflow Rules

- **Plan before building.** For anything non-trivial, say what you're about to touch and in what order before writing code. If your task file is ambiguous about *how* something should work, ask the team, don't guess a design that clashes with someone else's.
- **Build for the 48-hour build, not for production.** This is a hackathon. In-memory storage, no auth, no migrations — see section 4. Don't add infrastructure nobody asked for.
- **Stay inside your assigned files.** Your `docs/dev-*-tasks.md` lists exactly which files and folders are yours. Never edit another dev's files. If you need something to change in a file you don't own (especially `core/models.py` or `providers/base.py`), flag it in the group chat first — see `docs/05-PARALLEL-WORKFLOW.md`.
- **Commit to your own branch as you go.** Merge to `main` at minimum at the two checkpoints (hour 11, hour 35) — earlier is better, since early merges surface integration problems while there's still time to fix them.
- **Never touch `core/models.py` or `providers/base.py` after they're frozen at hour 2** without a team sync. Every module imports directly from these — an unannounced field rename breaks the other two people's code silently.

## 2. Tech Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.11+ | |
| Framework | FastAPI | async routes throughout |
| Validation | Pydantic v2 | all data contracts — see `docs/00-CONTRACTS.md` |
| Orchestration | Plain `asyncio` (`asyncio.gather`, `asyncio.create_task`, `asyncio.Queue`) | no CrewAI/LangGraph — deliberately rejected, see backend spec §1 |
| First LLM provider | Gemini via `google-genai` | Anthropic + OpenAI-compatible are stubbed behind the same interface, not built out |
| Search | DuckDuckGo Lite via Scrapling (one query per claim) | discovery only, zero API keys required |
| Fetch | Scrapling | deep-verification + pasted-URL ingestion only |
| Retries | `tenacity` | wraps DuckDuckGo and Scrapling calls |
| Secrets | `.env` via `python-dotenv` | never logged, never committed |
| Storage | `dict[str, Case]` in-memory | no DB for this build |
| Frontend transport | Server-Sent Events | one stream per case |
| Tests | `pytest` | every module ships tests alongside its code |

If your task genuinely needs something outside this table, say so in the group chat before adding a dependency — someone else may already be relying on the current shape.

## 3. Repo Layout

```
backend/
  main.py                  # FastAPI app + route wiring only — keep under ~20 lines, shared file, see §5
  api/                      # Dev C
    routes.py
    schemas.py
  core/
    models.py               # FROZEN hour 2 — Dev A authors, everyone imports
    loop.py                 # Dev A
    evaluators/
      devils_advocate.py    # Dev C
      receipts.py            # Dev B
      builder.py              # Dev A, once loop + evidence are solid (hour 18+)
      overthinker.py           # Dev C, stretch only
  providers/
    base.py                  # FROZEN hour 2 — Dev A authors
    gemini.py                 # Dev A
    anthropic.py               # Dev A, stub
    openai_compat.py            # Dev A, stub
  evidence/                    # Dev B
    search.py
    fetch.py
    curate.py
  ingestion/                    # Dev B, stretch only (hour 35+ slack)
    pdf.py
  store.py                       # Dev A
  config.py                       # Dev A
tests/
  eval_set/                        # Dev A owns the harness; each dev adds cases for their own module
```

No two devs write to the same file except `main.py` and `PROGRESS.md` — see `docs/05-PARALLEL-WORKFLOW.md` for how that's handled.

## 4. Backend Rules

- **No auth, no accounts, no DB, no migrations, no deployment/CI, no rate limiting beyond what `tenacity` gives you.** All explicitly out of scope for this build — don't future-proof it in.
- **Every evaluator and every internal step calls through `LLMProvider`** (`providers/base.py`). Nothing outside `providers/` talks to `google-genai` directly.
- **Reconciliation is the only place a claim's status gets decided.** No evaluator sets its own claim's status.
- **A negative finding needs a "because."** If Receipts or Devil's Advocate can't point at evidence or reasoning, that finding shouldn't be able to push a claim toward `broken`.
- **Errors are data, not crashes.** A dead source, a failed fetch, an empty search result — drop it and let the claim land on `unresolved`. Don't let a downstream failure take down `run_pipeline()`.

## 5. Testing — non-negotiable

- **`tests/` already has skeleton test files** for every module — see `tests/README.md`. Each skeleton is a real test function name + docstring describing what to assert, with `pytest.skip(...)` where the code under test doesn't exist yet. Find yours, delete the skip, fill in the body. Don't write tests from scratch when a skeleton already names the case.
- **Every task ships its unit tests in the same pass**, not "later." `pytest` (`pip install -r requirements-dev.txt`, then `pytest` — `pytest.ini` is already set up for async tests).
- Test the failure paths, not just the happy path — this pipeline's whole value is behaving sanely when evidence is thin or a tool call fails.
- Your `docs/dev-*-tasks.md` file lists the specific test cases expected per task, matching the skeletons 1:1 in most cases. Treat that list as a floor, not a ceiling.
- A task isn't checked off in `PROGRESS.md` until its skeleton test (or a new one, if there wasn't a matching skeleton) is un-skipped and passing.

## 6. Progress Tracking

- After finishing **any** checklist item in your `docs/dev-*-tasks.md`, immediately:
  1. Check it off there.
  2. Update your section in `PROGRESS.md` — one line: what's done, what's blocked, what's next.
- Don't batch this up for later. The whole point of `PROGRESS.md` is that at hour 11 and hour 35, anyone can read it and know the real state without a status meeting.
- If you're blocked on another dev's piece, say so in `PROGRESS.md`'s "Blockers" section, tagged with their name — don't just wait silently.

## 7. Definition of Done (per task)

- [ ] Matches the contract in `docs/00-CONTRACTS.md` — field names, types, enum values
- [ ] Only touches files your `docs/dev-*-tasks.md` assigns you
- [ ] Unit tests added and passing
- [ ] `PROGRESS.md` updated
- [ ] No new dependency added without a group heads-up
