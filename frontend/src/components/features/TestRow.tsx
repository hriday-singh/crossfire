import React from "react";
import { Finding, TestExecutionState } from "@/types/crossfire";
import { formatConfidence, formatTestName } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Circle, CircleCheck, Loader2 } from "lucide-react";
import { SerpApiText } from "@/components/ui/serpapi";

interface TestRowProps {
  testId: string;
  failureMode: string;
  objective?: string;
  state: TestExecutionState;
  finding?: Finding;
  activeActivity?: string;
  className?: string;
}

export const TestRow: React.FC<TestRowProps> = ({
  failureMode,
  state,
  finding,
  activeActivity,
  className = "",
}) => {
  const testLabel = formatTestName(failureMode);
  const isRunning = state === "running";
  const isCompleted = state === "completed" || !!finding;

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-high p-3.5 transition-colors",
        isRunning && "border-primary-container/40 bg-primary-container/10",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isRunning ? (
            <Loader2 size={15} className="animate-spin text-primary-container shrink-0" />
          ) : isCompleted ? (
            <CircleCheck size={15} className="text-verdict-survived shrink-0" />
          ) : (
            <Circle size={15} className="text-outline shrink-0 stroke-dashed" />
          )}
          <span className="font-mono text-xs font-semibold tracking-wider text-on-surface uppercase">
            {testLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {finding?.confidence !== undefined && (
            <span className="font-mono text-xs text-on-surface-variant">
              conf: {formatConfidence(finding.confidence)}
            </span>
          )}

          <span
            className={cn(
              "font-mono text-xs",
              isRunning
                ? "text-primary-container font-medium animate-pulse"
                : isCompleted
                ? "text-on-surface-variant font-medium"
                : "text-outline"
            )}
          >
            {isRunning ? "Running..." : isCompleted ? "Completed" : "Queued"}
          </span>
        </div>
      </div>

      {isRunning && activeActivity && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-primary-container font-mono bg-primary-container/10 px-2.5 py-1 rounded border border-primary-container/20">
          <span className="material-symbols-outlined text-[13px] animate-spin shrink-0">
            progress_activity
          </span>
          <span className="truncate">
            <SerpApiText text={activeActivity} />
          </span>
        </div>
      )}

      {finding && (
        <div className="mt-1 flex flex-col gap-1 border-t border-outline-variant pt-2.5 text-xs">
          <div className="font-medium text-on-surface">
            <SerpApiText text={finding.result} />
          </div>
          {finding.reasoning && (
            <div className="text-on-surface-variant line-clamp-2 leading-relaxed">
              <SerpApiText text={finding.reasoning} />
            </div>
          )}
          {finding.evidence && finding.evidence.length > 0 && (
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-outline font-mono">
              <span>{finding.evidence.length} source{finding.evidence.length > 1 ? "s" : ""} verified</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
