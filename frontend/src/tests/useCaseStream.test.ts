import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCaseStream } from "@/hooks/useCaseStream";
import * as CaseContextModule from "@/context/CaseContext";
import { AppState, INITIAL_STATE } from "@/context/caseReducer";

describe("useCaseStream hook", () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockState: AppState;

  beforeEach(() => {
    mockDispatch = vi.fn();
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
      selectClaim: vi.fn(),
      resetCase: vi.fn(),
      loadPreset: vi.fn(),
      toggleMockMode: vi.fn(),
      setPlaybackSpeed: vi.fn(),
      setActiveModal: vi.fn(),
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

  it("dispatches simulation events when isStreaming is true and isMockMode is true", () => {
    vi.useFakeTimers();
    mockState = {
      ...mockState,
      isStreaming: true,
      isMockMode: true,
      playbackSpeed: 10, // speed up mock execution
      currentCase: {
        id: "case-sim-1",
        raw_input: "test",
        context: null,
        status: "testing",
        claims: [],
        test_plan: [],
        findings: [],
        consequences: [],
      },
    };

    renderHook(() => useCaseStream());

    // Advance time to trigger simulation timeouts
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SSE_EVENT",
      })
    );

    vi.useRealTimers();
  });

  it("connects to EventSource when in live backend mode", () => {
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
      isMockMode: false,
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

    // Unmount closes connection
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });
});
