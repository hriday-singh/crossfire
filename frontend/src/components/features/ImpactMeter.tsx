import React from "react";
import { formatImpactLabel, getImpactScore } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface ImpactMeterProps {
  impact?: string | null;
  score?: number;
  showLabel?: boolean;
  className?: string;
}

export const ImpactMeter: React.FC<ImpactMeterProps> = ({
  impact,
  score,
  showLabel = true,
  className = "",
}) => {
  const currentScore = score !== undefined ? score : getImpactScore(impact);

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <div
        className="flex items-center gap-1"
        title={formatImpactLabel(currentScore)}
      >
        <span
          className={cn(
            "h-1.5 w-3.5 rounded-xs transition-colors",
            currentScore >= 1 ? "bg-zinc-200" : "bg-zinc-800"
          )}
        />
        <span
          className={cn(
            "h-1.5 w-3.5 rounded-xs transition-colors",
            currentScore >= 2 ? "bg-zinc-200" : "bg-zinc-800"
          )}
        />
        <span
          className={cn(
            "h-1.5 w-3.5 rounded-xs transition-colors",
            currentScore >= 3 ? "bg-zinc-200" : "bg-zinc-800"
          )}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs text-zinc-400">
          {formatImpactLabel(currentScore)}
        </span>
      )}
    </div>
  );
};
