# Working in Parallel Without Clashing

The whole point of the file split in `docs/00-CONTRACTS.md` and the three `docs/dev-*-tasks.md` files is that your diffs should almost never overlap. If you're getting merge conflicts constantly, something has drifted from this plan — check in with the group rather than pushing through it.

## The rule

**Each of you writes only inside your own subtree.** Nobody edits another dev's files. If your task genuinely needs a change in a file you don't own, you don't make the edit yourself — you flag it and the owner makes it.

| Dev | Owns |
|---|---|
| A (spine) | `providers/`, `core/models.py`, `core/loop.py`, `core/evaluators/builder.py`, `store.py`, `config.py` |
| B (evidence) | `evidence/`, `core/evaluators/receipts.py` (Researcher), `ingestion/` |
| C (api) | `api/`, `core/evaluators/devils_advocate.py`, `core/evaluators/operator.py` (Operator, legacy overthinker) |

That's every file in the repo except two, both handled specially below.

## The two shared files

**`core/models.py` + `providers/base.py`** — frozen at hour 2 by Dev A. After that, they're read-only for everyone. If a field genuinely needs to change past hour 2 (it happens), that's a 2-minute voice sync, not a silent edit — the change comes from Dev A, and both other devs pull it before continuing.

**`main.py`** — stays under ~20 lines, just app creation + route registration. Whoever needs to add a line (usually Dev C, registering a new route) adds it and pings the group. If two of you need to touch it the same day, whoever's second just merges past the other's one-line addition — it's small enough that a conflict here is trivial to resolve by hand.

**`PROGRESS.md`** — everyone writes to this constantly, in their own section. Conflicts here are expected and harmless: if git flags one, keep both additions, you're not actually overwriting each other's status lines.

**`tests/conftest.py`** — shared fixtures everyone's tests import. Treat it like `core/models.py`: read-only after hour 2 unless the group agrees to add a fixture, in which case whoever needs it adds it and says so, rather than three people adding near-duplicate fixtures under slightly different names.

**`tests/`** otherwise mirrors the ownership table above one-to-one — `tests/core/` and `tests/providers/` are Dev A's, `tests/evidence/` and `tests/evaluators/test_receipts.py` are Dev B's, `tests/api/` and `tests/evaluators/test_devils_advocate.py` are Dev C's. `tests/eval_set/` is Dev A's harness at hour 38-42, but anyone can add a case relevant to their own module without waiting.

## Branches

- One branch per person: `dev-a-core`, `dev-b-evidence`, `dev-c-api`. Commit to your own branch as often as you like.
- Merge to `main` at minimum at hour 11 and hour 35 — the two checkpoints. Merging more often than that is safer, not riskier: it surfaces integration problems (a field that drifted, an import that broke) while there's still time to fix them, instead of all three branches colliding at hour 35 with no runway left.
- Before each checkpoint, everyone pulls latest `main` and actually runs the full loop against it — not just their own branch in isolation. The seams between three people's code are exactly where a parallel hackathon build breaks, and the direction docs call this out explicitly as worth reserving real time for.

## If something doesn't fit

If, once you're actually building, your task doesn't cleanly fit inside your owned files — say so immediately in the group, not two hours later. It's cheaper to redraw one boundary at hour 6 than to discover three people quietly stepped on each other's work at hour 30.
