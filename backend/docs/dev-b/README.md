# Dev B — Handoff Index

Full task spec: [`../03-dev-B-evidence-researcher.md`](../03-dev-B-evidence-researcher.md) (unchanged, still the source of truth for hour-by-hour checklist).

No RESEARCH FIRST items — every task in the spec names a concrete algorithm or API call (DuckDuckGo Lite search shape, curation heuristic, Scrapling trigger condition, demo-fixture switch, failure-degradation rule). Send the whole spec to Antigravity as written.

One cross-file dependency worth knowing before implementing `evidence/fetch.py`'s adaptive-scrutiny branch: its trigger condition (`claim.load_bearing is True` + thin search snippet) reads a value decided in [`../dev-a/research/01-load-bearing.md`](../dev-a/research/01-load-bearing.md) (Dev A's research file, Feature 5). If Dev A's framing shifts the load-bearing yes-rate, your Scrapling spend shifts with it — worth a check-in, not a silent surprise at the API bill.
