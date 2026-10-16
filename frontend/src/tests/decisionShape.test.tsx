/**
 * Kill criteria, still-open/dissent, reversibility + deadline, and known limits
 * (docs/IMPROVEMENTS.md items 3, 4, 6, 8).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VerdictBlock } from "@/components/features/VerdictBlock";
import { ClaimCard } from "@/components/features/ClaimCard";
import { AssignedAgentsCard } from "@/components/features/AssignedAgentsCard";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import * as CaseContextModule from "@/context/CaseContext";
import { caseReducer, INITIAL_STATE } from "@/context/caseReducer";
import { ALL_AGENTS, DEFAULT_AGENT_IDS } from "@/lib/agents";
import { confirmCase } from "@/lib/api";
import { formatDecisionMemoMarkdown } from "@/lib/exportMemo";
import { Case, CaseVerdict } from "@/types/crossfire";

const verdict: CaseVerdict = {
  decision_state: "hold",
  headline: "Needs one answer first",
  summary: "After evaluation, one claim is still open.",
  survived: ["c2"],
  broken: [],
  unproven: ["c1"],
  next_actions: [],
  dissents: [
    {
      claim_id: "c2",
      evaluator: "researcher",
      the_fact: "The lease cap is 5% per year, not 10%.",
      objection: 0.82,
      source_url: "https://example.gov/rent",
      source_title: "Rent Board Rules",
    },
  ],
};

const makeCase = (overrides: Partial<Case> = {}): Case => ({
  id: "case-door",
  raw_input: "Sign a 2-year lease",
  context: null,
  status: "done",
  claims: [
    {
      id: "c1",
      statement: "Rent fits the budget",
      load_bearing: true,
      status: "unresolved",
      missing_input: "Final monthly rent quote",
    },
    { id: "c2", statement: "Landlord can raise rent 10%", load_bearing: true, status: "survived" },
    { id: "c3", statement: "Parking is free", load_bearing: false, status: "unresolved" },
  ],
  test_plan: [],
  findings: [],
  consequences: [
    {
      claim_id: "c1",
      impact: "high",
      recommended_change: "Get the quote in writing.",
      next_validation: "Ask the landlord for the final rent.",
      kill_criterion: "Stop if rent exceeds 35% of take-home pay.",
      verdict_reasoning: "Unresolved.",
    },
  ],
  case_verdict: verdict,
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe("VerdictBlock: still open and dissent", () => {
  it("leads with unresolved load-bearing claims only, with what they need", () => {
    const onSelect = vi.fn();
    render(<VerdictBlock currentCase={makeCase()} onSelectClaim={onSelect} isTesting={false} />);
    const block = screen.getByTestId("still-open");
    expect(block).toHaveTextContent("Rent fits the budget");
    expect(block).toHaveTextContent("Final monthly rent quote");
    expect(block).not.toHaveTextContent("Parking is free");
    expect(block).not.toHaveTextContent("one-way door");
    fireEvent.click(screen.getByRole("button", { name: /Rent fits the budget/ }));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("says a one-way door is why open claims block it", () => {
    render(
      <VerdictBlock currentCase={makeCase({ reversibility: "one_way" })} onSelectClaim={vi.fn()} isTesting={false} />
    );
    expect(screen.getByTestId("still-open")).toHaveTextContent("one-way door, so these block it");
  });

  it("omits the still-open block when nothing load-bearing is unresolved", () => {
    const c = makeCase();
    c.claims = c.claims.filter((cl) => cl.id !== "c1");
    render(<VerdictBlock currentCase={c} onSelectClaim={vi.fn()} isTesting={false} />);
    expect(screen.queryByTestId("still-open")).not.toBeInTheDocument();
  });

  it("shows overruled findings as dissent with evaluator, strength, and source", () => {
    const onSelect = vi.fn();
    render(<VerdictBlock currentCase={makeCase()} onSelectClaim={onSelect} isTesting={false} />);
    const block = screen.getByTestId("dissent");
    expect(block).toHaveTextContent("The lease cap is 5% per year, not 10%.");
    expect(block).toHaveTextContent("Researcher");
    expect(block).toHaveTextContent("objection 82%, overruled");
    expect(block).toHaveTextContent("Rent Board Rules");
    fireEvent.click(screen.getByRole("button", { name: /The lease cap is 5%/ }));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("renders no dissent block for older runs without the field", () => {
    const c = makeCase({ case_verdict: { ...verdict, dissents: undefined } });
    render(<VerdictBlock currentCase={c} onSelectClaim={vi.fn()} isTesting={false} />);
    expect(screen.queryByTestId("dissent")).not.toBeInTheDocument();
  });
});

describe("ClaimCard: kill criterion", () => {
  const claim = makeCase().claims[0];

  it("shows the stop condition next to the next validation", () => {
    render(<ClaimCard claim={claim} consequence={makeCase().consequences[0]} />);
    fireEvent.click(screen.getByRole("button", { name: /View Evidence & Sources/i }));
    expect(screen.getByText("Stop if")).toBeInTheDocument();
    expect(screen.getByText("Stop if rent exceeds 35% of take-home pay.")).toBeInTheDocument();
  });

  it("hides the stop condition when there is none", () => {
    render(<ClaimCard claim={claim} consequence={{ ...makeCase().consequences[0], kill_criterion: null }} />);
    fireEvent.click(screen.getByRole("button", { name: /View Evidence & Sources/i }));
    expect(screen.queryByText("Stop if")).not.toBeInTheDocument();
  });
});

describe("exportMemo: decision shape sections", () => {
  it("writes still open, dissent with source, and stop-if lines", () => {
    const md = formatDecisionMemoMarkdown(makeCase({ reversibility: "one_way" }));
    expect(md).toContain("### Still open (one-way door, so these block it)");
    expect(md).toContain("- Rent fits the budget _(needs: Final monthly rent quote)_");
    expect(md).not.toMatch(/Still open[^#]*Parking is free/);
    expect(md).toContain("### Dissent");
    expect(md).toContain(
      "- The lease cap is 5% per year, not 10%. _(Evidence Test, objection 82%, overruled)_ ([Rent Board Rules](https://example.gov/rent))"
    );
    expect(md).toContain("**Stop if:** Stop if rent exceeds 35% of take-home pay.");
  });

  it("omits the sections when there is nothing to report", () => {
    const c = makeCase({ case_verdict: { ...verdict, dissents: [] }, consequences: [] });
    c.claims = c.claims.filter((cl) => cl.id !== "c1");
    const md = formatDecisionMemoMarkdown(c);
    expect(md).not.toContain("### Still open");
    expect(md).not.toContain("### Dissent");
    expect(md).not.toContain("**Stop if:**");
  });
});

describe("reversibility and deadline plumbing", () => {
  it("SET_DECISION_SHAPE merges into the current case", () => {
    const state = { ...INITIAL_STATE, currentCase: makeCase({ reversibility: "two_way", deadline: "Friday" }) };
    const next = caseReducer(state, { type: "SET_DECISION_SHAPE", payload: { reversibility: null } });
    expect(next.currentCase?.reversibility).toBeNull();
    expect(next.currentCase?.deadline).toBe("Friday");
  });

  it("SET_DECISION_SHAPE is a no-op without a case", () => {
    expect(caseReducer(INITIAL_STATE, { type: "SET_DECISION_SHAPE", payload: { deadline: "x" } })).toBe(
      INITIAL_STATE
    );
  });

  it("confirmCase sends reversibility and deadline", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ case_id: "case-door", status: "testing", message: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await confirmCase("case-door", [], ["devils_advocate"], { reversibility: "one_way", deadline: "Friday" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ reversibility: "one_way", deadline: "Friday", selected_agents: ["devils_advocate"] });
    vi.unstubAllGlobals();
  });

  it("confirm screen lets the user correct the door and deadline", () => {
    const dispatch = vi.fn();
    vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
      state: { ...INITIAL_STATE, currentCase: makeCase({ status: "awaiting_confirmation", reversibility: "one_way" }) },
      dispatch,
      clarify: vi.fn(),
      confirmAndRun: vi.fn(),
      navigateScreen: vi.fn(),
      toggleAgentSelection: vi.fn(),
      acceptProvisionalClaim: vi.fn(),
    } as unknown as ReturnType<typeof CaseContextModule.useCase>);

    render(<ConfirmScreen />);
    expect(screen.getByRole("button", { name: "Hard to undo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Easy to undo" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Not sure" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "SET_DECISION_SHAPE", payload: { reversibility: null } });

    fireEvent.change(screen.getByPlaceholderText("None stated"), { target: { value: "End of month" } });
    expect(dispatch).toHaveBeenCalledWith({ type: "SET_DECISION_SHAPE", payload: { deadline: "End of month" } });
  });
});

describe("known limits", () => {
  it("every test documents what it misses", () => {
    for (const agent of ALL_AGENTS) expect(agent.knownLimit.trim().length).toBeGreaterThan(20);
  });

  it("the assigned-agents card shows each known limit", () => {
    render(
      <AssignedAgentsCard agentMode="custom" selectedAgents={[...DEFAULT_AGENT_IDS]} onToggleAgent={vi.fn()} />
    );
    for (const agent of ALL_AGENTS) expect(screen.getByText(agent.knownLimit)).toBeInTheDocument();
  });
});
