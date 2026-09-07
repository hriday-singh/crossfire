"""
Crossfire Calibration Corpus Automated Runner
Implements 00-corpus-spec.md run protocol.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_ROOT.parent
RUNS_DIR = PROJECT_ROOT / "docs" / "calibration" / "runs"

CASES = [
    # Band A — Should largely survive
    {
        "id": "a1-notion-migration",
        "band": "A",
        "raw_input": (
            "We're moving our 12-person engineering team's internal docs from Confluence "
            "to Notion over one weekend, keeping Confluence in read-only mode for six months "
            "as a fallback before we cancel the licence."
        ),
        "expected": "most claims survived, decision_state = proceed or proceed_with_changes",
    },
    {
        "id": "a2-treasury-mmf",
        "band": "A",
        "raw_input": (
            "I'm moving my savings out of a 0.5% APY checking account into a US Treasury "
            "money market fund yielding about 4.5%, keeping three months of expenses liquid in checking."
        ),
        "expected": "survived, decision_state = proceed",
    },
    {
        "id": "a3-soc2",
        "band": "A",
        "raw_input": (
            "Our SaaS will get SOC 2 Type II certified before we chase enterprise deals. "
            "We have budgeted nine months and about $45,000 including the auditor."
        ),
        "expected": "survived or weakened on numeric basis",
    },
    # Band B — Should break on hard public evidence
    {
        "id": "b1-phi-google-drive",
        "band": "B",
        "raw_input": (
            "We'll cut our cloud bill by 90% by moving all patient records out of our hosted "
            "EHR and into a shared Google Drive folder that staff access by link."
        ),
        "expected": "at least one broken claim, decision_state = drop",
    },
    {
        "id": "b2-14-hour-shifts",
        "band": "B",
        "raw_input": (
            "Our delivery drivers will run 14-hour continuous driving shifts so we can "
            "offer next-day delivery in every state in the lower 48."
        ),
        "expected": "broken, contradiction naming FMCSA 11 hours",
    },
    {
        "id": "b3-prepayment-crypto",
        "band": "B",
        "raw_input": (
            "We'll fund year one by taking twelve months of customer prepayments up front "
            "and holding them in crypto, and we'll guarantee customers an 8% return on the "
            "balance if they leave the money with us."
        ),
        "expected": "broken, decision_state = drop (unregistered security/deposit issue)",
    },
    # Band C — Genuinely uncertain
    {
        "id": "c1-japan-before-korea",
        "band": "C",
        "raw_input": (
            "We should launch our B2B analytics product in Japan before Korea, because "
            "Japanese mid-market firms will adopt AI tooling faster over the next 18 months."
        ),
        "expected": "unresolved on adoption-rate, decision_state = hold",
    },
    {
        "id": "c2-usage-based-pricing",
        "band": "C",
        "raw_input": (
            "Switching our pricing from per-seat to usage-based will increase net revenue "
            "retention for our customer mix."
        ),
        "expected": "unresolved (missing usage distribution)",
    },
    {
        "id": "c3-head-of-sales-timing",
        "band": "C",
        "raw_input": (
            "Hiring a Head of Sales now rather than in six months will shorten our enterprise sales cycle."
        ),
        "expected": "unresolved, decision_state = hold",
    },
    # Band D — Non-business domains
    {
        "id": "d1-spinal-fusion",
        "band": "D",
        "raw_input": (
            "I've had lower back pain for four months. I'm going to skip physical therapy "
            "and book a spinal fusion consult now."
        ),
        "expected": "weakened or broken on skip-PT claim, clinical language",
    },
    {
        "id": "d2-pro-se-custody",
        "band": "D",
        "raw_input": (
            "I'm going to represent myself at a contested child custody hearing to save "
            "the $12,000 in attorney fees."
        ),
        "expected": "engages asymmetry, weakened with salvage (unbundled legal services)",
    },
    {
        "id": "d3-tenure-vs-startup",
        "band": "D",
        "raw_input": (
            "I should turn down a tenure-track offer at a state university to join a "
            "seed-stage startup as employee number four, taking 0.8% equity and a 30% pay cut."
        ),
        "expected": "unresolved on overall call, 0.8% equity dilution arithmetic",
    },
    # Band E — Mixed verdicts and salvage quality
    {
        "id": "e1-ai-support-team",
        "band": "E",
        "raw_input": (
            "We should replace our entire customer support team with an autonomous "
            "AI agent to reduce support department operating costs to zero."
        ),
        "expected": "mixed statuses, proceed_with_changes with specific salvage",
    },
    {
        "id": "e2-pwa-instead-of-native",
        "band": "E",
        "raw_input": (
            "We'll ship our mobile app as a PWA instead of native to halve build time, "
            "and still list it on the iOS App Store."
        ),
        "expected": "one survived and one broken/weakened claim",
    },
    {
        "id": "e3-van-conversion",
        "band": "E",
        "raw_input": (
            "I'm buying a 2015 diesel van for $18,000, converting it to a camper for $8,000 "
            "over three months of weekends, and living in it full-time in Denver to save $2,000 a month on rent."
        ),
        "expected": "maximum status diversity across mechanical, financial, regulatory, climate",
    },
]


def run_control_sync(case_def: dict) -> str:
    case_id = case_def["id"]
    control_path = RUNS_DIR / f"{case_id}.control.md"
    if control_path.exists() and control_path.stat().st_size > 50:
        print(f"[{case_id}] Control file already exists at {control_path.name}")
        return control_path.read_text(encoding="utf-8")

    print(f"[{case_id}] Calling POST /baseline for vanilla Gemini control...")
    try:
        with httpx.Client(base_url="http://127.0.0.1:8000", timeout=90.0) as client:
            resp = client.post("/baseline", json={"raw_input": case_def["raw_input"]})
            if resp.status_code != 200:
                print(f"Error calling /baseline: {resp.status_code} {resp.text}")
                ans = f"Error {resp.status_code}: {resp.text}"
            else:
                data = resp.json()
                ans = data.get("answer", "")
    except Exception as exc:
        print(f"Exception calling /baseline: {exc}")
        ans = f"Baseline call failed: {exc}"

    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    control_content = (
        f"# Control Run — {case_id}\n\n"
        f"**Proposition:**\n> {case_def['raw_input']}\n\n"
        f"**Date:** {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n\n"
        f"## Vanilla Gemini Response\n\n{ans}\n"
    )
    control_path.write_text(control_content, encoding="utf-8")
    print(f"[{case_id}] Control saved to {control_path.name}")
    return control_content


def run_case_pipeline(case_def: dict) -> tuple[dict | None, float]:
    case_id = case_def["id"]
    dump_path = RUNS_DIR / f"{case_id}.json"
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    py_exe = sys.executable
    cmd = [
        py_exe,
        str(BACKEND_ROOT / "scripts" / "run_idea_test.py"),
        case_def["raw_input"],
        str(dump_path),
    ]

    for attempt in range(1, 3):
        print(f"\n[{case_id}] Launching pipeline test (attempt {attempt}/2)...")
        start_t = time.time()
        res = subprocess.run(cmd, cwd=str(BACKEND_ROOT), capture_output=True, text=True)
        dur = round(time.time() - start_t, 2)
        print(f"[{case_id}] Subprocess exited with code {res.returncode} in {dur}s")

        if dump_path.exists() and dump_path.stat().st_size > 100:
            try:
                data = json.loads(dump_path.read_text(encoding="utf-8"))
                if data.get("status") == "done":
                    return data, dur
                elif data.get("status") == "error":
                    print(f"[{case_id}] Case status is 'error'.")
                else:
                    return data, dur
            except Exception as exc:
                print(f"[{case_id}] Failed parsing JSON: {exc}")
        else:
            print(f"[{case_id}] Dump file not found or empty.")
            print(f"Stderr:\n{res.stderr[-500:]}")

        if attempt < 2:
            print(f"[{case_id}] Retrying case once...")
            time.sleep(2)

    return None, 0.0


def extract_summary(case_def: dict, case_data: dict, duration: float) -> dict:
    case_id = case_def["id"]
    claims = []
    for c in case_data.get("claims", []):
        claims.append(
            {
                "id": c.get("id"),
                "statement": c.get("statement"),
                "status": c.get("status"),
                "load_bearing": c.get("load_bearing"),
                "load_bearing_reason": c.get("load_bearing_reason"),
                "fatal_flaw": c.get("fatal_flaw"),
                "salvaged_claim": c.get("salvaged_claim"),
                "tradeoff_acknowledged": c.get("tradeoff_acknowledged"),
            }
        )

    findings = []
    for f in case_data.get("findings", []):
        ev_items = f.get("evidence", []) or []
        findings.append(
            {
                "claim_id": f.get("claim_id"),
                "evaluator": f.get("evaluator"),
                "confidence": f.get("confidence"),
                "result": f.get("result"),
                "reasoning": f.get("reasoning"),
                "contradiction": f.get("contradiction"),
                "evidence_count": len(ev_items),
                "source_classes": [item.get("source_class") for item in ev_items if item.get("source_class")],
                "stances": [item.get("stance") for item in ev_items if item.get("stance")],
            }
        )

    consequences = []
    for cons in case_data.get("consequences", []):
        vr = cons.get("verdict_reasoning") or ""
        consequences.append(
            {
                "claim_id": cons.get("claim_id"),
                "impact": cons.get("impact"),
                "recommended_change": cons.get("recommended_change"),
                "next_validation": cons.get("next_validation"),
                "verdict_reasoning": vr,
                "has_downgrade_note": "Downgraded from" in vr,
            }
        )

    verdict = case_data.get("case_verdict") or {}
    summary_text = verdict.get("summary") or ""
    # simple sentence count: split by '. '
    sentence_count = len([s for s in summary_text.replace("\n", " ").split(". ") if s.strip()]) if summary_text else 0

    next_actions = []
    for na in verdict.get("next_actions", []):
        next_actions.append(
            {
                "action": na.get("action"),
                "claim_ids": na.get("claim_ids", []),
            }
        )

    return {
        "case_id": case_id,
        "band": case_def["band"],
        "raw_input": case_def["raw_input"],
        "status": case_data.get("status"),
        "wall_clock_seconds": duration,
        "claims": claims,
        "findings": findings,
        "consequences": consequences,
        "case_verdict": {
            "decision_state": verdict.get("decision_state"),
            "summary": summary_text,
            "sentence_count": sentence_count,
            "next_actions": next_actions,
        },
    }


def update_progress(summary: dict) -> None:
    progress_file = RUNS_DIR / "corpus_progress.json"
    if progress_file.exists():
        try:
            progress = json.loads(progress_file.read_text(encoding="utf-8"))
        except Exception:
            progress = {"cases": {}, "completed": 0, "total": len(CASES)}
    else:
        progress = {"cases": {}, "completed": 0, "total": len(CASES)}

    cid = summary["case_id"]
    progress["cases"][cid] = {
        "band": summary["band"],
        "status": summary["status"],
        "decision_state": summary["case_verdict"]["decision_state"],
        "claims_count": len(summary["claims"]),
        "findings_count": len(summary["findings"]),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    progress["completed"] = len(progress["cases"])
    progress["total"] = len(CASES)

    progress_file.write_text(json.dumps(progress, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Run Crossfire Calibration Corpus")
    parser.add_argument("--case", help="Specific case ID to run")
    parser.add_argument("--band", help="Specific band to run (A, B, C, D, E)")
    parser.add_argument("--force", action="store_true", help="Force re-running existing completed cases")
    args = parser.parse_args()

    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    cases_to_run = CASES
    if args.case:
        cases_to_run = [c for c in CASES if c["id"] == args.case]
    elif args.band:
        cases_to_run = [c for c in CASES if c["band"] == args.band.upper()]

    print(f"Total candidate cases: {len(cases_to_run)}")
    for idx, cdef in enumerate(cases_to_run, 1):
        cid = cdef["id"]
        summary_path = RUNS_DIR / f"{cid}.summary.json"
        dump_path = RUNS_DIR / f"{cid}.json"

        if not args.force and summary_path.exists() and dump_path.exists():
            try:
                existing_sum = json.loads(summary_path.read_text(encoding="utf-8"))
                if existing_sum.get("status") == "done":
                    print(f"\n[SKIP] [{idx}/{len(cases_to_run)}] {cid} is already completed (decision: {existing_sum.get('case_verdict', {}).get('decision_state')}). Use --force to re-run.")
                    continue
            except Exception:
                pass

        print("\n" + "=" * 76)
        print(f"RUNNING [{idx}/{len(cases_to_run)}] {cid} (Band {cdef['band']})")
        print("=" * 76)

        # 1. Run control
        run_control_sync(cdef)

        # 2. Run pipeline
        case_data, dur = run_case_pipeline(cdef)
        if not case_data:
            print(f"FAILED: {cid} did not produce valid case data.")
            continue

        # 3. Extract summary
        summary = extract_summary(cdef, case_data, dur)
        summary_path = RUNS_DIR / f"{cid}.summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"[{cid}] Summary written to {summary_path.name}")

        # 4. Update progress
        update_progress(summary)
        print(f"[{cid}] Decision State: {summary['case_verdict']['decision_state']}")
        print(f"[{cid}] Claims: {len(summary['claims'])}, Findings: {len(summary['findings'])}")


if __name__ == "__main__":
    main()
