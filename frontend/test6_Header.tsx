// Backup of Header.tsx prior to debug views preview edits
import React from "react";
import { useCase } from "@/context/CaseContext";

export const Header: React.FC = () => {
  const { state, resetCase, navigateScreen, selectClaim, setActiveModal } = useCase();

  const handleNav = (path: "ingestion" | "claim-map" | "live-runner-verdicts" | "audit-sheet") => {
    if (path === "ingestion") {
      selectClaim(null);
      navigateScreen("entry");
    } else if (path === "claim-map") {
      if (!state.currentCase) return;
      selectClaim(null);
      navigateScreen("confirm");
    } else if (path === "live-runner-verdicts") {
      if (!state.currentCase) return;
      selectClaim(null);
      navigateScreen("dashboard");
    } else if (path === "audit-sheet") {
      if (!state.currentCase) return;
      const targetClaim =
        state.currentCase.claims.find((c) => c.status === "broken") ||
        state.currentCase.claims[0];
      if (targetClaim) {
        selectClaim(targetClaim.id);
      }
      navigateScreen("dashboard");
    }
  };

  const hasActiveCase = Boolean(state.currentCase);
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
        {/* Brand & Engine Model */}
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

          {/* Live Dynamic Model Badge */}
          <div
            className="hidden sm:flex items-center gap-space-2 px-space-2 py-0.5 border border-outline-variant rounded select-none font-code-sm text-code-sm bg-surface-container-low"
            title={`Backend LLM Provider: ${state.engineInfo?.provider || "connecting..."}`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                state.engineInfo ? "bg-verdict-survived" : "bg-outline animate-pulse"
              }`}
            />
            <span className="text-on-surface font-mono">
              {state.engineInfo ? state.engineInfo.model : "Connecting..."}
            </span>
          </div>

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
            disabled={!hasActiveCase}
            aria-current={isClaimMapActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full ${
              !hasActiveCase
                ? "text-outline/40 cursor-not-allowed opacity-50"
                : isClaimMapActive
                ? "text-on-surface border-b-2 border-primary-container font-medium cursor-pointer"
                : "text-on-surface-variant hover:text-on-surface cursor-pointer"
            }`}
          >
            02 Claim Map
          </button>

          <button
            type="button"
            onClick={() => handleNav("live-runner-verdicts")}
            data-path="live-runner-verdicts"
            disabled={!hasActiveCase}
            aria-current={isLiveRunnerActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full ${
              !hasActiveCase
                ? "text-outline/40 cursor-not-allowed opacity-50"
                : isLiveRunnerActive
                ? "text-on-surface border-b-2 border-primary-container font-medium cursor-pointer"
                : "text-on-surface-variant hover:text-on-surface cursor-pointer"
            }`}
          >
            03 Live Runner &amp; Verdicts
          </button>

          <button
            type="button"
            onClick={() => handleNav("audit-sheet")}
            data-path="audit-sheet"
            disabled={!hasActiveCase}
            aria-current={isAuditSheetActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full ${
              !hasActiveCase
                ? "text-outline/40 cursor-not-allowed opacity-50"
                : isAuditSheetActive
                ? "text-on-surface border-b-2 border-primary-container font-medium cursor-pointer"
                : "text-on-surface-variant hover:text-on-surface cursor-pointer"
            }`}
          >
            04 Audit Sheet
          </button>
        </nav>

        {/* Right Tools */}
        <div className="flex items-center gap-space-3">
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

          {/* Frequently Asked Questions */}
          <button
            type="button"
            onClick={() => setActiveModal("faq")}
            aria-label="View frequently asked questions"
            title="FAQ & Decision Testing Guide"
            className="text-outline hover:text-on-surface transition-colors flex items-center justify-center p-2 rounded hover:bg-surface-container cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
          </button>

          {/* Case History */}
          <button
            type="button"
            onClick={() => setActiveModal("history")}
            aria-label="View case history"
            title="Case History"
            className="text-outline hover:text-on-surface transition-colors flex items-center justify-center p-2 rounded hover:bg-surface-container cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
          </button>

          {/* Dedicated Settings */}
          <button
            type="button"
            onClick={() => setActiveModal("settings")}
            aria-label="View settings"
            title="Settings"
            className="text-outline hover:text-on-surface transition-colors flex items-center justify-center p-2 rounded hover:bg-surface-container cursor-pointer min-h-[36px] min-w-[36px]"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
