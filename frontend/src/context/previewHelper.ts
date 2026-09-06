import { AppState, PreviewView } from "./caseReducer";
import {
  MOCK_PREVIEW_CASE,
  MOCK_PREVIEW_HISTORY,
  MOCK_PREVIEW_LOGS,
  MOCK_PREVIEW_TESTS,
} from "@/lib/mockPreviewData";

export function applyPreviewViewToState(state: AppState, targetView: PreviewView): AppState {
  if (!targetView) return state;

  const base: AppState = {
    ...state,
    previewView: targetView,
  };

  switch (targetView) {
    case "entry":
      return {
        ...base,
        activeScreen: "entry",
        isExtracting: false,
        isConfirming: false,
        isStreaming: false,
        activeModal: "none",
        selectedClaimId: null,
      };
    case "extracting":
      return {
        ...base,
        activeScreen: "entry",
        isExtracting: true,
        isConfirming: false,
        isStreaming: false,
        activeModal: "none",
        selectedClaimId: null,
      };
    case "confirm":
      return {
        ...base,
        activeScreen: "confirm",
        isExtracting: false,
        isConfirming: false,
        isStreaming: false,
        activeModal: "none",
        selectedClaimId: null,
        currentCase: MOCK_PREVIEW_CASE,
      };
    case "runner":
      return {
        ...base,
        activeScreen: "runner",
        isExtracting: false,
        isConfirming: false,
        isStreaming: true,
        activeModal: "none",
        selectedClaimId: null,
        currentCase: { ...MOCK_PREVIEW_CASE, status: "testing" },
        activeTests: MOCK_PREVIEW_TESTS,
      };
    case "dashboard":
      return {
        ...base,
        activeScreen: "dashboard",
        isExtracting: false,
        isConfirming: false,
        isStreaming: false,
        activeModal: "none",
        selectedClaimId: null,
        currentCase: MOCK_PREVIEW_CASE,
      };
    case "evidence":
      return {
        ...base,
        activeScreen: "dashboard",
        isExtracting: false,
        isConfirming: false,
        isStreaming: false,
        activeModal: "none",
        selectedClaimId: "c-preview-1",
        currentCase: MOCK_PREVIEW_CASE,
      };
    case "logs":
      return {
        ...base,
        activeModal: "logs",
        selectedClaimId: null,
        eventLog: MOCK_PREVIEW_LOGS,
      };
    case "history":
      return {
        ...base,
        activeModal: "history",
        selectedClaimId: null,
        caseHistory: MOCK_PREVIEW_HISTORY,
      };
    case "faq":
      return {
        ...base,
        activeModal: "faq",
        selectedClaimId: null,
      };
    case "settings":
      return {
        ...base,
        activeModal: "settings",
        selectedClaimId: null,
      };
    default:
      return base;
  }
}
