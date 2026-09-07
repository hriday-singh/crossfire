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
  headline: "Containment tops out at 65%, not 100%.",
  summary: "Real tier-1 containment tops out at 45-65%, not the 100% the plan assumes.",
  deciding_factor: {
    claim_id: "c1",
    evaluator: "receipts",
    the_fact: "Benchmarks put tier-1 containment at 45-65%, not 100%.",
    source_url: "https://example.com/cx-trends",
    source_title: "Zendesk CX Trends 2024",
    gate_fired: false,
  },
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
  ])("falls back to the static headline for decision_state %s", (state, headline) => {
    // headline: "" is what an older run, or a failed synthesis call, sends.
    render(
      <VerdictBlock
        currentCase={baseCase({ ...verdict, decision_state: state, headline: "" })}
        onSelectClaim={vi.fn()}
        isTesting={false}
      />
    );
    expect(screen.getByText(headline)).toBeInTheDocument();
  });

  it("prefers the generated headline over the static one", () => {
    render(
      <VerdictBlock currentCase={baseCase(verdict)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    expect(screen.getByText("Containment tops out at 65%, not 100%.")).toBeInTheDocument();
    expect(screen.queryByText("Don't proceed as written.")).not.toBeInTheDocument();
  });

  it("renders the summary, counts, and the deciding fact with its source", () => {
    render(
      <VerdictBlock currentCase={baseCase(verdict)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    expect(screen.getByText(verdict.summary)).toBeInTheDocument();
    expect(screen.getByText("1 refuted · 1 unproven · 1 held")).toBeInTheDocument();
    expect(
      screen.getByText("Benchmarks put tier-1 containment at 45-65%, not 100%.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Zendesk CX Trends 2024/)).toBeInTheDocument();
    expect(screen.queryByText("Ticket volume stays flat")).not.toBeInTheDocument();
  });

  it("keeps the deciding claim out of the collapsed list so it is not shown twice", () => {
    render(
      <VerdictBlock currentCase={baseCase(verdict)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    // c1 is the deciding claim and is already rendered above the disclosure.
    expect(screen.getByText("1 more claim didn't hold")).toBeInTheDocument();
    expect(
      screen.queryByText("The agent handles 100% of tier-1 without escalation")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Token cost beats support salaries")).toBeInTheDocument();
  });

  it("opens the drawer on the claim behind the deciding fact", () => {
    const onSelectClaim = vi.fn();
    render(
      <VerdictBlock
        currentCase={baseCase(verdict)}
        onSelectClaim={onSelectClaim}
        isTesting={false}
      />
    );

    fireEvent.click(screen.getByText("Benchmarks put tier-1 containment at 45-65%, not 100%."));
    expect(onSelectClaim).toHaveBeenCalledWith("c1");
  });

  it("opens the drawer on a claim inside the collapsed list", () => {
    const onSelectClaim = vi.fn();
    render(
      <VerdictBlock
        currentCase={baseCase(verdict)}
        onSelectClaim={onSelectClaim}
        isTesting={false}
      />
    );

    fireEvent.click(screen.getByText("Token cost beats support salaries"));
    expect(onSelectClaim).toHaveBeenCalledWith("c2");
  });

  it("says the panel could not cite it when the evidence gate fired", () => {
    const gated = {
      ...verdict,
      deciding_factor: { ...verdict.deciding_factor!, gate_fired: true },
    };
    render(
      <VerdictBlock currentCase={baseCase(gated)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    expect(
      screen.getByText("Not refuted — the panel attacked this but no source backed it.")
    ).toBeInTheDocument();
  });

  it("hides the gate note when the gate did not fire", () => {
    render(
      <VerdictBlock currentCase={baseCase(verdict)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    expect(screen.queryByText(/no source backed it/)).not.toBeInTheDocument();
  });

  it("lists every failed claim when the run carries no deciding factor", () => {
    // Older runs have no deciding_factor; nothing may be dropped from the page.
    const legacy = { ...verdict, deciding_factor: null };
    render(
      <VerdictBlock currentCase={baseCase(legacy)} onSelectClaim={vi.fn()} isTesting={false} />
    );

    expect(screen.getByText("2 more claims didn't hold")).toBeInTheDocument();
    expect(
      screen.getByText("The agent handles 100% of tier-1 without escalation")
    ).toBeInTheDocument();
    expect(screen.getByText("Token cost beats support salaries")).toBeInTheDocument();
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
    const anchor = screen.getByRole("button", { name: /2 claims/ });
    fireEvent.click(anchor);
    expect(onSelectClaim).toHaveBeenCalledWith("c1");
    // The unanchored action gets no link of its own.
    expect(screen.queryByRole("button", { name: /1 claim/ })).not.toBeInTheDocument();
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

  it("accurately reports weakened claims in counts and avoids mislabeling them as unproven", () => {
    const weakenedCase: Case = {
      ...baseCase({
        decision_state: "proceed_with_changes",
        summary: "Three claims showed adoption friction and moderate risk.",
        survived: [],
        broken: [],
        weakened: ["w1", "w2", "w3"],
        unproven: ["w1", "w2", "w3"],
        next_actions: [],
      }),
      claims: [
        { id: "w1", statement: "Claim 1", status: "weakened", load_bearing: true },
        { id: "w2", statement: "Claim 2", status: "weakened", load_bearing: true },
        { id: "w3", statement: "Claim 3", status: "weakened", load_bearing: false },
      ],
    };

    render(
      <VerdictBlock currentCase={weakenedCase} onSelectClaim={vi.fn()} isTesting={false} />
    );

    // Header count must accurately say "3 weakened", NOT "3 unproven"
    expect(screen.getByText("3 weakened")).toBeInTheDocument();
    expect(screen.queryByText(/unproven/i)).not.toBeInTheDocument();
  });
});

