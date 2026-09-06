import React from "react";
import { Finding, TestExecutionState } from "@/types/crossfire";
import { formatConfidence, formatTestName } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Circle, CircleCheck, Loader2 } from "lucide-react";

interface TestRowProps {
  testId: string;
  failureMode: string;
  objective?: string;
  state: TestExecutionState;
  finding?: Finding;
  className?: string;
}

export const TestRow: React.FC<TestRowProps> = ({
  failureMode,
  state,
  finding,
  className = "",
}) => {
  const testLabel = formatTestName(failureMode);
  const isRunning = state === "running";
  const isCompleted = state === "completed" || !!finding;

  return (
    <div
      className={cn(
        "group flex flex-col gap-1.5 rounded-md border border-border/40 bg-zinc-950/60 p-3 transition-colors",
        isRunning && "border-indigo-500/40 bg-indigo-950/20",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isRunning ? (
            <Loader2 size={15} className="animate-spin text-indigo-400 shrink-0" />
          ) : isCompleted ? (
            <CircleCheck size={15} className="text-zinc-400 shrink-0" />
          ) : (
            <Circle size={15} className="text-zinc-600 shrink-0 stroke-dashed" />
          )}
          <span className="font-mono text-xs font-semibold tracking-wider text-zinc-300 uppercase">
            {testLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {finding?.confidence !== undefined && (
            <span className="font-mono text-xs text-zinc-400">
              conf: {formatConfidence(finding.confidence)}
            </span>
          )}

          <span
            className={cn(
              "font-mono text-xs",
              isRunning
                ? "text-indigo-400 animate-pulse"
                : isCompleted
                ? "text-zinc-400"
                : "text-zinc-500"
            )}
          >
            {isRunning ? "Running..." : isCompleted ? "Completed" : "Queued"}
          </span>
        </div>
      </div>

      {finding && (
        <div className="mt-1 flex flex-col gap-1 border-t border-border/30 pt-2 text-xs">
          <div className="font-medium text-zinc-200">
            {finding.result}
          </div>
          {finding.reasoning && (
            <div className="text-muted-foreground line-clamp-2 leading-relaxed">
              {finding.reasoning}
            </div>
          )}
          {finding.evidence && finding.evidence.length > 0 && (
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
              <span>{finding.evidence.length} source{finding.evidence.length > 1 ? "s" : ""} verified</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
