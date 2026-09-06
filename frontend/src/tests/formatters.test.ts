import { describe, it, expect } from "vitest";
import {
  formatConfidence,
  formatImpactLabel,
  formatTestName,
  getImpactScore,
  getVerdictConfig,
  truncateUrl,
} from "@/lib/formatters";

describe("formatters", () => {
  it("should mask internal backend evaluator names to CI test names (zero agent leakage)", () => {
    expect(formatTestName("evidence")).toBe("Evidence Test");
    expect(formatTestName("feasibility")).toBe("Feasibility Test");
    expect(formatTestName("constraint")).toBe("Feasibility Test");
    expect(formatTestName("edge-case")).toBe("Edge-Case Test");
    expect(formatTestName("assumption")).toBe("Assumption Test");
    expect(formatTestName("behavior")).toBe("Assumption Test");

    // Fallback should never expose raw strings
    expect(formatTestName("unknown_evaluator")).toBe("Assumption Test");
  });

  it("should format verdicts correctly and ensure unresolved is violet, not gray", () => {
    const survived = getVerdictConfig("survived");
    expect(survived.label).toBe("Survived");
    expect(survived.hex).toBe("#34d399");

    const weakened = getVerdictConfig("weakened");
    expect(weakened.label).toBe("Weakened");
    expect(weakened.hex).toBe("#fbbf24");

    const broken = getVerdictConfig("broken");
    expect(broken.label).toBe("Broken");
    expect(broken.hex).toBe("#f87171");

    const unresolved = getVerdictConfig("unresolved");
    expect(unresolved.label).toBe("Unresolved");
    // Mandatory Rule: Unresolved is indigo (#818cf8), NEVER gray
    expect(unresolved.hex).toBe("#818cf8");
    expect(unresolved.badgeText).toContain("indigo");
  });

  it("should map impact scores accurately", () => {
    expect(getImpactScore("high")).toBe(3);
    expect(getImpactScore("High Decision Impact")).toBe(3);
    expect(getImpactScore("medium")).toBe(2);
    expect(getImpactScore("moderate")).toBe(2);
    expect(getImpactScore("low")).toBe(1);
    expect(getImpactScore(undefined)).toBe(1);

    expect(formatImpactLabel(3)).toBe("High Impact");
    expect(formatImpactLabel(2)).toBe("Medium Impact");
    expect(formatImpactLabel(1)).toBe("Low Impact");
  });

  it("should format confidence numbers cleanly", () => {
    expect(formatConfidence(0.8123)).toBe("0.81");
    expect(formatConfidence(0)).toBe("0.00");
    expect(formatConfidence(null)).toBe("—");
    expect(formatConfidence(undefined)).toBe("—");
  });

  it("should truncate URLs cleanly without broken protocols", () => {
    expect(
      truncateUrl("https://techcrunch.com/2026/03/12/collegeai-raises-12m-automated-applications", 25)
    ).toBe("techcrunch.com/2026/03...");
  });
});
