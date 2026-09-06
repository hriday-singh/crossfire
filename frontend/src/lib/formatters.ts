import { ClaimStatus, FailureMode } from "@/types/crossfire";

/**
 * Maps failure mode to user-facing CI Test name.
 * Mandatory Rule: Backend agent names (devils_advocate, receipts, builder, overthinker)
 * must NEVER appear anywhere in the UI.
 */
export function formatTestName(failureMode: FailureMode | string): string {
  const normalized = failureMode.toLowerCase().trim();
  switch (normalized) {
    case "evidence":
    case "receipts":
      return "Evidence Test";
    case "feasibility":
    case "constraint":
    case "behavior":
    case "builder":
      return "Feasibility Test";
    case "edge-case":
    case "edge_case":
    case "alternative":
    case "overthinker":
      return "Edge-Case Test";
    case "assumption":
    case "devils_advocate":
    default:
      return "Assumption Test";
  }
}

/**
 * Returns user-facing label and styling tokens for verdicts.
 * Mandatory Rule: unresolved is NEVER gray. It is styled in Violet (#a78bfa).
 */
export interface VerdictConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  hex: string;
}

export function getVerdictConfig(status: ClaimStatus | null | undefined): VerdictConfig {
  switch (status) {
    case "survived":
      return {
        label: "Survived",
        badgeBg: "bg-emerald-50",
        badgeText: "text-emerald-800",
        badgeBorder: "border-emerald-200/80",
        dotColor: "bg-emerald-600",
        hex: "#059669",
      };
    case "weakened":
      return {
        label: "Weakened",
        badgeBg: "bg-amber-50",
        badgeText: "text-amber-800",
        badgeBorder: "border-amber-200/80",
        dotColor: "bg-amber-600",
        hex: "#d97706",
      };
    case "broken":
      return {
        label: "Broken",
        badgeBg: "bg-rose-50",
        badgeText: "text-rose-800",
        badgeBorder: "border-rose-200/80",
        dotColor: "bg-rose-600",
        hex: "#e11d48",
      };
    case "unresolved":
      return {
        label: "Unresolved",
        badgeBg: "bg-indigo-50",
        badgeText: "text-indigo-800",
        badgeBorder: "border-indigo-200/80",
        dotColor: "bg-indigo-600",
        hex: "#4f46e5",
      };
    default:
      return {
        label: "Untested",
        badgeBg: "bg-zinc-100",
        badgeText: "text-zinc-600",
        badgeBorder: "border-zinc-200",
        dotColor: "bg-zinc-400",
        hex: "#71717a",
      };
  }
}

/**
 * Maps impact string or severity to numeric score (1 to 3).
 */
export function getImpactScore(impact: string | null | undefined): number {
  if (!impact) return 1;
  const lower = impact.toLowerCase();
  if (lower.includes("high") || lower.includes("critical") || lower.includes("severe")) {
    return 3;
  }
  if (lower.includes("medium") || lower.includes("moderate")) {
    return 2;
  }
  return 1;
}

/**
 * Maps numeric score (1 to 3) to executive impact label.
 */
export function formatImpactLabel(score: number): string {
  if (score >= 3) return "High Impact";
  if (score === 2) return "Medium Impact";
  return "Low Impact";
}

/**
 * Formats consequence impact into clean executive label.
 */
export function formatImpact(impact: string | null | undefined): string {
  if (!impact) return "";
  const lower = impact.toLowerCase();
  if (lower.includes("high") || lower.includes("critical") || lower.includes("severe")) {
    return "High Impact";
  }
  if (lower.includes("medium") || lower.includes("moderate")) {
    return "Medium Impact";
  }
  return "Low Impact";
}

export function formatConfidence(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined || isNaN(confidence)) {
    return "—";
  }
  return confidence.toFixed(2);
}

export function truncateUrl(url: string, maxLength: number = 40): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const combined = `${domain}${path}`;
    if (combined.length <= maxLength) return combined;
    return combined.slice(0, maxLength - 3) + "...";
  } catch {
    return url.length <= maxLength ? url : url.slice(0, maxLength - 3) + "...";
  }
}
