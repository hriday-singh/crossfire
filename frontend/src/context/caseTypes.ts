import {
  ActiveTestRow,
  ActivityItem,
  Case,
  SSEEventLogItem,
  SSEEventName,
} from "@/types/crossfire";

export type ScreenView = "entry" | "confirm" | "runner" | "dashboard";

export type PreviewView =
  | null
  | "entry"
  | "extracting"
  | "confirm"
  | "runner"
  | "dashboard"
  | "evidence"
  | "logs"
  | "history"
  | "faq"
  | "settings";

export interface SavedRealState {
  currentCase: Case | null;
  activeScreen: ScreenView;
  activeModal: AppState["activeModal"];
  selectedClaimId: string | null;
  isStreaming: boolean;
  isExtracting: boolean;
  isConfirming: boolean;
}

export interface AppState {
  currentCase: Case | null;
  activeScreen: ScreenView;
  isExtracting: boolean;
  isConfirming: boolean;
  isStreaming: boolean;
  error: { stage: string; message: string; details?: unknown } | null;
  eventLog: SSEEventLogItem[];
  activities: ActivityItem[];
  activeTestActivities: Record<string, string>;
  selectedClaimId: string | null;
  activeTests: Record<string, ActiveTestRow>;
  caseHistory: Case[];
  activeModal: "none" | "history" | "logs" | "faq" | "settings";
  startedAt: number | null;
  completedAt: number | null;
  engineInfo: {
    status: string;
    provider: string;
    model: string;
    llm_base_url?: string;
    backend_port?: number;
  } | null;
  isDebugMode: boolean;
  previewView: PreviewView;
  savedRealState: SavedRealState | null;
  draftPrompt?: string | null;
}

export const INITIAL_STATE: AppState = {
  currentCase: null,
  activeScreen: "entry",
  isExtracting: false,
  isConfirming: false,
  isStreaming: false,
  error: null,
  eventLog: [],
  activities: [],
  activeTestActivities: {},
  selectedClaimId: null,
  activeTests: {},
  caseHistory: [],
  activeModal: "none",
  startedAt: null,
  completedAt: null,
  engineInfo: null,
  isDebugMode: false,
  previewView: null,
  savedRealState: null,
  draftPrompt: null,
};

export type AppAction =
  | { type: "SET_ACTIVE_MODAL"; payload: AppState["activeModal"] }
  | { type: "SET_ENGINE_INFO"; payload: AppState["engineInfo"] }
  | { type: "CLEAR_HISTORY" }
  | { type: "DELETE_HISTORY_ITEM"; payload: string }
  | {
      type: "START_EXTRACTING";
      payload: {
        rawInput: string;
        context?: string | null;
        agentMode?: "auto" | "custom";
        selectedAgents?: string[];
      };
    }
  | { type: "EXTRACTING_SUCCESS"; payload: Case }
  | { type: "EXTRACTING_ERROR"; payload: { stage: string; message: string; details?: unknown } }
  | { type: "SET_AGENT_MODE"; payload: "auto" | "custom" }
  | { type: "TOGGLE_AGENT_SELECTION"; payload: string }
  | { type: "SET_SELECTED_AGENTS"; payload: string[] }
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
  | { type: "LOAD_PROMPT_INTO_ENTRY"; payload: { rawInput: string } }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_DEBUG_MODE"; payload: boolean }
  | { type: "ENTER_PREVIEW_MODE"; payload?: PreviewView }
  | { type: "SET_PREVIEW_VIEW"; payload: PreviewView }
  | { type: "EXIT_PREVIEW_MODE" }
  | { type: "ACCEPT_PROVISIONAL_CLAIM"; payload: { claimId: string } }
  | { type: "CLARIFY_SUCCESS"; payload: { case: Case; autoStarted: boolean } };


