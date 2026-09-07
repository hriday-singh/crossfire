import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import * as api from "@/lib/api";
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
      evaluator: "receipts",
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

const mockCaseWithSalvaged: Case = {
  id: "case-retest-test",
  raw_input: "Launch legal bot",
  context: null,
  status: "done",
  claims: [
    {
      id: "claim-1",
      statement: "AI gives legal advice without lawyer",
      load_bearing: true,
      status: "broken",
      fatal_flaw: "Statutory bar on unauthorized law practice",
      salvaged_claim: "AI drafts memos for supervising attorneys",
      tradeoff_acknowledged: "Requires human review",
    },
  ],
  test_plan: [],
  findings: [],
  consequences: [
    {
      claim_id: "claim-1",
      impact: "high",
      recommended_change: "Adopt salvaged workflow",
      next_validation: null,
      verdict_reasoning: "Original premise violates rules.",
      salvaged_claim: "AI drafts memos for supervising attorneys",
      tradeoff_acknowledged: "Requires human review",
    },
  ],
  telemetry: {
    total_prompt_tokens: 1200,
    total_completion_tokens: 300,
    total_tokens: 1500,
    total_estimated_cost_usd: 0.00018,
    duration_ms: 1250,
    agent_breakdown: [
      {
        agent: "builder",
        prompt_tokens: 600,
        completion_tokens: 150,
        total_tokens: 750,
        estimated_cost_usd: 0.00009,
      },
      {
        agent: "devils_advocate",
        prompt_tokens: 600,
        completion_tokens: 150,
        total_tokens: 750,
        estimated_cost_usd: 0.00009,
      },
    ],
  },
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

  it("renders the judge's reasoning and test suite headers", () => {
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

  describe("Interactive Retest & Counter-Evidence", () => {
    it("renders Test Salvaged Claim button and counter-evidence toggle", async () => {
      const retestSpy = vi.spyOn(api, "retestClaim").mockResolvedValueOnce({
        ...mockCaseWithSalvaged,
        claims: [
          {
            ...mockCaseWithSalvaged.claims[0],
            statement: "AI drafts memos for supervising attorneys",
            status: "survived",
          },
        ],
      });

      render(
        <EvidenceDrawer
          claimId="claim-1"
          currentCase={mockCaseWithSalvaged}
          onClose={() => {}}
        />
      );

      const testSalvagedBtn = screen.getByRole("button", { name: /test salvaged claim/i });
      expect(testSalvagedBtn).toBeInTheDocument();

      const challengeBtn = screen.getByRole("button", { name: /challenge finding with counter-evidence/i });
      expect(challengeBtn).toBeInTheDocument();

      // Click challenge button to reveal counter-evidence input
      fireEvent.click(challengeBtn);
      expect(screen.getByPlaceholderText(/paste citation url, statute/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /submit counter-evidence/i })).toBeInTheDocument();

      // Click Test Salvaged Claim
      fireEvent.click(testSalvagedBtn);
      await waitFor(() => {
        expect(retestSpy).toHaveBeenCalledWith("case-retest-test", "claim-1", "test_salvaged");
      });
    });

    it("submits counter-evidence when user types proof and clicks Submit", async () => {
      const retestSpy = vi.spyOn(api, "retestClaim").mockResolvedValueOnce(mockCaseWithSalvaged);

      render(
        <EvidenceDrawer
          claimId="claim-1"
          currentCase={mockCaseWithSalvaged}
          onClose={() => {}}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /challenge finding with counter-evidence/i }));
      const textarea = screen.getByPlaceholderText(/paste citation url, statute/i);
      fireEvent.change(textarea, { target: { value: "State Bar Opinion 2026-A approves AI drafting" } });

      const submitBtn = screen.getByRole("button", { name: /submit counter-evidence/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(retestSpy).toHaveBeenCalledWith(
          "case-retest-test",
          "claim-1",
          "counter_evidence",
          "State Bar Opinion 2026-A approves AI drafting"
        );
      });
    });
  });
});


