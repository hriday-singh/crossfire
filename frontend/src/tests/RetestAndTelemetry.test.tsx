import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import * as api from "@/lib/api";
import { Case } from "@/types/crossfire";

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

describe("Interactive Retest & Telemetry", () => {
  it("renders Test Salvaged Claim button and counter-evidence toggle in EvidenceDrawer", async () => {
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
