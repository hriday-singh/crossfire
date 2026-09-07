import { Case } from "@/types/crossfire";

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

  let md = `# EXECUTIVE DECISION MEMO\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Subject:** Stress-Test Analysis: "${currentCase.raw_input}"  \n`;
  if (currentCase.context) {
    md += `**Context:** ${currentCase.context}  \n`;
  }
  md += `\n---\n\n`;

  md += `## 1. Executive Summary & Verdict\n\n`;
  
  const verdict = currentCase.case_verdict;
  if (verdict) {
    const rawHeadline = verdict.headline || "";
    const headlineWords = rawHeadline ? rawHeadline.split(/\s+/).filter(Boolean) : [];
    const headline = (rawHeadline && headlineWords.length <= 9 ? rawHeadline : null) || VERDICT_HEADLINES[verdict.decision_state] || "Result";
    
    md += `> **${headline}**  \n`;

    let summaryText = verdict.summary || "";
    if (!summaryText) {
      const broken = currentCase.claims.filter((c) => c.status === "broken");
      const weakened = currentCase.claims.filter((c) => c.status === "weakened");
      const unproven = currentCase.claims.filter((c) => c.status === "unresolved");
      const survived = currentCase.claims.filter((c) => c.status === "survived");
      const keyFlaws: string[] = [];
      [...broken, ...weakened, ...unproven].forEach((c) => {
        if (c.fatal_flaw) keyFlaws.push(c.fatal_flaw);
        else {
          const topFinding = currentCase.findings.find((f) => f.claim_id === c.id && f.contradiction);
          if (topFinding?.contradiction) keyFlaws.push(topFinding.contradiction);
        }
      });
      const flawsStr = keyFlaws.length > 0 ? ` Key errors identified: ${keyFlaws.slice(0, 2).join("; ")}.` : "";
      if (survived.length === totalClaims && totalClaims > 0) {
        summaryText = `After evaluation, all ${totalClaims} core assumption${totalClaims > 1 ? "s" : ""} held up with verified outside evidence. No critical errors were identified.`;
      } else {
        summaryText = `After evaluation, we found that ${survived.length} assumption${survived.length !== 1 ? "s" : ""} held up, ${broken.length} refuted, and ${unproven.length} unproven.${flawsStr}`;
      }
    }
    md += `> ${summaryText}\n\n`;

    if (verdict.deciding_factor) {
      md += `### What decided it\n`;
      md += `- ${verdict.deciding_factor.the_fact}\n\n`;
    }

    if (verdict.next_actions && verdict.next_actions.length > 0) {
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
    // Fallback if no verdict object
    let strategicVerdict = "VALIDATED STRATEGY: FOUNDATIONAL ASSUMPTIONS HOLD";
    let executiveSummary = "All tested foundational assumptions survived adversarial stress-testing. Proceed with execution.";
    const loadBearingBroken = currentCase.claims.filter((c) => c.load_bearing && (c.status === "broken" || c.status === "weakened")).length;
    
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

    md += `### Claim ${idx + 1}. [${statusUpper}] ${claim.statement}\n`;
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

    // Steel Man Re-Architecture (Break to Rebuild)
    const fatalFlaw = claim.fatal_flaw || consequence?.fatal_flaw;
    const salvagedClaim = claim.salvaged_claim || consequence?.salvaged_claim;
    const tradeoff = claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged;

    if (fatalFlaw || salvagedClaim || tradeoff) {
      md += `\n**Steel Man Re-Architecture (Break to Rebuild):**  \n`;
      if (fatalFlaw) {
        md += `> **Fatal Flaw:** ${fatalFlaw}  \n`;
      }
      if (salvagedClaim) {
        md += `> **Salvaged Claim:** ${salvagedClaim}  \n`;
      }
      if (tradeoff) {
        md += `> **Trade-off Acknowledged:** ${tradeoff}  \n`;
      }
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
