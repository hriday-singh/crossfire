import React from "react";
import { ActiveTestRow, Claim, DecisionConsequence, Finding } from "@/types/crossfire";
import { formatConfidence, formatImpact, getVerdictConfig } from "@/lib/formatters";
import { TestRow } from "./TestRow";
import { cn } from "@/lib/utils";
import { Anchor, ChevronRight, CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react";

interface ClaimCardProps {
  claim: Claim;
  tests?: ActiveTestRow[];
  findings?: Finding[];
  consequence?: DecisionConsequence;
  onClick?: () => void;
  isTestingMode?: boolean;
  className?: string;
}

function renderVerdictIcon(status: Claim["status"], size = 13) {
  switch (status) {
    case "survived":
      return <CircleCheck size={size} className="text-emerald-400 shrink-0" />;
    case "weakened":
      return <TriangleAlert size={size} className="text-amber-400 shrink-0" />;
    case "broken":
      return <CircleX size={size} className="text-rose-400 shrink-0" />;
    case "unresolved":
      return <CircleHelp size={size} className="text-indigo-400 shrink-0" />;
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
  className = "",
}) => {
  const verdictConfig = getVerdictConfig(claim.status);
  const relevantFinding = findings.find((f) => f.claim_id === claim.id);
  const relevantTests = tests.filter((t) => t.target_claim === claim.id);

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors text-left outline-none",
        onClick && "cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/80 focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
    >
      {/* Top Row: Load-bearing pill + Verdict Badge */}
      <div className="flex items-center justify-between gap-4">
        <div>
          {claim.load_bearing ? (
            <span
              title="Load-bearing assumption — if false, the entire plan fails"
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-0.5 text-xs font-mono"
            >
              <Anchor size={12} className="text-zinc-400 shrink-0" />
              Core foundation
            </span>
          ) : (
            <span className="text-xs font-mono text-zinc-500">
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
              <span className="font-mono text-xs text-zinc-500">
                {formatConfidence(relevantFinding.confidence)}
              </span>
            )}
          </div>
        ) : (
          isTestingMode && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-0.5 text-xs font-mono text-indigo-400">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Testing
              </span>
            </div>
          )
        )}
      </div>

      {/* Body: Claim Statement */}
      <h4 className="text-lg font-medium leading-relaxed text-zinc-100 mt-1">
        {claim.statement}
      </h4>

      {/* Real-World Consequence */}
      {consequence?.recommended_change && (
        <p className="text-sm text-zinc-400 leading-relaxed">
          {consequence.recommended_change}
        </p>
      )}

      {/* Nested Active Test Rows during execution */}
      {relevantTests.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
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

      {/* Footer Action */}
      {claim.status && (
        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-3 text-xs">
          <span className="font-mono text-xs text-zinc-500">
            {consequence?.impact ? formatImpact(consequence.impact) : ""}
          </span>

          <span className="flex items-center gap-1 font-mono text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">
            <span>View Evidence & Sources</span>
            <ChevronRight size={13} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      )}
    </div>
  );
};
