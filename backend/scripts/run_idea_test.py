"""
Crossfire Internal Idea Runner CLI

Usage:
  python scripts/run_idea_test.py "Your decision proposition here"

Runs the full end-to-end Python pipeline internally:
  1. POST /cases -> extracts claims
  2. GET /cases/{id}/stream -> monitors real-time SSE frames
  3. POST /cases/{id}/confirm -> confirms claims & launches pipeline
  4. Awaits background evaluators, researcher search, and judge reconciliation
  5. GET /cases/{id} -> prints formatted Decision Memo and verdicts
"""
import asyncio
import json
import os
import sys

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(SCRIPT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import httpx
from main import app
import store
import events
import core.loop
from core.models import Case

DEFAULT_PROPOSITION = (
    "We should replace our entire customer support team with an autonomous "
    "AI agent to reduce support department operating costs to zero."
)

async def run_pipeline_test(proposition: str, dump_path: str | None = None):
    print("=" * 76)
    print("CROSSFIRE INTERNAL IDEA TEST RUNNER")
    print("=" * 76)
    print(f"\n[PROPOSITION UNDER TEST]:\n  \"{proposition}\"\n")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: POST /cases
        print("[1] Calling POST /cases (Extracting claims)...")
        create_res = await client.post("/cases", json={"raw_input": proposition})
        if create_res.status_code != 200:
            print(f"Error creating case: {create_res.status_code} {create_res.text}")
            return
        
        case_data = create_res.json()
        case_id = case_data["id"]
        print(f"    --> Case ID: {case_id}")
        print(f"    --> Status:  {case_data['status']}")
        print(f"    --> Claims Extracted ({len(case_data['claims'])}):")
        for i, c in enumerate(case_data["claims"], 1):
            print(f"        {i}. [{c['id'][:8]}] {c['statement']}")

        # Step 2: GET /cases/{id}/stream queue inspection
        print(f"\n[2] Checking Stream Queue for Case {case_id[:8]}...")
        q = events.get_queue(case_id)
        queued = []
        while not q.empty():
            queued.append(q.get_nowait())
        for item in queued:
            print(f"    --> Event Queued: '{item.get('event')}'")
        for item in queued:
            q.put_nowait(item)

        # Step 3: POST /cases/{id}/confirm
        print(f"\n[3] Calling POST /cases/{case_id[:8]}/confirm (Launching Pipeline)...")
        confirm_res = await client.post(
            f"/cases/{case_id}/confirm",
            json={"claims": case_data["claims"]}
        )
        if confirm_res.status_code != 202:
            print(f"Error confirming case: {confirm_res.status_code} {confirm_res.text}")
            return
        print(f"    --> Status: 202 Accepted (Pipeline started in background)")

        # Step 4: Await Background Execution
        print("\n[4] Executing Evaluators, Evidence Search & Judge Reconciliation...")
        if core.loop._background_tasks:
            await asyncio.gather(*list(core.loop._background_tasks), return_exceptions=True)

        for _ in range(120):
            case = store.get(case_id)
            if case and case.status in ("done", "error"):
                break
            await asyncio.sleep(0.2)

        # Step 5: GET /cases/{id} (Final Decision Memo)
        print(f"\n[5] Fetching Final Case Memo (GET /cases/{case_id[:8]})...\n")
        get_res = await client.get(f"/cases/{case_id}")
        if get_res.status_code != 200:
            print(f"Error retrieving case: {get_res.status_code} {get_res.text}")
            return

        final = get_res.json()
        if dump_path:
            os.makedirs(os.path.dirname(os.path.abspath(dump_path)), exist_ok=True)
            with open(dump_path, "w", encoding="utf-8") as fh:
                json.dump(final, fh, indent=2, ensure_ascii=False)
            print(f"    --> Raw case JSON written to {dump_path}")
        print("=" * 76)
        print("DECISION MEMO RESULTS")
        print("=" * 76)
        print(f"Final Pipeline Status: {final.get('status').upper()}")
        print(f"Total Test Plan Items: {len(final.get('test_plan', []))}")
        print(f"Total Findings:        {len(final.get('findings', []))}")
        print(f"Total Consequences:    {len(final.get('consequences', []))}")

        print("\n" + "-" * 76)
        print("CLAIM VERDICTS & FINDINGS:")
        print("-" * 76)
        for c in final.get("claims", []):
            verdict = (c.get("status") or "unresolved").upper()
            lb = "LOAD-BEARING" if c.get("load_bearing") else "SECONDARY"
            print(f"\n* Claim: \"{c.get('statement')}\"")
            print(f"  Verdict:  [{verdict}]  |  Importance: [{lb}]")
            
            # Print findings for this claim
            claim_findings = [f for f in final.get("findings", []) if f.get("claim_id") == c.get("id")]
            for f in claim_findings:
                print(f"  - [{f.get('evaluator').upper()} TEST]: {f.get('result')}")
                if f.get("reasoning"):
                    print(f"    Reasoning: {f.get('reasoning')[:140]}...")
                if f.get("contradiction"):
                    print(f"    Contradiction: {f.get('contradiction')}")

        print("\n" + "-" * 76)
        print("DECISION CONSEQUENCES & ACTIONABLE PIVOTS:")
        print("-" * 76)
        for cons in final.get("consequences", []):
            print(f"\n* Impact: {cons.get('impact', '').upper()}")
            print(f"  Recommended Adjustment: {cons.get('recommended_change')}")
            if cons.get("next_validation"):
                print(f"  Smallest Next Experiment: {cons.get('next_validation')}")

        print("\n" + "=" * 76)
        print("PIPELINE RUN COMPLETE")
        print("=" * 76)

if __name__ == "__main__":
    prop = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROPOSITION
    dump = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(run_pipeline_test(prop, dump))
