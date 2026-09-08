import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { AGENT_CONFIGS, AGENT_MAP, STEELMAN_CONFIG } from "../constants/agentConfigs";
import {
  ROOM_DIMENSIONS,
  STEELMAN_TABLE_CONFIG,
  CUBICLE_LAYOUTS,
  WAYPOINTS,
} from "../constants/roomLayout";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { DialogueOverlay } from "../components/ui/DialogueOverlay";
import { SideControlPanel } from "../components/ui/SideControlPanel";
import { StageContainer } from "../components/canvas/StageContainer";

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
      const researcher = AGENT_MAP["researcher"];
      const builder = AGENT_MAP["builder"];
      const operator = AGENT_MAP["operator"];

      expect(devilsAdvocate).toBeDefined();
      expect(researcher).toBeDefined();
      expect(builder).toBeDefined();
      expect(operator).toBeDefined();

      expect(devilsAdvocate.cubicle).toBe("Cubicle 02 (SW)");
      expect(researcher.cubicle).toBe("Cubicle 03 (NE)");
      expect(builder.cubicle).toBe("Cubicle 01 (NW)");
      expect(operator.cubicle).toBe("Cubicle 04 (SE)");

      expect(devilsAdvocate.initialWaypoint).toBe("cubicle_2_desk");
      expect(researcher.initialWaypoint).toBe("cubicle_3_desk");
      expect(builder.initialWaypoint).toBe("cubicle_1_desk");
      expect(operator.initialWaypoint).toBe("cubicle_4_desk");

      expect(devilsAdvocate.color).toBe("#818cf8");
      expect(researcher.color).toBe("#34d399");
      expect(builder.color).toBe("#fbbf24");
      expect(operator.color).toBe("#60a5fa");
    });

    it("exports STEELMAN_CONFIG for Steelman presiding at central bench", () => {
      expect(STEELMAN_CONFIG).toBeDefined();
      expect(STEELMAN_CONFIG.id).toBe("steelman");
      expect(STEELMAN_CONFIG.name).toBe("Steelman");
      expect(STEELMAN_CONFIG.initialWaypoint).toBe("steelman_chair");
      expect(STEELMAN_CONFIG.color).toBe("#e4e1e6");
    });

    it("provides backward compatibility aliases in AGENT_MAP for legacy agent IDs", () => {
      expect(AGENT_MAP["agent_1"]).toBe(AGENT_MAP["builder"]);
      expect(AGENT_MAP["agent_2"]).toBe(AGENT_MAP["devils_advocate"]);
      expect(AGENT_MAP["agent_3"]).toBe(AGENT_MAP["researcher"]);
      expect(AGENT_MAP["agent_4"]).toBe(AGENT_MAP["operator"]);
      expect(AGENT_MAP["steelman"]).toBe(STEELMAN_CONFIG);
      expect(AGENT_MAP["arbiter"]).toBe(STEELMAN_CONFIG);
      expect(AGENT_MAP["steelman"]).toBe(STEELMAN_CONFIG);
    });
  });

  describe("Room Layout & Bullpen Geometry", () => {
    it("defines 1000x587 room dimensions", () => {
      expect(ROOM_DIMENSIONS.width).toBe(1000);
      expect(ROOM_DIMENSIONS.height).toBe(587);
    });

    it("places Steelman Table in the upper-center position", () => {
      expect(STEELMAN_TABLE_CONFIG).toBeDefined();
      expect(STEELMAN_TABLE_CONFIG.x).toBe(500);
      expect(STEELMAN_TABLE_CONFIG.y).toBe(281);
      expect(STEELMAN_TABLE_CONFIG.width).toBe(240);
      expect(STEELMAN_TABLE_CONFIG.height).toBe(120);
    });

    it("positions 2 cubicles on the left and 2 cubicles on the right of the steelman table", () => {
      expect(CUBICLE_LAYOUTS).toHaveLength(4);

      const leftCubicles = CUBICLE_LAYOUTS.filter((c) => c.side === "left");
      const rightCubicles = CUBICLE_LAYOUTS.filter((c) => c.side === "right");

      expect(leftCubicles).toHaveLength(2);
      expect(rightCubicles).toHaveLength(2);

      // Left cubicles must have bounds.x to the left of the steelman table (x < 500)
      leftCubicles.forEach((c) => {
        expect(c.bounds.x).toBeLessThan(STEELMAN_TABLE_CONFIG.x);
      });

      // Right cubicles must have bounds.x to the right of the steelman table (x > 500)
      rightCubicles.forEach((c) => {
        expect(c.bounds.x).toBeGreaterThan(STEELMAN_TABLE_CONFIG.x);
      });
    });

    it("provides sit and stand waypoints for each cubicle and the steelman bench", () => {
      expect(WAYPOINTS.steelman_chair).toBeDefined();
      expect(WAYPOINTS.steelman_desk).toBeDefined();

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

  describe("Audio Playback & Exclusive Steelman Voice TTS", () => {
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

    it("strictly speaks voice audio ONLY for the Steelman (Crucible Arbiter)", () => {
      const { result } = renderHook(() => useAudioPlayback());
      const onEndMock = vi.fn();

      act(() => {
        result.current.playSpeech({
          speakerId: "steelman",
          dialogue: "Crucible Magistrate Verdict: Decision is WEAKENED.",
          onEnd: onEndMock,
        });
      });

      // The Steelman speaks with voice synthesis
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });
  });

  describe("DialogueOverlay & Always-Visible AI Bubbles", () => {
    it("renders an AI evaluator bubble even when not hovered, with its detail card collapsed", () => {
      render(
        <DialogueOverlay
          activeDialogue={null}
          evaluatorFindings={{
            devils_advocate: {
              speaker_id: "devils_advocate",
              dialogue: "Premise 1: Decision memo assumes 100% human compliance without fallback safeguards.",
              action: "stand",
              stage: "Assumption Test",
              verdict: "broken",
              reasoning: "Full reasoning text only shown on hover.",
            },
          }}
          characterPositions={{
            devils_advocate: { x: 200, y: 235 },
          }}
          hoveredAgentId={null}
        />
      );

      // Bubble itself is always visible with a concise one-line status
      expect(screen.getByText("Devil's Advocate")).toBeInTheDocument();
      expect(screen.getByText("Assumption Test")).toBeInTheDocument();

      // Expanded detail card (full reasoning) only appears on hover
      expect(
        screen.queryByText("Full reasoning text only shown on hover.")
      ).not.toBeInTheDocument();
    });

    it("expands the detail card with reasoning ONLY when the user hovers over that AI", () => {
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
              reasoning: "Full reasoning text only shown on hover.",
            },
          }}
          characterPositions={{
            devils_advocate: { x: 200, y: 235 },
          }}
        />
      );

      expect(screen.getByText("Devil's Advocate")).toBeInTheDocument();
      expect(screen.getByText("Assumption Test")).toBeInTheDocument();
      expect(screen.getByText("BROKEN")).toBeInTheDocument();
      expect(screen.getByText("Full reasoning text only shown on hover.")).toBeInTheDocument();
    });

    it("renders the Steelman bubble when the user hovers over the Steelman", () => {
      render(
        <DialogueOverlay
          activeDialogue={{
            speaker_id: "steelman",
            dialogue: "Crucible Magistrate Verdict: Decision is WEAKENED.",
            action: "inspect",
            stage: "Crucible Synthesis",
            verdict: "weakened",
          }}
          characterPositions={{
            steelman: { x: 500, y: 330 },
          }}
          hoveredAgentId="steelman"
        />
      );

      expect(screen.getByText("Steelman")).toBeInTheDocument();
      expect(screen.getByText("WEAKENED")).toBeInTheDocument();
    });

    it("enforces a strict maximum width on agent status pills and provides title attribute for thoughts", () => {
      render(
        <DialogueOverlay
          activeDialogue={null}
          evaluatorFindings={{
            researcher: {
              speaker_id: "researcher",
              thought: 'Auditing: "Auto-generated blog content meets enterprise compliance standards with high accuracy and low cost"',
              action: "type",
              stage: "Citation Audit",
            },
          }}
          characterPositions={{
            researcher: { x: 670, y: 140 },
          }}
          hoveredAgentId={null}
        />
      );

      const pill = screen.getByTestId("bubble-researcher");
      expect(pill).toBeInTheDocument();
      // The pill container must enforce max-w-[280px]
      const innerPill = pill.querySelector(".max-w-\\[280px\\]");
      expect(innerPill).toBeInTheDocument();

      // The status text should have title attribute for tooltip reading
      const statusSpan = screen.getByTitle(/Auto-generated blog content/i);
      expect(statusSpan).toBeInTheDocument();
      expect(statusSpan).toHaveClass("truncate");
    });

    it("renders StageContainer with bullpen-stage background and calls onStageReady", () => {
      const onStageReadyMock = vi.fn();
      const { container } = render(
        <StageContainer onStageReady={onStageReadyMock}>
          <div data-testid="child-overlay">Overlay</div>
        </StageContainer>
      );

      // Verify the container has bg-bullpen-stage class
      const stageDiv = container.firstChild as HTMLElement;
      expect(stageDiv.className).toContain("bg-bullpen-stage");

      // In non-WebGL test environment, onStageReady fires immediately
      expect(onStageReadyMock).toHaveBeenCalled();
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
      const researcherZone = screen.getByTestId("hover-zone-researcher");
      const builderZone = screen.getByTestId("hover-zone-builder");
      const operatorZone = screen.getByTestId("hover-zone-operator");
      const steelmanZone = screen.getByTestId("hover-zone-steelman");

      expect(devilsAdvocateZone).toBeInTheDocument();
      expect(researcherZone).toBeInTheDocument();
      expect(builderZone).toBeInTheDocument();
      expect(operatorZone).toBeInTheDocument();
      expect(steelmanZone).toBeInTheDocument();

      fireEvent.mouseEnter(devilsAdvocateZone);
      expect(mockOnHoverAgent).toHaveBeenCalledWith("devils_advocate");

      fireEvent.mouseLeave(devilsAdvocateZone);
      expect(mockOnHoverAgent).toHaveBeenCalledWith(null);
    });
  });

  describe("SideControlPanel Active Workstation Feed", () => {
    it("renders Active Workstation Feed and displays active evaluator finding telemetry", () => {
      render(
        <SideControlPanel
          eventHistory={[{
            id: 'ev1',
            speaker_id: "builder",
            dialogue: "Benchmarking GPU latency: under 4ms verified.",
            verdict: "survived",
            cognitive_tag: "[Latency Benchmark]",
          }]}
          hoveredAgentId={null}
        />
      );

      expect(screen.getByText("Active Workstation Feed")).toBeInTheDocument();
      expect(screen.getByText("Builder")).toBeInTheDocument();
      expect(screen.getByText(/survived/i)).toBeInTheDocument();
      expect(screen.getByText("Benchmarking GPU latency: under 4ms verified.")).toBeInTheDocument();
    });

    it("displays standby message when no event has been received", () => {
      render(
        <SideControlPanel
          eventHistory={[]}
          hoveredAgentId={null}
        />
      );

      expect(screen.getByText("Active Workstation Feed")).toBeInTheDocument();
      expect(screen.getByText(/Awaiting evaluator telemetry/i)).toBeInTheDocument();
    });

    it("highlights hovered agent in active workstation feed", () => {
      render(
        <SideControlPanel
          eventHistory={[]}
          hoveredAgentId="devils_advocate"
        />
      );

      expect(screen.getByText(/\[HOVER\]\s*Devil's Advocate/i)).toBeInTheDocument();
    });
  });
});
