import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PromptFixerWorkbench } from "@/components/features/PromptFixerWorkbench";
import { Case, Claim, DecisionConsequence } from "@/types/crossfire";

describe("PromptFixerWorkbench", () => {
  const originalPrompt = "We will launch without trial. Architecture uses Solana.";
  const mockClaims: Claim[] = [
    {
      id: "c1",
      statement: "We will launch without trial",
      load_bearing: true,
      status: "broken",
      salvaged_claim: "Offer 14-day reverse trial with onboarding concierge",
      fatal_flaw: "Users will churn before seeing value",
      tradeoff_acknowledged: "Delayed direct monetization",
    },
    {
      id: "c2",
      statement: "Architecture uses Solana",
      load_bearing: false,
      status: "weakened",
      salvaged_claim: "Deploy on Base L2 to retain EVM compatibility",
    },
    {
      id: "c3",
      statement: "Database will never get slow",
      load_bearing: false,
      status: "survived",
    },
  ];

  const mockConsequences: DecisionConsequence[] = [
    {
      claim_id: "c1",
      impact: "fatal",
      recommended_change: "Add trial",
      next_validation: "User tests",
      verdict_reasoning: "Test reasoning",
      salvaged_claim: "Offer 14-day reverse trial with onboarding concierge",
    },
  ];

  const mockCase: Case = {
    id: "case-workbench-test",
    raw_input: originalPrompt,
    context: null,
    status: "done",
    claims: mockClaims,
    test_plan: [],
    findings: [],
    consequences: mockConsequences,
  };

  it("renders the workbench with failed salvageable claims", () => {
    render(
      <PromptFixerWorkbench
        currentCase={mockCase}
        selectedClaimIds={new Set(["c1"])}
        onToggleClaim={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}

        improvedPrompt="We will launch with trial. Architecture uses Solana."
        onChangeImprovedPrompt={vi.fn()}
        onPutIntoStartingScreen={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Revise Proposal/i)
    ).toBeInTheDocument();
    expect(screen.getByText("We will launch without trial")).toBeInTheDocument();
    expect(
      screen.getByText(/Offer 14-day reverse trial with onboarding concierge/i)
    ).toBeInTheDocument();
  });

  it("handles toggling claim checkboxes", () => {
    const handleToggle = vi.fn();
    render(
      <PromptFixerWorkbench
        currentCase={mockCase}
        selectedClaimIds={new Set()}
        onToggleClaim={handleToggle}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}

        improvedPrompt={originalPrompt}
        onChangeImprovedPrompt={vi.fn()}
        onPutIntoStartingScreen={vi.fn()}
      />
    );

    const claimCard = screen.getByText("We will launch without trial").closest("div.border");
    if (claimCard) fireEvent.click(claimCard);
    expect(handleToggle).toHaveBeenCalledWith("c1");
  });

  it("handles batch select all and clear all buttons", () => {
    const handleSelectAll = vi.fn();
    const handleClearAll = vi.fn();

    const { rerender } = render(
      <PromptFixerWorkbench
        currentCase={mockCase}
        selectedClaimIds={new Set(["c1"])}
        onToggleClaim={vi.fn()}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}

        improvedPrompt={originalPrompt}
        onChangeImprovedPrompt={vi.fn()}
        onPutIntoStartingScreen={vi.fn()}
      />
    );

    const selectAllBtn = screen.getByRole("button", { name: /^Select All$/i });
    fireEvent.click(selectAllBtn);
    expect(handleSelectAll).toHaveBeenCalledTimes(1);

    // When all claims are selected, the button toggles to "Deselect All"
    rerender(
      <PromptFixerWorkbench
        currentCase={mockCase}
        selectedClaimIds={new Set(["c1", "c2"])}
        onToggleClaim={vi.fn()}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}

        improvedPrompt={originalPrompt}
        onChangeImprovedPrompt={vi.fn()}
        onPutIntoStartingScreen={vi.fn()}
      />
    );

    const clearAllBtn = screen.getByRole("button", { name: /Deselect All/i });
    fireEvent.click(clearAllBtn);
    expect(handleClearAll).toHaveBeenCalledTimes(1);
  });

  it("calls onPutIntoStartingScreen when primary button is clicked", () => {
    const handlePut = vi.fn();
    render(
      <PromptFixerWorkbench
        currentCase={mockCase}
        selectedClaimIds={new Set(["c1"])}
        onToggleClaim={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}

        improvedPrompt="Improved prompt content"
        onChangeImprovedPrompt={vi.fn()}
        onPutIntoStartingScreen={handlePut}
      />
    );

    const rerunBtn = screen.getByRole("button", {
      name: /Test Revised Proposal/i,
    });
    fireEvent.click(rerunBtn);
    expect(handlePut).toHaveBeenCalledTimes(1);
  });

  it("allows editing the improved prompt textarea", () => {
    const handleChange = vi.fn();
    render(
      <PromptFixerWorkbench
        currentCase={mockCase}
        selectedClaimIds={new Set(["c1"])}
        onToggleClaim={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}

        improvedPrompt="Draft text"
        onChangeImprovedPrompt={handleChange}
        onPutIntoStartingScreen={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Your revised decision proposal\.\.\./i);
    fireEvent.change(textarea, { target: { value: "Manually edited prompt" } });
    expect(handleChange).toHaveBeenCalledWith("Manually edited prompt");
  });
});
