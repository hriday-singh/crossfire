import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import { AppAction, AppState, INITIAL_STATE, caseReducer } from "./caseReducer";
import { DECISION_PRESETS } from "@/lib/presets";
import { confirmCase, createCase, getCase } from "@/lib/api";
import { Case } from "@/types/crossfire";

interface CaseContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  startExtracting: (rawInput: string, context?: string | null) => Promise<void>;
  confirmAndRun: () => Promise<void>;
  selectClaim: (claimId: string | null) => void;
  resetCase: () => void;
  loadPreset: (presetId: string) => void;
  setActiveModal: (modal: AppState["activeModal"]) => void;
  refreshCurrentCase: () => Promise<void>;
}

const CaseContext = createContext<CaseContextValue | null>(null);

const STORAGE_KEY_HISTORY = "crossfire_case_history";

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(caseReducer, INITIAL_STATE, (initial) => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      const parsedHistory: Case[] = savedHistory ? JSON.parse(savedHistory) : [];
      return {
        ...initial,
        caseHistory: parsedHistory,
      };
    } catch {
      return initial;
    }
  });

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.caseHistory));
    } catch {
      // Ignore storage errors
    }
  }, [state.caseHistory]);

  const startExtracting = async (rawInput: string, context?: string | null) => {
    dispatch({ type: "START_EXTRACTING", payload: { rawInput, context } });

    try {
      const result = await createCase(rawInput, context);
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

  const confirmAndRun = async () => {
    if (!state.currentCase) return;
    dispatch({ type: "START_CONFIRMING" });

    try {
      // Connect to SSE stream first by setting streaming mode to avoid race condition
      dispatch({ type: "CONFIRMING_SUCCESS" });
      // Allow the React commit phase to mount and open the EventSource stream connection first
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      await confirmCase(state.currentCase.id, state.currentCase.claims);
    } catch (err: unknown) {
      const errorObj = err as { stage?: string; message?: string };
      dispatch({
        type: "EXTRACTING_ERROR",
        payload: {
          stage: "confirm",
          message: errorObj?.message || "Failed to confirm case and launch tests.",
          details: err,
        },
      });
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

  const loadPreset = (presetId: string) => {
    const preset = DECISION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    startExtracting(preset.rawInput, preset.contextHint);
  };

  const setActiveModal = (modal: AppState["activeModal"]) => {
    dispatch({ type: "SET_ACTIVE_MODAL", payload: modal });
  };

  return (
    <CaseContext.Provider
      value={{
        state,
        dispatch,
        startExtracting,
        confirmAndRun,
        selectClaim,
        resetCase,
        loadPreset,
        setActiveModal,
        refreshCurrentCase,
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
