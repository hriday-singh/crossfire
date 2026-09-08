import { Case, Claim, EvidenceItem } from "@/types/crossfire";

/**
 * Generates an authoritative Markdown Decision Memorandum from a completed or in-progress Case.
 * Follows executive memo format (Stripe Press / Notion style).
 *
 * Section order is the specification, not a preference: the verdict and the part of
 * the idea that survived lead, the claims that did not move the verdict are rows in a
 * table rather than blocks of their own, and the memo ends on something buildable.
 * The markdown vocabulary is unchanged — same meta header, `##` sections separated by
 * `---`, `>` blockquotes, `_(claim 1, 3)_` anchors, generated-by footer.
 */
const VERDICT_HEADLINES: Record<string, string> = {
  drop: "Don't proceed as written.",
  hold: "Not decidable yet.",
  proceed_with_changes: "Survives, but only with changes.",
  proceed: "Holds up.",
};

const STATUS_LABEL: Record<string, string> = {
  survived: "SURVIVED",
  weakened: "WEAKENED",
  broken: "BROKEN",
  unresolved: "UNRESOLVED",
};

/** `unchecked` is the honest default for a case serialized before verification existed. */
function verificationLabel(ev: EvidenceItem): string {
  switch (ev.verification) {
    case "snippet_matched":
      return "verified";
    case "unreachable":
      return "unreachable";
    case "snippet_absent":
      return "snippet absent";
    default:
      return "unchecked";
  }
}

function statusLabel(claim: Claim): string {
  const base = STATUS_LABEL[claim.status || ""] || "UNTESTED";
  if (claim.status === "weakened" && claim.weakened_kind) {
    return `${base} (${claim.weakened_kind.toUpperCase()})`;
  }
  return base;
}

/** One line saying why the claim landed where it did, drawn from what was generated. */
function claimReason(currentCase: Case, claim: Claim): string {
  const consequence = currentCase.consequences.find((c) => c.claim_id === claim.id);
  const topFinding = currentCase.findings.find((f) => f.claim_id === claim.id && f.contradiction);
  const text =
    claim.fatal_flaw ||
    topFinding?.contradiction ||
    consequence?.verdict_reasoning ||
    (claim.status === "survived" ? "Withstood the panel." : "");
  return (text || "—").replace(/\s*\n+\s*/g, " ").replace(/\|/g, "\\|");
}

export function formatDecisionMemoMarkdown(currentCase: Case): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const claims = currentCase.claims;
  const totalClaims = claims.length;
  const survivedCount = claims.filter((c) => c.status === "survived").length;
  const weakenedCount = claims.filter((c) => c.status === "weakened").length;
  const brokenCount = claims.filter((c) => c.status === "broken").length;
  const unresolvedCount = claims.filter((c) => c.status === "unresolved").length;

  let sectionNum = 1;
  let md = `# EXECUTIVE DECISION MEMO\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Subject:** Stress-Test Analysis: "${currentCase.raw_input}"  \n`;
  if (currentCase.context) {
    md += `**Context:** ${currentCase.context}  \n`;
  }
  md += `\n---\n\n`;

  // --- 1. Verdict ---------------------------------------------------------
  md += `## ${sectionNum++}. Verdict\n\n`;

  const verdict = currentCase.case_verdict;
  if (verdict) {
    const rawHeadline = verdict.headline || "";
    const headlineWords = rawHeadline ? rawHeadline.split(/\s+/).filter(Boolean) : [];
    const headline =
      (rawHeadline && headlineWords.length <= 9 ? rawHeadline : null) ||
      VERDICT_HEADLINES[verdict.decision_state] ||
      "Result";

    md += `> **${headline}**  \n`;

    if (verdict.surviving_core) {
      md += `> ${verdict.surviving_core}\n>\n`;
    }

    let summaryText = verdict.summary || "";
    if (!summaryText) {
      const broken = claims.filter((c) => c.status === "broken");
      const unproven = claims.filter((c) => c.status === "unresolved");
      const survived = claims.filter((c) => c.status === "survived");
      const keyFlaws: string[] = [];
      claims
        .filter((c) => c.status && c.status !== "survived")
        .forEach((c) => {
          if (c.fatal_flaw) keyFlaws.push(c.fatal_flaw);
          else {
            const topFinding = currentCase.findings.find(
              (f) => f.claim_id === c.id && f.contradiction
            );
            if (topFinding?.contradiction) keyFlaws.push(topFinding.contradiction);
          }
        });
      const flawsStr =
        keyFlaws.length > 0 ? ` Key errors identified: ${keyFlaws.slice(0, 2).join("; ")}.` : "";
      if (survived.length === totalClaims && totalClaims > 0) {
        summaryText = `After evaluation, all ${totalClaims} core assumption${
          totalClaims > 1 ? "s" : ""
        } held up with verified outside evidence. No critical errors were identified.`;
      } else {
        summaryText = `After evaluation, we found that ${survived.length} assumption${
          survived.length !== 1 ? "s" : ""
        } held up, ${broken.length} refuted, and ${unproven.length} unproven.${flawsStr}`;
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
          .map((id) => claims.findIndex((c) => c.id === id) + 1)
          .filter((n) => n > 0);
        const suffix = anchors.length > 0 ? ` _(claim ${anchors.join(", ")})_` : "";
        md += `- ${next.action}${suffix}\n`;
      });
      md += `\n`;
    }
  } else {
    // Fallback if no verdict object
    let strategicVerdict = "VALIDATED STRATEGY: FOUNDATIONAL ASSUMPTIONS HOLD";
    let executiveSummary =
      "All tested foundational assumptions survived adversarial stress-testing. Proceed with execution.";
    const loadBearingBroken = claims.filter(
      (c) => c.load_bearing && (c.status === "broken" || c.status === "weakened")
    ).length;

    if (brokenCount > 0 && loadBearingBroken > 0) {
      strategicVerdict = "HIGH STRATEGIC RISK: CRITICAL ASSUMPTIONS BROKEN";
      executiveSummary = `${loadBearingBroken} core load-bearing assumption(s) failed adversarial verification. Fundamental plan revision required before committing resources.`;
    } else if (brokenCount > 0 || weakenedCount > 0) {
      strategicVerdict = "MODERATE STRATEGIC RISK: ASSUMPTIONS WEAKENED";
      executiveSummary = `${
        brokenCount + weakenedCount
      } assumption(s) challenged by empirical counterarguments. Targeted tactical adjustments advised.`;
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

  // --- 2. What the idea actually is --------------------------------------
  md += `---\n\n`;
  md += `## ${sectionNum++}. What the idea actually is\n\n`;

  const groups = new Map<string, Claim[]>();
  claims.forEach((claim) => {
    const key = claim.mechanism_of || "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(claim);
    else groups.set(key, [claim]);
  });

  groups.forEach((groupClaims, label) => {
    if (label) {
      md += `### ${label}\n`;
    }
    groupClaims.forEach((claim) => {
      const idx = claims.indexOf(claim) + 1;
      md += `- ${claim.statement} _(claim ${idx})_\n`;
    });
    md += `\n`;
  });

  const terms = claims.flatMap((c) => c.terms || []);
  const seenTerms = new Set<string>();
  const uniqueTerms = terms.filter((t) => {
    const key = t.term.toLowerCase();
    if (seenTerms.has(key)) return false;
    seenTerms.add(key);
    return true;
  });
  if (uniqueTerms.length > 0) {
    md += `**What the terms meant:**  \n`;
    uniqueTerms.forEach((t) => {
      md += `- **${t.term}** — ${t.resolved}\n`;
    });
    md += `\n`;
  }

  // --- 3. What survives, what dies ---------------------------------------
  md += `---\n\n`;
  md += `## ${sectionNum++}. What survives, what dies\n\n`;
  md += `| # | Claim | Status | Why |\n`;
  md += `| --- | --- | --- | --- |\n`;
  claims.forEach((claim, idx) => {
    const statement = claim.statement.replace(/\|/g, "\\|");
    md += `| ${idx + 1} | ${statement} | ${statusLabel(claim)} | ${claimReason(
      currentCase,
      claim
    )} |\n`;
  });
  md += `\n`;

  // --- 4. The load-bearing kills -----------------------------------------
  // Only the claims that moved the verdict get a block. Everything else is a row
  // above — that repetition is where the padding was.
  const kills = claims.filter((c) => c.load_bearing && c.status && c.status !== "survived");
  if (kills.length > 0) {
    md += `---\n\n`;
    md += `## ${sectionNum++}. The load-bearing kills\n\n`;

    kills.forEach((claim) => {
      const idx = claims.indexOf(claim) + 1;
      const findings = currentCase.findings.filter((f) => f.claim_id === claim.id);
      const consequence = currentCase.consequences.find((c) => c.claim_id === claim.id);

      md += `#### Claim ${idx}. [${statusLabel(claim)}] ${claim.statement}\n`;
      if (consequence?.impact) {
        md += `- **Impact Level:** ${consequence.impact.toUpperCase()}\n`;
      }

      // Generated per claim, so it says something different every time. The two
      // fixed strings this replaced read identically under every claim.
      if (claim.load_bearing_reason) {
        md += `\n**Strategic Importance:**  \n`;
        md += `${claim.load_bearing_reason}\n`;
      }

      const contradictions = Array.from(
        new Set(findings.map((f) => f.contradiction).filter((c): c is string => Boolean(c)))
      );
      if (contradictions.length > 0) {
        md += `\n**Contradictions & Counterarguments:**  \n`;
        contradictions.forEach((c) => {
          md += `> **Counter-evidence:** ${c}\n`;
        });
      }

      if (consequence?.recommended_change) {
        md += `\n**What to change:**  \n`;
        md += `> ${consequence.recommended_change}\n`;
      }

      if (consequence?.next_validation) {
        md += `\n**Next Validation Experiment (Smallest Real-World Test):**  \n`;
        md += `> **Next validation:** ${consequence.next_validation}\n`;
      }

      const fatalFlaw = claim.fatal_flaw || consequence?.fatal_flaw;
      const salvagedClaim = claim.salvaged_claim || consequence?.salvaged_claim;
      const tradeoff = claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged;

      if (fatalFlaw || salvagedClaim || tradeoff) {
        md += `\n**Steel Man Re-Architecture (Break to Rebuild):**  \n`;
        if (fatalFlaw) md += `> **Fatal Flaw:** ${fatalFlaw}  \n`;
        if (salvagedClaim) md += `> **Salvaged Claim:** ${salvagedClaim}  \n`;
        if (tradeoff) md += `> **Trade-off Acknowledged:** ${tradeoff}  \n`;
      }

      md += `\n`;
    });
  }

  // --- 5 & 6. The version I'd build, and the cheapest test ----------------
  const buildSpec = currentCase.case_verdict?.build_spec;
  if (buildSpec) {
    md += `---\n\n`;
    md += `## ${sectionNum++}. The version I'd build\n\n`;
    md += `> ${buildSpec.what_it_does}\n\n`;
    md += `- **What it omits:** ${buildSpec.what_it_omits}\n`;
    md += `- **Demo path:** ${buildSpec.demo_path}\n\n`;

    md += `---\n\n`;
    md += `## ${sectionNum++}. Cheapest next experiment\n\n`;
    md += `> ${buildSpec.cheapest_experiment}\n\n`;
  }

  // --- 7. Sources ---------------------------------------------------------
  const seenUrls = new Set<string>();
  const sources: EvidenceItem[] = [];
  currentCase.findings.forEach((f) => {
    (f.evidence || []).forEach((ev) => {
      if (seenUrls.has(ev.source_url)) return;
      seenUrls.add(ev.source_url);
      sources.push(ev);
    });
  });

  if (sources.length > 0) {
    md += `---\n\n`;
    md += `## ${sectionNum++}. Sources\n\n`;
    sources.forEach((ev) => {
      const title = ev.title ? `"${ev.title}"` : ev.source_url;
      md += `- [${title}](${ev.source_url}) _(${verificationLabel(ev)})_: "${ev.snippet}"\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
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
