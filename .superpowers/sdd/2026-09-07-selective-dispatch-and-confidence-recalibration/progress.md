# SDD ledger — plan: docs/superpowers/plans/2026-09-07-selective-dispatch-and-confidence-recalibration.md

## Pre-flight Conflict Scan
| Task Pair / Task | Prods vs Cons / Self-consistency | Finding | Ruling |
|---|---|---|---|
| Task 1 -> Task 2 | Claim.confidence in models.py consumed by crossfire.ts & ClaimCard.tsx | Consistent types (float / number) | Ruling: None needed — types align. |
| Task 3 -> Task 4 | Selective dispatch in agent_panel.py and Abstain protocol in receipts.py | Complementary: selective dispatch prunes upfront, abstain handles edge cases | Ruling: Proceed with both in sequence. |
| Task 1 self | calculate_claim_confidence status bounds | Calibrated ranges: Survived (0.90-0.98), Weakened (0.40-0.60), Broken (0.05-0.15) | Ruling: Enforced via unit tests. |

## Tasks
- [x] Task 1: Add Claim.confidence and Recalculate During Reconciliation (Backend)
- [x] Task 2: Update Frontend Types and UI for Claim Confidence & Objection Relabeling
- [x] Task 3: Selective Evaluator Dispatch (Backend)
- [x] Task 4: Explicit Abstain Protocol (Evaluators & Steel Man Gate)
- [x] Task 5: End-to-End Regression and Integration Verification

## Test Results
- Backend: 344 passed, 8 skipped (100% pass)
- Frontend: 22 test files, 178 passed (100% pass)
