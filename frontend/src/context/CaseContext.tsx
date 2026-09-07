import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import { AppAction, AppState, INITIAL_STATE, PreviewView, caseReducer } from "./caseReducer";
import { DECISION_PRESETS } from "@/lib/presets";
import { confirmCase, createCase, getCase, getHealth } from "@/lib/api";
import { Case } from "@/types/crossfire";

interface CaseContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  startExtracting: (
    rawInput: string,
    context?: string | null,
    agentMode?: "auto" | "custom",
    selectedAgents?: string[]
  ) => Promise<void>;
  confirmAndRun: () => Promise<void>;
  toggleAgentSelection: (agentId: string) => void;
  setAgentMode: (mode: "auto" | "custom") => void;
  setSelectedAgents: (agents: string[]) => void;
  selectClaim: (claimId: string | null) => void;
  resetCase: () => void;
  loadPreset: (presetId: string) => void;
  navigateScreen: (screen: AppState["activeScreen"]) => void;
  loadPromptIntoEntry: (improvedPrompt: string) => void;
  setActiveModal: (modal: AppState["activeModal"]) => void;
  refreshCurrentCase: () => Promise<void>;
  selectModel?: (modelId: string) => void;
  setDebugMode: (enabled: boolean) => void;
  enterPreview: (view?: PreviewView) => void;
  setPreviewView: (view: PreviewView) => void;
  exitPreview: () => void;
}

export const CaseContext = createContext<CaseContextValue | null>(null);

const STORAGE_KEY_HISTORY = "crossfire_case_history";
const STORAGE_KEY_DEBUG = "crossfire_debug";
const STORAGE_KEY_MODEL = "crossfire_selected_model";

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(caseReducer, INITIAL_STATE, (initial) => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      const parsedHistory: Case[] = savedHistory ? JSON.parse(savedHistory) : [];
      const savedDebug = localStorage.getItem(STORAGE_KEY_DEBUG);
      let isDebug = savedDebug === "true";
      if (!isDebug && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        isDebug = urlParams.get("debug") === "true" || urlParams.get("debug") === "1";
      }
      const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
      return {
        ...initial,
        caseHistory: parsedHistory,
        isDebugMode: isDebug,
        engineInfo: savedModel
          ? { status: "ok", provider: "openai_compat", model: savedModel }
          : initial.engineInfo,
      };
    } catch {
      return initial;
    }
  });

  // Query backend engine health on mount
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const health = await getHealth();
        if (isMounted) {
          const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
          dispatch({
            type: "SET_ENGINE_INFO",
            payload: {
              ...health,
              model: savedModel || health.model,
            },
          });
        }
      } catch (err) {
        console.warn("Backend health check failed:", err);
      }
    };
    checkHealth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync history to localStorage (only when not in preview mode)
  useEffect(() => {
    if (state.previewView !== null) return;
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.caseHistory));
    } catch {
      // Ignore storage errors
    }
  }, [state.caseHistory, state.previewView]);

  const setDebugMode = (enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_DEBUG, String(enabled));
    } catch {
      // Ignore storage errors
    }
    dispatch({ type: "SET_DEBUG_MODE", payload: enabled });
  };

  const enterPreview = (view?: PreviewView) => {
    dispatch({ type: "ENTER_PREVIEW_MODE", payload: view });
  };

  const setPreviewView = (view: PreviewView) => {
    dispatch({ type: "SET_PREVIEW_VIEW", payload: view });
  };

  const exitPreview = () => {
    dispatch({ type: "EXIT_PREVIEW_MODE" });
  };

  const toggleAgentSelection = (agentId: string) => {
    dispatch({ type: "TOGGLE_AGENT_SELECTION", payload: agentId });
  };

  const setAgentMode = (mode: "auto" | "custom") => {
    dispatch({ type: "SET_AGENT_MODE", payload: mode });
  };

  const setSelectedAgents = (agents: string[]) => {
    dispatch({ type: "SET_SELECTED_AGENTS", payload: agents });
  };

  const startExtracting = async (
    rawInput: string,
    context?: string | null,
    agentMode?: "auto" | "custom",
    selectedAgents?: string[]
  ) => {
    dispatch({
      type: "START_EXTRACTING",
      payload: { rawInput, context, agentMode, selectedAgents },
    });

    try {
      const result = await createCase(rawInput, context, agentMode, selectedAgents);
      dispatch({ type: "EXTRACTING_SUCCESS", payload: result });
    } catch (err: unknown) {
      const errorObj = err as { stage?: string; message?: string };
      dispatch({
        type: "EXTRACTING_ERROR",
        payload: {
          stage: "extraction",
          message: errorObj?.message || "Failed to extract claims from backend.",
          details: err,
        },
      });
    }
  };

  const isConfirmingRef = useRef(false);

  const confirmAndRun = async () => {
    if (!state.currentCase) return;
    if (
      isConfirmingRef.current ||
      state.isConfirming ||
      state.isStreaming ||
      state.currentCase.status === "testing"
    ) {
      return;
    }

    isConfirmingRef.current = true;
    dispatch({ type: "START_CONFIRMING" });

    try {
      // Connect to SSE stream first by setting streaming mode to avoid race condition
      dispatch({ type: "CONFIRMING_SUCCESS" });
      // Allow the React commit phase to mount and open the EventSource stream connection first
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      await confirmCase(
        state.currentCase.id,
        state.currentCase.claims,
        state.currentCase.selected_agents
      );
    } catch (err: unknown) {
      const errorObj = err as { stage?: string; message?: string; status?: number };
      // If the case is already in 'testing' status on backend (e.g. race condition returned 400),
      // treat it as confirmed and keep runner UI active
      if (
        errorObj?.status === 400 &&
        (errorObj?.message?.includes("testing") || errorObj?.message?.includes("Cannot confirm"))
      ) {
        dispatch({ type: "CONFIRMING_SUCCESS" });
        return;
      }
      dispatch({
        type: "EXTRACTING_ERROR",
        payload: {
          stage: "confirm",
          message: errorObj?.message || "Failed to confirm case and launch tests.",
          details: err,
        },
      });
    } finally {
      isConfirmingRef.current = false;
    }
  };

  const refreshCurrentCase = useCallback(async () => {
    if (!state.currentCase?.id) return;
    try {
      const fullCase = await getCase(state.currentCase.id);
      dispatch({ type: "UPDATE_CASE", payload: fullCase });
    } catch (err) {
      console.warn("Failed to refresh case snapshot:", err);
    }
  }, [state.currentCase?.id]);

  const selectClaim = (claimId: string | null) => {
    dispatch({ type: "SELECT_CLAIM", payload: claimId });
  };

  const resetCase = () => {
    dispatch({ type: "RESET_CASE" });
  };

  const navigateScreen = (screen: AppState["activeScreen"]) => {
    dispatch({ type: "NAVIGATE_SCREEN", payload: screen });
  };

  const loadPromptIntoEntry = (improvedPrompt: string) => {
    dispatch({ type: "LOAD_PROMPT_INTO_ENTRY", payload: { rawInput: improvedPrompt } });
  };

  const loadPreset = (presetId: string) => {
    const preset = DECISION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    startExtracting(preset.rawInput, preset.contextHint);
  };

  const setActiveModal = (modal: AppState["activeModal"]) => {
    dispatch({ type: "SET_ACTIVE_MODAL", payload: modal });
  };

  const selectModel = (modelId: string) => {
    try {
      localStorage.setItem(STORAGE_KEY_MODEL, modelId);
    } catch {
      // ignore
    }
    dispatch({
      type: "SET_ENGINE_INFO",
      payload: {
        status: state.engineInfo?.status || "ok",
        provider: state.engineInfo?.provider || "openai_compat",
        model: modelId,
      },
    });
  };

  return (
    <CaseContext.Provider
      value={{
        state,
        dispatch,
        startExtracting,
        confirmAndRun,
        toggleAgentSelection,
        setAgentMode,
        setSelectedAgents,
        selectClaim,
        resetCase,
        loadPreset,
        navigateScreen,
        loadPromptIntoEntry,
        setActiveModal,
        refreshCurrentCase,
        selectModel,
        setDebugMode,
        enterPreview,
        setPreviewView,
        exitPreview,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
};

export function useCase() {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error("useCase must be used within a CaseProvider");
  }
  return context;
}

export function useOptionalCase() {
  return useContext(CaseContext);
}

