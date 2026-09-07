import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCaseStream } from "@/hooks/useCaseStream";
import * as CaseContextModule from "@/context/CaseContext";
import { AppState, INITIAL_STATE } from "@/context/caseReducer";

describe("useCaseStream hook", () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockRefreshCurrentCase: ReturnType<typeof vi.fn>;
  let mockState: AppState;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockRefreshCurrentCase = vi.fn();
    mockState = {
      ...INITIAL_STATE,
      isStreaming: false,
      currentCase: null,
    };

    vi.spyOn(CaseContextModule, "useCase").mockImplementation(() => ({
      state: mockState,
      dispatch: mockDispatch,
      startExtracting: vi.fn(),
      confirmAndRun: vi.fn(),
      clarify: vi.fn(),
      acceptProvisionalClaim: vi.fn(),
      selectClaim: vi.fn(),
      resetCase: vi.fn(),
      loadPreset: vi.fn(),
      navigateScreen: vi.fn(),
      setActiveModal: vi.fn(),
      refreshCurrentCase: mockRefreshCurrentCase,
      setDebugMode: vi.fn(),
      enterPreview: vi.fn(),
      setPreviewView: vi.fn(),
      exitPreview: vi.fn(),
      toggleAgentSelection: vi.fn(),
      setAgentMode: vi.fn(),
      setSelectedAgents: vi.fn(),
      selectModel: vi.fn(),
      cancelExtraction: vi.fn(),
      loadPromptIntoEntry: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns streaming status and empty logs when not streaming", () => {
    const { result } = renderHook(() => useCaseStream());
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamLogs).toEqual([]);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("connects to EventSource and dispatches SSE events", () => {
    const listeners: Record<string, (e: any) => void> = {};
    const mockClose = vi.fn();

    class MockEventSource {
      url: string;
      readyState = 1;
      close = mockClose;
      addEventListener = vi.fn((event: string, cb: (e: any) => void) => {
        listeners[event] = cb;
      });
      onerror = null;

      constructor(url: string) {
        this.url = url;
      }
    }

    vi.stubGlobal("EventSource", MockEventSource);

    mockState = {
      ...mockState,
      isStreaming: true,
      currentCase: {
        id: "case-live-1",
        raw_input: "test",
        context: null,
        status: "testing",
        claims: [],
        test_plan: [],
        findings: [],
        consequences: [],
      },
    };

    const { unmount } = renderHook(() => useCaseStream());

    expect(listeners["run_complete"]).toBeDefined();
    expect(listeners["test_started"]).toBeDefined();
    // The verdict event has to be subscribed, otherwise the run's call never
    // reaches state before run_complete archives the case to history.
    expect(listeners["case_verdict"]).toBeDefined();

    // Trigger an incoming event
    act(() => {
      listeners["test_started"]({
        data: JSON.stringify({ test_id: "test-live-9" }),
      });
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SSE_EVENT",
      payload: {
        event: "test_started",
        data: { test_id: "test-live-9" },
      },
    });

    // Trigger run_complete event
    act(() => {
      listeners["run_complete"]({
        data: JSON.stringify({ summary: "done" }),
      });
    });
    
    // Now trigger the final 'done' event with [DONE]
    act(() => {
      listeners["done"]({
        data: "[DONE]",
      });
    });

    expect(mockClose).toHaveBeenCalled();
    expect(mockRefreshCurrentCase).toHaveBeenCalled();

    // Unmount closes connection
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });
});
