import {
  ActivityItem,
  CaseVerdict,
  Claim,
  DecisionConsequence,
  Finding,
  SSEEventLogItem,
  SSEEventName,
} from "@/types/crossfire";
import type { AppState } from "./caseReducer";

export function handleSSEEvent(
  state: AppState,
  event: SSEEventName,
  data: Record<string, unknown>
): AppState {
  const logItem: SSEEventLogItem = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    event,
    data,
  };

  const updatedLog = [logItem, ...state.eventLog];

  if (!state.currentCase) {
    return { ...state, eventLog: updatedLog };
  }

  let updatedCase = { ...state.currentCase };
  let updatedTests = { ...state.activeTests };
  let newActiveScreen = state.activeScreen;
  let newIsStreaming = state.isStreaming;

  switch (event) {
    case "claim_map_ready": {
      const claims = (data.claims as Claim[]) || [];
      updatedCase.claims = claims;
      break;
    }

    case "awaiting_confirmation": {
      if (
        state.activeScreen !== "runner" &&
        state.activeScreen !== "dashboard" &&
        updatedCase.status !== "testing" &&
        updatedCase.status !== "done"
      ) {
        updatedCase.status = "awaiting_confirmation";
        newActiveScreen = "confirm";
      }
      break;
    }

    case "activity": {
      const actItem: ActivityItem = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: (data.timestamp as string) || new Date().toISOString(),
        tag: (data.tag as string) || "Investigation",
        text: (data.text as string) || "",
        claim_id: (data.claim_id as string) || null,
        action: (data.action as string) || null,
      };
      const newActivities = [...state.activities, actItem];
      // Cap at 100 to keep memory bounded
      const updatedActivities =
        newActivities.length > 100
          ? newActivities.slice(newActivities.length - 100)
          : newActivities;
      const updatedActiveTestActivities = { ...state.activeTestActivities };
      if (data.claim_id) {
        updatedActiveTestActivities[data.claim_id as string] = actItem.text;
      }
      if (data.action) {
        updatedActiveTestActivities[data.action as string] = actItem.text;
      }
      // Map tag to failure_mode key so ClaimCard TestRow lookups match
      const tagToFailureMode: Record<string, string> = {
        "Evidence Test": "evidence",
        "Feasibility Test": "feasibility",
        "Assumption Test": "assumption",
        "Operational Friction Test": "operational_friction",
        "Edge-Case Test": "edge_case",
      };
      const tag = (data.tag as string) || "";
      const failureKey = tagToFailureMode[tag];
      if (failureKey) {
        updatedActiveTestActivities[failureKey] = actItem.text;
      }
      if (tag) {
        updatedActiveTestActivities[tag] = actItem.text;
      }
      return {
        ...state,
        eventLog: updatedLog,
        activities: updatedActivities,
        activeTestActivities: updatedActiveTestActivities,
      };
    }

    case "load_bearing_ready": {
      const claimId = (data.claim_id as string) || "";
      const isLoadBearing = Boolean(data.load_bearing);
      const reason = (data.reason as string) || "";

      if (claimId) {
        updatedCase.claims = updatedCase.claims.map((c) =>
          c.id === claimId
            ? { ...c, load_bearing: isLoadBearing, load_bearing_reason: reason }
            : c
        );
      }
      break;
    }

    case "test_started": {
      const testId = data.test_id as string;
      const targetClaimId = data.target_claim_id as string;
      const evaluator = (data.evaluator as string) || "assumption";

      const mappedFailureMode =
        evaluator === "receipts" || evaluator === "researcher"
          ? "evidence"
          : evaluator === "builder"
          ? "feasibility"
          : evaluator === "operator"
          ? "operational_friction"
          : evaluator === "overthinker"
          ? "edge-case"
          : "assumption";

      if (testId) {
        updatedTests[testId] = {
          test_id: testId,
          target_claim: targetClaimId,
          failure_mode: mappedFailureMode,
          objective: "Running adversarial evaluation",
          state: "running",
        };
      }
      break;
    }

    case "finding_ready": {
      const finding = data.finding as Finding;
      const targetClaimId = (data.target_claim_id as string) || finding?.claim_id;

      if (finding) {
        const existingFindingIdx = updatedCase.findings.findIndex(
          (f) =>
            (f.test_id && f.test_id === finding.test_id) ||
            (f.claim_id === finding.claim_id && f.evaluator === finding.evaluator)
        );
        if (existingFindingIdx >= 0) {
          updatedCase.findings[existingFindingIdx] = finding;
        } else {
          updatedCase.findings.push(finding);
        }

        if (finding.test_id && updatedTests[finding.test_id]) {
          updatedTests[finding.test_id] = {
            ...updatedTests[finding.test_id],
            state: "completed",
            finding,
          };
        } else if (finding.test_id) {
          const mappedFailureMode =
            finding.evaluator === "receipts" || finding.evaluator === "researcher"
              ? "evidence"
              : finding.evaluator === "builder"
              ? "feasibility"
              : finding.evaluator === "operator"
              ? "operational_friction"
              : finding.evaluator === "overthinker"
              ? "edge-case"
              : "assumption";

          updatedTests[finding.test_id] = {
            test_id: finding.test_id,
            target_claim: targetClaimId,
            failure_mode: mappedFailureMode,
            objective: "Completed evaluation",
            state: "completed",
            finding,
          };
        }
      }
      break;
    }

    case "verdict_ready": {
      const claimId = data.claim_id as string;
      const verdictStatus = data.status as Claim["status"];
      const reasoning = (data.verdict_reasoning as string) || "";
      const fatalFlaw = (data.fatal_flaw as string) || null;
      const salvagedClaim = (data.salvaged_claim as string) || null;
      const tradeoffAcknowledged = (data.tradeoff_acknowledged as string) || null;

      updatedCase.claims = updatedCase.claims.map((c) =>
        c.id === claimId
          ? {
              ...c,
              status: verdictStatus,
              fatal_flaw: fatalFlaw ?? c.fatal_flaw,
              salvaged_claim: salvagedClaim ?? c.salvaged_claim,
              tradeoff_acknowledged: tradeoffAcknowledged ?? c.tradeoff_acknowledged,
            }
          : c
      );
      if (reasoning || fatalFlaw || salvagedClaim || tradeoffAcknowledged) {
        const existingConsequenceIdx = updatedCase.consequences.findIndex(
          (c) => c.claim_id === claimId
        );
        if (existingConsequenceIdx >= 0) {
          updatedCase.consequences[existingConsequenceIdx] = {
            ...updatedCase.consequences[existingConsequenceIdx],
            verdict_reasoning:
              reasoning || updatedCase.consequences[existingConsequenceIdx].verdict_reasoning,
            fatal_flaw: fatalFlaw ?? updatedCase.consequences[existingConsequenceIdx].fatal_flaw,
            salvaged_claim:
              salvagedClaim ?? updatedCase.consequences[existingConsequenceIdx].salvaged_claim,
            tradeoff_acknowledged:
              tradeoffAcknowledged ??
              updatedCase.consequences[existingConsequenceIdx].tradeoff_acknowledged,
          };
        } else {
          updatedCase.consequences.push({
            claim_id: claimId,
            impact: "medium",
            recommended_change: "",
            next_validation: null,
            verdict_reasoning: reasoning,
            fatal_flaw: fatalFlaw,
            salvaged_claim: salvagedClaim,
            tradeoff_acknowledged: tradeoffAcknowledged,
          });
        }
      }
      break;
    }

    case "consequence_ready": {
      const consequence = data.consequence as DecisionConsequence;
      if (consequence) {
        const existingIdx = updatedCase.consequences.findIndex(
          (c) => c.claim_id === consequence.claim_id
        );
        if (existingIdx >= 0) {
          updatedCase.consequences[existingIdx] = {
            ...updatedCase.consequences[existingIdx],
            ...consequence,
            fatal_flaw:
              consequence.fatal_flaw ?? updatedCase.consequences[existingIdx].fatal_flaw,
            salvaged_claim:
              consequence.salvaged_claim ?? updatedCase.consequences[existingIdx].salvaged_claim,
            tradeoff_acknowledged:
              consequence.tradeoff_acknowledged ??
              updatedCase.consequences[existingIdx].tradeoff_acknowledged,
            verdict_reasoning:
              consequence.verdict_reasoning ||
              updatedCase.consequences[existingIdx].verdict_reasoning,
          };
        } else {
          updatedCase.consequences.push(consequence);
        }
      }
      break;
    }

    case "case_verdict": {
      const verdict = data.case_verdict as CaseVerdict | undefined;
      if (verdict) {
        updatedCase.case_verdict = verdict;
      }
      break;
    }

    case "run_complete": {
      const finishTime = Date.now();
      updatedCase.status = "done";
      updatedCase.completed_at = finishTime;
      newActiveScreen = "dashboard";
      newIsStreaming = false;

      // Also record to history if not already present
      const alreadyInHistory = state.caseHistory.some((c) => c.id === updatedCase.id);
      const newHistory = alreadyInHistory
        ? state.caseHistory.map((c) => (c.id === updatedCase.id ? updatedCase : c))
        : [updatedCase, ...state.caseHistory];

      return {
        ...state,
        currentCase: updatedCase,
        activeTests: updatedTests,
        eventLog: updatedLog,
        activeScreen: newActiveScreen,
        isStreaming: newIsStreaming,
        caseHistory: newHistory,
        completedAt: finishTime,
      };
    }

    case "error": {
      const stage = (data.stage as string) || "pipeline";
      const message = (data.message as string) || "Pipeline error occurred";
      return {
        ...state,
        eventLog: updatedLog,
        isStreaming: false,
        error: { stage, message, details: data },
      };
    }
  }

  return {
    ...state,
    currentCase: updatedCase,
    activeTests: updatedTests,
    eventLog: updatedLog,
    activeScreen: newActiveScreen,
    isStreaming: newIsStreaming,
  };
}
