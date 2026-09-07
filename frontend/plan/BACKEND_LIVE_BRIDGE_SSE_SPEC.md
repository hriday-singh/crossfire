# Backend Live Bridge SSE Specification

This document provides a specification for the backend on how to emit Server-Sent Events (SSE) so that the Live View in Crossfire correctly mirrors the AI cognition states for the evaluators (`devils_advocate`, `receipts`, `builder`, `operator`) and the Judge.

## Architecture & Data Flow

The frontend consumes an SSE stream for a case. To achieve the 2.5D bullpen canvas visualization (where AI agents actively think, type, walk to the magistrate table, and deliver verdicts), the backend must emit the following events in sequence with the correct payload structure.

### 1. `test_started`
Fired when an evaluator begins testing a specific claim.
*   **Action**: Dispatches active typing packet with a cognitive goal.
*   **Payload structure**:
    ```json
    {
      "test_id": "uuid",
      "target_claim_id": "claim_uuid",
      "evaluator": "devils_advocate | receipts | builder | operator",
      "claim_statement": "The claim text being tested" // (Required for UI thought bubbles)
    }
    ```
*   **UI Effect**: Evaluator transitions to typing animation at their cubicle. The thought bubble appears with a cognitive tag (e.g., `[Assumption Pre-Mortem] Testing implicit premises in "{claim_statement}"`).

### 2. `activity`
Fired continuously as the backend LLM runs its inference (e.g., fetching citations, web searching, chain-of-thought).
*   **Action**: Sets the active agent's thinking telemetry text, providing real-time insight into the LLM's current sub-task.
*   **Payload structure**:
    ```json
    {
      "evaluator": "devils_advocate | receipts | builder | operator",
      "tag": "e.g., [Assumption Test], [Citation Audit]",
      "text": "The live thought emitted by the backend (e.g., 'Stress-testing unstated premises...')",
      "timestamp": "iso-date-string"
    }
    ```
*   **UI Effect**: The thinking bubble text is updated live above the evaluator's desk.

### 3. `load_bearing_ready`
Fired when the Judge assesses whether a claim is load-bearing.
*   **Action**: Directs the Judge to evaluate core assumptions.
*   **Payload structure**:
    ```json
    {
      "claim_id": "claim_uuid",
      "load_bearing": true | false,
      "reason": "String explaining why"
    }
    ```
*   **UI Effect**: The Judge bench bubble dynamically updates to reflect that the Judge is evaluating load-bearing premises.

### 4. `finding_ready`
Fired when an evaluator completes their LLM evaluation.
*   **Action**: Queues the evaluator's journey to the magistrate table. Dispatches speech and verdict containing the actual LLM finding.
*   **Payload structure**:
    ```json
    {
      "target_claim_id": "claim_uuid",
      "finding": {
        "evaluator": "devils_advocate",
        "result": "The final finding or contradiction",
        "reasoning": "The detailed reasoning",
        "confidence": 0.85, // Float between 0 and 1
        "contradiction": "Specific contradiction if found",
        "evidence": [
            { "source_url": "...", "title": "..." }
        ]
      }
    }
    ```
*   **UI Effect**: 
    *   Dialogue is set to `finding.result` or `finding.contradiction`.
    *   Reasoning is set to `finding.reasoning`.
    *   Verdict badge (`broken` | `weakened` | `survived`) is computed based on confidence and contradiction.
    *   Confidence bar is rendered using `Math.round(finding.confidence * 100)`.
    *   Hover detail card becomes populated with citation URLs and full contradiction summary.

### 5. `verdict_ready`
Fired when the Judge reconciles the findings for a single claim.
*   **Action**: Directs the Crucible Arbiter to display the Steel Man reconciliation.
*   **Payload structure**:
    ```json
    {
      "claim_id": "claim_uuid",
      "status": "survived | weakened | broken",
      "verdict_reasoning": "Judge's reconciliation reasoning",
      "fatal_flaw": "Only if broken",
      "salvaged_claim": "Only if weakened"
    }
    ```
*   **UI Effect**: Sets the Judge's stage to `Reconciling {STATUS}` and displays the reasoning in the dialogue overlay.

### 6. `case_verdict`
Fired when all claims are resolved and the final case decision is made.
*   **Action**: Triggers the Judge's synthesis speech and verdict banner.
*   **Payload structure**:
    ```json
    {
      "case_verdict": {
         "decision_state": "proceed | hold | drop",
         "summary": "Final synthesis speech",
         "survived": [],
         "broken": [],
         "unproven": []
      }
    }
    ```
*   **UI Effect**: Judge delivers the final verdict with TTS and the final synthesis overlay appears.

### 7. `run_complete`
Fired when the entire pipeline finishes.
*   **Payload structure**:
    ```json
    {
      "case_id": "case_uuid"
    }
    ```
*   **UI Effect**: All evaluators return to their seated workstations in a quiet standby state. Active thinking bubbles fade out.

---

## Technical Notes for Backend Implementation
*   **Async/Parallel Execution**: The backend uses `asyncio.gather` so multiple `activity` and `test_started` events will be emitted concurrently. The frontend supports multiple active thinking bubbles simultaneously. Ensure the `evaluator` field is consistently populated on every `activity` and `finding_ready` event to route it to the correct sprite.
*   **Claim Statement in `test_started`**: The frontend needs the raw text of the claim being evaluated to construct the initial thought bubble (e.g. `Testing implicit premises in "${statement}"`). Please ensure `claim_statement` is injected in the `test_started` payload.
