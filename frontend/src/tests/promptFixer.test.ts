import { describe, it, expect } from "vitest";
import { Case, Claim, Consequence } from "@/types/crossfire";
import {
  getSalvageableClaims,
  getClaimSalvagedText,
  generateImprovedPrompt,
  calculatePromptStats,
} from "@/lib/promptFixer";

describe("promptFixer utility", () => {
  const mockClaims: Claim[] = [
    {
      id: "c1",
      statement: "Users will pay $50/mo subscription fee without free trial",
      load_bearing: true,
      status: "broken",
      salvaged_claim: "Users will pay $29/mo with a 14-day reverse trial",
      fatal_flaw: "Zero conversion expected without demonstrating product value first",
      tradeoff_acknowledged: "Lower initial ARPU in exchange for 3x higher activation rate",
    },
    {
      id: "c2",
      statement: "We will build on Solana for sub-second finality",
      load_bearing: false,
      status: "weakened",
      weakened_kind: "qualified",
      // Salvage comes from consequence
    },
    {
      id: "c3",
      statement: "No marketing spend needed due to viral loops",
      load_bearing: true,
      status: "broken",
      // No salvage available
    },
    {
      id: "c4",
      statement: "PostgreSQL will scale cleanly to 10k writes/sec",
      load_bearing: false,
      status: "survived",
      salvaged_claim: "Should not be offered as salvage since survived",
    },
  ];

  const mockConsequences: Consequence[] = [
    {
      claim_id: "c2",
      impact: "high",
      recommended_change: "Adopt Base L2",
      next_validation: "Run benchmark",
      salvaged_claim: "Deploy on Base L2 to retain EVM tooling while achieving sub-cent fees",
    },
  ];

  const mockCase: Case = {
    id: "case-mock-1",
    raw_input:
      "We propose a new SaaS product. Users will pay $50/mo subscription fee without free trial. We will build on Solana for sub-second finality. Launch target is Q3.",
    context: null,
    status: "done",
    claims: mockClaims,
    test_plan: [],
    findings: [],
    consequences: mockConsequences,
  };

  describe("getSalvageableClaims", () => {
    it("returns only failed claims (broken, weakened, contested, unresolved) that have a salvage", () => {
      const salvageable = getSalvageableClaims(mockCase);
      const ids = salvageable.map((c) => c.id);

      expect(ids).toContain("c1");
      expect(ids).toContain("c2");
      expect(ids).not.toContain("c3"); // No salvage text
      expect(ids).not.toContain("c4"); // Status is survived
    });

    it("handles null or empty case gracefully", () => {
      expect(getSalvageableClaims(null)).toEqual([]);
      expect(getSalvageableClaims(undefined)).toEqual([]);
    });
  });

  describe("getClaimSalvagedText", () => {
    it("returns salvaged_claim from claim if available", () => {
      const text = getClaimSalvagedText(mockClaims[0], mockCase);
      expect(text).toBe("Users will pay $29/mo with a 14-day reverse trial");
    });

    it("falls back to consequence salvaged_claim if not on claim directly", () => {
      const text = getClaimSalvagedText(mockClaims[1], mockCase);
      expect(text).toBe(
        "Deploy on Base L2 to retain EVM tooling while achieving sub-cent fees"
      );
    });

    it("returns empty string if neither claim nor consequence has salvage", () => {
      const text = getClaimSalvagedText(mockClaims[2], mockCase);
      expect(text).toBe("");
    });
  });

  describe("generateImprovedPrompt", () => {
    const originalPrompt =
      "We propose a new SaaS product. Users will pay $50/mo subscription fee without free trial. We will build on Solana for sub-second finality. Launch target is Q3.";

    it("returns original prompt unchanged when selection is empty", () => {
      const res = generateImprovedPrompt(originalPrompt, mockClaims, new Set(), mockCase);
      expect(res).toBe(originalPrompt);
    });

    it("replaces exact match statement with salvaged claim", () => {
      const res = generateImprovedPrompt(
        originalPrompt,
        mockClaims,
        new Set(["c1"]),
        mockCase
      );
      expect(res).toContain("Users will pay $29/mo with a 14-day reverse trial");
      expect(res).not.toContain("Users will pay $50/mo subscription fee without free trial");
      expect(res).toContain("We will build on Solana for sub-second finality");
    });

    it("replaces multiple selected claims cleanly", () => {
      const res = generateImprovedPrompt(
        originalPrompt,
        mockClaims,
        new Set(["c1", "c2"]),
        mockCase
      );
      expect(res).toContain("Users will pay $29/mo with a 14-day reverse trial");
      expect(res).toContain(
        "Deploy on Base L2 to retain EVM tooling while achieving sub-cent fees"
      );
      expect(res).not.toContain("Users will pay $50/mo subscription fee without free trial");
      expect(res).not.toContain("We will build on Solana for sub-second finality");
      expect(res).toContain("Launch target is Q3.");
    });

    it("performs sentence-level token overlap replacement when exact statement is paraphrased", () => {
      const paraphrasedPrompt =
        "Our plan: Users will pay $50 monthly subscription fees without any free trial. All other parts remain.";
      const res = generateImprovedPrompt(
        paraphrasedPrompt,
        mockClaims,
        new Set(["c1"]),
        mockCase
      );
      expect(res).toContain("Users will pay $29/mo with a 14-day reverse trial");
      expect(res).toContain("All other parts remain.");
    });

    it("appends to prompt as revisions if claim text cannot be found in prompt", () => {
      const differentPrompt = "Completely unrelated prompt text here.";
      const res = generateImprovedPrompt(
        differentPrompt,
        mockClaims,
        new Set(["c1"]),
        mockCase
      );
      expect(res).toContain("Completely unrelated prompt text here.");
      expect(res).toContain("Users will pay $29/mo with a 14-day reverse trial");
    });
  });

  describe("calculatePromptStats", () => {
    it("calculates character delta correctly", () => {
      const original = "Short prompt";
      const improved = "Much longer improved prompt for testing";
      const stats = calculatePromptStats(original, improved);

      expect(stats.originalLen).toBe(original.length);
      expect(stats.improvedLen).toBe(improved.length);
      expect(stats.charDelta).toBe(improved.length - original.length);
      expect(stats.isModified).toBe(true);
    });

    it("handles identical prompts", () => {
      const original = "Same prompt";
      const stats = calculatePromptStats(original, original);

      expect(stats.charDelta).toBe(0);
      expect(stats.isModified).toBe(false);
    });
  });
});
