import { Case } from "@/types/crossfire";
import { formatTestName } from "./formatters";

/**
 * Generates an authoritative Markdown Decision Memorandum from a completed or in-progress Case.
 * Follows executive memo format (Stripe Press / Notion style).
 */
const VERDICT_HEADLINES: Record<string, string> = {
  drop: "Don't proceed as written.",
  hold: "Not decidable yet.",
  proceed_with_changes: "Survives, but only with changes.",
  proceed: "Holds up.",
};

export function formatDecisionMemoMarkdown(currentCase: Case): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalClaims = currentCase.claims.length;
  const survivedCount = currentCase.claims.filter((c) => c.status === "survived").length;
  const weakenedCount = currentCase.claims.filter((c) => c.status === "weakened").length;
  const brokenCount = currentCase.claims.filter((c) => c.status === "broken").length;
  const unresolvedCount = currentCase.claims.filter((c) => c.status === "unresolved").length;
  const loadBearingBroken = currentCase.claims.filter(
    (c) => c.load_bearing && (c.status === "broken" || c.status === "weakened")
  ).length;

  // Strategic Executive Assessment
  let strategicVerdict = "VALIDATED STRATEGY: FOUNDATIONAL ASSUMPTIONS HOLD";
  let executiveSummary =
    "All tested foundational assumptions survived adversarial stress-testing. Proceed with execution.";
  if (brokenCount > 0 && loadBearingBroken > 0) {
    strategicVerdict = "HIGH STRATEGIC RISK: CRITICAL ASSUMPTIONS BROKEN";
    executiveSummary = `${loadBearingBroken} core load-bearing assumption(s) failed adversarial verification. Fundamental plan revision required before committing resources.`;
  } else if (brokenCount > 0 || weakenedCount > 0) {
    strategicVerdict = "MODERATE STRATEGIC RISK: ASSUMPTIONS WEAKENED";
    executiveSummary = `${brokenCount + weakenedCount} assumption(s) challenged by empirical counterarguments. Targeted tactical adjustments advised.`;
  } else if (unresolvedCount > 0) {
    strategicVerdict = "INCONCLUSIVE: EMPIRICAL EVIDENCE GAPS";
    executiveSummary = `${unresolvedCount} assumption(s) remain unresolved due to limited empirical data. Run targeted validation experiments.`;
  }

  let md = `# EXECUTIVE DECISION MEMO\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Subject:** Stress-Test Analysis: "${currentCase.raw_input}"  \n`;
  if (currentCase.context) {
    md += `**Context:** ${currentCase.context}  \n`;
  }
  md += `\n---\n\n`;

  md += `## 1. Executive Summary & Verdict\n\n`;
  // The backend's own adjudication when it exists; the count-derived text is only a fallback.
  const verdict = currentCase.case_verdict;
  if (verdict) {
    md += `> **${VERDICT_HEADLINES[verdict.decision_state] || "Result"}**  \n`;
    md += `> ${verdict.summary}\n\n`;
    if (verdict.next_actions.length > 0) {
      md += `### Before you commit\n`;
      verdict.next_actions.forEach((next) => {
        const anchors = next.claim_ids
          .map((id) => currentCase.claims.findIndex((c) => c.id === id) + 1)
          .filter((n) => n > 0);
        const suffix = anchors.length > 0 ? ` _(claim ${anchors.join(", ")})_` : "";
        md += `- ${next.action}${suffix}\n`;
      });
      md += `\n`;
    }
  } else {
    md += `> **Strategic Verdict:** \`${strategicVerdict}\`  \n`;
    md += `> ${executiveSummary}\n\n`;
  }

  md += `### Scoreboard\n`;
  md += `- **Total Assumptions Audited:** ${totalClaims}\n`;
  md += `- **Survived:** ${survivedCount}\n`;
  md += `- **Weakened:** ${weakenedCount}\n`;
  md += `- **Broken:** ${brokenCount}\n`;
  md += `- **Unresolved:** ${unresolvedCount}\n\n`;

  md += `---\n\n`;
  md += `## 2. Foundational Assumption Audit\n\n`;

  currentCase.claims.forEach((claim, idx) => {
    const statusUpper = (claim.status || "UNTESTED").toUpperCase();
    const tag = claim.load_bearing ? "CORE FOUNDATION" : "SUPPORTING ASSUMPTION";
    const findings = currentCase.findings.filter((f) => f.claim_id === claim.id);
    const consequence = currentCase.consequences.find((c) => c.claim_id === claim.id);
    const tests = currentCase.test_plan.filter((t) => t.target_claim === claim.id);

    md += `### ${idx + 1}. [${statusUpper}] ${claim.statement}\n`;
    md += `- **Type:** ${tag}\n`;
    if (consequence?.impact) {
      md += `- **Impact Level:** ${consequence.impact.toUpperCase()}\n`;
    }

    // Why it matters
    md += `\n**Strategic Importance:**  \n`;
    if (claim.load_bearing) {
      md += `This assumption is load-bearing. If invalidated, the core economic or distribution model of the proposal fails.\n`;
    } else {
      md += `Supporting assumption. If invalidated, friction increases but core model can adapt.\n`;
    }

    // Tests executed
    if (tests.length > 0) {
      md += `\n**Tests run:**  \n`;
      tests.forEach((t) => {
        md += `- \`[${formatTestName(t.failure_mode).toUpperCase()}]\` ${t.objective}\n`;
      });
    }

    // Evidence & Citations
    const evidenceList = findings.flatMap((f) => f.evidence || []);
    if (evidenceList.length > 0) {
      md += `\n**Sources:**  \n`;
      evidenceList.forEach((ev) => {
        const title = ev.title ? `"${ev.title}"` : ev.source_url;
        md += `- [${title}](${ev.source_url}): "${ev.snippet}"\n`;
      });
    }

    // Contradictions
    const contradictions = findings.map((f) => f.contradiction).filter(Boolean);
    if (contradictions.length > 0) {
      md += `\n**Contradictions & Counterarguments:**  \n`;
      contradictions.forEach((c) => {
        md += `> **Counter-evidence:** ${c}\n`;
      });
    }

    // Recommended plan adjustment
    if (consequence?.recommended_change) {
      md += `\n**What to change:**  \n`;
      md += `> ${consequence.recommended_change}\n`;
    }

    // Next validation experiment
    if (consequence?.next_validation) {
      md += `\n**Next Validation Experiment (Smallest Real-World Test):**  \n`;
      md += `> **Next validation:** ${consequence.next_validation}\n`;
    }

    md += `\n---\n\n`;
  });

  md += `*Generated via Crossfire Decision Testing Memo: Autonomous Adversarial Stress Testing*\n`;
  return md;
}

/**
 * Copies text to the clipboard with fallback for non-secure contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}
