import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import { AppAction, AppState, INITIAL_STATE, PreviewView, caseReducer } from "./caseReducer";
import { DECISION_PRESETS } from "@/lib/presets";
import { clarifyCase, confirmCase, createCase, getCase, getHealth } from "@/lib/api";
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
  cancelExtraction: () => void;
  confirmAndRun: () => Promise<void>;
  clarify: (answer: string) => Promise<void>;
  acceptProvisionalClaim: (claimId: string) => void;
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

  // Query backend engine health on mount and periodically so backend going live is detected automatically
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
    const interval = setInterval(checkHealth, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
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

  const abortControllerRef = useRef<AbortController | null>(null);

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

    abortControllerRef.current = new AbortController();

    try {
      const result = await createCase(
        rawInput,
        context,
        agentMode,
        selectedAgents,
        undefined,
        abortControllerRef.current.signal
      );
      dispatch({ type: "EXTRACTING_SUCCESS", payload: result });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // Ignored, we handle state reset in cancelExtraction
        return;
      }
      const errorObj = err as { stage?: string; message?: string; status?: number };
      
      let errorMessage = "Claim extraction failed.";
      const status = errorObj?.status;
      const originalMsg = errorObj?.message || "";
      if (status === 404 || status === 424 || originalMsg.toLowerCase().includes("failed dependency") || originalMsg.toLowerCase().includes("llm")) {
        errorMessage = "We got an error from the LLM. Check your LLM.";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded. Please try again.";
      }

      dispatch({
        type: "EXTRACTING_ERROR",
        payload: {
          stage: "extraction",
          message: errorMessage,
          details: err,
        },
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancelExtraction = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Set isExtracting to false while preserving currentCase so EntryScreen doesn't wipe input text
    dispatch({ type: "CANCEL_EXTRACTION" });
    dispatch({ type: "NAVIGATE_SCREEN", payload: "entry" });
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

      let errorMessage = "Failed to start tests.";
      const status = errorObj?.status;
      const originalMsg = errorObj?.message || "";
      if (status === 404 || status === 424 || originalMsg.toLowerCase().includes("failed dependency") || originalMsg.toLowerCase().includes("llm")) {
        errorMessage = "We got an error from the LLM. Check your LLM.";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded. Please try again.";
      }

      dispatch({
        type: "EXTRACTING_ERROR",
        payload: {
          stage: "confirm",
          message: errorMessage,
          details: err,
        },
      });
    } finally {
      isConfirmingRef.current = false;
    }
  };

  const isClarifyingRef = useRef(false);

  const clarify = async (answer: string) => {
    if (!state.currentCase || isClarifyingRef.current) return;
    
    isClarifyingRef.current = true;
    dispatch({ type: "START_CLARIFYING" });
    try {
      const result = await clarifyCase(state.currentCase.id, answer);
      
      if (result.case.claims && result.case.claims.length === 0) {
        dispatch({
          type: "CLARIFY_FAILED_THIN_IDEA",
          payload: { message: "Idea was too thin to find claims." }
        });
        return;
      }

      if (result.auto_started) {
        dispatch({
          type: "CLARIFY_SUCCESS",
          payload: { case: result.case, autoStarted: true }
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      } else {
        dispatch({
          type: "CLARIFY_SUCCESS",
          payload: { case: result.case, autoStarted: false }
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { stage?: string; message?: string; status?: number };
      
      let errorMessage = errorObj?.message || "Failed to submit.";
      const status = errorObj?.status;
      if (status === 404 || status === 424 || errorMessage.toLowerCase().includes("failed dependency") || errorMessage.toLowerCase().includes("llm")) {
        errorMessage = "We got an error from the LLM. Check your LLM.";
      }

      dispatch({
        type: "EXTRACTING_ERROR",
        payload: {
          stage: "clarify",
          message: errorMessage,
          details: err,
        },
      });
    } finally {
      isClarifyingRef.current = false;
    }
  };

  const acceptProvisionalClaim = (claimId: string) => {
    dispatch({ type: "ACCEPT_PROVISIONAL_CLAIM", payload: { claimId } });
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
        cancelExtraction,
        confirmAndRun,
        clarify,
        acceptProvisionalClaim,
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

