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
        badgeBg: "bg-emerald-950/40",
        badgeText: "text-emerald-400",
        badgeBorder: "border-emerald-500/30",
        dotColor: "bg-emerald-400",
        hex: "#34d399",
      };
    case "weakened":
      return {
        label: "Weakened",
        badgeBg: "bg-amber-950/40",
        badgeText: "text-amber-400",
        badgeBorder: "border-amber-500/30",
        dotColor: "bg-amber-400",
        hex: "#fbbf24",
      };
    case "broken":
      return {
        label: "Broken",
        badgeBg: "bg-rose-950/40",
        badgeText: "text-rose-400",
        badgeBorder: "border-rose-500/30",
        dotColor: "bg-rose-400",
        hex: "#f87171",
      };
    case "unresolved":
      return {
        label: "Unresolved",
        badgeBg: "bg-indigo-950/40",
        badgeText: "text-indigo-400",
        badgeBorder: "border-indigo-500/30",
        dotColor: "bg-indigo-400",
        hex: "#818cf8",
      };
    default:
      return {
        label: "Untested",
        badgeBg: "bg-zinc-800",
        badgeText: "text-zinc-400",
        badgeBorder: "border-zinc-700",
        dotColor: "bg-zinc-500",
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
    return "-";
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
