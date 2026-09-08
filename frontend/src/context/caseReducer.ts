export * from "./caseTypes";
import {
  ActivityItem,
  CaseVerdict,
  Claim,
  DecisionConsequence,
  Finding,
  SSEEventLogItem,
} from "@/types/crossfire";
import { AppAction, AppState, SavedRealState } from "./caseTypes";
import { DEFAULT_AGENT_IDS } from "@/lib/agents";
import { applyPreviewViewToState } from "./previewHelper";

export function caseReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_DEBUG_MODE":
      return {
        ...state,
        isDebugMode: action.payload,
        ...(action.payload
          ? {}
          : state.previewView
          ? {
              currentCase: state.savedRealState ? state.savedRealState.currentCase : state.currentCase,
              activeScreen: state.savedRealState ? state.savedRealState.activeScreen : state.activeScreen,
              activeModal: state.savedRealState ? state.savedRealState.activeModal : "none",
              selectedClaimId: state.savedRealState ? state.savedRealState.selectedClaimId : null,
              isStreaming: state.savedRealState ? state.savedRealState.isStreaming : false,
              isExtracting: state.savedRealState ? state.savedRealState.isExtracting : false,
              isConfirming: state.savedRealState ? state.savedRealState.isConfirming : false,
              previewView: null,
              savedRealState: null,
            }
          : {}),
      };

    case "ENTER_PREVIEW_MODE": {
      const targetView = action.payload || "dashboard";
      const savedRealState: SavedRealState = state.savedRealState || {
        currentCase: state.currentCase,
        activeScreen: state.activeScreen,
        activeModal: state.activeModal,
        selectedClaimId: state.selectedClaimId,
        isStreaming: state.isStreaming,
        isExtracting: state.isExtracting,
        isConfirming: state.isConfirming,
      };

      const stateWithSaved = {
        ...state,
        savedRealState,
        error: null,
      };

      return applyPreviewViewToState(stateWithSaved, targetView);
    }

    case "SET_PREVIEW_VIEW": {
      if (!action.payload) {
        return {
          ...state,
          ...(state.savedRealState
            ? {
                currentCase: state.savedRealState.currentCase,
                activeScreen: state.savedRealState.activeScreen,
                activeModal: state.savedRealState.activeModal,
                selectedClaimId: state.savedRealState.selectedClaimId,
                isStreaming: state.savedRealState.isStreaming,
                isExtracting: state.savedRealState.isExtracting,
                isConfirming: state.savedRealState.isConfirming,
              }
            : {}),
          previewView: null,
          savedRealState: null,
        };
      }
      return applyPreviewViewToState(state, action.payload);
    }

    case "EXIT_PREVIEW_MODE": {
      if (!state.savedRealState) {
        return {
          ...state,
          previewView: null,
        };
      }
      return {
        ...state,
        currentCase: state.savedRealState.currentCase,
        activeScreen: state.savedRealState.activeScreen,
        activeModal: state.savedRealState.activeModal,
        selectedClaimId: state.savedRealState.selectedClaimId,
        isStreaming: state.savedRealState.isStreaming,
        isExtracting: state.savedRealState.isExtracting,
        isConfirming: state.savedRealState.isConfirming,
        previewView: null,
        savedRealState: null,
      };
    }

    case "NAVIGATE_SCREEN":
      return { ...state, activeScreen: action.payload };
    case "LOAD_PROMPT_INTO_ENTRY":
      return {
        ...state,
        activeScreen: "entry",
        draftPrompt: action.payload.rawInput,
        selectedClaimId: null,
        isStreaming: false,
        isExtracting: false,
        isConfirming: false,
        currentCase: state.currentCase
          ? {
              ...state.currentCase,
              raw_input: action.payload.rawInput,
            }
          : null,
      };
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

    case "LOAD_HISTORY_FROM_DB":
      return {
        ...state,
        caseHistory: action.payload,
      };

    case "START_EXTRACTING":
      return {
        ...state,
        isExtracting: true,
        draftPrompt: null,
        error: null,
        eventLog: [],
        activities: [],
        activeTestActivities: {},
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
          agent_mode: action.payload.agentMode || "auto",
          selected_agents: action.payload.selectedAgents || [...DEFAULT_AGENT_IDS],
          agent_rationales: {},
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

    case "CANCEL_EXTRACTION":
      return {
        ...state,
        isExtracting: false,
      };

    case "SET_AGENT_MODE": {
      if (!state.currentCase) return state;
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          agent_mode: action.payload,
        },
      };
    }

    case "TOGGLE_AGENT_SELECTION": {
      if (!state.currentCase) return state;
      const agentId = action.payload;
      
      const backendIdMap: Record<string, string> = {
        researcher: "researcher",
        operator: "overthinker"
      };
      
      const mappedId = backendIdMap[agentId] || agentId;
      const currentSelected = state.currentCase.selected_agents || [...DEFAULT_AGENT_IDS];
      
      const isSelected = currentSelected.includes(agentId) || currentSelected.includes(mappedId);
      
      const updated = isSelected
        ? currentSelected.filter((id) => id !== agentId && id !== mappedId)
        : [...currentSelected, agentId];

      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          selected_agents: updated,
        },
      };
    }

    case "SET_SELECTED_AGENTS": {
      if (!state.currentCase) return state;
      return {
        ...state,
        currentCase: {
          ...state.currentCase,
          selected_agents: action.payload,
        },
      };
    }

    case "UPDATE_CLAIM_STATEMENT": {
      if (!state.currentCase) return state;
      const updatedClaims = state.currentCase.claims.map((c) =>
        c.id === action.payload.claimId
          ? { ...c, statement: action.payload.statement, provisional: false }
          : c
      );
      return {
        ...state,
        currentCase: { ...state.currentCase, claims: updatedClaims },
      };
    }

    case "ACCEPT_PROVISIONAL_CLAIM": {
      if (!state.currentCase) return state;
      const updatedClaims = state.currentCase.claims.map((c) =>
        c.id === action.payload.claimId ? { ...c, provisional: false } : c
      );
      return {
        ...state,
        currentCase: { ...state.currentCase, claims: updatedClaims },
      };
    }

    case "START_CLARIFYING": {
      return {
        ...state,
        isExtracting: true, // This will trigger the CubeSpinner
        activeScreen: "entry", // Need to go to entry screen to show the CubeSpinner, or just let the app handle it? Actually, EntryScreen shows CubeSpinner if isExtracting is true, but it's only rendered if activeScreen is 'entry'. So we set activeScreen to 'entry'.
        error: null,
      };
    }

    case "CLARIFY_FAILED_THIN_IDEA": {
      return {
        ...state,
        isExtracting: false,
        activeScreen: "entry",
        error: {
          stage: "clarify",
          message: action.payload.message
        },
        currentCase: state.currentCase ? {
          ...state.currentCase,
          claims: [],
          status: "extracting"
        } : null
      };
    }

    case "CLARIFY_SUCCESS": {
      return {
        ...state,
        isExtracting: false,
        currentCase: action.payload.case,
        isStreaming: action.payload.autoStarted,
        activeScreen: action.payload.autoStarted ? "dashboard" : "confirm",
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
        draftPrompt: null,
        activeScreen: "entry",
        isExtracting: false,
        isConfirming: false,
        isStreaming: false,
        error: null,
        selectedClaimId: null,
        activeTests: {},
        activities: [],
        activeTestActivities: {},
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
        activities: [],
        activeTests: {},
        activeTestActivities: {},
        eventLog: [],
      };

    case "UPDATE_CASE": {
      const incomingCase = action.payload;
      const existingHistoryCase = state.caseHistory.find((c) => c.id === incomingCase.id);
      const existingCurrentCase = state.currentCase?.id === incomingCase.id ? state.currentCase : null;

      const mergedCase = {
        ...incomingCase,
        activities: incomingCase.activities || existingCurrentCase?.activities || existingHistoryCase?.activities || [],
        started_at: incomingCase.started_at || existingCurrentCase?.started_at || existingHistoryCase?.started_at || undefined,
        completed_at: incomingCase.completed_at || existingCurrentCase?.completed_at || existingHistoryCase?.completed_at || undefined,
      };

      return {
        ...state,
        currentCase: mergedCase,
        // Keep the archived copy in sync: the post-run snapshot refresh is what
        // fills in anything the stream missed, and history is read back from
        // localStorage later.
        caseHistory: state.caseHistory.map((c) =>
          c.id === mergedCase.id ? mergedCase : c
        ),
      };
    }

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
          const updatedActivities = newActivities.length > 100
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
          return {
            ...state,
            currentCase: updatedCase,
            eventLog: updatedLog,
          };
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
                finding.evaluator === "researcher"
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

        case "case_verdict": {
          const verdict = data.case_verdict as CaseVerdict | undefined;
          if (verdict) {
            updatedCase.case_verdict = verdict;
          }
          break;
        }

        case "done":
        case "run_complete": {
          const finishTime = Date.now();
          updatedCase.status = "done";
          if (!updatedCase.completed_at) {
            updatedCase.completed_at = finishTime;
          }
          updatedCase.activities = [...state.activities];
          newActiveScreen = state.activeScreen === "runner" ? "runner" : "dashboard";
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
