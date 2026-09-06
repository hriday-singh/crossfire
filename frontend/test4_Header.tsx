import React from "react";
import { useCase } from "@/context/CaseContext";
import { DEFAULT_COLLEGE_AI_CASE } from "@/lib/presets";

export const Header: React.FC = () => {
  const { state, dispatch, resetCase, navigateScreen, selectClaim, setActiveModal } = useCase();

  const isRunnerActive =
    state.isStreaming ||
    state.currentCase?.status === "testing" ||
    state.isExtracting ||
    state.isConfirming;

  const handleNav = (path: "ingestion" | "claim-map" | "live-runner-verdicts" | "audit-sheet") => {
    if (path === "ingestion") {
      selectClaim(null);
      navigateScreen("entry");
    } else if (path === "claim-map") {
      if (!state.currentCase) {
        dispatch({ type: "LOAD_CASE", payload: DEFAULT_COLLEGE_AI_CASE });
      }
      selectClaim(null);
      navigateScreen("confirm");
    } else if (path === "live-runner-verdicts") {
      if (!state.currentCase) {
        dispatch({ type: "LOAD_CASE", payload: DEFAULT_COLLEGE_AI_CASE });
      }
      selectClaim(null);
      navigateScreen("dashboard");
    } else if (path === "audit-sheet") {
      if (!state.currentCase) {
        dispatch({ type: "LOAD_CASE", payload: DEFAULT_COLLEGE_AI_CASE });
      }
      // Select broken target claim or first claim
      const targetClaim =
        state.currentCase?.claims.find((c) => c.status === "broken") ||
        state.currentCase?.claims[0] ||
        DEFAULT_COLLEGE_AI_CASE.claims[1];
      selectClaim(targetClaim.id);
      navigateScreen("dashboard");
    }
  };

  const isIngestionActive = state.activeScreen === "entry";
  const isClaimMapActive = state.activeScreen === "confirm";
  const isLiveRunnerActive =
    (state.activeScreen === "runner" || state.activeScreen === "dashboard") &&
    !state.selectedClaimId;
  const isAuditSheetActive = Boolean(state.selectedClaimId);

  // Current stage label for mobile
  const currentStageLabel = isIngestionActive
    ? "01 Ingestion"
    : isClaimMapActive
    ? "02 Claim Map"
    : isAuditSheetActive
    ? "04 Audit Sheet"
    : "03 Verdicts";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b border-outline-variant">
      <div className="h-14 w-full px-space-6 flex items-center justify-between max-w-6xl mx-auto">
        {/* Brand & Engine Version */}
        <div className="flex items-center gap-space-3">
          <button
            type="button"
            onClick={resetCase}
            aria-label="Crossfire / decision testing"
            className="flex items-center gap-space-2 text-left focus:outline-none group cursor-pointer"
          >
            <span className="font-code-lg text-code-lg tracking-widest uppercase font-semibold text-on-surface group-hover:text-primary transition-colors">
              Crossfire
            </span>
            <span className="sr-only">/ decision testing</span>
          </button>
          <span className="font-code-sm text-code-sm text-outline px-space-2 py-0.5 border border-outline-variant rounded select-none hidden sm:inline-block">
            v1.4-engine
          </span>

          {/* Compact Mobile Current Stage Pill */}
          <span className="lg:hidden font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-primary-container font-medium">
            {currentStageLabel}
          </span>
        </div>

        {/* Center Nav Pipeline */}
        <nav
          className="hidden lg:flex items-center gap-space-6 h-full font-code-sm text-code-sm"
          data-active-classes="text-on-surface border-b-2 border-primary-container font-medium"
        >
          <button
            type="button"
            onClick={() => handleNav("ingestion")}
            data-path="ingestion"
            aria-current={isIngestionActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full cursor-pointer ${
              isIngestionActive
                ? "text-on-surface border-b-2 border-primary-container font-medium"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            01 Ingestion
          </button>

          <button
            type="button"
            onClick={() => handleNav("claim-map")}
            data-path="claim-map"
            aria-current={isClaimMapActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full cursor-pointer ${
              isClaimMapActive
                ? "text-on-surface border-b-2 border-primary-container font-medium"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            02 Claim Map
          </button>

          <button
            type="button"
            onClick={() => handleNav("live-runner-verdicts")}
            data-path="live-runner-verdicts"
            aria-current={isLiveRunnerActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full cursor-pointer ${
              isLiveRunnerActive
                ? "text-on-surface border-b-2 border-primary-container font-medium"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            03 Live Runner &amp; Verdicts
          </button>

          <button
            type="button"
            onClick={() => handleNav("audit-sheet")}
            data-path="audit-sheet"
            aria-current={isAuditSheetActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full cursor-pointer ${
              isAuditSheetActive
                ? "text-on-surface border-b-2 border-primary-container font-medium"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            04 Audit Sheet
          </button>
        </nav>

        {/* Right Tools & Profile */}
        <div className="flex items-center gap-space-3">
          {/* Truthful Status Indicator */}
          <div className="flex items-center gap-space-2 px-space-2.5 py-1 bg-surface-container-low border border-outline-variant rounded select-none">
            <span
              className={`inline-block rounded-full h-2 w-2 ${
                isRunnerActive ? "bg-primary-container" : "bg-verdict-survived"
              }`}
            />
            <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface">
              {isRunnerActive ? "RUNNER ACTIVE" : "RUNNER READY"}
            </span>
          </div>

          {/* Live Pipeline Telemetry Toggle */}
          <button
            type="button"
            onClick={() => setActiveModal("logs")}
            aria-label="View live pipeline telemetry and logs"
            title="Terminal & Logs"
            className="text-outline hover:text-on-surface transition-colors flex items-center justify-center p-2 rounded hover:bg-surface-container relative cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            {state.eventLog.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary-container" />
            )}
          </button>

          {/* Case History & Settings */}
          <button
            type="button"
            onClick={() => setActiveModal("history")}
            aria-label="View case history and settings"
            title="Settings & History"
            className="text-outline hover:text-on-surface transition-colors flex items-center justify-center p-2 rounded hover:bg-surface-container cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>

          {/* Self-contained Executive Avatar */}
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-xs font-semibold text-on-surface select-none shadow-xs"
            title="Executive Operator"
            aria-label="Executive Operator Profile"
          >
            CF
          </div>
        </div>
      </div>
    </header>
  );
};
