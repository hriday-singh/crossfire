import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { AGENT_CONFIGS, AGENT_MAP, JUDGE_CONFIG } from "../constants/agentConfigs";
import {
  ROOM_DIMENSIONS,
  JUDGE_TABLE_CONFIG,
  CUBICLE_LAYOUTS,
  WAYPOINTS,
} from "../constants/roomLayout";
import { MOCK_SCENARIOS } from "../hooks/useSocketSimulation";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { DialogueOverlay } from "../components/ui/DialogueOverlay";
import { SideControlPanel } from "../components/ui/SideControlPanel";

describe("2.5D Bullpen Cubicle Simulation Architecture", () => {
  beforeEach(() => {
    class MockSpeechSynthesisUtterance {
      text: string;
      pitch: number = 1;
      rate: number = 1;
      volume: number = 1;
      voice: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
      paused: false,
      pending: false,
      speaking: false,
      onvoiceschanged: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;
  });

  describe("Agent Configurations & Roles", () => {
    it("exports all 4 Crossfire evaluators with workstation metadata", () => {
      expect(AGENT_CONFIGS).toHaveLength(4);

      const devilsAdvocate = AGENT_MAP["devils_advocate"];
      const receipts = AGENT_MAP["receipts"];
      const builder = AGENT_MAP["builder"];
      const operator = AGENT_MAP["operator"];

      expect(devilsAdvocate).toBeDefined();
      expect(receipts).toBeDefined();
      expect(builder).toBeDefined();
      expect(operator).toBeDefined();

      expect(devilsAdvocate.cubicle).toBe("Cubicle 01 (NW)");
      expect(receipts.cubicle).toBe("Cubicle 02 (SW)");
      expect(builder.cubicle).toBe("Cubicle 03 (NE)");
      expect(operator.cubicle).toBe("Cubicle 04 (SE)");

      expect(devilsAdvocate.initialWaypoint).toBe("cubicle_1_desk");
      expect(receipts.initialWaypoint).toBe("cubicle_2_desk");
      expect(builder.initialWaypoint).toBe("cubicle_3_desk");
      expect(operator.initialWaypoint).toBe("cubicle_4_desk");

      expect(devilsAdvocate.color).toBe("#818cf8");
      expect(receipts.color).toBe("#34d399");
      expect(builder.color).toBe("#fbbf24");
      expect(operator.color).toBe("#60a5fa");
    });

    it("exports JUDGE_CONFIG for Crucible Arbiter presiding at central bench", () => {
      expect(JUDGE_CONFIG).toBeDefined();
      expect(JUDGE_CONFIG.id).toBe("judge");
      expect(JUDGE_CONFIG.name).toBe("Crucible Arbiter");
      expect(JUDGE_CONFIG.initialWaypoint).toBe("judge_chair");
      expect(JUDGE_CONFIG.color).toBe("#e4e1e6");
    });

    it("provides backward compatibility aliases in AGENT_MAP for legacy agent IDs", () => {
      expect(AGENT_MAP["agent_1"]).toBe(AGENT_MAP["devils_advocate"]);
      expect(AGENT_MAP["agent_2"]).toBe(AGENT_MAP["receipts"]);
      expect(AGENT_MAP["agent_3"]).toBe(AGENT_MAP["builder"]);
      expect(AGENT_MAP["agent_4"]).toBe(AGENT_MAP["operator"]);
      expect(AGENT_MAP["judge"]).toBe(JUDGE_CONFIG);
      expect(AGENT_MAP["arbiter"]).toBe(JUDGE_CONFIG);
    });
  });

  describe("Room Layout & Bullpen Geometry", () => {
    it("defines 1000x650 room dimensions", () => {
      expect(ROOM_DIMENSIONS.width).toBe(1000);
      expect(ROOM_DIMENSIONS.height).toBe(650);
    });

    it("places Judge Table in the upper-center position", () => {
      expect(JUDGE_TABLE_CONFIG).toBeDefined();
      expect(JUDGE_TABLE_CONFIG.x).toBe(500);
      expect(JUDGE_TABLE_CONFIG.y).toBe(330);
      expect(JUDGE_TABLE_CONFIG.width).toBe(220);
      expect(JUDGE_TABLE_CONFIG.height).toBe(90);
    });

    it("positions 2 cubicles on the left and 2 cubicles on the right of the judge table", () => {
      expect(CUBICLE_LAYOUTS).toHaveLength(4);

      const leftCubicles = CUBICLE_LAYOUTS.filter((c) => c.side === "left");
      const rightCubicles = CUBICLE_LAYOUTS.filter((c) => c.side === "right");

      expect(leftCubicles).toHaveLength(2);
      expect(rightCubicles).toHaveLength(2);

      // Left cubicles must have bounds.x to the left of the judge table (x < 500)
      leftCubicles.forEach((c) => {
        expect(c.bounds.x).toBeLessThan(JUDGE_TABLE_CONFIG.x);
      });

      // Right cubicles must have bounds.x to the right of the judge table (x > 500)
      rightCubicles.forEach((c) => {
        expect(c.bounds.x).toBeGreaterThan(JUDGE_TABLE_CONFIG.x);
      });
    });

    it("provides sit and stand waypoints for each cubicle and the judge bench", () => {
      expect(WAYPOINTS.judge_chair).toBeDefined();
      expect(WAYPOINTS.judge_desk).toBeDefined();

      expect(WAYPOINTS.cubicle_1_desk).toBeDefined();
      expect(WAYPOINTS.cubicle_1_stand).toBeDefined();
      expect(WAYPOINTS.cubicle_2_desk).toBeDefined();
      expect(WAYPOINTS.cubicle_2_stand).toBeDefined();
      expect(WAYPOINTS.cubicle_3_desk).toBeDefined();
      expect(WAYPOINTS.cubicle_3_stand).toBeDefined();
      expect(WAYPOINTS.cubicle_4_desk).toBeDefined();
      expect(WAYPOINTS.cubicle_4_stand).toBeDefined();

      // Verify stand waypoints exist near desks
      expect(WAYPOINTS.cubicle_1_stand.x).toBeGreaterThanOrEqual(WAYPOINTS.cubicle_1_desk.x);
      expect(WAYPOINTS.cubicle_3_stand.x).toBeLessThanOrEqual(WAYPOINTS.cubicle_3_desk.x);
    });
  });

  describe("Audio Playback & Exclusive Judge Voice TTS", () => {
    it("does NOT speak voice audio for AI evaluators", () => {
      const { result } = renderHook(() => useAudioPlayback());
      const onEndMock = vi.fn();

      act(() => {
        result.current.playSpeech({
          speakerId: "devils_advocate",
          dialogue: "Premise 1: Unstated assumption under test.",
          onEnd: onEndMock,
        });
      });

      // AI evaluators do NOT talk aloud - speech synthesis must NOT be called
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
      expect(onEndMock).toHaveBeenCalledTimes(1);
    });

    it("strictly speaks voice audio ONLY for the Judge (Crucible Arbiter)", () => {
      const { result } = renderHook(() => useAudioPlayback());
      const onEndMock = vi.fn();

      act(() => {
        result.current.playSpeech({
          speakerId: "judge",
          dialogue: "Crucible Magistrate Verdict: Decision is WEAKENED.",
          onEnd: onEndMock,
        });
      });

      // The Judge speaks with voice synthesis
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });
  });

  describe("DialogueOverlay & Hover-Only AI Bubble Enforcement", () => {
    it("does NOT render an AI evaluator bubble when not hovered", () => {
      render(
        <DialogueOverlay
          activeDialogue={{
            speaker_id: "devils_advocate",
            dialogue: "Premise 1: Decision memo assumes 100% human compliance without fallback safeguards.",
            action: "stand",
            stage: "Assumption Test",
            verdict: "broken",
          }}
          characterPositions={{
            devils_advocate: { x: 200, y: 235 },
          }}
          hoveredAgentId={null}
        />
      );

      // Evaluators do NOT talk to each other; unhovered bubbles must not appear
      expect(screen.queryByText("Devil's Advocate")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Premise 1: Decision memo assumes 100% human compliance without fallback safeguards.")
      ).not.toBeInTheDocument();
    });

    it("renders the AI evaluator bubble ONLY when the user hovers over that AI", () => {
      render(
        <DialogueOverlay
          activeDialogue={null}
          hoveredAgentId="devils_advocate"
          evaluatorFindings={{
            devils_advocate: {
              speaker_id: "devils_advocate",
              dialogue: "Auditing assumption matrix on pinboard: found unstated enterprise dependencies.",
              action: "stand",
              stage: "Assumption Test",
              verdict: "broken",
            },
          }}
          characterPositions={{
            devils_advocate: { x: 200, y: 235 },
          }}
        />
      );

      expect(screen.getByText("Devil's Advocate")).toBeInTheDocument();
      expect(screen.getByText("Assumption Test")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Auditing assumption matrix on pinboard: found unstated enterprise dependencies."
        )
      ).toBeInTheDocument();
      expect(screen.getByText("BROKEN")).toBeInTheDocument();
      expect(screen.getByText("STANDING")).toBeInTheDocument();
      expect(screen.getByText("HOVER")).toBeInTheDocument();
    });

    it("renders the Judge bubble when the Judge is delivering a ruling without requiring hover", () => {
      render(
        <DialogueOverlay
          activeDialogue={{
            speaker_id: "judge",
            dialogue: "Crucible Magistrate Verdict: Decision is WEAKENED.",
            action: "inspect",
            stage: "Crucible Synthesis",
            verdict: "weakened",
          }}
          characterPositions={{
            judge: { x: 500, y: 330 },
          }}
          hoveredAgentId={null}
        />
      );

      expect(screen.getByText("Crucible Arbiter")).toBeInTheDocument();
      expect(
        screen.getByText("Crucible Magistrate Verdict: Decision is WEAKENED.")
      ).toBeInTheDocument();
      expect(screen.getByText("WEAKENED")).toBeInTheDocument();
    });

    it("provides interactive cubicle hover zones that trigger onHoverAgent", () => {
      const mockOnHoverAgent = vi.fn();

      render(
        <DialogueOverlay
          activeDialogue={null}
          hoveredAgentId={null}
          onHoverAgent={mockOnHoverAgent}
        />
      );

      const devilsAdvocateZone = screen.getByTestId("hover-zone-devils_advocate");
      const receiptsZone = screen.getByTestId("hover-zone-receipts");
      const builderZone = screen.getByTestId("hover-zone-builder");
      const operatorZone = screen.getByTestId("hover-zone-operator");
      const judgeZone = screen.getByTestId("hover-zone-judge");

      expect(devilsAdvocateZone).toBeInTheDocument();
      expect(receiptsZone).toBeInTheDocument();
      expect(builderZone).toBeInTheDocument();
      expect(operatorZone).toBeInTheDocument();
      expect(judgeZone).toBeInTheDocument();

      fireEvent.mouseEnter(devilsAdvocateZone);
      expect(mockOnHoverAgent).toHaveBeenCalledWith("devils_advocate");

      fireEvent.mouseLeave(devilsAdvocateZone);
      expect(mockOnHoverAgent).toHaveBeenCalledWith(null);
    });
  });

  describe("SideControlPanel Controls & Audio Toggle", () => {
    it("renders Judge Voice Readout toggle button and responds to toggle", () => {
      const mockToggleAudio = vi.fn();
      const mockSetAutoPlaying = vi.fn();
      const mockSetSpeed = vi.fn();
      const mockSetMuted = vi.fn();
      const mockSetVolume = vi.fn();
      const mockSetScenario = vi.fn();
      const mockStepForward = vi.fn();
      const mockResetScenario = vi.fn();
      const mockTriggerManual = vi.fn();

      render(
        <SideControlPanel
          isAutoPlaying={false}
          setIsAutoPlaying={mockSetAutoPlaying}
          playbackSpeed={1}
          setPlaybackSpeed={mockSetSpeed}
          isMuted={false}
          setIsMuted={mockSetMuted}
          speechSynthesisEnabled={true}
          setSpeechSynthesisEnabled={mockToggleAudio}
          volume={0.8}
          setVolume={mockSetVolume}
          currentScenarioKey="b2b_copilot_stress_test"
          setCurrentScenarioKey={mockSetScenario}
          scenarios={MOCK_SCENARIOS}
          stepForward={mockStepForward}
          resetScenario={mockResetScenario}
          lastEvent={null}
          triggerManualEvent={mockTriggerManual}
          connectionStatus="mock_mode"
          socketUrl="http://localhost:4000"
        />
      );

      // Check Judge Voice label and toggle button
      expect(screen.getByText("Judge Voice (TTS)")).toBeInTheDocument();
      const voiceButton = screen.getByRole("button", {
        name: /Voice Readout: ENABLED/i,
      });
      expect(voiceButton).toBeInTheDocument();

      fireEvent.click(voiceButton);
      expect(mockToggleAudio).toHaveBeenCalledTimes(1);
    });

    it("displays MUTED state when voice readout is disabled", () => {
      render(
        <SideControlPanel
          isAutoPlaying={true}
          setIsAutoPlaying={vi.fn()}
          playbackSpeed={1}
          setPlaybackSpeed={vi.fn()}
          isMuted={false}
          setIsMuted={vi.fn()}
          speechSynthesisEnabled={false}
          setSpeechSynthesisEnabled={vi.fn()}
          volume={0.8}
          setVolume={vi.fn()}
          currentScenarioKey="b2b_copilot_stress_test"
          setCurrentScenarioKey={vi.fn()}
          scenarios={MOCK_SCENARIOS}
          stepForward={vi.fn()}
          resetScenario={vi.fn()}
          lastEvent={null}
          triggerManualEvent={vi.fn()}
          connectionStatus="mock_mode"
          socketUrl="http://localhost:4000"
        />
      );

      expect(
        screen.getByRole("button", { name: /Voice Readout: MUTED/i })
      ).toBeInTheDocument();
    });

    it("highlights hovered agent in active workstation feed", () => {
      render(
        <SideControlPanel
          isAutoPlaying={false}
          setIsAutoPlaying={vi.fn()}
          playbackSpeed={1}
          setPlaybackSpeed={vi.fn()}
          isMuted={false}
          setIsMuted={vi.fn()}
          speechSynthesisEnabled={true}
          setSpeechSynthesisEnabled={vi.fn()}
          volume={0.8}
          setVolume={vi.fn()}
          currentScenarioKey="b2b_copilot_stress_test"
          setCurrentScenarioKey={vi.fn()}
          scenarios={MOCK_SCENARIOS}
          stepForward={vi.fn()}
          resetScenario={vi.fn()}
          lastEvent={null}
          hoveredAgentId="devils_advocate"
          triggerManualEvent={vi.fn()}
          connectionStatus="mock_mode"
          socketUrl="http://localhost:4000"
        />
      );

      expect(screen.getByText(/\[HOVER\] Cubicle 01 \(NW\)/i)).toBeInTheDocument();
    });

    it("triggers quick standalone evaluator actions (e.g. Stand & Audit)", () => {
      const mockTriggerManual = vi.fn();
      render(
        <SideControlPanel
          isAutoPlaying={false}
          setIsAutoPlaying={vi.fn()}
          playbackSpeed={1}
          setPlaybackSpeed={vi.fn()}
          isMuted={false}
          setIsMuted={vi.fn()}
          speechSynthesisEnabled={true}
          setSpeechSynthesisEnabled={vi.fn()}
          volume={0.8}
          setVolume={vi.fn()}
          currentScenarioKey="b2b_copilot_stress_test"
          setCurrentScenarioKey={vi.fn()}
          scenarios={MOCK_SCENARIOS}
          stepForward={vi.fn()}
          resetScenario={vi.fn()}
          lastEvent={null}
          triggerManualEvent={mockTriggerManual}
          connectionStatus="mock_mode"
          socketUrl="http://localhost:4000"
        />
      );

      // Expand Quick Evaluator Actions accordion
      const accordionToggle = screen.getByRole("button", {
        name: /Quick Evaluator Actions/i,
      });
      fireEvent.click(accordionToggle);

      const standAuditBtn = screen.getByRole("button", {
        name: /Stand & Audit/i,
      });
      expect(standAuditBtn).toBeInTheDocument();

      fireEvent.click(standAuditBtn);
      expect(mockTriggerManual).toHaveBeenCalled();
      const dispatchedEvent = mockTriggerManual.mock.calls[0][0];
      expect(dispatchedEvent.speaker_id).toBe("devils_advocate");
      expect(dispatchedEvent.action).toBe("stand");
    });
  });
});
