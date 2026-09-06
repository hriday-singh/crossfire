import React from "react";
import { ActiveTestRow, Claim, DecisionConsequence, Finding } from "@/types/crossfire";
import { formatConfidence, getVerdictConfig } from "@/lib/formatters";
import { IconAnchor, IconChevronRight } from "@/components/icons/KeylineIcons";
import { MorphingStatusIcon } from "@/components/icons/MorphingStatusIcon";
import { ImpactMeter } from "./ImpactMeter";
import { TestRow } from "./TestRow";
import { cn } from "@/lib/utils";

interface ClaimCardProps {
  claim: Claim;
  tests?: ActiveTestRow[];
  findings?: Finding[];
  consequence?: DecisionConsequence;
  onClick?: () => void;
  isTestingMode?: boolean;
  className?: string;
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
        "group relative flex flex-col gap-3.5 rounded-lg border border-border bg-card p-5 transition-all text-left outline-none",
        onClick && "cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/90 hover:shadow-md focus-visible:ring-1 focus-visible:ring-primary",
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0">
          {claim.load_bearing && (
            <span
              className="mt-0.5 shrink-0 text-zinc-300"
              title="Load-bearing assumption — if false, the entire plan fails"
            >
              <IconAnchor size={18} />
            </span>
          )}
          <h4 className="text-base font-medium leading-snug text-foreground">
            {claim.statement}
          </h4>
        </div>

        {/* Verdict Badge */}
        {claim.status ? (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono font-semibold",
                verdictConfig.badgeBg,
                verdictConfig.badgeText,
                verdictConfig.badgeBorder
              )}
            >
              <MorphingStatusIcon verdict={claim.status} size={14} />
              <span>{verdictConfig.label}</span>
            </span>

            {relevantFinding?.confidence !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatConfidence(relevantFinding.confidence)}
              </span>
            )}
          </div>
        ) : (
          isTestingMode && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-zinc-950 px-2 py-0.5 text-xs font-mono text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                Testing
              </span>
            </div>
          )
        )}
      </div>

      {/* Nested Test Rows (In Live Runner or Testing mode) */}
      {relevantTests.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
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

      {/* Sub-line Summary (Post-Verdict) */}
      {claim.status && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs">
          <div className="flex items-center gap-4">
            {consequence && (
              <ImpactMeter
                impact={consequence.impact}
                showLabel={true}
              />
            )}

            {consequence?.recommended_change && (
              <span className="text-muted-foreground line-clamp-1 max-w-md">
                "{consequence.recommended_change}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            <span>Audit Trail</span>
            <IconChevronRight size={14} />
          </div>
        </div>
      )}
    </div>
  );
};
