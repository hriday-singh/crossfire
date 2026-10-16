import React, { useEffect, useState } from "react";

/**
 * Fills the gap between "run accepted" and the first agent moving on the stage.
 * The backend spends that time ranking load-bearing claims (an LLM call that can
 * take a minute with thinking on), so the bullpen would otherwise sit frozen.
 */
export function shouldShowRunStartup({
  isRealRun,
  isTesting,
  isReplaying,
  findingsCount,
  activeTestCount,
}: {
  isRealRun: boolean;
  isTesting: boolean;
  isReplaying: boolean;
  findingsCount: number;
  activeTestCount: number;
}): boolean {
  return isRealRun && isTesting && !isReplaying && findingsCount === 0 && activeTestCount === 0;
}

const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

interface RunStartupOverlayProps {
  visible: boolean;
  /** Latest backend activity line, e.g. "Classifying load-bearing assumptions...". */
  message?: string | null;
}

export const RunStartupOverlay: React.FC<RunStartupOverlayProps> = ({ visible, message }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="run-startup-overlay"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-space-4 animate-in fade-in duration-300"
    >
      <div className="w-full max-w-xs rounded-xl border border-outline-variant bg-surface/90 backdrop-blur-sm shadow-sm px-space-4 py-space-3 space-y-1">
        <div className="flex items-center gap-2 text-primary-container">
          <span className="material-symbols-outlined text-[16px] animate-spin" aria-hidden>
            progress_activity
          </span>
          <span className="font-label-mono text-label-mono uppercase tracking-wider font-semibold">
            Starting up
          </span>
          <span className="ml-auto font-mono text-xs text-outline tabular-nums" aria-label="Elapsed time">
            {formatElapsed(elapsed)}
          </span>
        </div>
        <p className="font-body-sm text-sm text-on-surface-variant leading-relaxed">
          {message?.trim() || "Run accepted. Getting the panel ready..."}
        </p>
      </div>
    </div>
  );
};

export default RunStartupOverlay;
