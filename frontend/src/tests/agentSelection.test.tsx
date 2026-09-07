import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentSelectorPanel } from "@/components/features/AgentSelectorPanel";
import {
  AssignedAgentsCard,
  formatConciseRationale,
} from "@/components/features/AssignedAgentsCard";
import * as CaseContextModule from "@/context/CaseContext";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { INITIAL_STATE } from "@/context/caseReducer";

describe("AgentSelectorPanel Component", () => {
  it("renders collapsed header showing auto mode", () => {
    render(
      <AgentSelectorPanel
        agentMode="auto"
        onAgentModeChange={vi.fn()}
        selectedAgents={["devils_advocate", "receipts", "builder", "operator"]}
        onToggleAgent={vi.fn()}
        isExpanded={false}
        onToggleExpand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("agent-selector-panel")).toBeInTheDocument();
    expect(screen.getByText(/Auto \(Recommended\)/i)).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    // In collapsed state, the expanded body is not shown
    expect(screen.queryByText(/Auto-Select Suite/i)).not.toBeInTheDocument();
  });

  it("calls onToggleExpand when header is clicked", () => {
    const handleExpand = vi.fn();
    render(
      <AgentSelectorPanel
        agentMode="auto"
        onAgentModeChange={vi.fn()}
        selectedAgents={["devils_advocate", "receipts", "builder", "operator"]}
        onToggleAgent={vi.fn()}
        isExpanded={false}
        onToggleExpand={handleExpand}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleExpand).toHaveBeenCalledTimes(1);
  });

  it("renders all four agents enabled by default in auto mode and jumps to custom on click", () => {
    const handleModeChange = vi.fn();
    const handleToggle = vi.fn();

    render(
      <AgentSelectorPanel
        agentMode="auto"
        onAgentModeChange={handleModeChange}
        selectedAgents={["devils_advocate", "receipts", "builder", "operator"]}
        onToggleAgent={handleToggle}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Auto \(Recommended\)$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Custom Selection$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crossfire analyzes your extracted assumption. Automatically select the most relevant test agents.",
      ),
    ).toBeInTheDocument();

    // Verify all 4 agents are rendered and checked by default
    expect(screen.getByText("Devil's Advocate")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Builder")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();

    const builderCheckbox = screen.getByRole("checkbox", { name: /Builder/i });
    expect(builderCheckbox).toBeChecked();

    // Clicking an agent in auto mode directly switches to custom selection and toggles it
    fireEvent.click(builderCheckbox);
    expect(handleModeChange).toHaveBeenCalledWith("custom");
    expect(handleToggle).toHaveBeenCalledWith("builder");
  });

  it("renders mode choices and interactive agent cards when expanded in custom mode", () => {
    const handleModeChange = vi.fn();
    const handleToggle = vi.fn();

    render(
      <AgentSelectorPanel
        agentMode="custom"
        onAgentModeChange={handleModeChange}
        selectedAgents={["devils_advocate", "receipts"]}
        onToggleAgent={handleToggle}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />,
    );

    expect(screen.getByText(/Custom Selection/i)).toBeInTheDocument();
    expect(screen.getByText("Collapse")).toBeInTheDocument();

    // Verify all 4 agent names are displayed as primary selectable items
    expect(screen.getByText("Devil's Advocate")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Builder")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();

    // Verify corresponding test names are explicitly shown
    expect(screen.getByText("Conducts: Assumption Test")).toBeInTheDocument();
    expect(screen.getByText("Conducts: Evidence Test")).toBeInTheDocument();
    expect(screen.getByText("Conducts: Feasibility Test")).toBeInTheDocument();
    expect(
      screen.getByText("Conducts: Operational Friction Test"),
    ).toBeInTheDocument();

    // Toggle agent by selecting the agent
    const builderCheckbox = screen.getByRole("checkbox", { name: /Builder/i });
    expect(builderCheckbox).not.toBeChecked();
    fireEvent.click(builderCheckbox);
    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(handleToggle).toHaveBeenCalledWith("builder");

    // Switch mode to auto
    const autoOption = screen.getByRole("button", {
      name: /Auto \(Recommended\)/i,
    });
    fireEvent.click(autoOption);
    expect(handleModeChange).toHaveBeenCalledWith("auto");
  });

  it("shows warning when custom mode has 0 agents selected", () => {
    render(
      <AgentSelectorPanel
        agentMode="custom"
        onAgentModeChange={vi.fn()}
        selectedAgents={[]}
        onToggleAgent={vi.fn()}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Please select at least 1 agent/i),
    ).toBeInTheDocument();
  });
});

describe("AssignedAgentsCard Component", () => {
  it("renders auto-selection callout with rationales when mode is auto", () => {
    const handleToggle = vi.fn();
    const rationales: Record<string, string> = {
      builder: "System architecture and technical complexity identified.",
      devils_advocate: "Core critical assumptions identified in market thesis.",
    };

    render(
      <AssignedAgentsCard
        agentMode="auto"
        selectedAgents={["builder", "devils_advocate"]}
        agentRationales={rationales}
        onToggleAgent={handleToggle}
      />,
    );

    expect(screen.getByTestId("assigned-agents-panel")).toBeInTheDocument();
    expect(screen.getByText(/2 of 4 agents armed/i)).toBeInTheDocument();

    // Verify corresponding test badges are shown for all agents
    expect(screen.getByText("Runs Feasibility Test")).toBeInTheDocument();
    expect(screen.getByText("Runs Assumption Test")).toBeInTheDocument();
    expect(screen.getByText("Runs Operational Friction Test")).toBeInTheDocument();
    expect(screen.getByText("Runs Evidence Test")).toBeInTheDocument();

    // Verify Active and Excluded badges
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getAllByText("Excluded")).toHaveLength(2);

    // Verify rationale text is displayed
    expect(
      screen.getByText(
        "System architecture and technical complexity identified.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Core critical assumptions identified in market thesis.",
      ),
    ).toBeInTheDocument();
  });

  it("formats rationale into one concise sentence, stripping extra sentences and redundant prefixes", () => {
    // Strips redundant prefix and limits to first sentence
    const verbose =
      "Why selected: Core critical assumptions identified in market thesis. Furthermore we need to stress test competitors.";
    expect(formatConciseRationale(verbose)).toBe(
      "Core critical assumptions identified in market thesis.",
    );

    // Handles single sentence without prefix
    expect(
      formatConciseRationale("External vendor pricing is publicly verifiable."),
    ).toBe("External vendor pricing is publicly verifiable.");

    // Handles empty input
    expect(formatConciseRationale("")).toBe("");
    expect(formatConciseRationale(undefined)).toBe("");
  });

  it("renders only the first concise sentence in AssignedAgentsCard when rationale is verbose", () => {
    const handleToggle = vi.fn();
    const verboseRationales: Record<string, string> = {
      builder:
        "Architecture requires substantial API integration work. There is also potential latency risks.",
    };

    render(
      <AssignedAgentsCard
        agentMode="auto"
        selectedAgents={["builder"]}
        agentRationales={verboseRationales}
        onToggleAgent={handleToggle}
      />,
    );

    expect(
      screen.getByText(
        "Architecture requires substantial API integration work.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/There is also potential latency risks/i),
    ).not.toBeInTheDocument();
  });

  it("allows selecting and deselecting agents", () => {
    const handleToggle = vi.fn();

    render(
      <AssignedAgentsCard
        agentMode="custom"
        selectedAgents={["builder"]}
        agentRationales={{}}
        onToggleAgent={handleToggle}
      />,
    );

    const card = screen.getByTestId("agent-card-devils_advocate");
    fireEvent.click(card);
    expect(handleToggle).toHaveBeenCalledWith("devils_advocate");
  });

  it("displays alert when 0 agents are selected in AssignedAgentsCard", () => {
    render(
      <AssignedAgentsCard
        agentMode="custom"
        selectedAgents={[]}
        agentRationales={{}}
        onToggleAgent={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/At least 1 test agent must be active/i),
    ).toBeInTheDocument();
  });
});

describe("ConfirmScreen Agent Integration", () => {
  it("disables 'Confirm & Run Tests' button when selected_agents is empty", () => {
    const mockConfirm = vi.fn();

    vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
      state: {
        ...INITIAL_STATE,
        activeScreen: "confirm",
        currentCase: {
          id: "case-empty-agents",
          raw_input: "Launch B2B invoice matching",
          context: "EU enterprise market",
          status: "awaiting_confirmation",
          agent_mode: "custom",
          selected_agents: [],
          claims: [
            {
              id: "c-1",
              statement: "Accountants will accept automated reconciliation",
              load_bearing: true,
              status: null,
            },
          ],
          test_plan: [],
          findings: [],
          consequences: [],
        },
      },
      dispatch: vi.fn(),
      confirmAndRun: mockConfirm,
      startExtracting: vi.fn(),
      selectClaim: vi.fn(),
      resetCase: vi.fn(),
      loadPreset: vi.fn(),
      navigateScreen: vi.fn(),
      setActiveModal: vi.fn(),
      refreshCurrentCase: vi.fn(),
      setDebugMode: vi.fn(),
      enterPreview: vi.fn(),
      setPreviewView: vi.fn(),
      exitPreview: vi.fn(),
      toggleAgentSelection: vi.fn(),
      setAgentMode: vi.fn(),
      setSelectedAgents: vi.fn(),
      selectModel: vi.fn(),
    });

    render(<ConfirmScreen />);

    const runBtn = screen.getByRole("button", { name: /Confirm & Run Tests/i });
    expect(runBtn).toBeDisabled();

    fireEvent.click(runBtn);
    expect(mockConfirm).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
