import React, { useState } from "react";
import { ActiveTestRow, Claim, DecisionConsequence, Finding } from "@/types/crossfire";
import { formatConfidence, truncateUrl } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface ClaimCardProps {
  claim: Claim;
  tests?: ActiveTestRow[];
  findings?: Finding[];
  consequence?: DecisionConsequence;
  onClick?: () => void;
  isTestingMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({
  claim,
  tests: _tests = [],
  findings = [],
  consequence,
  onClick,
  isTestingMode = false,
  isExpanded: controlledExpanded,
  onToggleExpand,
  className = "",
}) => {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;

  const relevantFinding = findings.find((f) => f.claim_id === claim.id);
  const allEvidence = findings.flatMap((f) => f.evidence || []);

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

  // Determine finding header label & style
  const getFindingHeadline = () => {
    if (claim.status === "broken") {
      return {
        label: "Critical Contradiction Discovered",
        icon: "report",
        classes: "text-error",
      };
    }
    if (claim.status === "unresolved") {
      return {
        label: "Technical Feasibility Indeterminate",
        icon: "sync_problem",
        classes: "text-secondary",
      };
    }
    if (claim.status === "weakened") {
      return {
        label: "User Sentiment Regression",
        icon: "warning",
        classes: "text-tertiary",
      };
    }
    return {
      label: "Validated by Benchmark",
      icon: "check",
      classes: "text-primary-container",
    };
  };

  const findingHeadline = getFindingHeadline();

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
              title="Load-bearing assumption — if false, the entire plan fails"
              className="font-label-mono text-label-mono uppercase tracking-wider px-space-2 py-0.5 rounded bg-surface-container-highest text-primary-container font-semibold"
            >
              Load-bearing assumption
            </span>
          ) : (
            <span className="font-label-mono text-label-mono uppercase tracking-wider px-space-2 py-0.5 rounded bg-surface-container-highest text-outline font-semibold">
              Peripheral assertion
            </span>
          )}
          <span className="font-code-sm text-code-sm text-outline">
            #{claim.id.startsWith("CLM") ? claim.id : `CLM-${claim.id.replace(/[^0-9]/g, "") || "4019"}`}
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

      {/* Details Box */}
      {!isExpanded && (relevantFinding?.result || relevantFinding?.contradiction || relevantFinding?.reasoning) && (
        <div className="bg-surface-container-low p-space-4 rounded space-y-space-2 border border-outline-variant">
          <div
            className={`font-label-mono text-label-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 ${findingHeadline.classes}`}
          >
            <span className="material-symbols-outlined text-[14px]">{findingHeadline.icon}</span>
            <span>{findingHeadline.label}</span>
          </div>

          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
            {relevantFinding.result || relevantFinding.contradiction}
          </p>

          <div className="flex items-center gap-space-4 text-outline font-code-sm text-code-sm pt-1 flex-wrap">
            {relevantFinding.reasoning && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">database</span>
                <span>{relevantFinding.reasoning}</span>
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
                "Differentiate on verifiable transparency and audit logs rather than claiming to be first-to-market."
              : "Review full adversarial audit and strategic adjustment below."}
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
          {/* Primary Citations */}
          {allEvidence.length > 0 && (
            <div className="space-y-2">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
                Primary Source Citations
              </span>
              {allEvidence.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 space-y-2"
                >
                  <a
                    href={ev.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body-md text-body-md font-semibold text-primary hover:underline flex items-center justify-between gap-space-2"
                  >
                    <span>{ev.title || truncateUrl(ev.source_url, 45)}</span>
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  </a>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    "{ev.snippet}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Contradictions */}
          {relevantFinding?.contradiction && (
            <div className="space-y-1">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-error font-semibold block">
                Contradictions Surfaced
              </span>
              <p className="font-body-sm text-body-sm text-on-surface bg-error-container/20 border-l-2 border-error p-3 rounded-r">
                {relevantFinding.contradiction}
              </p>
            </div>
          )}

          {/* Recommended Strategic Adjustment */}
          {consequence?.recommended_change && (
            <div className="space-y-1">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
                Recommended Strategic Adjustment
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
                Next Validation Step
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
