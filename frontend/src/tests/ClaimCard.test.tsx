import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimCard } from "@/components/features/ClaimCard";

describe("ClaimCard", () => {
  it("renders claim statement and load-bearing flag", () => {
    render(
      <ClaimCard
        claim={{
          id: "claim-1",
          statement: "There is no existing competitor solving this well",
          load_bearing: true,
          status: "broken",
        }}
      />
    );

    expect(
      screen.getByText("There is no existing competitor solving this well")
    ).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();
    expect(
      screen.getByTitle("Load-bearing assumption: if false, the entire plan fails")
    ).toBeInTheDocument();
  });

  it("handles click to open drawer callback", () => {
    const handleClick = vi.fn();

    render(
      <ClaimCard
        claim={{
          id: "claim-2",
          statement: "Another test claim",
          load_bearing: false,
          status: "survived",
        }}
        onClick={handleClick}
      />
    );

    const card = screen.getByText("Another test claim").closest('div[role="button"]');
    expect(card).toBeInTheDocument();
    if (card) {
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });

  it("expands inline to show evidence, citations, and validation experiment", () => {
    render(
      <ClaimCard
        claim={{
          id: "claim-3",
          statement: "Enterprise customers will pay upfront annual contracts",
          load_bearing: true,
          status: "weakened",
        }}
        findings={[
          {
            claim_id: "claim-3",
            test_id: "test-3",
            evaluator: "receipts",
            result: "weakened",
            reasoning: "Budget cycles delayed onboarding by 6 months",
            confidence: 0.85,
            contradiction: "Budget cycles delayed onboarding by 6 months",
            evidence: [
              {
                source_url: "https://gartner.com/procurement-study",
                title: "Procurement Delays in AI SaaS",
                snippet: "Enterprises demand pilot periods before annual commitments.",
                retrieved_at: "2026-09-06T12:00:00Z",
              },
            ],
          },
        ]}
        consequence={{
          claim_id: "claim-3",
          impact: "high",
          recommended_change: "Introduce a 90-day paid pilot converting into annual billing.",
          next_validation: "Offer 3 design partners a 90-day pilot agreement.",
          verdict_reasoning: "Risk of delayed cashflow",
        }}
      />
    );

    // Initial state: details not visible
    expect(screen.queryByText(/Procurement Delays in AI SaaS/i)).not.toBeInTheDocument();

    // Click toggle
    const toggleBtn = screen.getByRole("button", { name: /View Evidence & Sources/i });
    fireEvent.click(toggleBtn);

    // Now evidence and citations are visible
    expect(screen.getByText("Procurement Delays in AI SaaS")).toBeInTheDocument();
    expect(screen.getByText(/Enterprises demand pilot periods/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Budget cycles delayed onboarding/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Introduce a 90-day paid pilot/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Offer 3 design partners a 90-day pilot agreement/i)).toBeInTheDocument();

    // Toggle close
    const hideBtn = screen.getByRole("button", { name: /Hide Evidence & Sources/i });
    fireEvent.click(hideBtn);
    expect(screen.queryByText(/Procurement Delays in AI SaaS/i)).not.toBeInTheDocument();
  });

  it("renders live running tests when isTestingMode is true without needing expand", () => {
    render(
      <ClaimCard
        claim={{
          id: "claim-stream-1",
          statement: "High conversion rate on landing page",
          load_bearing: true,
          status: null,
        }}
        isTestingMode={true}
        tests={[
          {
            test_id: "test-stream-1",
            target_claim: "claim-stream-1",
            failure_mode: "evidence",
            objective: "Verify funnel benchmarks",
            state: "running",
          },
          {
            test_id: "test-stream-2",
            target_claim: "claim-stream-1",
            failure_mode: "feasibility",
            objective: "Assess technical CAC limits",
            state: "queued",
          },
        ]}
      />
    );

    expect(
      screen.getByText(/Adversarial Testing in Progress/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/evidence test/i)).toBeInTheDocument();
    expect(screen.getByText("Running...")).toBeInTheDocument();
    expect(screen.getByText(/feasibility test/i)).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("renders Judge Reconciled Verdict when expanded", () => {
    render(
      <ClaimCard
        claim={{
          id: "claim-verdict-1",
          statement: "Customers will migrate instantly",
          load_bearing: true,
          status: "broken",
        }}
        consequence={{
          claim_id: "claim-verdict-1",
          impact: "critical",
          recommended_change: "Provide automated migration scripts.",
          next_validation: "Test script with 2 beta users.",
          verdict_reasoning: "High switching cost will prevent adoption.",
        }}
        isExpanded={true}
      />
    );

    expect(screen.getByText("Judge Reconciled Verdict")).toBeInTheDocument();
    expect(
      screen.getByText("High switching cost will prevent adoption.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Impact: critical/i)).toBeInTheDocument();
  });

  it("passes activeActivities to running test rows in testing mode", () => {
    render(
      <ClaimCard
        claim={{
          id: "claim-active-1",
          statement: "AI automated filings are accepted by agencies",
          load_bearing: true,
          status: null,
        }}
        isTestingMode={true}
        tests={[
          {
            test_id: "t-act-1",
            target_claim: "claim-active-1",
            failure_mode: "evidence",
            objective: "Verify agency policies",
            state: "running",
          },
        ]}
        activeActivities={{
          evidence: 'Querying DuckDuckGo: "agency automated filing policies"',
        }}
      />
    );

    expect(screen.getByText(/evidence test/i)).toBeInTheDocument();
    expect(
      screen.getByText('Querying DuckDuckGo: "agency automated filing policies"')
    ).toBeInTheDocument();
  });
});
