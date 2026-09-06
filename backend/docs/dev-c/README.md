# Dev C — Handoff Index

Full task spec: [`../04-dev-C-api-sse-evaluators.md`](../04-dev-C-api-sse-evaluators.md) (unchanged, still the source of truth for hour-by-hour checklist).

No RESEARCH FIRST items — routes, SSE re-emission, and `devils_advocate.py` all follow `docs/00-CONTRACTS.md` §3/§4 exactly, no undecided behavior. Send the whole spec to Antigravity as written.

One cross-file dependency worth knowing: the `verdict_ready` SSE event you emit carries `verdict_reasoning`, a field whose format is still being decided in [`../dev-a/research/02-reconcile.md`](../dev-a/research/02-reconcile.md) (Feature 4). If that decision changes from free text to structured reasoning, it's a frozen-contract change per `docs/00-CONTRACTS.md` — you'll need to pull the update before your SSE tests lock in the old shape.
