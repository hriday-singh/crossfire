// Backup of caseReducer.ts prior to adding debug views preview support
import {
  ActiveTestRow,
  Case,
  Claim,
  DecisionConsequence,
  Finding,
  SSEEventLogItem,
  SSEEventName,
} from "@/types/crossfire";

export type ScreenView = "entry" | "confirm" | "runner" | "dashboard";

export interface AppState {
  currentCase: Case | null;
  activeScreen: ScreenView;
  isExtracting: boolean;
  isConfirming: boolean;
  isStreaming: boolean;
  error: { stage: string; message: string; details?: unknown } | null;
  eventLog: SSEEventLogItem[];
  selectedClaimId: string | null;
  activeTests: Record<string, ActiveTestRow>;
  caseHistory: Case[];
  activeModal: "none" | "history" | "logs" | "faq" | "settings";
  startedAt: number | null;
  completedAt: number | null;
  engineInfo: { status: string; provider: string; model: string } | null;
}

export const INITIAL_STATE: AppState = {
  currentCase: null,
  activeScreen: "entry",
  isExtracting: false,
  isConfirming: false,
  isStreaming: false,
  error: null,
  eventLog: [],
  selectedClaimId: null,
  activeTests: {},
  caseHistory: [],
  activeModal: "none",
  startedAt: null,
  completedAt: null,
  engineInfo: null,
};

export type AppAction =
  | { type: "SET_ACTIVE_MODAL"; payload: AppState["activeModal"] }
  | { type: "SET_ENGINE_INFO"; payload: AppState["engineInfo"] }
  | { type: "CLEAR_HISTORY" }
  | { type: "DELETE_HISTORY_ITEM"; payload: string }
  | { type: "START_EXTRACTING"; payload: { rawInput: string; context?: string | null } }
  | { type: "EXTRACTING_SUCCESS"; payload: Case }
  | { type: "EXTRACTING_ERROR"; payload: { stage: string; message: string; details?: unknown } }
  | { type: "UPDATE_CLAIM_STATEMENT"; payload: { claimId: string; statement: string } }
  | { type: "TOGGLE_CLAIM_LOAD_BEARING"; payload: { claimId: string } }
  | { type: "REMOVE_CLAIM"; payload: { claimId: string } }
  | { type: "ADD_CLAIM"; payload: { statement: string } }
  | { type: "START_CONFIRMING" }
  | { type: "CONFIRMING_SUCCESS" }
  | { type: "SELECT_CLAIM"; payload: string | null }
  | { type: "SSE_EVENT"; payload: { event: SSEEventName | string; data: Record<string, unknown> } }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "RESET_CASE" }
  | { type: "LOAD_CASE"; payload: Case }
  | { type: "UPDATE_CASE"; payload: Case }
  | { type: "NAVIGATE_SCREEN"; payload: ScreenView }
  | { type: "CLEAR_ERROR" };

export function caseReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "NAVIGATE_SCREEN":
      return { ...state, activeScreen: action.payload };
    case "SET_ACTIVE_MODAL":
      return { ...state, activeModal: action.payload };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "SET_ENGINE_INFO":
      return { ...state, engineInfo: action.payload };

    case "CLEAR_HISTORY":
      return { ...state, caseHistory: [] };

    case "DELETE_HISTORY_ITEM":
      return {
        ...state,
        caseHistory: state.caseHistory.filter((c) => c.id !== action.payload),
      };

    case "START_EXTRACTING":
      return {
        ...state,
        isExtracting: true,
        error: null,
        eventLog: [],
        activeTests: {},
        selectedClaimId: null,
        currentCase: {
          id: `case-${Date.now().toString(36)}`,
          raw_input: action.payload.rawInput,
          context: action.payload.context || null,
          claims: [],
          test_plan: [],
          findings: [],
          consequences: [],
          status: "extracting",
        },
      };

    case "EXTRACTING_SUCCESS":
      return {
        ...state,
        isExtracting: false,
        currentCase: action.payload,
        activeScreen: "confirm",
      };

    case "EXTRACTING_ERROR":
      return {
        ...state,
        isExtracting: false,
        error: action.payload,
      };

    case "UPDATE_CLAIM_STATEMENT": {
      if (!state.currentCase) return state;
      const updatedClaims = state.currentCase.claims.map((c) =>
        c.id === action.payload.claimId
          ? { ...c, statement: action.payload.statement }
          : c
      );
      return {
        ...state,
        currentCase: { ...state.currentCase, claims: updatedClaims },
      };
    }

    case "TOGGLE_CLAIM_LOAD_BEARING": {
      if (!state.currentCase) return state;
      const updatedClaims = state.currentCase.claims.map((c) =>
        c.id === action.payload.claimId
          ? { ...c, load_bearing: !c.load_bearing }
          : c
      );
      return {
        ...state,
        currentCase: { ...state.currentCase, claims: updatedClaims },
      };
    }

    case "REMOVE_CLAIM": {
      if (!state.currentCase) return state;
      const filtered = state.currentCase.claims.filter(
        (c) => c.id !== action.payload.claimId
      );
      return {
        ...state,
        currentCase: { ...state.currentCase, claims: filtered },
      };
    }

    case "ADD_CLAIM": {
      if (!state.currentCase) return state;
      const newClaim: Claim = {
        id: `claim-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        statement: action.payload.statement,
        load_bearing: null,
        status: null,
      };
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          claims: [...state.currentCase.claims, newClaim],
        },
      };
    }

    case "START_CONFIRMING":
      return {
        ...state,
        isConfirming: true,
        error: null,
      };

    case "CONFIRMING_SUCCESS": {
      const now = Date.now();
      return {
        ...state,
        isConfirming: false,
        isStreaming: true,
        activeScreen: "runner",
        startedAt: now,
        completedAt: null,
        currentCase: state.currentCase
          ? { ...state.currentCase, status: "testing", started_at: now, completed_at: null }
          : null,
      };
    }

    case "SELECT_CLAIM":
      return {
        ...state,
        selectedClaimId: action.payload,
      };

    case "SET_STREAMING":
      return {
        ...state,
        isStreaming: action.payload,
      };

    case "RESET_CASE":
      return {
        ...state,
        currentCase: null,
        activeScreen: "entry",
        isExtracting: false,
        isConfirming: false,
        isStreaming: false,
        error: null,
        selectedClaimId: null,
        activeTests: {},
        startedAt: null,
        completedAt: null,
      };

    case "LOAD_CASE":
      return {
        ...state,
        currentCase: action.payload,
        activeScreen: action.payload.status === "done" ? "dashboard" : "confirm",
        isStreaming: false,
        isExtracting: false,
        isConfirming: false,
        error: null,
        selectedClaimId: null,
        activeModal: "none",
        startedAt: action.payload.started_at || null,
        completedAt: action.payload.completed_at || null,
      };

    case "UPDATE_CASE":
      return {
        ...state,
        currentCase: action.payload,
      };

    case "SSE_EVENT": {
      const { event, data } = action.payload;
      const timestamp = new Date().toISOString();
      const logItem: SSEEventLogItem = {
        id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp,
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
          updatedCase.status = "awaiting_confirmation";
          newActiveScreen = "confirm";
          break;
        }

        case "test_started": {
          const testId = (data.test_id as string) || "";
          const targetClaim = (data.target_claim_id as string) || "";
          const failureMode = (data.failure_mode as string) || (data.evaluator as string) || "assumption";

          if (testId) {
            updatedTests[testId] = {
              test_id: testId,
              target_claim: targetClaim,
              failure_mode: failureMode,
              objective: `Evaluating assumption against failure criteria`,
              state: "running",
            };

            const planItemExists = updatedCase.test_plan.some((p) => p.id === testId);
            if (!planItemExists) {
              updatedCase.test_plan.push({
                id: testId,
                target_claim: targetClaim,
                failure_mode: failureMode,
                objective: `Evaluating assumption against failure criteria`,
              });
            }
          }
          break;
        }

        case "finding_ready": {
          const finding = data.finding as Finding;
          const targetClaimId = (data.target_claim_id as string) || finding?.claim_id;

          if (finding) {
            const existingFindingIdx = updatedCase.findings.findIndex(
              (f) => f.test_id === finding.test_id
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
                finding.evaluator === "receipts"
                  ? "evidence"
                  : finding.evaluator === "builder"
                  ? "feasibility"
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
          updatedCase.claims = updatedCase.claims.map((c) =>
            c.id === claimId ? { ...c, status: verdictStatus } : c
          );
          if (reasoning) {
            const existingConsequenceIdx = updatedCase.consequences.findIndex(
              (c) => c.claim_id === claimId
            );
            if (existingConsequenceIdx >= 0) {
              updatedCase.consequences[existingConsequenceIdx] = {
                ...updatedCase.consequences[existingConsequenceIdx],
                verdict_reasoning: reasoning,
              };
            } else {
              updatedCase.consequences.push({
                claim_id: claimId,
                impact: "medium",
                recommended_change: "",
                next_validation: null,
                verdict_reasoning: reasoning,
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
              updatedCase.consequences[existingIdx] = consequence;
            } else {
              updatedCase.consequences.push(consequence);
            }
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
          const alreadyInHistory = state.caseHistory.some(
            (c) => c.id === updatedCase.id
          );
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

    default:
      return state;
  }
}
