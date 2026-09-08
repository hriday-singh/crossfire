import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { SideControlPanel } from "@/components/ui/SideControlPanel";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { INITIAL_STATE } from "@/context/caseReducer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { Case } from "@/types/crossfire";

const makeDoneCase = (overrides: Record<string, unknown> = {}): Case => ({
  id: "case-1",
  raw_input: "Should we launch the new feature?",
  context: null,
  status: "done",
  claims: [{ id: "c1", statement: "Claim one", load_bearing: false, status: "weakened" }],
  test_plan: [],
  findings: [
    {
      claim_id: "c1",
      test_id: "t1",
      evaluator: "researcher",
      result: "Looks good",
      confidence: 0.4,
      evidence: [],
      reasoning: "Reasoning",
      contradiction: null,
    },
  ],
  consequences: [],
  case_verdict: {
    decision_state: "survived",
    headline: "Proposal held up.",
    summary: "All claims reconciled.",
    survived: ["c1"],
    broken: [],
    unproven: [],
    next_actions: [],
  },
  activities: [],
  selected_agents: ["researcher"],
  ...overrides,
});

/** Load a case into context before rendering the component under test. */
const LoadCase: React.FC<{ caseData: ReturnType<typeof makeDoneCase> }> = ({
  caseData,
}) => {
  const { dispatch } = useCase();
  React.useEffect(() => {
    dispatch({ type: "LOAD_CASE", payload: caseData });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// ---------------------------------------------------------------------------
// DashboardScreen - Replay button visibility
// ---------------------------------------------------------------------------

describe("DashboardScreen - Replay button", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the Replay button when the case is done and has findings", async () => {
    const doneCase = makeDoneCase();

    const { findByTestId } = render(
      <CaseProvider>
        <LoadCase caseData={doneCase} />
        <DashboardScreen />
      </CaseProvider>,
    );

    const btn = await findByTestId("replay-in-bullpen-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/replay/i);
  });

  it("hides the Replay button when the case has no findings", async () => {
    const noFindingsCase = makeDoneCase({ findings: [] });

    const { queryByTestId } = render(
      <CaseProvider>
        <LoadCase caseData={noFindingsCase} />
        <DashboardScreen />
      </CaseProvider>,
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(queryByTestId("replay-in-bullpen-btn")).not.toBeInTheDocument();
  });

  it("hides the Replay button while the case is still streaming / testing", async () => {
    const testingCase = makeDoneCase({ status: "testing" as const });

    const { queryByTestId } = render(
      <CaseProvider>
        <LoadCase caseData={testingCase} />
        <DashboardScreen />
      </CaseProvider>,
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(queryByTestId("replay-in-bullpen-btn")).not.toBeInTheDocument();
  });

  it("clicking Replay calls navigateScreen with 'runner'", async () => {
    const navigateScreen = vi.fn();
    const useCaseSpy = vi.spyOn(
      await import("@/context/CaseContext"),
      "useCase",
    );
    const doneCase = makeDoneCase();

    useCaseSpy.mockReturnValue({
      state: {
        ...INITIAL_STATE,
        currentCase: doneCase,
        isStreaming: false,
        activities: [],
        activeTests: {},
        activeTestActivities: {},
        selectedClaimId: null,
      },
      dispatch: vi.fn(),
      selectClaim: vi.fn(),
      loadPromptIntoEntry: vi.fn(),
      navigateScreen,
      startExtracting: vi.fn(),
      cancelExtraction: vi.fn(),
      confirmAndRun: vi.fn(),
      clarify: vi.fn(),
      acceptProvisionalClaim: vi.fn(),
      toggleAgentSelection: vi.fn(),
      setAgentMode: vi.fn(),
      setSelectedAgents: vi.fn(),
      resetCase: vi.fn(),
      loadPreset: vi.fn(),
      setActiveModal: vi.fn(),
      refreshCurrentCase: vi.fn(),
      setDebugMode: vi.fn(),
      enterPreview: vi.fn(),
      setPreviewView: vi.fn(),
      exitPreview: vi.fn(),
      refreshEngineInfo: vi.fn(),
    } as unknown as ReturnType<typeof import("@/context/CaseContext").useCase>);

    render(<DashboardScreen />);

    const btn = await screen.findByTestId("replay-in-bullpen-btn");
    fireEvent.click(btn);
    expect(navigateScreen).toHaveBeenCalledWith("runner");
  });
});

// ---------------------------------------------------------------------------
// SideControlPanel - REPLAYING badge
// ---------------------------------------------------------------------------

describe("SideControlPanel - REPLAYING badge", () => {
  it("shows the REPLAYING badge when isReplaying=true", () => {
    render(
      <SideControlPanel eventHistory={[]} hoveredAgentId={null} isReplaying={true} />,
    );
    expect(screen.getByText(/replaying/i)).toBeInTheDocument();
  });

  it("hides the REPLAYING badge when isReplaying=false", () => {
    render(
      <SideControlPanel eventHistory={[]} hoveredAgentId={null} isReplaying={false} />,
    );
    expect(screen.queryByText(/replaying/i)).not.toBeInTheDocument();
  });

  it("hides the REPLAYING badge when isReplaying is not passed", () => {
    render(<SideControlPanel eventHistory={[]} hoveredAgentId={null} />);
    expect(screen.queryByText(/replaying/i)).not.toBeInTheDocument();
  });
});
