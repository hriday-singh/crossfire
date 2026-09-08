import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import { Case } from "@/types/crossfire";

const mockCase: Case = {
  id: "case-audit-1",
  raw_input: "Launch AI legal summarizer",
  context: "High accuracy required",
  status: "done",
  claims: [
    {
      id: "claim-test-1",
      statement: "Law firms will pay $500/month for document summaries",
      load_bearing: true,
      status: "broken",
    },
    {
      id: "claim-test-2",
      statement: "API response latency is under 500ms",
      load_bearing: false,
      status: "survived",
    },
  ],
  test_plan: [
    {
      id: "test-1",
      target_claim: "claim-test-1",
      failure_mode: "evidence",
      objective: "Verify market willingness to pay",
    },
  ],
  findings: [
    {
      claim_id: "claim-test-1",
      test_id: "test-1",
      evaluator: "researcher",
      result: "competitor pricing is $50/month",
      evidence: [
        {
          source_url: "https://lawsheet.org/pricing",
          title: "Legal Tech Pricing Report 2026",
          snippet: "Industry median pricing for AI summarizers sits at $49/mo.",
          retrieved_at: "2026-03-01T10:05:00Z",
        },
      ],
      reasoning: "High price point meets strong competitor discounting.",
      confidence: 0.94,
      contradiction: "Direct pricing conflict with existing vendors.",
    },
  ],
  consequences: [
    {
      claim_id: "claim-test-1",
      impact: "high",
      recommended_change: "Pivot to seat-based $49 tier.",
      next_validation: "Survey 10 corporate attorneys.",
      verdict_reasoning: "Clear price resistance found in benchmark studies.",
    },
  ],
};



describe("EvidenceDrawer", () => {
  it("renders null when claimId is null", () => {
    const { container } = render(
      <EvidenceDrawer claimId={null} currentCase={mockCase} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders claim details, audit trail, and 4 collapsible test windows", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );

    expect(screen.getAllByText("Evidence").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Law firms will pay \$500\/month for document summaries/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();

    // Verify all 4 test windows are present
    expect(screen.getByRole("button", { name: /assumption test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /evidence test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /feasibility test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /operational friction test/i })).toBeInTheDocument();

    // Click Evidence Test to open it
    const evidenceBtn = screen.getByRole("button", { name: /evidence test/i });
    fireEvent.click(evidenceBtn);

    expect(screen.getByText("Legal Tech Pricing Report 2026")).toBeInTheDocument();
    expect(
      screen.getByText(/Industry median pricing for AI summarizers sits at \$49\/mo/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Pivot to seat-based \$49 tier/i)).toBeInTheDocument();

    // Click to collapse again
    fireEvent.click(evidenceBtn);
    expect(screen.queryByText("Legal Tech Pricing Report 2026")).not.toBeInTheDocument();
  });

  it("renders load-bearing indicator for load bearing claims", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );
    expect(
      screen.getByText(/This assumption is load-bearing/i)
    ).toBeInTheDocument();
  });

  it("renders the steelman's reasoning and test suite headers", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );
    expect(screen.getByText(/Why this call/i)).toBeInTheDocument();
    expect(
      screen.getByText("Clear price resistance found in benchmark studies.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /evidence test/i })).toBeInTheDocument();
  });

  it("renders SerpApi badge for evidence items when evidence window is opened", () => {
    const caseWithDdg: Case = {
      ...mockCase,
      findings: [
        {
          ...mockCase.findings[0],
          evidence: [
            {
              source_url: "https://lawsheet.org/pricing",
              title: "Legal Tech Pricing Report 2026",
              snippet: "Industry median pricing for AI summarizers sits at $49/mo.",
              retrieved_at: "2026-03-01T10:05:00Z",
              provider: "duckduckgo",
            },
          ],
        },
      ],
    };

    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={caseWithDdg} onClose={() => {}} />
    );

    // Open Evidence Test window
    const evidenceBtn = screen.getByRole("button", { name: /evidence test/i });
    fireEvent.click(evidenceBtn);

    expect(screen.getAllByTitle("Verified live web result via SerpApi").length).toBeGreaterThan(0);
    expect(screen.queryByText(/via DuckDuckGo Lite/i)).not.toBeInTheDocument();
  });

  it("renders summarized findings for each test window when opened", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );

    // Open Assumption Test
    const assumptionBtn = screen.getByRole("button", { name: /assumption test/i });
    fireEvent.click(assumptionBtn);
    expect(
      screen.getByText(/No contradictory premises or logical flaws found/i)
    ).toBeInTheDocument();

    // Open Feasibility Test
    const feasibilityBtn = screen.getByRole("button", { name: /feasibility test/i });
    fireEvent.click(feasibilityBtn);
    expect(
      screen.getByText(/No engineering bottlenecks, API limits/i)
    ).toBeInTheDocument();

    // Open Operational Friction Test
    const opFrictionBtn = screen.getByRole("button", { name: /operational friction test/i });
    fireEvent.click(opFrictionBtn);
    expect(
      screen.getByText(/No significant adoption inertia/i)
    ).toBeInTheDocument();
  });

  it("does not render 'How to check', 'Audit Ref', or export brief/JSON actions", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );

    expect(screen.queryByText(/How to check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark experiment as queued/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Audit Ref:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Export Brief/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^JSON$/i)).not.toBeInTheDocument();
  });
});


