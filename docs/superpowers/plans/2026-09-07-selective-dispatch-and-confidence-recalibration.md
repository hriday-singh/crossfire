# Selective Evaluator Dispatch, Explicit Abstain Protocol & Confidence Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate overcritical downgrades and semantic confusion in Crossfire by: (1) recalculating a true synthetic `Claim.confidence` (90-98% for SURVIVED) while treating `Finding.confidence` strictly as objection strength/risk, (2) selectively dispatching Researcher only on empirical claims, and (3) enforcing an explicit Abstain Protocol (0.0 objection score, null contradiction) across all evaluators and Judicial Reconciliation.

**Architecture:**
- **Phase 1 (Data Schema & Frontend UI):**
  - Add `confidence: float | None = None` to `Claim` in `backend/core/models.py`.
  - In `backend/core/loop.py`, calculate calibrated `Claim.confidence` based on final verdict status and maximum objection strength, emitting it in `verdict_ready` events.
  - Update `frontend/src/types/crossfire.ts` with `confidence?: number | null`.
  - In `ClaimCard.tsx`, display `Claim.confidence` on the card header (`Confidence: 96%`) and relabel drawer findings to `Objection Strength: X%` (or `Risk: X%`).
  - In `EvidenceDrawer.tsx` and `TestRow.tsx`, relabel evaluator scores to `Objection Strength` / `risk` to resolve the semantic collision.
- **Phase 2 (Selective Evaluator Dispatch):**
  - Implement `is_empirical_claim(statement: str) -> bool` in `backend/core/textutil.py` using robust heuristic pattern matching for external metrics, numbers, market data, technical tools, and regulations vs. pure design/deductive logic.
  - In `backend/core/agent_panel.py` (`build_test_plan`), selectively omit the `receipts` (Researcher) evaluator for non-empirical claims, falling back to Builder, Operator, or Devil's Advocate.
- **Phase 3 (Explicit Abstain Protocol):**
  - Update system prompts and post-processing across all 4 evaluators (`receipts.py`, `builder.py`, `operator.py`, `devils_advocate.py` / `_reasoning.py`): if a claim is outside an evaluator's domain or no empirical evidence is found, return status `Abstain: ...`, objection score strictly `0.0`, and `contradiction=None`.
  - In `backend/core/reconcile.py`, format `0.0` findings as `objection="abstained (neutral)"` and ensure Judicial Reconciliation mathematically ignores `0.0` findings, preventing false-positive downgrades.

**Tech Stack:** Python 3.11, Pydantic v2, FastAPI, pytest, React 19, TypeScript, Vitest, Tailwind CSS.

**Spec:** User instructions:
1. "Phase 1: Update Finding.confidence to strictly represent Objection Strength/Risk (0.0 = Abstention/No Objection, 0.9+ = Fatal Blocker). Add confidence: float to Claim model. Calculate overall Claim.confidence during Judicial Reconciliation (SURVIVED = 90-98%, WEAKENED = 40-60%, etc.). Update Frontend ClaimCard and Drawer to display Claim.confidence on header and relabel drawer findings to Risk / Objection Strength."
2. "Phase 2: Selective Evaluator Dispatch: Stop dispatching Researcher on non-empirical claims during test planning (agent_panel.py). If a claim is purely deductive/internal, only dispatch Builder, Operator, and Devil's Advocate. Dispatch Researcher only if is_empirical_claim(statement) is true."
3. "Phase 3: The Explicit Abstain Protocol: Update all evaluator system prompts with an Abstain Rule: if a claim is outside domain, return status 'abstain', objection score strictly 0.0, and contradiction=null. Steel Man mathematically ignores 0.0 objection findings as neutral abstentions."

## Global Constraints
- Preserve backward compatibility for existing serialized fixtures and SSE payloads.
- Strict TypeScript mode in frontend (zero `any`, narrow `unknown`).
- Design system tokens only (`surface-container`, `outline`, `primary-container`, etc.).
- All backend pytest tests and frontend vitest tests must pass 100% without regressions.

---

### Task 1: Add `Claim.confidence` and Recalculate During Reconciliation (Backend)

**Files:**
- Modify: `backend/core/models.py:20-30`
- Modify: `backend/core/loop.py:397-460`
- Create: `backend/tests/core/test_claim_confidence.py`

**Interfaces:**
- `Claim.confidence: float | None = None`
- Function `calculate_claim_confidence(status: ClaimStatus, max_objection: float) -> float`:
  - `SURVIVED`: `round(max(0.90, min(0.98, 0.98 - (max_objection * 0.40))), 2)`
  - `WEAKENED`: `round(max(0.40, min(0.60, 0.60 - ((max_objection - 0.20) / 0.60) * 0.20)), 2)`
  - `BROKEN`: `round(max(0.05, min(0.15, 0.15 - ((max_objection - 0.70) / 0.30) * 0.10)), 2)`
  - `UNRESOLVED`: `0.50`
- Emitted payload for `verdict_ready`: includes `"confidence": clm.confidence`

- [ ] **Step 1: Write the failing unit test for `calculate_claim_confidence` and `Claim.confidence` field**

```python
# backend/tests/core/test_claim_confidence.py
import pytest
from core.models import Claim, ClaimStatus, Finding, EvidenceItem
from core.loop import calculate_claim_confidence

def test_calculate_claim_confidence_survived():
    # 0.0 max objection -> 0.98
    assert calculate_claim_confidence(ClaimStatus.SURVIVED, 0.0) == 0.98
    # 0.15 minor objection -> calibrated between 0.90 and 0.98
    conf = calculate_claim_confidence(ClaimStatus.SURVIVED, 0.15)
    assert 0.90 <= conf <= 0.98
    assert conf == 0.92

def test_calculate_claim_confidence_weakened():
    # 0.35 objection -> ~0.55
    conf = calculate_claim_confidence(ClaimStatus.WEAKENED, 0.35)
    assert 0.40 <= conf <= 0.60
    assert conf == 0.55

def test_calculate_claim_confidence_broken():
    # 0.95 fatal objection -> ~0.07
    conf = calculate_claim_confidence(ClaimStatus.BROKEN, 0.95)
    assert 0.05 <= conf <= 0.15
    assert conf == 0.07

def test_calculate_claim_confidence_unresolved():
    assert calculate_claim_confidence(ClaimStatus.UNRESOLVED, 0.5) == 0.50

def test_claim_model_has_confidence_field():
    c = Claim(id="c1", statement="Test statement", confidence=0.96)
    assert c.confidence == 0.96
    dumped = c.model_dump()
    assert dumped["confidence"] == 0.96
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\pytest backend/tests/core/test_claim_confidence.py -v`
Expected: FAIL with `ImportError: cannot import name 'calculate_claim_confidence' from 'core.loop'`

- [ ] **Step 3: Implement `calculate_claim_confidence` in `backend/core/loop.py` and update `Claim` in `backend/core/models.py`**

In `backend/core/models.py`:
```python
class Claim(BaseModel):
    id: str
    statement: str
    load_bearing: bool | None = None       # set after the load-bearing question runs
    load_bearing_reason: str | None = None # why this claim is load-bearing or secondary
    status: ClaimStatus | None = None
    confidence: float | None = None        # synthetic claim confidence: 0.0 (broken) to 1.0 (validated)
    fatal_flaw: str | None = None          # isolated flaw if weakened/broken
    salvaged_claim: str | None = None      # minimal viable re-architecture (Break to Rebuild)
    tradeoff_acknowledged: str | None = None  # operational trade-off of the salvaged claim
```

In `backend/core/loop.py`:
```python
def calculate_claim_confidence(status: ClaimStatus, max_objection: float) -> float:
    """Calculates overall claim confidence (0.0 to 1.0) for UI display.
    
    This inverts and calibrates the adversarial panel's objection scores:
    - SURVIVED: 90% - 98% (sound, with minor objections causing slight drops)
    - WEAKENED: 40% - 60% (substantive friction identified)
    - BROKEN: 5% - 15% (fatal refutation)
    - UNRESOLVED: 50% (neutral indeterminate)
    """
    if status == ClaimStatus.SURVIVED:
        return round(max(0.90, min(0.98, 0.98 - (max_objection * 0.40))), 2)
    elif status == ClaimStatus.WEAKENED:
        scaled = ((max(0.20, min(0.80, max_objection)) - 0.20) / 0.60) * 0.20
        return round(max(0.40, min(0.60, 0.60 - scaled)), 2)
    elif status == ClaimStatus.BROKEN:
        scaled = ((max(0.70, min(1.0, max_objection)) - 0.70) / 0.30) * 0.10
        return round(max(0.05, min(0.15, 0.15 - scaled)), 2)
    return 0.50
```

In `backend/core/loop.py` in `_reconcile_single` and verdict publishing:
```python
            # Calculate max objection from active findings
            max_obj = max((f.confidence for f in claim_findings), default=0.0)
            clm.confidence = calculate_claim_confidence(clm.status, max_obj)
```
And in `events.publish(case.id, "verdict_ready", ...)`:
```python
                "verdict_ready",
                {
                    "claim_id": clm.id,
                    "status": clm.status.value,
                    "confidence": clm.confidence,
                    "verdict_reasoning": reasoning,
                    "fatal_flaw": clm.fatal_flaw,
                    "salvaged_claim": clm.salvaged_claim,
                    "tradeoff_acknowledged": clm.tradeoff_acknowledged,
                },
```

- [ ] **Step 4: Run unit test to verify it passes**

Run: `.venv\Scripts\pytest backend/tests/core/test_claim_confidence.py -v`
Expected: PASS

---

### Task 2: Update Frontend Types and UI for Claim Confidence & Objection Relabeling

**Files:**
- Modify: `frontend/src/types/crossfire.ts:24-34`
- Modify: `frontend/src/components/features/ClaimCard.tsx:174-182, 388-393`
- Modify: `frontend/src/components/features/EvidenceDrawer.tsx:433-438`
- Modify: `frontend/src/components/features/TestRow.tsx:52-57`
- Test: `frontend/src/tests/ClaimCard.test.tsx`
- Test: `frontend/src/tests/EvidenceDrawer.test.tsx`

**Interfaces:**
- `Claim.confidence?: number | null;`
- In `ClaimCard.tsx`:
  - Main header displays `claim.confidence` if defined (e.g. `Confidence: 0.98`), falling back to `relevantFinding.confidence` only if `claim.confidence` is absent.
  - Finding pill in drawer/expanded list displays `Objection Strength: {(f.confidence * 100).toFixed(0)}%` instead of `Confidence: {(f.confidence * 100).toFixed(0)}%`.
- In `EvidenceDrawer.tsx`:
  - Evaluator pill displays `Objection Strength: {(f.confidence * 100).toFixed(0)}%`.
- In `TestRow.tsx`:
  - Displays `obj: {formatConfidence(finding.confidence)}` or `risk: {formatConfidence(finding.confidence)}`.

- [ ] **Step 1: Write/update frontend tests in `ClaimCard.test.tsx` and `EvidenceDrawer.test.tsx`**

Check that:
1. `ClaimCard` displays `Confidence: 0.96` when `claim.confidence = 0.96` (even if finding objection confidence is 0.10).
2. `ClaimCard` drawer displays `Objection Strength:` for finding scores.
3. `EvidenceDrawer` displays `Objection Strength:` for evaluator finding scores.

- [ ] **Step 2: Run frontend tests to verify failure/discrepancies**

Run: `npm test src/tests/ClaimCard.test.tsx` in `frontend/`

- [ ] **Step 3: Update `crossfire.ts`, `ClaimCard.tsx`, `EvidenceDrawer.tsx`, and `TestRow.tsx`**

In `frontend/src/types/crossfire.ts`:
```typescript
export interface Claim {
  id: string;
  statement: string;
  load_bearing: boolean | null;
  load_bearing_reason?: string | null;
  status: ClaimStatus | null;
  confidence?: number | null;
  fatal_flaw?: string | null;
  salvaged_claim?: string | null;
  tradeoff_acknowledged?: string | null;
}
```

In `frontend/src/components/features/ClaimCard.tsx`:
Replace lines 174-181:
```tsx
          {/* Display synthetic Claim.confidence on the card header */}
          {(claim.confidence !== undefined && claim.confidence !== null) ? (
            <span className="font-code-sm text-code-sm text-outline">
              Confidence:{" "}
              <span className="text-on-surface font-semibold">
                {formatConfidence(claim.confidence)}
              </span>
            </span>
          ) : relevantFinding?.confidence !== undefined ? (
            <span className="font-code-sm text-code-sm text-outline">
              Confidence:{" "}
              <span className="text-on-surface font-semibold">
                {formatConfidence(relevantFinding.confidence)}
              </span>
            </span>
          ) : null}
```
And replace lines 388-392:
```tsx
                      {f.confidence !== undefined && (
                        <span 
                          title="Evaluator objection strength (0% = no objection / abstained, 90%+ = fatal blocker)"
                          className="font-code-xs text-code-xs px-2 py-0.5 rounded bg-surface-container-highest text-outline"
                        >
                          Objection Strength: {(f.confidence * 100).toFixed(0)}%
                        </span>
                      )}
```

In `frontend/src/components/features/EvidenceDrawer.tsx`:
Replace lines 433-437:
```tsx
                      {f.confidence !== undefined && (
                        <span 
                          title="Evaluator objection strength (0% = no objection / abstained, 90%+ = fatal blocker)"
                          className="font-code-xs text-code-xs px-2 py-0.5 rounded bg-surface-container-highest text-outline"
                        >
                          Objection Strength: {(f.confidence * 100).toFixed(0)}%
                        </span>
                      )}
```

In `frontend/src/components/features/TestRow.tsx`:
Replace line 54:
```tsx
          {finding?.confidence !== undefined && (
            <span 
              title="Objection strength against the claim"
              className="font-code-xs text-code-xs text-outline px-1.5 py-0.5 rounded bg-surface-container-highest"
            >
              obj: {formatConfidence(finding.confidence)}
            </span>
          )}
```

- [ ] **Step 4: Run frontend tests to verify they pass**

Run: `npm test` in `frontend/`
Expected: PASS

---

### Task 3: Selective Evaluator Dispatch (Backend)

**Files:**
- Modify: `backend/core/textutil.py`
- Modify: `backend/core/agent_panel.py:123-153`
- Create: `backend/tests/core/test_selective_dispatch.py`
- Update: `backend/tests/core/test_loop.py:244-279`

**Interfaces:**
- `is_empirical_claim(statement: str) -> bool`:
  - Returns `True` if statement contains external verifiable metrics, quantitative data, prices, dates/durations, third-party platforms/tools, legal/regulatory frameworks, or competitive assertions.
  - Returns `False` if statement is purely an internal aesthetic/design preference ("dark theme", "color scheme", "font size"), subjective organizational philosophy, or internal deductive tautology.
- In `agent_panel.py`:
  - `build_test_plan(case: Case, panel: bool = True, active_agents: list[str] | None = None)`:
    - For each claim, if `not is_empirical_claim(claim.statement)`:
      `receipts` is pruned from the candidate agents for that claim.
      - If `full=True`: dispatches `[a for a in agents if a != "receipts"]` (e.g. Builder, Operator, Devil's Advocate).
      - If `full=False` (single pass): selects the next single-pass priority agent that is NOT `receipts` (e.g. `devils_advocate` or `builder`).

- [ ] **Step 1: Write the failing tests for `is_empirical_claim` and selective dispatch**

```python
# backend/tests/core/test_selective_dispatch.py
import pytest
from core.textutil import is_empirical_claim
from core.agent_panel import build_test_plan
from core.models import Case, Claim

def test_is_empirical_claim_classification():
    # Empirical claims
    assert is_empirical_claim("The API will scale to 10k QPS on AWS ECS") is True
    assert is_empirical_claim("Competitor X charges $50/month for this feature") is True
    assert is_empirical_claim("90% of enterprises require SOC 2 compliance") is True
    assert is_empirical_claim("PostgreSQL handles 50,000 writes/sec with jsonb") is True
    assert is_empirical_claim("Students will trust an AI submitting applications on their behalf") is True

    # Non-empirical / deductive / internal claims
    assert is_empirical_claim("The onboarding screen should use a dark theme") is False
    assert is_empirical_claim("We believe code simplicity is more important than speed") is False
    assert is_empirical_claim("If component A fails, component B handles the exception by definition") is False
    assert is_empirical_claim("The founder should lead product design decisions") is False

def test_build_test_plan_selective_dispatch():
    case = Case(
        id="case-selective",
        raw_input="Test proposal",
        claims=[
            Claim(id="c1", statement="The API will scale to 10k QPS", load_bearing=True),
            Claim(id="c2", statement="The onboarding screen should use a dark theme", load_bearing=True),
            Claim(id="c3", statement="The button color should be blue", load_bearing=False),
        ],
    )
    plan = build_test_plan(case, panel=True)
    c1_modes = [p.failure_mode for p in plan if p.target_claim == "c1"]
    c2_modes = [p.failure_mode for p in plan if p.target_claim == "c2"]
    c3_modes = [p.failure_mode for p in plan if p.target_claim == "c3"]

    # Empirical load-bearing claim gets all evaluators including evidence (receipts)
    assert "evidence" in c1_modes
    assert "assumption" in c1_modes
    assert "feasibility" in c1_modes
    assert "operational_friction" in c1_modes

    # Non-empirical load-bearing claim gets reasoning evaluators, but NOT receipts/evidence
    assert "evidence" not in c2_modes
    assert "assumption" in c2_modes
    assert "feasibility" in c2_modes
    assert "operational_friction" in c2_modes

    # Non-empirical secondary claim gets fallback single-pass (assumption/devils_advocate), not evidence
    assert c3_modes == ["assumption"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\pytest backend/tests/core/test_selective_dispatch.py -v`
Expected: FAIL with `ImportError: cannot import name 'is_empirical_claim' from 'core.textutil'`

- [ ] **Step 3: Implement `is_empirical_claim` and update `build_test_plan`**

In `backend/core/textutil.py`:
```python
_EMPIRICAL_QUANT_PATTERN = re.compile(
    r"(\b\d+(\.\d+)?\s*(%|percent|qps|rps|ms|seconds?|mins?|minutes?|hours?|days?|months?|years?|usd|\$|k|m|b|gb|tb|mb|users|customers|queries)\b|\$\d+|\b\d+k\b)",
    re.IGNORECASE,
)
_EMPIRICAL_TERMS_PATTERN = re.compile(
    r"\b(market|competitor|competitors|industry|pricing|cost|costs|regulation|regulations|compliance|soc\s*2|hipaa|gdpr|sec|fda|law|statute|standard|standards|benchmark|benchmarks|adoption|survey|patent|court|contract|contracts|api|apis|sdk|vendor|vendors|aws|gcp|azure|postgres|mysql|redis|openai|anthropic|stripe|google|apple|meta|microsoft|github|docker|kubernetes|saas|churn|retention|conversion|revenue|arr|mrr|cac|ltv|latency|throughput|uptime|sla|downtime|trust|distrust)\b",
    re.IGNORECASE,
)
_EMPIRICAL_COMPARE_PATTERN = re.compile(
    r"\b(unique|only|first|cheaper than|faster than|more expensive|unmatched|sole|exclusive|proprietary|superior to|nobody else|no other|widely used|industry standard|adoption rate|market share)\b",
    re.IGNORECASE,
)
_NON_EMPIRICAL_SUBJECTIVE_PATTERN = re.compile(
    r"\b(should use|should be|theme|dark theme|light theme|color|font|aesthetic|looks better|we believe|our mission|philosophy|prefer|by definition)\b",
    re.IGNORECASE,
)

def is_empirical_claim(statement: str) -> bool:
    """Determines if a claim asserts verifiable real-world facts, metrics,
    outside benchmarks, or third-party realities requiring the Researcher (receipts).
    
    Claims that are purely subjective design choices, aesthetic preferences,
    internal definitions, or abstract logic return False.
    """
    if not statement:
        return False
    has_subjective = bool(_NON_EMPIRICAL_SUBJECTIVE_PATTERN.search(statement))
    has_quant = bool(_EMPIRICAL_QUANT_PATTERN.search(statement))
    has_terms = bool(_EMPIRICAL_TERMS_PATTERN.search(statement))
    has_compare = bool(_EMPIRICAL_COMPARE_PATTERN.search(statement))

    if has_subjective and not (has_quant or has_terms or has_compare):
        return False
    return has_quant or has_terms or has_compare or (not has_subjective)
```

In `backend/core/agent_panel.py`:
```python
    items: list[TestPlanItem] = []
    for claim in case.claims:
        full = panel and claim.load_bearing is not False
        
        # Selective Evaluator Dispatch: omit receipts if claim is not empirical
        claim_agents = [a for a in agents if a != "receipts" or is_empirical_claim(claim.statement)]
        if not claim_agents:
            claim_agents = ["devils_advocate"]
            
        if full:
            target_agents = claim_agents
        else:
            single = next((a for a in SINGLE_PASS_PRIORITY if a in claim_agents), claim_agents[0])
            target_agents = [single]

        for agent in target_agents:
            items.append(
                TestPlanItem(
                    id=str(uuid4()),
                    target_claim=claim.id,
                    failure_mode=AGENT_FAILURE_MODE[agent],
                    objective=AGENT_OBJECTIVE[agent].format(statement=claim.statement),
                )
            )
    return items
```

Update `backend/tests/core/test_loop.py:244-279` to test empirical claim routing and verify that secondary non-empirical claims route to the non-receipts fallback single-pass agent as intended by the new architecture.

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv\Scripts\pytest backend/tests/core/test_selective_dispatch.py backend/tests/core/test_loop.py -v`
Expected: PASS

---

### Task 4: Explicit Abstain Protocol (Evaluators & Steel Man Gate)

**Files:**
- Modify: `backend/core/evaluators/receipts.py:60-75, 400-480`
- Modify: `backend/core/evaluators/builder.py:17-45, 60-115`
- Modify: `backend/core/evaluators/operator.py:18-40, 70-130`
- Modify: `backend/core/evaluators/devils_advocate.py:14-38`
- Modify: `backend/core/evaluators/_reasoning.py:20-35, 80-102`
- Modify: `backend/core/reconcile.py:102-138, 182-218`
- Create: `backend/tests/evaluators/test_abstain_protocol.py`

**Interfaces:**
- Evaluator Abstain Rule:
  - If a claim is outside domain or no empirical evidence is found:
    - `result`: `"Abstain: ..."`
    - `confidence`: `0.0` (strictly 0.0)
    - `contradiction`: `None`
- In `receipts.py`:
  - When `evidence` is empty (or no sources cited), confidence is strictly `0.0` and contradiction is `None` (replaces previous `min(conf, 0.35)`).
- In `reconcile.py`:
  - `findings_summary`:
    - `f.confidence == 0.0` is summarized as `objection="abstained (neutral)"`.
  - `apply_evidence_gate`:
    - Findings with `confidence == 0.0` are neutral abstentions. If all non-abstained findings (or all findings) are in the `no objection` band (`< TRIVIAL_OBJECTION_CEILING`) and no sourced contradiction exists, `weakened` is upgraded to `survived`.

- [ ] **Step 1: Write the failing tests for the Abstain Protocol**

```python
# backend/tests/evaluators/test_abstain_protocol.py
import pytest
from core.models import Claim, ClaimStatus, Finding, TestPlanItem, Case
from core.reconcile import apply_evidence_gate, objection_band, reconcile
from core.evaluators.receipts import run_researcher
from providers.base import LLMProvider

class MockEmptySearchProvider(LLMProvider):
    async def generate(self, system_prompt, messages, response_schema=None, temperature=0.0):
        # Even if model outputs something, empty evidence must force abstention
        return Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="researcher",
            result="No evidence",
            evidence=[],
            reasoning="Could not find any outside sources",
            confidence=0.35,
            contradiction=None,
        )

@pytest.mark.asyncio
async def test_researcher_abstains_with_zero_confidence_when_no_evidence():
    claim = Claim(id="c1", statement="Our core values prioritize customer delight")
    item = TestPlanItem(id="t1", target_claim="c1", failure_mode="evidence", objective="Check sources")
    case = Case(id="case1", raw_input="test", claims=[claim])
    provider = MockEmptySearchProvider()
    
    finding = await run_researcher(item, case, provider)
    assert finding.confidence == 0.0
    assert finding.contradiction is None
    assert "abstain" in finding.result.lower() or finding.confidence == 0.0

def test_steelman_ignores_zero_confidence_abstentions():
    findings = [
        Finding(
            claim_id="c1",
            test_id="t1",
            evaluator="researcher",
            result="Abstain: No empirical evidence found",
            evidence=[],
            reasoning="Non-empirical claim",
            confidence=0.0,
            contradiction=None,
        ),
        Finding(
            claim_id="c1",
            test_id="t2",
            evaluator="builder",
            result="Feasible with standard effort",
            evidence=[],
            reasoning="Buildable",
            confidence=0.05,
            contradiction=None,
        ),
    ]
    # Under evidence gate, with only abstentions and no objection (< 0.20), weakened must upgrade to survived
    status, reasoning = apply_evidence_gate(ClaimStatus.WEAKENED, "Judge was overly skeptical", findings)
    assert status == ClaimStatus.SURVIVED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\pytest backend/tests/evaluators/test_abstain_protocol.py -v`
Expected: FAIL (researcher currently returns 0.35 or 0.2 when evidence is empty)

- [ ] **Step 3: Implement Abstain Protocol across evaluators and reconciliation**

In `backend/core/evaluators/receipts.py`:
- Update `RESEARCHER_SYSTEM_PROMPT` with explicit Abstain Protocol:
  `"ABSTAIN PROTOCOL: If the target claim is non-empirical or no external sources can be found, you MUST return result='Abstain: No external empirical evidence found', confidence=0.0, and contradiction=null. Absence of evidence is NOT refutation."`
- In post-processing (lines 405, 437, 476):
  ```python
  if not evidence:
      conf = 0.0
      contra = None
      if not res_text.lower().startswith("abstain"):
          res_text = "Abstain: No external empirical evidence found"
  ```

In `backend/core/evaluators/builder.py`:
- In `BUILDER_SYSTEM_PROMPT`:
  `"ABSTAIN PROTOCOL: If the claim contains no technical implementation, architecture, software/hardware build, or engineering feasibility to evaluate, return result='Abstain: Out of domain', blocker=None, and confidence=0.0."`
- In runner post-processing: if `result.lower().startswith("abstain")` or (`blocker is None and conf <= 0.05`): `conf = 0.0`, `blocker = None`.

In `backend/core/evaluators/operator.py`:
- In `OPERATOR_SYSTEM_PROMPT`:
  `"ABSTAIN PROTOCOL: If the claim involves no human workflows, corporate bureaucracy, procurement, or legal/regulatory liability, return result='Abstain: Out of domain', friction_type='none', operational_blocker=None, and confidence=0.0."`
- In runner post-processing: if `result.lower().startswith("abstain")` or (`friction_type == "none" and operational_blocker is None and conf <= 0.05`): `conf = 0.0`, `operational_blocker = None`.

In `backend/core/evaluators/_reasoning.py`:
- In `ReasoningOutput.confidence`: description updated with `0.0 (abstain / no real objection)`.
- In runner post-processing: if `result.lower().startswith("abstain")`: `conf = 0.0`, `contradiction = None`.

In `backend/core/reconcile.py`:
- In `objection_band`:
  ```python
  def objection_band(confidence: float) -> str:
      if confidence <= 0.0:
          return "abstained (neutral)"
      if confidence >= 0.9:
          return "fatal"
      if confidence >= 0.7:
          return "severe"
      if confidence >= 0.4:
          return "substantive"
      if confidence >= 0.2:
          return "minor"
      return "no objection"
  ```
- In `apply_evidence_gate`:
  ```python
      # Treat 0.0 findings as neutral abstentions
      active_findings = [f for f in findings if f.confidence > 0.0]
      max_obj = max((f.confidence for f in active_findings), default=0.0)
      if (
          status is ClaimStatus.WEAKENED
          and findings
          and max_obj < TRIVIAL_OBJECTION_CEILING
          and not has_sourced_contradiction(findings)
      ):
          note = (
              "Upgraded from weakened to survived: all evaluators abstained or scored in "
              "the 'no objection' band and none carried a sourced contradiction."
          )
          return ClaimStatus.SURVIVED, f"{reasoning} {note}".strip()
  ```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\pytest backend/tests/evaluators/test_abstain_protocol.py -v`
Expected: PASS

---

### Task 5: End-to-End Regression and Integration Verification

**Files:**
- Run: Entire backend test suite (`.venv\Scripts\pytest --ignore=tests/ingestion/test_image.py`)
- Run: Entire frontend test suite (`npm test` in `frontend/`)

- [ ] **Step 1: Run complete backend test suite**
Run: `cd backend && .venv\Scripts\pytest --ignore=tests/ingestion/test_image.py`
Expected: All tests pass (335+ passed, 8 skipped).

- [ ] **Step 2: Run complete frontend test suite**
Run: `cd frontend && npm test`
Expected: All 26 test files, 198+ tests pass.

- [ ] **Step 3: Verify end-to-end telemetry and SSE contract**
Check that `verdict_ready` SSE event sends `confidence` field to frontend and frontend correctly parses it.
