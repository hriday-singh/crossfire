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
      screen.getByTitle("Load-bearing assumption — if false, the entire plan fails")
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
    expect(screen.getByText(/Budget cycles delayed onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/Introduce a 90-day paid pilot/i)).toBeInTheDocument();
    expect(screen.getByText(/Offer 3 design partners a 90-day pilot agreement/i)).toBeInTheDocument();

    // Toggle close
    const hideBtn = screen.getByRole("button", { name: /Hide Evidence & Sources/i });
    fireEvent.click(hideBtn);
    expect(screen.queryByText(/Procurement Delays in AI SaaS/i)).not.toBeInTheDocument();
  });
});
