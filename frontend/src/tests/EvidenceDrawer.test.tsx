import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("EvidenceDrawer", () => {
  it("renders null when claimId is null", () => {
    const { container } = render(
      <EvidenceDrawer claimId={null} currentCase={mockCase} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders claim details, audit trail, and findings when claim is selected", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );

    expect(screen.getByText("Audit Trail & Evidence")).toBeInTheDocument();
    expect(
      screen.getByText(/Law firms will pay \$500\/month for document summaries/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();
    expect(screen.getByText("Legal Tech Pricing Report 2026")).toBeInTheDocument();
    expect(
      screen.getByText(/Industry median pricing for AI summarizers sits at \$49\/mo/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Pivot to seat-based \$49 tier/i)).toBeInTheDocument();
  });

  it("renders load-bearing indicator for load bearing claims", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );
    expect(
      screen.getByText(/This assumption is load-bearing/i)
    ).toBeInTheDocument();
  });

  it("renders Judge Reconciled Verdict and evaluator badge", () => {
    render(
      <EvidenceDrawer claimId="claim-test-1" currentCase={mockCase} onClose={() => {}} />
    );
    expect(screen.getByText("Judge Reconciled Verdict")).toBeInTheDocument();
    expect(
      screen.getByText("Clear price resistance found in benchmark studies.")
    ).toBeInTheDocument();
    expect(screen.getByText(/\[receipts\]/i)).toBeInTheDocument();
  });
});
