import React, { useState } from "react";
import { ActiveTestRow, Claim, DecisionConsequence, Finding } from "@/types/crossfire";
import { cleanUiText, formatConfidence, formatTestName, truncateUrl } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TestRow } from "./TestRow";
import { PoweredBySerpApiBadge, SerpApiText } from "@/components/ui/serpapi";

interface ClaimCardProps {
  claim: Claim;
  index?: number;
  tests?: ActiveTestRow[];
  findings?: Finding[];
  consequence?: DecisionConsequence;
  onClick?: () => void;
  isTestingMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  activeActivities?: Record<string, string>;
  isSelectedForPromptFix?: boolean;
  onTogglePromptFix?: () => void;
  className?: string;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({
  claim,
  index,
  tests = [],
  findings = [],
  consequence,
  onClick,
  isTestingMode = false,
  isExpanded: controlledExpanded,
  onToggleExpand,
  activeActivities,
  isSelectedForPromptFix,
  onTogglePromptFix,
  className = "",
}) => {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;

  const claimFindings = findings.filter((f) => f.claim_id === claim.id);
  const relevantFinding = claimFindings[0] || findings.find((f) => f.claim_id === claim.id);
  const allEvidence = (claimFindings.length > 0 ? claimFindings : findings).flatMap((f) => f.evidence || []);
  const allContradictions = Array.from(
    new Set(
      (claimFindings.length > 0 ? claimFindings : findings)
        .map((f) => f.contradiction)
        .filter((c): c is string => Boolean(c))
    )
  );

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalExpanded((prev) => !prev);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const getStatusBadge = () => {
    switch (claim.status) {
      case "broken":
        return {
          label: "Broken",
          icon: "cancel",
          classes: "text-error bg-surface-container-highest",
        };
      case "weakened":
        if (claim.weakened_kind === "qualified") {
          return {
            label: "Holds, with limits",
            icon: "warning",
            classes: "text-tertiary bg-surface-container-highest",
          };
        } else if (claim.weakened_kind === "contested") {
          return {
            label: "Challenged",
            icon: "error",
            classes: "text-error opacity-90 bg-surface-container-highest", // muted text-error
          };
        }
        return {
          label: "Weakened",
          icon: "warning",
          classes: "text-tertiary bg-surface-container-highest",
        };
      case "unresolved":
        return {
          label: "Unresolved",
          icon: "help",
          classes: "text-secondary bg-surface-container-highest",
        };
      case "survived":
        return {
          label: "Survived",
          icon: "check_circle",
          classes: "text-primary-container bg-surface-container-highest",
        };
      default:
        return null;
    }
  };

  const statusBadge = getStatusBadge();
  const isLoadBearing = claim.load_bearing ?? true;

  // One plain label per status. The sentence below it already says the specific thing.
  const FINDING_HEADLINES: Record<string, { label: string; icon: string; classes: string }> = {
    broken: { label: "Didn't hold up", icon: "cancel", classes: "text-error" },
    weakened: { label: "Held up only partly", icon: "warning", classes: "text-tertiary" },
    weakened_qualified: { label: "Held up, within limits", icon: "warning", classes: "text-tertiary" },
    weakened_contested: { label: "Challenged by a source", icon: "error", classes: "text-error opacity-90" },
    unresolved: { label: "Couldn't be settled", icon: "help", classes: "text-secondary" },
    survived: { label: "Held up", icon: "check_circle", classes: "text-primary-container" },
  };

  const headlineKey = claim.status === "weakened" && claim.weakened_kind ? `weakened_${claim.weakened_kind}` : (claim.status || "survived");
  const findingHeadline = FINDING_HEADLINES[headlineKey] || FINDING_HEADLINES.survived;

  const isActivelyTested =
    Boolean(isTestingMode) &&
    (tests.some((t) => t.state === "running" || (t as unknown as { status?: string }).status === "running") ||
      Boolean(activeActivities?.[claim.id]));

  return (
    <div
      id={`claim-card-${claim.id}`}
      data-claim-id={claim.id}
      data-actively-tested={isActivelyTested ? "true" : undefined}
      onClick={handleCardClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "bg-surface-container rounded-xl border border-outline-variant p-space-6 space-y-space-4 hover:border-outline transition-colors text-left outline-none block w-full",
        isActivelyTested && "ring-1 ring-primary-container/40 border-primary-container/50",
        onClick && "cursor-pointer focus-visible:ring-1 focus-visible:ring-primary-container",
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-space-3 flex-wrap">
        <div className="flex items-center gap-space-2">
          {isLoadBearing ? (
            <span
              title="If this claim is wrong, the plan fails"
              className="font-label-mono text-label-mono uppercase tracking-wider px-space-2 py-0.5 rounded bg-surface-container-highest text-primary-container font-semibold"
            >
              If this is wrong, the plan fails
            </span>
          ) : (
            <span className="font-label-mono text-label-mono uppercase tracking-wider px-space-2 py-0.5 rounded bg-surface-container-highest text-outline font-semibold">
              Minor point
            </span>
          )}
          <span className="font-code-sm text-code-sm text-outline font-medium">
            {index !== undefined ? `${index + 1}` : claim.id.replace(/\D/g, "") || "1"}
          </span>
        </div>

        <div className="flex items-center gap-space-3">
          {statusBadge ? (
            <div
              className={`flex items-center gap-1.5 px-space-2.5 py-1 rounded ${statusBadge.classes}`}
            >
              <span className="material-symbols-outlined text-[16px]">{statusBadge.icon}</span>
              <span className="font-code-md text-code-md font-semibold">{statusBadge.label}</span>
            </div>
          ) : (
            isTestingMode && (
              <div className="flex items-center gap-1.5 px-space-2.5 py-1 rounded bg-surface-container-highest text-primary-container">
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                <span className="font-code-md text-code-md font-semibold">Testing</span>
              </div>
            )
          )}

          {(claim.confidence !== undefined && claim.confidence !== null) ? (
            <span className="font-code-sm text-code-sm text-outline">
              Confidence:{" "}
              <span className="text-on-surface font-semibold">
                {formatConfidence(claim.confidence)}
              </span>
            </span>
          ) : relevantFinding?.confidence !== undefined ? (
            <span className="font-code-sm text-code-sm text-outline">
              Confidence:{" "}
              <span className="text-on-surface font-semibold">
                {formatConfidence(relevantFinding.confidence)}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Claim Title */}
      <h2 className="font-headline-md text-headline-md text-on-surface font-medium leading-tight">
        <SerpApiText text={cleanUiText(claim.statement)} />
      </h2>

      {/* Which bundled mechanism this claim tests, when the idea was split into several */}
      {claim.mechanism_of && (
        <span
          data-testid="mechanism-label"
          className="inline-flex w-fit items-center rounded-full border border-outline-variant bg-surface-container px-space-3 py-0.5 font-code-sm text-code-sm text-outline"
        >
          {claim.mechanism_of}
        </span>
      )}

      {/* Domain jargon resolved at extraction time, so the reader sees what it meant */}
      {claim.terms && claim.terms.length > 0 && (
        <dl data-testid="resolved-terms" className="space-y-1">
          {claim.terms.map((t) => (
            <div key={t.term} className="flex flex-wrap gap-1 font-code-sm text-code-sm text-outline">
              <dt className="font-semibold text-on-surface-variant">{t.term}:</dt>
              <dd>{t.resolved}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Steel Man Prompt Fix Checkbox & Toggle */}
      {!isTestingMode && (claim.salvaged_claim || consequence?.salvaged_claim) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePromptFix?.();
          }}
          className={cn(
            "p-space-4 w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg border transition-all flex items-start justify-between gap-space-3 cursor-pointer",
            isSelectedForPromptFix
              ? "bg-primary-container/10 border-primary-container/50 text-on-surface ring-1 ring-primary-container/20"
              : "bg-surface-container-low border-outline-variant/60 text-on-surface-variant hover:border-outline hover:bg-surface-container"
          )}
        >
          <div className="flex items-start gap-3 select-none flex-1 min-w-0">
            <div className={cn(
              "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 mt-0.5",
              isSelectedForPromptFix 
                ? "bg-primary-container border-primary-container text-on-primary-container" 
                : "border-outline-variant bg-surface-container-lowest"
            )}>
              {isSelectedForPromptFix && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="font-body-md text-[15px] text-on-surface leading-snug font-medium">
                <span className="font-code-sm text-[15px] font-semibold text-primary-container inline-flex items-center gap-1 mr-2 align-middle">
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  <span>Apply Fix:</span>
                </span>
                &ldquo;{cleanUiText(claim.salvaged_claim || consequence?.salvaged_claim || "")}&rdquo;
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Live Adversarial Test Stream (Visible during active testing) */}
      {isTestingMode && tests.length > 0 && !isExpanded && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-mono text-outline">
            <span className="flex items-center gap-1.5 text-primary-container font-medium">
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              <span>Adversarial Testing in Progress ({tests.length} test{tests.length > 1 ? "s" : ""})</span>
            </span>
          </div>
          <div className="space-y-1.5">
            {tests.map((t) => (
              <TestRow
                key={t.test_id}
                testId={t.test_id}
                failureMode={t.failure_mode}
                objective={t.objective}
                state={t.state}
                finding={t.finding}
                activeActivity={
                  activeActivities?.[t.failure_mode] ||
                  activeActivities?.[t.test_id] ||
                  activeActivities?.[claim.id]
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Details Box */}
      {!isExpanded && !isTestingMode && (relevantFinding?.result || relevantFinding?.contradiction || relevantFinding?.reasoning || consequence?.verdict_reasoning) && (
        <div className="bg-surface-container-low p-space-5 rounded-lg space-y-space-3 border border-outline-variant mt-2">
          <div
            className={`font-label-mono text-[13px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${findingHeadline.classes}`}
          >
            <span className="material-symbols-outlined text-[16px]">{findingHeadline.icon}</span>
            <span>{findingHeadline.label}</span>
          </div>

          <p className="font-body-md text-[15px] text-on-surface leading-relaxed">
            <SerpApiText text={cleanUiText(relevantFinding?.result || relevantFinding?.contradiction || consequence?.verdict_reasoning)} />
          </p>

          {consequence?.verdict_reasoning && (
            <div className="font-body-sm text-[15px] text-on-surface-variant flex items-start gap-1.5 pt-2">
              <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5">gavel</span>
              <span><strong className="text-[15px]">Steel Man Verdict:</strong> <SerpApiText text={cleanUiText(consequence.verdict_reasoning)} /></span>
            </div>
          )}

          <div className="flex items-center gap-space-4 text-outline font-code-sm text-[13px] pt-1 flex-wrap">
            {relevantFinding?.reasoning && !consequence?.verdict_reasoning && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">database</span>
                <span><SerpApiText text={cleanUiText(relevantFinding.reasoning)} /></span>
              </span>
            )}
            {claimFindings.length > 1 && (
              <span className="font-mono text-xs text-outline">
                +{claimFindings.length - 1} more evaluator finding{claimFindings.length > 2 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recommendation & Evidence Action Row */}
      <div className="bg-surface-container-high p-space-5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-space-4 mt-space-3">
        <div className="flex flex-col md:flex-row md:items-center gap-space-2 flex-1 min-w-0">
          <span className="font-code-sm text-[15px] font-bold text-primary uppercase shrink-0">
            Recommended Change:
          </span>
          <span className="font-body-md text-[15px] text-on-surface-variant line-clamp-2">
            {!isExpanded
              ? (consequence?.recommended_change
                  ? cleanUiText(consequence.recommended_change)
                  : isTestingMode
                    ? "Formulating strategic recommendation based on adversarial test results..."
                    : "No plan revision indicated: assumption aligns with findings.")
              : "Review full adversarial audit, test plan, and strategic adjustment below."}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            if (onClick) {
              e.stopPropagation();
              onClick();
            } else {
              handleToggleExpand(e);
            }
          }}
          className="px-4 py-2 rounded-lg border border-outline-variant hover:border-outline bg-surface-container-low hover:bg-surface-container font-code-sm text-sm text-primary flex items-center gap-1.5 shrink-0 font-semibold cursor-pointer transition-all shadow-sm group"
        >
          <span>{isExpanded ? "Hide Evidence & Sources" : "View evidence & audit trail"}</span>
          <span className="sr-only">
            {isExpanded ? "Hide Evidence & Sources" : "View Evidence & Sources"}
          </span>
          <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
        </button>
      </div>

      {/* INLINE EXPANDED CONTENT (if expanded on page) */}
      {isExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-4 space-y-4 border-t border-outline-variant/60 pt-4 text-left"
        >
          {/* Active / Executed Tests */}
          {tests.length > 0 && (
            <div className="space-y-2">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
                {tests.length} tests run
              </span>
              <div className="space-y-1.5">
                {tests.map((t) => (
                  <TestRow
                    key={t.test_id}
                    testId={t.test_id}
                    failureMode={t.failure_mode}
                    objective={t.objective}
                    state={t.state}
                    finding={t.finding}
                    activeActivity={
                      activeActivities?.[t.failure_mode] ||
                      activeActivities?.[t.test_id] ||
                      activeActivities?.[claim.id]
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Steel Man Verdict & Reconciliation */}
          {consequence?.verdict_reasoning && (
            <div className="space-y-1.5">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-primary-container font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">gavel</span>
                <span>Why this call</span>
              </span>
              <div className="border border-outline-variant bg-surface-container-low p-3 rounded text-body-sm text-on-surface space-y-1">
                <p className="font-medium text-on-surface">{cleanUiText(consequence.verdict_reasoning)}</p>
                {consequence.impact && (
                  <span className="inline-block font-mono text-xs uppercase px-2 py-0.5 rounded bg-surface-container-high text-outline">
                    Impact: {consequence.impact}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Steel Man Re-Architecture (Break to Rebuild) */}
          {(claim.salvaged_claim || consequence?.salvaged_claim) && (
            <div className="space-y-2 border border-primary-container/30 bg-primary-container/5 p-3.5 rounded-lg">
              <div className="flex items-center gap-1.5 text-primary-container font-semibold font-label-mono text-xs uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">build_circle</span>
                <span>Steel Man Salvage Plan (Break to Rebuild)</span>
              </div>

              {(claim.fatal_flaw || consequence?.fatal_flaw) && (
                <div className="text-body-sm text-on-surface">
                  <span className="text-error font-semibold text-xs font-mono uppercase mr-1.5">[Fatal Flaw]:</span>
                  <span>{cleanUiText(claim.fatal_flaw || consequence?.fatal_flaw || "")}</span>
                </div>
              )}

              <div className="text-body-sm text-on-surface">
                <span className="text-primary font-semibold text-xs font-mono uppercase mr-1.5">[Salvaged Claim]:</span>
                <span className="font-medium">{cleanUiText(claim.salvaged_claim || consequence?.salvaged_claim || "")}</span>
              </div>

              {(claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged) && (
                <div className="text-body-sm text-on-surface-variant text-xs">
                  <span className="text-outline font-semibold font-mono uppercase mr-1.5">[Trade-off]:</span>
                  <span>{cleanUiText(claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged || "")}</span>
                </div>
              )}

              {/* Toggle to adopt in starting prompt */}
              <div className="pt-2 flex items-center justify-between border-t border-primary-container/20">
                <span className="text-xs font-code-sm text-outline">
                  {isSelectedForPromptFix ? "Included in revised prompt" : "Include this solution in prompt revision"}
                </span>
                <button
                  type="button"
                  onClick={() => onTogglePromptFix?.()}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-code-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer",
                    isSelectedForPromptFix
                      ? "bg-primary-container text-white"
                      : "bg-surface-container-high hover:bg-surface-container-highest text-primary-container border border-primary-container/40"
                  )}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isSelectedForPromptFix ? "check_box" : "check_box_outline_blank"}
                  </span>
                  <span>{isSelectedForPromptFix ? "Applied to Starting Prompt" : "Apply to Starting Prompt"}</span>
                </button>
              </div>
            </div>
          )}

          {/* What the tests found */}
          {claimFindings.length > 0 && (
            <div className="space-y-2">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
                What the {claimFindings.length} tests found
              </span>
              <div className="space-y-2">
                {claimFindings.map((f, i) => (
                  <div
                    key={f.test_id || i}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-high text-primary-container uppercase">
                        [{formatTestName(f.evaluator).toUpperCase()}]
                      </span>
                      {f.confidence !== undefined && (
                        <span 
                          title="Evaluator objection strength (0% = no objection / abstained, 90%+ = fatal blocker)"
                          className="font-mono text-xs text-outline"
                        >
                          Objection Strength: {(f.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {f.contradiction && (
                      <p className="font-body-sm text-body-sm text-error font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-error shrink-0 select-none">
                          warning
                        </span>
                        <span><SerpApiText text={cleanUiText(f.contradiction)} /></span>
                      </p>
                    )}
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                      <SerpApiText text={cleanUiText(f.result)} />
                    </p>
                    {f.reasoning && f.reasoning !== f.result && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed text-xs">
                        <SerpApiText text={cleanUiText(f.reasoning)} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Citations */}
          {allEvidence.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
                  Sources ({allEvidence.length})
                </span>
                <PoweredBySerpApiBadge variant="header" />
              </div>
              {allEvidence.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-space-2">
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body-md text-body-md font-semibold text-primary hover:underline flex items-center gap-space-2 truncate"
                    >
                      <span className="truncate"><SerpApiText text={cleanUiText(ev.title || truncateUrl(ev.source_url, 45))} /></span>
                      <span className="material-symbols-outlined text-[15px] shrink-0">open_in_new</span>
                    </a>
                    {(ev.provider === "serpapi" || ev.provider === "duckduckgo" || !ev.provider) && (
                      <PoweredBySerpApiBadge variant="inline" />
                    )}
                    {ev.provider === "fixture" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                        via Demo Fixture
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    "<SerpApiText text={cleanUiText(ev.snippet)} />"
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Contradictions */}
          {allContradictions.length > 0 && (
            <div className="space-y-1">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-error font-semibold block">
                What contradicts it
              </span>
              {allContradictions.map((contra, idx) => (
                <p
                  key={idx}
                  className="font-body-sm text-body-sm text-on-surface bg-error-container/20 border border-error/50 p-3 rounded"
                >
                  {cleanUiText(contra)}
                </p>
              ))}
            </div>
          )}

          {/* What to change */}
          {consequence?.recommended_change && (
            <div className="space-y-1">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
                What to change
              </span>
              <blockquote className="border border-primary-container/30 bg-surface-container-low p-3 rounded text-body-sm text-on-surface">
                "{cleanUiText(consequence.recommended_change)}"
              </blockquote>
            </div>
          )}

          {/* Smallest Validation Step */}
          {consequence?.next_validation && (
            <div className="space-y-1">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-primary font-semibold block">
                How to check
              </span>
              <div className="border border-primary-container/40 bg-surface-container-low p-3 rounded text-body-sm text-on-surface">
                {cleanUiText(consequence.next_validation)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
