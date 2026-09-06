import { describe, it, expect } from "vitest";
import { formatDecisionMemoMarkdown } from "@/lib/exportMemo";
import { Case } from "@/types/crossfire";

describe("exportMemo", () => {
  it("formats a complete decision memo in markdown", () => {
    const mockCase: Case = {
      id: "case-123",
      raw_input: "Shift to usage-based pricing",
      context: "Developer platform with 10k users",
      status: "done",
      claims: [
        {
          id: "claim-1",
          statement: "Developers prefer usage-based billing over seats",
          load_bearing: true,
          status: "broken",
        },
        {
          id: "claim-2",
          statement: "Revenue churn will remain under 2% monthly",
          load_bearing: false,
          status: "survived",
        },
      ],
      test_plan: [
        {
          id: "test-1",
          target_claim: "claim-1",
          failure_mode: "evidence",
          objective: "Check devtool pricing transition case studies",
        },
      ],
      findings: [
        {
          claim_id: "claim-1",
          test_id: "test-1",
          evaluator: "receipts",
          result: "fail",
          reasoning: "Contradicts past empirical cases",
          confidence: 0.9,
          contradiction: "Multiple SaaS companies saw 40% churn spike during surprise usage bills",
          evidence: [
            {
              source_url: "https://pricinginsights.com/usage-shift",
              title: "The Danger of Metered Pricing",
              snippet: "Customers felt billing anxiety without predictable seat caps.",
              retrieved_at: "2026-09-06T12:00:00Z",
            },
          ],
        },
      ],
      consequences: [
        {
          claim_id: "claim-1",
          impact: "high",
          recommended_change: "Offer a hybrid seat + usage model with strict budget alerts",
          next_validation: "Survey top 50 paying teams on billing preference",
          verdict_reasoning: "High risk due to documented churn",
        },
      ],
    };

    const memo = formatDecisionMemoMarkdown(mockCase);
    expect(memo).toContain("# EXECUTIVE DECISION MEMO");
    expect(memo).toContain('Stress-Test Analysis: "Shift to usage-based pricing"');
    expect(memo).toContain("Developer platform with 10k users");
    expect(memo).toContain("HIGH STRATEGIC RISK");
    expect(memo).toContain("Developers prefer usage-based billing over seats");
    expect(memo).toContain("CORE FOUNDATION");
    expect(memo).toContain("The Danger of Metered Pricing");
    expect(memo).toContain("Multiple SaaS companies saw 40% churn spike");
    expect(memo).toContain("Offer a hybrid seat + usage model with strict budget alerts");
    expect(memo).toContain("Survey top 50 paying teams on billing preference");
  });

  it("handles empty or sparse cases gracefully", () => {
    const sparseCase: Case = {
      id: "case-empty",
      raw_input: "Simple test case",
      context: null,
      status: "awaiting_confirmation",
      claims: [],
      test_plan: [],
      findings: [],
      consequences: [],
    };

    const memo = formatDecisionMemoMarkdown(sparseCase);
    expect(memo).toContain("# EXECUTIVE DECISION MEMO");
    expect(memo).toContain("**Total Assumptions Audited:** 0");
    expect(memo).toContain("VALIDATED STRATEGY");
  });
});
