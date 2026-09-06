import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VerdictBlock } from "@/components/features/VerdictBlock";
import { Case, CaseVerdict } from "@/types/crossfire";

const baseCase = (verdict: CaseVerdict | null): Case => ({
  id: "case-1",
  raw_input: "Replace the support team with an autonomous agent",
  context: null,
  status: "done",
  claims: [
    {
      id: "c1",
      statement: "The agent handles 100% of tier-1 without escalation",
      load_bearing: true,
      status: "broken",
    },
    {
      id: "c2",
      statement: "Token cost beats support salaries",
      load_bearing: true,
      status: "unresolved",
    },
    {
      id: "c3",
      statement: "Ticket volume stays flat",
      load_bearing: false,
      status: "survived",
    },
  ],
  test_plan: [],
  findings: [
    {
      claim_id: "c1",
      test_id: "t1",
      evaluator: "receipts",
      result: "Containment tops out at 45-65%.",
      evidence: [
        {
          source_url: "https://example.com/cx-trends",
          title: "Zendesk CX Trends 2024",
          snippet: "Tier-1 containment sits at 45-65%.",
          retrieved_at: "2026-01-01",
        },
      ],
      reasoning: "Benchmark contradicts the claim.",
      confidence: 0.8,
      contradiction: null,
    },
  ],
  consequences: [
    {
      claim_id: "c1",
      impact: "high",
      recommended_change: "Keep humans on billing.",
      next_validation: "Run a 30-day shadow test.",
      verdict_reasoning: "Real tier-1 containment tops out at 45-65%, not 100%.",
    },
  ],
  case_verdict: verdict,
});

const verdict: CaseVerdict = {
  decision_state: "drop",
  summary: "Real tier-1 containment tops out at 45-65%, not the 100% the plan assumes.",
  survived: ["c3"],
  broken: ["c1"],
  unproven: ["c2"],
  next_actions: [
    { action: "Run a 30-day shadow test on tier-1 refunds.", claim_ids: ["c1", "c2"] },
    { action: "Price the fallback human rota before signing.", claim_ids: [] },
  ],
};

describe("VerdictBlock", () => {
  it.each([
    ["drop", "Don't proceed as written."],
    ["hold", "Not decidable yet."],
    ["proceed_with_changes", "Survives, but only with changes."],
    ["proceed", "Holds up."],
  ])("renders the headline for decision_state %s", (state, headline) => {
    render(
      <VerdictBlock
        currentCase={baseCase({ ...verdict, decision_state: state })}
        onSelectClaim={vi.fn()}
        isTesting={false}
      />
    );
    expect(screen.getByText(headline)).toBeInTheDocument();
  });

  it("renders the summary, counts, and the deciding sentence with its source", () => {
    render(
      <VerdictBlock currentCase={baseCase(verdict)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    expect(screen.getByText(verdict.summary)).toBeInTheDocument();
    expect(screen.getByText("1 refuted · 1 unproven · 1 held")).toBeInTheDocument();
    expect(
      screen.getByText("Real tier-1 containment tops out at 45-65%, not 100%.")
    ).toBeInTheDocument();
    expect(screen.getByText("Zendesk CX Trends 2024")).toBeInTheDocument();
    // Only the two claims that failed are listed.
    expect(screen.queryByText("Ticket volume stays flat")).not.toBeInTheDocument();
  });

  it("opens the drawer on the claim behind a broken row", () => {
    const onSelectClaim = vi.fn();
    render(
      <VerdictBlock
        currentCase={baseCase(verdict)}
        onSelectClaim={onSelectClaim}
        isTesting={false}
      />
    );

    fireEvent.click(screen.getByText("The agent handles 100% of tier-1 without escalation"));
    expect(onSelectClaim).toHaveBeenCalledWith("c1");
  });

  it("anchors an action to its first claim and leaves an unanchored one plain", () => {
    const onSelectClaim = vi.fn();
    render(
      <VerdictBlock
        currentCase={baseCase(verdict)}
        onSelectClaim={onSelectClaim}
        isTesting={false}
      />
    );

    expect(screen.getByText("Price the fallback human rota before signing.")).toBeInTheDocument();
    const anchor = screen.getByRole("button", { name: "2 claims →" });
    fireEvent.click(anchor);
    expect(onSelectClaim).toHaveBeenCalledWith("c1");
    // The unanchored action gets no link of its own.
    expect(screen.queryByRole("button", { name: /1 claim →/ })).not.toBeInTheDocument();
  });

  it("says the call is still coming while the run is live", () => {
    render(
      <VerdictBlock currentCase={baseCase(null)} onSelectClaim={vi.fn()} isTesting={true} />
    );
    expect(
      screen.getByText("The call lands here once every claim has been tested.")
    ).toBeInTheDocument();
  });

  it("says there is no verdict when a finished run has none", () => {
    render(
      <VerdictBlock currentCase={baseCase(null)} onSelectClaim={vi.fn()} isTesting={false} />
    );
    expect(screen.getByText("No verdict for this run.")).toBeInTheDocument();
  });
});
