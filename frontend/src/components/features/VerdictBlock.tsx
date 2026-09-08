import React from "react";
import { Case, Claim } from "@/types/crossfire";
import { cleanUiText, clampSentences } from "@/lib/formatters";
import { SerpApiText } from "@/components/ui/serpapi";
import { getAgentById } from "@/lib/agents";

/**
 * The call, the one fact that forced it, and what to do before committing.
 *
 * Everything on this page is anchored - every row clicks through to the claim
 * whose test produced it. Only three things sit above the fold; the remaining
 * failed claims are one disclosure down, because a flat list of every failure
 * gives the reader no way to tell which one actually decided the case.
 */

interface VerdictBlockProps {
  currentCase: Case;
  onSelectClaim: (claimId: string) => void;
  isTesting: boolean;
  onStatusClick?: (status: "needs_attention" | "passed" | "all") => void;
}

// The floor when the backend could not generate a headline for this case.
// Kept in sync with synthesis.FALLBACK_HEADLINES.
const HEADLINES: Record<string, string> = {
  drop: "Don't proceed as written.",
  hold: "Not decidable yet.",
  proceed_with_changes: "Survives, but only with changes.",
  proceed: "Holds up.",
};

const HEADLINE_COLORS: Record<string, string> = {
  drop: "text-error",
  hold: "text-secondary",
  proceed_with_changes: "text-tertiary",
  proceed: "text-primary-container",
};

const STATUS_WORDS: Record<string, string> = {
  broken: "Refuted",
  weakened: "Weakened",
  unresolved: "Unproven",
  survived: "Held up",
};

const STATUS_COLORS: Record<string, string> = {
  broken: "text-error",
  weakened: "text-tertiary",
  unresolved: "text-secondary",
  survived: "text-primary-container",
};

function getStatusWord(claim: Claim) {
  if (claim.status === "weakened") {
    if (claim.weakened_kind === "qualified") return "Holds, with limits";
    if (claim.weakened_kind === "contested") return "Challenged";
  }
  return STATUS_WORDS[claim.status || ""] || "Untested";
}

function getStatusColor(claim: Claim) {
  if (claim.status === "weakened") {
    if (claim.weakened_kind === "qualified") return "text-tertiary";
    if (claim.weakened_kind === "contested") return "text-error opacity-90";
  }
  return STATUS_COLORS[claim.status || ""] || "text-outline";
}

const EVALUATOR_NAMES: Record<string, string> = {
  devils_advocate: "Devil's Advocate",
  researcher: "Researcher",
  builder: "Builder",
  operator: "Operator",
  overthinker: "Operator",
};

// Same ordering the claim list uses: load-bearing first, then worst outcome first.
const severityRank: Record<string, number> = {
  broken: 1,
  unresolved: 2,
  weakened: 3,
  survived: 4,
};

const getOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function rankClaims(claims: Claim[]): Claim[] {
  return [...claims].sort((a, b) => {
    if (a.load_bearing && !b.load_bearing) return -1;
    if (!a.load_bearing && b.load_bearing) return 1;
    const rankA = a.status ? severityRank[a.status] || 99 : 99;
    const rankB = b.status ? severityRank[b.status] || 99 : 99;
    return rankA - rankB;
  });
}

export const VerdictBlock: React.FC<VerdictBlockProps> = ({
  currentCase,
  onSelectClaim,
  isTesting,
  onStatusClick,
}) => {
  const verdict = currentCase.case_verdict;
  const totalClaims = currentCase.claims.length;
  const adjudicatedClaims = currentCase.claims.filter((c) => c.status != null);
  const survivedClaims = currentCase.claims.filter((c) => c.status === "survived");
  const flaggedTestingClaims = currentCase.claims.filter(
    (c) => c.status === "broken" || c.status === "weakened" || c.status === "unresolved"
  );

  if (!verdict) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low px-space-5 py-space-5 transition-all">
        {isTesting ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary-container animate-spin">
                  progress_activity
                </span>
                <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                  {adjudicatedClaims.length > 0
                    ? `Adjudicating claims (${adjudicatedClaims.length}/${totalClaims} resolved)`
                    : "Testing claims in parallel..."}
                </span>
              </div>
              {totalClaims > 0 && (
                <span className="font-code-sm text-code-sm text-outline">
                  {Math.round((adjudicatedClaims.length / totalClaims) * 100)}% complete
                </span>
              )}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              The call lands here once every claim has been tested.
            </p>
            {adjudicatedClaims.length > 0 && (
              <div className="flex items-center gap-space-2 pt-1 font-code-sm text-code-sm text-on-surface-variant">
                <span className="text-verdict-survived font-medium">
                  {survivedClaims.length} held up
                </span>
                <span>•</span>
                <span className="text-verdict-weakened font-medium">
                  {flaggedTestingClaims.length} flagged / weakened
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="font-body-md text-body-md text-on-surface-variant">
            No verdict for this run.
          </p>
        )}
      </div>
    );
  }

  // Generated per case; the static map is only the floor for older runs and for
  // synthesis failures. Four fixed strings read identically across unrelated
  // decisions, which is what made every verdict look the same regardless of what the panel actually found.
  const rawHeadline = cleanUiText(verdict.headline || "");
  const headlineWords = rawHeadline ? rawHeadline.split(/\s+/).filter(Boolean) : [];
  // Keep headline punchy (generally 3-6 words, up to 9 max; avoid big lines)
  const headline =
    (rawHeadline && headlineWords.length <= 9 ? rawHeadline : null) ||
    HEADLINES[verdict.decision_state] ||
    "Result";
  const headlineColor = HEADLINE_COLORS[verdict.decision_state] ?? "text-on-surface";

  const summaryText = cleanUiText(verdict.summary || "");
  const displaySummary = React.useMemo(() => {
    if (summaryText) return summaryText;
    const total = currentCase.claims.length;
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
    if (survived.length === total && total > 0) {
      return `After evaluation, all ${total} core assumption${total > 1 ? "s" : ""} held up with verified outside evidence. No critical errors were identified.`;
    }
    return `After evaluation, we found that ${survived.length} assumption${survived.length !== 1 ? "s" : ""} held up, ${broken.length} refuted, and ${unproven.length} unproven.${flawsStr}`;
  }, [summaryText, currentCase]);

  const deciding = verdict.deciding_factor ?? null;

  const failedClaims = rankClaims(
    currentCase.claims.filter((c) => c.status && c.status !== "survived")
  );
  // The deciding claim is already shown in full above; repeating it in the list
  // below is the duplication that made this page feel long.
  const otherFailedClaims = failedClaims.filter((c) => c.id !== deciding?.claim_id);

  const decidingClaim = deciding
    ? currentCase.claims.find((c) => c.id === deciding.claim_id)
    : undefined;

  const getBriefFailureReason = (claim: Claim): string => {
    if (claim.fatal_flaw) {
      return clampSentences(claim.fatal_flaw, 1);
    }
    const topContradiction = currentCase.findings?.find(
      (f) => f.claim_id === claim.id && f.contradiction
    )?.contradiction;
    if (topContradiction) {
      return clampSentences(topContradiction, 1);
    }
    const consequence = currentCase.consequences?.find((c) => c.claim_id === claim.id);
    if (consequence?.verdict_reasoning) {
      return clampSentences(consequence.verdict_reasoning, 1);
    }
    const topResult = currentCase.findings?.find(
      (f) => f.claim_id === claim.id && f.result && f.result.toLowerCase() !== "survived"
    )?.result;
    if (topResult) {
      return clampSentences(topResult, 1);
    }
    return "";
  };

  const claimsWithStatus = currentCase.claims.filter((c) => c.status);
  const hasClaimStatuses = claimsWithStatus.length > 0;

  const brokenCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "broken").length
    : verdict.broken.length;

  const weakenedCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "weakened").length
    : (verdict.weakened?.length ?? 0);

  const unresolvedCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "unresolved").length
    : Math.max(0, verdict.unproven.length - (verdict.weakened?.length ?? 0));

  const survivedCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "survived").length
    : verdict.survived.length;

  const handleStatusClick = (statusFilter: "needs_attention" | "passed" | "all") => {
    if (onStatusClick) {
      onStatusClick(statusFilter);
    }
  };

  const countElements: React.ReactNode[] = [];
  if (brokenCount) countElements.push(<button key="broken" type="button" onClick={() => handleStatusClick("needs_attention")} className="text-error hover:underline cursor-pointer">{brokenCount} refuted</button>);
  if (weakenedCount) countElements.push(<button key="weakened" type="button" onClick={() => handleStatusClick("needs_attention")} className="text-tertiary hover:underline cursor-pointer">{weakenedCount} weakened</button>);
  if (unresolvedCount) countElements.push(<button key="unresolved" type="button" onClick={() => handleStatusClick("needs_attention")} className="text-secondary hover:underline cursor-pointer">{unresolvedCount} unproven</button>);
  if (survivedCount) countElements.push(<button key="survived" type="button" onClick={() => handleStatusClick("passed")} className="text-primary-container hover:underline cursor-pointer">{survivedCount} held</button>);

  const separatedCounts = countElements.reduce((acc: React.ReactNode[], el, idx) => {
    if (idx === 0) return [el];
    return [...acc, <span key={`sep-${idx}`} className="text-outline">·</span>, el];
  }, []);

  return (
    <section
      aria-label="Verdict"
      className="rounded-xl border border-outline-variant bg-surface-container-low px-space-5 py-space-6 space-y-space-8 animate-in fade-in duration-300"
    >


      {/* The call */}
      <div className="space-y-space-4">
        <h2
          className={`font-headline-lg text-headline-lg font-semibold leading-tight ${headlineColor}`}
        >
          <SerpApiText text={headline} />
        </h2>
        {verdict.surviving_core && (
          <p
            data-testid="surviving-core"
            className="font-body-md text-[15px] leading-[1.6] text-primary-container font-medium"
          >
            <SerpApiText text={cleanUiText(verdict.surviving_core)} />
          </p>
        )}
        <p className="font-body-md text-[16px] leading-[1.7] text-on-surface">
          <SerpApiText text={displaySummary} />
        </p>
        {separatedCounts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap font-title-sm text-title-sm font-medium">
            {separatedCounts}
          </div>
        )}
      </div>

      {/* What decided it - one finding, resolved server-side */}
      {deciding && (() => {
        const agent = getAgentById(deciding.evaluator);
        const evaluatorName = agent?.name || EVALUATOR_NAMES[deciding.evaluator] || deciding.evaluator;
        const evaluatorLogo = agent?.emoji;

        return (
          <>
            <hr className="border-t border-outline-variant" />
            <div className="space-y-space-3">
              <h3 className="font-title-sm text-title-sm text-on-surface-variant font-semibold">
                What decided it
              </h3>
              <button
                type="button"
                onClick={() => onSelectClaim(deciding.claim_id)}
                className="w-full text-left rounded-lg border border-outline-variant bg-surface-container px-space-3 py-space-3 hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-space-3">
                  <span className="font-body-md text-[15px] leading-[1.6] text-on-surface">
                    <SerpApiText text={cleanUiText(deciding.the_fact)} />
                  </span>
                  {decidingClaim?.status && (
                    <span
                      className={`font-body-sm text-[14px] font-semibold shrink-0 pt-0.5 ${
                        getStatusColor(decidingClaim)
                      }`}
                    >
                      {getStatusWord(decidingClaim)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5 font-code-sm text-[13px] text-outline flex-wrap">
                  {evaluatorLogo && (
                    <img
                      src={evaluatorLogo}
                      alt=""
                      className="w-[18px] h-[18px] object-contain inline-block shrink-0 rounded-xs"
                    />
                  )}
                  <span className="font-medium text-on-surface-variant">
                    {evaluatorName}
                  </span>
                  {deciding.source_title ? (
                    <>
                      {" · "}
                      <SerpApiText text={cleanUiText(deciding.source_title)} />
                    </>
                  ) : null}
                </div>
                {/* Where the panel attacked but nobody could cite it. Showing the
                    refusal is the point: it is the opposite of a model that agrees. */}
                {deciding.gate_fired && (
                  <p className="mt-1 font-code-sm text-code-sm text-secondary">
                    Not refuted - the panel attacked this but no source backed it.
                  </p>
                )}
              </button>
            </div>
          </>
        );
      })()}

      {/* The salvaged version, assembled from what survived */}
      {verdict.build_spec && (
        <>
          <hr className="border-t border-outline-variant" />
          <div
            data-testid="build-spec"
            className="space-y-space-3 rounded-lg border border-outline-variant bg-surface-container px-space-3 py-space-3"
          >
            <h3 className="font-title-sm text-title-sm text-on-surface-variant font-semibold">
              The version I'd build
            </h3>
            <p className="font-body-md text-[15px] leading-[1.6] text-on-surface">
              <SerpApiText text={cleanUiText(verdict.build_spec.what_it_does)} />
            </p>
            <p className="font-body-sm text-[14px] leading-[1.6] text-outline">
              <span className="font-semibold text-on-surface-variant">What it omits: </span>
              <SerpApiText text={cleanUiText(verdict.build_spec.what_it_omits)} />
            </p>
            <p className="font-body-sm text-[14px] leading-[1.6] text-outline">
              <span className="font-semibold text-on-surface-variant">Demo path: </span>
              <SerpApiText text={cleanUiText(verdict.build_spec.demo_path)} />
            </p>
            <p className="font-body-sm text-[14px] leading-[1.6] text-outline">
              <span className="font-semibold text-on-surface-variant">Cheapest experiment: </span>
              <SerpApiText text={cleanUiText(verdict.build_spec.cheapest_experiment)} />
            </p>
          </div>
        </>
      )}

      {/* What to do about it */}
      {verdict.next_actions.length > 0 && (
        <>
          <hr className="border-t border-outline-variant" />
          <div className="space-y-space-3">
            <h3 className="font-title-sm text-title-sm text-on-surface-variant font-semibold">
              Before you commit
            </h3>
            <ul className="space-y-space-3">
              {verdict.next_actions.map((next, idx) => {
                return (
                  <li
                    key={`${idx}-${next.action.slice(0, 24)}`}
                    className="flex flex-col gap-space-2 md:flex-row md:items-center md:justify-between"
                  >
                    <span className="font-body-md text-[15px] leading-[1.6] text-on-surface flex-1">
                      <SerpApiText text={cleanUiText(next.action)} />
                    </span>
                    {next.claim_ids && next.claim_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 shrink-0 mt-2 md:mt-0 md:ml-4">
                        {next.claim_ids.map((cid) => {
                          const cIdx = currentCase.claims.findIndex(c => c.id === cid);
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => onSelectClaim(cid)}
                              className="w-[105px] justify-between font-body-sm text-[13px] font-medium px-2.5 py-1 rounded border border-outline-variant text-primary-container hover:bg-surface-container-high transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>{cIdx >= 0 ? `${getOrdinal(cIdx + 1)} Claim` : "Claim"}</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {/* Other failed claims shown openly with brief 1-sentence notes */}
      {otherFailedClaims.length > 0 && (
        <>
          <hr className="border-t border-outline-variant" />
          <div className="space-y-space-3">
            <h3 className="font-title-sm text-title-sm text-on-surface-variant font-semibold">
              {otherFailedClaims.length} more claim{otherFailedClaims.length > 1 ? "s" : ""} didn't hold
            </h3>
            <ul className="space-y-space-3">
              {otherFailedClaims.map((claim) => {
                const briefReason = getBriefFailureReason(claim);
                return (
                  <li key={claim.id}>
                    <button
                      type="button"
                      onClick={() => onSelectClaim(claim.id)}
                      className="w-full text-left rounded-lg border border-outline-variant bg-surface-container px-space-4 py-space-4 hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-space-3">
                        <span className="font-body-md text-[15px] leading-[1.6] text-on-surface">
                          <SerpApiText text={cleanUiText(claim.statement)} />
                        </span>
                        <span
                          className={`font-body-sm text-[14px] font-semibold shrink-0 pt-0.5 ${
                            getStatusColor(claim)
                          }`}
                        >
                          {getStatusWord(claim)}
                        </span>
                      </div>
                      {briefReason && (
                        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                          <SerpApiText text={cleanUiText(briefReason)} />
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {/* Jump to Quick Fix button */}
      {!isTesting && failedClaims.length > 0 && (
        <div className="pt-2 flex justify-start">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("quick-fix-section");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="inline-flex items-center gap-1.5 font-body-sm text-body-sm font-medium px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary-container transition-colors cursor-pointer"
          >
            <span>Jump to Quick Fix</span>
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
          </button>
        </div>
      )}
    </section>
  );
};
