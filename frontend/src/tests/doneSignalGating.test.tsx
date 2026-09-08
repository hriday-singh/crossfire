import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { useCaseStream } from "@/hooks/useCaseStream";
import useSocketSimulation from "@/hooks/useSocketSimulation";
import { DiscussionApp } from "@/components/DiscussionApp";
import { CaseContext } from "@/context/CaseContext";
import * as CaseContextModule from "@/context/CaseContext";
import { AppState, INITIAL_STATE } from "@/context/caseReducer";

vi.mock("pixi.js", () => ({
  Assets: { load: vi.fn().mockResolvedValue({ source: { scaleMode: "" } }) },
  Texture: vi.fn().mockImplementation(() => ({})),
  Rectangle: vi.fn(),
  AnimatedSprite: class {},
  Container: class {},
  Graphics: class {},
  Sprite: class {},
  Text: class {},
}));

vi.mock("@/components/canvas/StageContainer", () => ({
  default: () => <div data-testid="mock-stage-container">Mock Stage</div>,
}));

vi.mock("@pixi/react", () => ({
  extend: vi.fn(),
  Application: ({ children }: any) => <div data-testid="pixi-app">{children}</div>,
}));

vi.mock("gsap", () => {
  const timelineMock = { to: vi.fn().mockReturnThis(), kill: vi.fn() };
  return {
    default: {
      to: vi.fn(() => ({ kill: vi.fn() })),
      timeline: vi.fn(() => timelineMock),
      globalTimeline: { timeScale: vi.fn(), pause: vi.fn(), resume: vi.fn() },
    },
  };
});

vi.mock("@/hooks/useAudioPlayback", () => ({
  default: () => ({
    isMuted: false,
    setIsMuted: vi.fn(),
    speechSynthesisEnabled: true,
    setSpeechSynthesisEnabled: vi.fn(),
    volume: 0.8,
    setVolume: vi.fn(),
    playSpeech: vi.fn(),
    stopSpeech: vi.fn(),
    playSfx: vi.fn(),
  }),
}));

/**
 * Guards the single rule that ended live runs early: only the backend's terminal
 * `run_complete`/`done` frame may finish a run. Neither a scripted mock packet nor
 * an EventSource transport blip is allowed to stand in for it.
 */
describe("done-signal gating", () => {
  describe("useSocketSimulation mockEnabled", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("dispatches no scripted packets while a real run drives the stage", () => {
      const onEventReceived = vi.fn();
      renderHook(() =>
        useSocketSimulation({ onEventReceived, mockEnabled: false } as any)
      );

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(onEventReceived).not.toHaveBeenCalled();
    });

    it("still auto-plays the scripted scenario when no real case is loaded", () => {
      const onEventReceived = vi.fn();
      renderHook(() => useSocketSimulation({ onEventReceived } as any));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onEventReceived).toHaveBeenCalled();
    });
  });

  describe("useCaseStream transport errors", () => {
    let mockDispatch: ReturnType<typeof vi.fn>;
    let listeners: Record<string, (e: any) => void>;
    let mockClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockDispatch = vi.fn();
      listeners = {};
      mockClose = vi.fn();

      class MockEventSource {
        static CLOSED = 2;
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

      const state: AppState = {
        ...INITIAL_STATE,
        isStreaming: true,
        currentCase: {
          id: "case-gating-1",
          raw_input: "test",
          context: null,
          status: "testing",
          claims: [],
          test_plan: [],
          findings: [],
          consequences: [],
        } as any,
      };

      vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
        state,
        dispatch: mockDispatch,
        refreshCurrentCase: vi.fn(),
      } as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("ignores EventSource's native error event mid-run", () => {
      renderHook(() => useCaseStream());

      act(() => {
        listeners["error"]({ type: "error" });
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it("still surfaces a real backend error frame", () => {
      renderHook(() => useCaseStream());

      act(() => {
        listeners["error"]({
          data: JSON.stringify({ stage: "run_pipeline", message: "boom" }),
        });
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SSE_EVENT",
        payload: {
          event: "error",
          data: { stage: "run_pipeline", message: "boom" },
        },
      });
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("DiscussionApp mid-run", () => {
    const liveCase: any = {
      id: "case_live_gate",
      raw_input: "Should we migrate to edge computing?",
      status: "testing",
      selected_agents: ["builder", "devils_advocate"],
      claims: [{ id: "c1", statement: "Latency under 4ms", status: null }],
      findings: [],
      consequences: [],
    };

    const wrapperFor = (currentCase: any, navigateScreen: any) => {
      const contextValue: any = {
        state: {
          currentCase,
          activeScreen: "runner",
          eventLog: [],
          previewView: null,
          history: [],
          debugViewsEnabled: false,
          error: null,
        },
        dispatch: vi.fn(),
        navigateScreen,
      };
      return ({ children }: { children: React.ReactNode }) => (
        <CaseContext.Provider value={contextValue}>{children}</CaseContext.Provider>
      );
    };

    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it("never reaches Evaluation Complete or navigates away before the done signal", () => {
      const navigateScreen = vi.fn();
      render(<DiscussionApp />, { wrapper: wrapperFor(liveCase, navigateScreen) });

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(screen.queryByText(/Evaluation Complete/i)).toBeNull();
      expect(screen.queryByText(/100%/)).toBeNull();
      expect(navigateScreen).not.toHaveBeenCalled();
    });
  });
});
