import React, { createContext, useContext, useReducer, useEffect } from "react";
import { AppAction, AppState, INITIAL_STATE, caseReducer } from "./caseReducer";
import { DECISION_PRESETS, MOCK_COLLEGE_CASE } from "@/lib/mockData";
import { confirmCase, createCase } from "@/lib/api";
import { Case } from "@/types/crossfire";

interface CaseContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  startExtracting: (rawInput: string, context?: string | null) => Promise<void>;
  confirmAndRun: () => Promise<void>;
  selectClaim: (claimId: string | null) => void;
  resetCase: () => void;
  loadPreset: (presetId: string) => void;
  toggleMockMode: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setActiveModal: (modal: AppState["activeModal"]) => void;
}

const CaseContext = createContext<CaseContextValue | null>(null);

const STORAGE_KEY_HISTORY = "crossfire_case_history";
const STORAGE_KEY_MOCK = "crossfire_mock_mode";

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(caseReducer, INITIAL_STATE, (initial) => {
    try {
      const savedMock = localStorage.getItem(STORAGE_KEY_MOCK);
      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      const parsedHistory: Case[] = savedHistory ? JSON.parse(savedHistory) : [];
      return {
        ...initial,
        isMockMode: savedMock ? savedMock === "true" : true, // Default to true so user can test out of the box
        caseHistory: parsedHistory.length > 0 ? parsedHistory : [MOCK_COLLEGE_CASE],
      };
    } catch {
      return {
        ...initial,
        isMockMode: true,
        caseHistory: [MOCK_COLLEGE_CASE],
      };
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

  // Sync mock mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MOCK, String(state.isMockMode));
    } catch {
      // Ignore storage errors
    }
  }, [state.isMockMode]);

  const startExtracting = async (rawInput: string, context?: string | null) => {
    dispatch({ type: "START_EXTRACTING", payload: { rawInput, context } });

    if (state.isMockMode) {
      // Realistic simulation
      setTimeout(() => {
        const mockCase: Case = {
          id: `case-sim-${Date.now().toString(36)}`,
          raw_input: rawInput,
          context: context || null,
          status: "awaiting_confirmation",
          claims: [
            {
              id: "claim-1",
              statement: "Students will trust an AI to submit applications on their behalf.",
              load_bearing: null,
              status: null,
            },
            {
              id: "claim-2",
              statement: "There's no existing competitor already solving this well.",
              load_bearing: null,
              status: null,
            },
            {
              id: "claim-3",
              statement: "The AI can reliably parse arbitrary college application portal formats without per-school custom integration.",
              load_bearing: null,
              status: null,
            },
            {
              id: "claim-4",
              statement: "The onboarding screen should use a dark theme.",
              load_bearing: null,
              status: null,
            },
          ],
          test_plan: [],
          findings: [],
          consequences: [],
        };
        dispatch({ type: "EXTRACTING_SUCCESS", payload: mockCase });
      }, 1200);
      return;
    }

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

    if (state.isMockMode) {
      dispatch({ type: "CONFIRMING_SUCCESS" });
      return;
    }

    try {
      await confirmCase(state.currentCase.id, state.currentCase.claims);
      dispatch({ type: "CONFIRMING_SUCCESS" });
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

  const toggleMockMode = () => {
    dispatch({ type: "SET_MOCK_MODE", payload: !state.isMockMode });
  };

  const setPlaybackSpeed = (speed: number) => {
    dispatch({ type: "SET_PLAYBACK_SPEED", payload: speed });
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
        toggleMockMode,
        setPlaybackSpeed,
        setActiveModal,
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
