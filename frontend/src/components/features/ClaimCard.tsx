import React, { useState } from "react";
import { ActiveTestRow, Claim, DecisionConsequence, Finding } from "@/types/crossfire";
import { formatConfidence, formatTestName, truncateUrl } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TestRow } from "./TestRow";
import { PoweredBySerpApiBadge } from "@/components/ui/serpapi";

interface ClaimCardProps {
  claim: Claim;
  tests?: ActiveTestRow[];
  findings?: Finding[];
  consequence?: DecisionConsequence;
  onClick?: () => void;
  isTestingMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  activeActivities?: Record<string, string>;
  className?: string;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({
  claim,
  tests = [],
  findings = [],
  consequence,
  onClick,
  isTestingMode = false,
  isExpanded: controlledExpanded,
  onToggleExpand,
  activeActivities,
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
    unresolved: { label: "Couldn't be settled", icon: "help", classes: "text-secondary" },
    survived: { label: "Held up", icon: "check_circle", classes: "text-primary-container" },
  };

  const findingHeadline =
    FINDING_HEADLINES[claim.status || "survived"] || FINDING_HEADLINES.survived;

  return (
    <div
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
          <span className="font-code-sm text-code-sm text-outline">
            #{claim.id.startsWith("CLM") || claim.id.startsWith("C-") ? claim.id : `CLM-${claim.id.replace(/-/g, "").slice(0, 4).toUpperCase() || "01"}`}
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

          {relevantFinding?.confidence !== undefined && (
            <span className="font-code-sm text-code-sm text-outline">
              Confidence:{" "}
              <span className="text-on-surface font-semibold">
                {formatConfidence(relevantFinding.confidence)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Claim Title */}
      <h2 className="font-headline-md text-headline-md text-on-surface font-medium leading-tight">
        {claim.statement}
      </h2>

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
        <div className="bg-surface-container-low p-space-4 rounded space-y-space-2 border border-outline-variant">
          <div
            className={`font-label-mono text-label-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 ${findingHeadline.classes}`}
          >
            <span className="material-symbols-outlined text-[14px]">{findingHeadline.icon}</span>
            <span>{findingHeadline.label}</span>
          </div>

          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
            {relevantFinding?.result || relevantFinding?.contradiction || consequence?.verdict_reasoning}
          </p>

          {consequence?.verdict_reasoning && (
            <div className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1.5 pt-1">
              <span className="material-symbols-outlined text-[15px] text-primary-container shrink-0">gavel</span>
              <span><strong>Steel Man Verdict:</strong> {consequence.verdict_reasoning}</span>
            </div>
          )}

          <div className="flex items-center gap-space-4 text-outline font-code-sm text-code-sm pt-1 flex-wrap">
            {relevantFinding?.reasoning && !consequence?.verdict_reasoning && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">database</span>
                <span>{relevantFinding.reasoning}</span>
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
      <div className="bg-surface-container-high p-space-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-space-3">
        <div className="flex items-center gap-space-2 flex-1 min-w-0">
          <span className="font-code-sm text-code-sm font-semibold text-primary uppercase shrink-0">
            Recommended Change:
          </span>
          <span className="font-body-md text-body-md text-on-surface-variant truncate">
            {!isExpanded
              ? consequence?.recommended_change ||
                (isTestingMode
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
          className="font-code-sm text-code-sm text-primary hover:underline flex items-center gap-1 shrink-0 font-medium cursor-pointer"
        >
          <span>{isExpanded ? "Hide Evidence & Sources" : "View evidence & audit trail"}</span>
          <span className="sr-only">
            {isExpanded ? "Hide Evidence & Sources" : "View Evidence & Sources"}
          </span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
              <div className="border-l-2 border-primary-container bg-surface-container-low p-3 rounded-r text-body-sm text-on-surface space-y-1">
                <p className="font-medium text-on-surface">{consequence.verdict_reasoning}</p>
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
                  <span>{claim.fatal_flaw || consequence?.fatal_flaw}</span>
                </div>
              )}

              <div className="text-body-sm text-on-surface">
                <span className="text-primary font-semibold text-xs font-mono uppercase mr-1.5">[Salvaged Claim]:</span>
                <span className="font-medium">{claim.salvaged_claim || consequence?.salvaged_claim}</span>
              </div>

              {(claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged) && (
                <div className="text-body-sm text-on-surface-variant text-xs">
                  <span className="text-outline font-semibold font-mono uppercase mr-1.5">[Trade-off]:</span>
                  <span>{claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged}</span>
                </div>
              )}
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
                        <span className="font-mono text-xs text-outline">
                          Confidence: {(f.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {f.contradiction && (
                      <p className="font-body-sm text-body-sm text-error font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-error shrink-0 select-none">
                          warning
                        </span>
                        <span>{f.contradiction}</span>
                      </p>
                    )}
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                      {f.result}
                    </p>
                    {f.reasoning && f.reasoning !== f.result && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed text-xs">
                        {f.reasoning}
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
                      <span className="truncate">{ev.title || truncateUrl(ev.source_url, 45)}</span>
                      <span className="material-symbols-outlined text-[15px] shrink-0">open_in_new</span>
                    </a>
                    {ev.provider === "serpapi" && (
                      <PoweredBySerpApiBadge variant="inline" />
                    )}
                    {ev.provider === "duckduckgo" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
                        via DuckDuckGo Lite
                      </span>
                    )}
                    {ev.provider === "fixture" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                        via Demo Fixture
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    "{ev.snippet}"
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
                  className="font-body-sm text-body-sm text-on-surface bg-error-container/20 border-l-2 border-error p-3 rounded-r"
                >
                  {contra}
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
              <blockquote className="border-l-2 border-primary-container bg-surface-container-low p-3 rounded-r text-body-sm text-on-surface">
                "{consequence.recommended_change}"
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
                {consequence.next_validation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
