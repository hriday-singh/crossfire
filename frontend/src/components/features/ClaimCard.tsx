import React, { useState } from "react";
import { ActiveTestRow, Claim, DecisionConsequence, Finding } from "@/types/crossfire";
import { formatConfidence, formatImpact, formatTestName, getVerdictConfig, truncateUrl } from "@/lib/formatters";
import { TestRow } from "./TestRow";
import { cn } from "@/lib/utils";
import {
  Anchor,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  CircleX,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

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

function renderVerdictIcon(status: Claim["status"], size = 14) {
  switch (status) {
    case "survived":
      return <CircleCheck size={size} className="text-emerald-700 shrink-0" />;
    case "weakened":
      return <TriangleAlert size={size} className="text-amber-700 shrink-0" />;
    case "broken":
      return <CircleX size={size} className="text-rose-700 shrink-0" />;
    case "unresolved":
      return <CircleHelp size={size} className="text-indigo-700 shrink-0" />;
    default:
      return null;
  }
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
  className = "",
}) => {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;

  const verdictConfig = getVerdictConfig(claim.status);
  const relevantFinding = findings.find((f) => f.claim_id === claim.id);
  const relevantTests = tests.filter((t) => t.target_claim === claim.id);
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
        "group relative flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all text-left outline-none",
        onClick && "cursor-pointer hover:border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-950",
        className
      )}
    >
      {/* Top Row: Load-bearing indicator + Verdict Badge */}
      <div className="flex items-center justify-between gap-4">
        <div>
          {claim.load_bearing ? (
            <span
              title="Load-bearing assumption — if false, the entire plan fails"
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 text-white px-2.5 py-0.5 text-xs font-mono font-medium"
            >
              <Anchor size={11} className="text-zinc-300 shrink-0" />
              Core foundation
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2.5 py-0.5 text-xs font-mono">
              Supporting assumption
            </span>
          )}
        </div>

        {/* Reconciled Verdict Badge */}
        {claim.status ? (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono font-medium",
                verdictConfig.badgeBg,
                verdictConfig.badgeText,
                verdictConfig.badgeBorder
              )}
            >
              {renderVerdictIcon(claim.status, 14)}
              <span>{verdictConfig.label}</span>
            </span>

            {relevantFinding?.confidence !== undefined && (
              <span className="font-mono text-xs text-zinc-400">
                {formatConfidence(relevantFinding.confidence)}
              </span>
            )}
          </div>
        ) : (
          isTestingMode && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-mono text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
                Testing
              </span>
            </div>
          )
        )}
      </div>

      {/* Body: Claim Statement */}
      <h4 className="text-base sm:text-lg font-medium leading-relaxed text-zinc-950 mt-3">
        {claim.statement}
      </h4>

      {/* Real-World Consequence Summary */}
      {consequence?.recommended_change && !isExpanded && (
        <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">
          {consequence.recommended_change}
        </p>
      )}

      {/* Nested Active Test Rows during execution */}
      {relevantTests.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {relevantTests.map((t) => (
            <TestRow
              key={t.test_id}
              testId={t.test_id}
              failureMode={t.failure_mode}
              objective={t.objective}
              state={t.state}
              finding={t.finding}
            />
          ))}
        </div>
      )}

      {/* Footer Action Bar */}
      {claim.status && (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
          <span className="font-mono text-xs text-zinc-500">
            {consequence?.impact ? formatImpact(consequence.impact) : ""}
          </span>

          <button
            type="button"
            onClick={handleToggleExpand}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-700 hover:text-zinc-950 font-medium py-1 px-2 rounded-md hover:bg-zinc-100 transition-colors"
          >
            <span>{isExpanded ? "Hide Evidence & Sources" : "View Evidence & Sources"}</span>
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </button>
        </div>
      )}

      {/* INLINE EXPANDED DOSSIER CONTENT */}
      {isExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-5 space-y-5 border-t border-zinc-200 pt-5 text-left"
        >
          {/* 1. Why It Matters */}
          <div className="space-y-1">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Why It Matters
            </span>
            <p className="text-sm text-zinc-700 leading-relaxed">
              {claim.load_bearing
                ? "This assumption is load-bearing. If false, the fundamental unit economics and operational model collapse."
                : "This is a supporting assumption. If false, it introduces friction but does not necessarily invalidate the core strategy."}
            </p>
          </div>

          {/* 2. Tests Executed */}
          {tests.length > 0 && (
            <div className="space-y-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Tests Executed
              </span>
              <div className="flex flex-wrap gap-2">
                {tests.map((t) => (
                  <span
                    key={t.test_id}
                    className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-mono text-zinc-700"
                  >
                    [ {formatTestName(t.failure_mode).toUpperCase()} · COMPLETED ]
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Primary Source Citations */}
          <div className="space-y-2.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Primary Source Citations
            </span>

            {allEvidence.length > 0 ? (
              <div className="space-y-2.5">
                {allEvidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-2"
                  >
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline break-all"
                    >
                      <span>{ev.title || truncateUrl(ev.source_url, 45)}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>

                    <p className="text-xs text-zinc-700 leading-relaxed font-sans">
                      "{ev.snippet}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-zinc-200/60">
                      <span>{truncateUrl(ev.source_url, 35)}</span>
                      <span>
                        {ev.retrieved_at
                          ? new Date(ev.retrieved_at).toLocaleDateString()
                          : "Verified"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-xs text-zinc-500 italic leading-relaxed">
                No external web evidence could be retrieved for this claim. Evaluated using
                adversarial reasoning and structural feasibility analysis.
              </div>
            )}
          </div>

          {/* 4. Contradictions Surfaced */}
          {findings.some((f) => f.contradiction) && (
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-700">
                Contradictions Surfaced
              </span>
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed">
                <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <span>{findings.find((f) => f.contradiction)?.contradiction}</span>
              </div>
            </div>
          )}

          {/* 5. Recommended Strategic Adjustment */}
          {consequence?.recommended_change && (
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recommended Strategic Adjustment
              </span>
              <blockquote className="border-l-2 border-zinc-900 bg-zinc-50 rounded-r-md px-4 py-3 text-xs sm:text-sm text-zinc-900 font-medium leading-relaxed">
                "{consequence.recommended_change}"
              </blockquote>
            </div>
          )}

          {/* 6. Next Validation Step */}
          {consequence?.next_validation && (
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Next Validation Step
              </span>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-700 font-mono text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={13} />
                  <span>Smallest Real-World Experiment</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed">
                  {consequence.next_validation}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
