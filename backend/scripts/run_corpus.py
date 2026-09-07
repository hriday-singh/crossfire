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
BASE_RUNS_DIR = PROJECT_ROOT / "docs" / "calibration" / "runs"

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


def run_control_sync(case_def: dict, runs_dir: Path) -> dict:
    case_id = case_def["id"]
    control_path = runs_dir / f"{case_id}.control.md"

    # Check for a valid existing control file (ignoring error dumps from previously failed runs)
    if control_path.exists() and control_path.stat().st_size > 50:
        content = control_path.read_text(encoding="utf-8")
        has_error = any(
            err in content
            for err in ("Error 429:", "Error 500:", "Error 502:", "Error 504:", "Baseline call failed:")
        )
        if not has_error:
            print(f"[{case_id}] Valid control file already exists at {control_path.name}")
            cached_dur = 0.0
            import re
            m = re.search(r"\*\*Execution Time:\*\*\s*([0-9.]+)s", content)
            if m:
                try:
                    cached_dur = float(m.group(1))
                except ValueError:
                    pass
            return {
                "status": "cached",
                "error": None,
                "error_type": None,
                "duration_seconds": cached_dur,
                "attempts": 0,
            }

    print(f"[{case_id}] Calling POST /baseline for vanilla Gemini control...")
    start_t = time.time()
    last_err: str | None = None
    last_err_type: str | None = None
    ans = ""
    attempts = 0

    req_payload: dict[str, str] = {"raw_input": case_def["raw_input"]}
    if case_def.get("context"):
        req_payload["context"] = case_def["context"]

    for attempt in range(1, 3):
        attempts = attempt
        try:
            with httpx.Client(base_url="http://127.0.0.1:8000", timeout=180.0) as client:
                resp = client.post("/baseline", json=req_payload)
                if resp.status_code == 200:
                    data = resp.json()
                    ans = data.get("answer", "")
                    last_err = None
                    last_err_type = None
                    break
                else:
                    err_msg = f"HTTP {resp.status_code}: {resp.text}"
                    print(f"[{case_id}] Error calling /baseline (attempt {attempt}/2): {err_msg}")
                    last_err = err_msg
                    if resp.status_code == 429 or "429" in resp.text:
                        last_err_type = "rate_limit"
                        if attempt < 2:
                            print(f"[{case_id}] Rate limited (429). Waiting 5s before retry...")
                            time.sleep(5)
                    elif resp.status_code == 504 or "timed out" in resp.text.lower():
                        last_err_type = "timeout"
                        if attempt < 2:
                            print(f"[{case_id}] Timed out (504). Waiting 2s before retry...")
                            time.sleep(2)
                    else:
                        last_err_type = "http_error"
        except (httpx.TimeoutException, TimeoutError) as exc:
            print(f"[{case_id}] Client timeout calling /baseline (attempt {attempt}/2): {exc}")
            last_err = f"Timeout: {exc}"
            last_err_type = "timeout"
            if attempt < 2:
                time.sleep(2)
        except Exception as exc:
            print(f"[{case_id}] Exception calling /baseline (attempt {attempt}/2): {exc}")
            last_err = f"Exception: {exc}"
            last_err_type = "connection_error"
            if attempt < 2:
                time.sleep(2)

    dur = round(time.time() - start_t, 2)
    if ans:
        runs_dir.mkdir(parents=True, exist_ok=True)
        control_content = (
            f"# Control Run — {case_id}\n\n"
            f"**Proposition:**\n> {case_def['raw_input']}\n\n"
            f"**Execution Time:** {dur}s\n"
            f"**Date:** {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n\n"
            f"## Vanilla Gemini Response\n\n{ans}\n"
        )
        control_path.write_text(control_content, encoding="utf-8")
        print(f"[{case_id}] Control saved to {control_path.name} in {dur}s")
        return {
            "status": "ok",
            "error": None,
            "error_type": None,
            "duration_seconds": dur,
            "attempts": attempts,
        }
    else:
        print(f"[{case_id}] Control generation failed after {attempts} attempts: {last_err}")
        return {
            "status": "error",
            "error": last_err,
            "error_type": last_err_type,
            "duration_seconds": dur,
            "attempts": attempts,
        }


def run_case_pipeline(case_def: dict, runs_dir: Path) -> tuple[dict | None, float, dict]:
    case_id = case_def["id"]
    dump_path = runs_dir / f"{case_id}.json"
    runs_dir.mkdir(parents=True, exist_ok=True)

    venv_py = BACKEND_ROOT / ".venv" / "Scripts" / "python.exe"
    py_exe = str(venv_py) if venv_py.exists() else sys.executable
    cmd = [
        py_exe,
        str(BACKEND_ROOT / "scripts" / "run_idea_test.py"),
        case_def["raw_input"],
        str(dump_path),
    ]

    last_error: str | None = None
    total_dur = 0.0

    for attempt in range(1, 3):
        print(f"\n[{case_id}] Launching pipeline test (attempt {attempt}/2)...")
        start_t = time.time()
        res = subprocess.run(cmd, cwd=str(BACKEND_ROOT), capture_output=True, text=True)
        dur = round(time.time() - start_t, 2)
        total_dur += dur
        print(f"[{case_id}] Subprocess exited with code {res.returncode} in {dur}s")

        if dump_path.exists() and dump_path.stat().st_size > 100:
            try:
                data = json.loads(dump_path.read_text(encoding="utf-8"))
                case_status = data.get("status")
                findings = data.get("findings", []) or []
                timeouts_count = sum(
                    1
                    for f in findings
                    if f.get("result") == "System Error / Timeout"
                    or "timeout" in str(f.get("reasoning", "")).lower()
                )
                account = {
                    "status": case_status or "done",
                    "attempts": attempt,
                    "duration_seconds": dur,
                    "timeouts_count": timeouts_count,
                    "error": None if case_status == "done" else data.get("error_message"),
                }
                if case_status == "done":
                    return data, dur, account
                elif case_status == "error":
                    print(f"[{case_id}] Case status is 'error'.")
                    last_error = data.get("error_message") or "Case status returned 'error'"
                else:
                    return data, dur, account
            except Exception as exc:
                last_error = f"Failed parsing JSON: {exc}"
                print(f"[{case_id}] Failed parsing JSON: {exc}")
        else:
            stderr_snippet = res.stderr[-500:].strip() if res.stderr else "No stderr"
            last_error = f"Subprocess exit {res.returncode}: {stderr_snippet}"
            print(f"[{case_id}] Dump file not found or empty.")
            print(f"Stderr:\n{stderr_snippet}")

        if attempt < 2:
            print(f"[{case_id}] Retrying case once...")
            time.sleep(2)

    failed_account = {
        "status": "failed",
        "attempts": 2,
        "duration_seconds": total_dur,
        "timeouts_count": 0,
        "error": last_error,
    }
    return None, total_dur, failed_account


def extract_summary(
    case_def: dict,
    case_data: dict,
    duration: float,
    control_account: dict | None = None,
    pipeline_account: dict | None = None,
) -> dict:
    case_id = case_def["id"]
    test_plan_ids = [tp.get("id") for tp in case_data.get("test_plan", []) if tp.get("id")]
    claims = []
    for c in case_data.get("claims", []):
        claims.append(
            {
                "id": c.get("id"),
                "statement": c.get("statement"),
                "status": c.get("status"),
                "weakened_kind": c.get("weakened_kind"),
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
        t_id = f.get("test_id")
        findings.append(
            {
                "claim_id": f.get("claim_id"),
                "evaluator": f.get("evaluator"),
                "test_id": t_id,
                "is_probe": f.get("evaluator") == "researcher" and (t_id not in test_plan_ids or str(t_id or "").startswith("probe_")),
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
                "has_upgrade_note": "Upgraded from" in vr,
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

    timeouts_count = (pipeline_account or {}).get("timeouts_count", 0)
    if not timeouts_count:
        timeouts_count = sum(
            1
            for f in findings
            if f.get("result") == "System Error / Timeout"
            or "timeout" in str(f.get("reasoning", "")).lower()
        )

    ctrl_dur = round(float((control_account or {}).get("duration_seconds", 0.0) or 0.0), 2)
    pipe_dur = round(float((pipeline_account or {}).get("duration_seconds", duration) or 0.0), 2)
    tot_dur = round(ctrl_dur + pipe_dur, 2)
    timings_data = {
        "control_seconds": ctrl_dur,
        "pipeline_seconds": pipe_dur,
        "total_seconds": tot_dur,
    }

    return {
        "case_id": case_id,
        "band": case_def["band"],
        "raw_input": case_def["raw_input"],
        "status": case_data.get("status"),
        "wall_clock_seconds": pipe_dur,
        "total_wall_clock_seconds": tot_dur,
        "timings": timings_data,
        "test_plan_count": len(test_plan_ids),
        "claims": claims,
        "findings": findings,
        "consequences": consequences,
        "case_verdict": {
            "decision_state": verdict.get("decision_state"),
            "summary": summary_text,
            "sentence_count": sentence_count,
            "next_actions": next_actions,
            "headline": verdict.get("headline"),
            "deciding_factor": verdict.get("deciding_factor"),
        },
        "account": {
            "control": control_account or {"status": "unknown"},
            "pipeline": pipeline_account or {"status": case_data.get("status", "done"), "attempts": 1},
            "timeouts_count": timeouts_count,
            "has_system_errors": timeouts_count > 0,
            "timings": timings_data,
        },
    }


def _calculate_progress_summary(progress: dict) -> None:
    cases = progress.get("cases", {})
    completed = sum(1 for c in cases.values() if c.get("status") == "done")
    failed = sum(1 for c in cases.values() if c.get("status") in ("failed", "error"))
    ctrl_ok = sum(1 for c in cases.values() if c.get("control_status") in ("ok", "cached"))
    ctrl_err = sum(1 for c in cases.values() if c.get("control_status") == "error")
    total_timeouts = sum(c.get("timeouts_count", 0) for c in cases.values())
    total_pipe = round(sum(c.get("pipeline_seconds", c.get("wall_clock_seconds", 0.0)) for c in cases.values()), 2)
    total_ctrl = round(sum(c.get("control_seconds", 0.0) for c in cases.values()), 2)
    total_duration = round(sum(c.get("total_seconds", c.get("wall_clock_seconds", 0.0)) for c in cases.values()), 2)

    progress["completed"] = completed
    progress["total"] = len(CASES)
    progress["summary"] = {
        "total_cases": len(CASES),
        "considered": len(cases),
        "completed": completed,
        "failed": failed,
        "control_ok": ctrl_ok,
        "control_errors": ctrl_err,
        "total_timeouts": total_timeouts,
        "total_control_seconds": total_ctrl,
        "total_pipeline_seconds": total_pipe,
        "total_wall_clock_seconds": total_duration,
        "last_updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


def update_progress(summary: dict, runs_dir: Path) -> None:
    progress_file = runs_dir / "corpus_progress.json"
    if progress_file.exists():
        try:
            progress = json.loads(progress_file.read_text(encoding="utf-8"))
        except Exception:
            progress = {"cases": {}, "completed": 0, "total": len(CASES)}
    else:
        progress = {"cases": {}, "completed": 0, "total": len(CASES)}

    if "cases" not in progress:
        progress["cases"] = {}

    cid = summary["case_id"]
    acct = summary.get("account", {})
    ctrl = acct.get("control", {})
    pipe = acct.get("pipeline", {})
    timings = summary.get("timings", {})
    ctrl_sec = timings.get("control_seconds", ctrl.get("duration_seconds", 0.0))
    pipe_sec = timings.get("pipeline_seconds", summary.get("wall_clock_seconds", 0.0))
    tot_sec = timings.get("total_seconds", round(ctrl_sec + pipe_sec, 2))

    progress["cases"][cid] = {
        "band": summary["band"],
        "status": summary.get("status", "done"),
        "decision_state": summary.get("case_verdict", {}).get("decision_state"),
        "claims_count": len(summary.get("claims", [])),
        "findings_count": len(summary.get("findings", [])),
        "pipeline_seconds": pipe_sec,
        "control_seconds": ctrl_sec,
        "total_seconds": tot_sec,
        "wall_clock_seconds": pipe_sec,
        "control_status": ctrl.get("status", "unknown"),
        "control_error": ctrl.get("error"),
        "timeouts_count": acct.get("timeouts_count", 0),
        "attempts": pipe.get("attempts", 1),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    _calculate_progress_summary(progress)
    progress_file.write_text(json.dumps(progress, indent=2), encoding="utf-8")


def update_progress_failed(
    case_def: dict,
    runs_dir: Path,
    control_account: dict,
    pipeline_account: dict,
) -> None:
    progress_file = runs_dir / "corpus_progress.json"
    if progress_file.exists():
        try:
            progress = json.loads(progress_file.read_text(encoding="utf-8"))
        except Exception:
            progress = {"cases": {}, "completed": 0, "total": len(CASES)}
    else:
        progress = {"cases": {}, "completed": 0, "total": len(CASES)}

    if "cases" not in progress:
        progress["cases"] = {}

    cid = case_def["id"]
    ctrl_sec = round(float(control_account.get("duration_seconds", 0.0) or 0.0), 2)
    pipe_sec = round(float(pipeline_account.get("duration_seconds", 0.0) or 0.0), 2)
    tot_sec = round(ctrl_sec + pipe_sec, 2)
    progress["cases"][cid] = {
        "band": case_def["band"],
        "status": pipeline_account.get("status", "failed"),
        "decision_state": None,
        "claims_count": 0,
        "findings_count": 0,
        "pipeline_seconds": pipe_sec,
        "control_seconds": ctrl_sec,
        "total_seconds": tot_sec,
        "wall_clock_seconds": pipe_sec,
        "control_status": control_account.get("status", "unknown"),
        "control_error": control_account.get("error"),
        "timeouts_count": pipeline_account.get("timeouts_count", 0),
        "attempts": pipeline_account.get("attempts", 2),
        "error": pipeline_account.get("error"),
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    _calculate_progress_summary(progress)
    progress_file.write_text(json.dumps(progress, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Run Crossfire Calibration Corpus")
    parser.add_argument("--case", help="Specific case ID to run")
    parser.add_argument("--band", help="Specific band to run (A, B, C, D, E)")
    parser.add_argument("--round", default="round2", help="Subdirectory under runs (e.g. round2)")
    parser.add_argument("--force", action="store_true", help="Force re-running existing completed cases")
    args = parser.parse_args()

    runs_dir = BASE_RUNS_DIR / args.round
    runs_dir.mkdir(parents=True, exist_ok=True)

    cases_to_run = CASES
    if args.case:
        cases_to_run = [c for c in CASES if c["id"] == args.case]
    elif args.band:
        cases_to_run = [c for c in CASES if c["band"] == args.band.upper()]

    print(f"Destination directory: {runs_dir}")
    print(f"Total candidate cases: {len(cases_to_run)}")
    for idx, cdef in enumerate(cases_to_run, 1):
        cid = cdef["id"]
        summary_path = runs_dir / f"{cid}.summary.json"
        dump_path = runs_dir / f"{cid}.json"

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
        control_acct = run_control_sync(cdef, runs_dir)

        # 2. Run pipeline
        case_data, dur, pipeline_acct = run_case_pipeline(cdef, runs_dir)
        if not case_data:
            print(f"FAILED: {cid} did not produce valid case data.")
            update_progress_failed(cdef, runs_dir, control_acct, pipeline_acct)
            continue

        # 3. Extract summary
        summary = extract_summary(cdef, case_data, dur, control_acct, pipeline_acct)
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"[{cid}] Summary written to {summary_path.name}")

        # 4. Update progress
        update_progress(summary, runs_dir)
        t = summary.get("timings", {})
        print(f"[{cid}] Decision State: {summary['case_verdict']['decision_state']}")
        print(
            f"[{cid}] Timing: Total={t.get('total_seconds', 0.0)}s "
            f"(Control={t.get('control_seconds', 0.0)}s, Pipeline={t.get('pipeline_seconds', 0.0)}s)"
        )
        print(
            f"[{cid}] Claims: {len(summary['claims'])}, Findings: {len(summary['findings'])}, "
            f"Timeouts: {summary['account']['timeouts_count']}, Control: {control_acct['status']}"
        )

    # Print final accounting report
    progress_file = runs_dir / "corpus_progress.json"
    if progress_file.exists():
        try:
            progress = json.loads(progress_file.read_text(encoding="utf-8"))
            s = progress.get("summary", {})
            print("\n" + "=" * 76)
            print("CORPUS RUN ACCOUNTING SUMMARY")
            print("=" * 76)
            print(f"Total Corpus Cases:     {s.get('total_cases', len(CASES))}")
            print(f"Considered Cases:       {s.get('considered', 0)}")
            print(f"Completed Successfully: {s.get('completed', 0)}")
            print(f"Failed Cases:           {s.get('failed', 0)}")
            print(f"Control Baselines OK:   {s.get('control_ok', 0)}")
            print(f"Control Errors:         {s.get('control_errors', 0)}")
            print(f"Degraded Timeouts:      {s.get('total_timeouts', 0)}")
            print(f"Total Control Time:     {s.get('total_control_seconds', 0.0)}s")
            print(f"Total Pipeline Time:    {s.get('total_pipeline_seconds', 0.0)}s")
            print(f"Total Wall Time:        {s.get('total_wall_clock_seconds', 0.0)}s")
            print(f"Progress Ledger:        {progress_file}")
            print("=" * 76)
        except Exception:
            pass


if __name__ == "__main__":
    main()

