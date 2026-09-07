import React from "react";
import { useCase } from "@/context/CaseContext";
import { formatModelName, formatProviderName } from "@/lib/models";

export const Header: React.FC = () => {
  const { state, resetCase, navigateScreen, selectClaim, setActiveModal, enterPreview, exitPreview } = useCase();

  const handleNav = (path: "ingestion" | "claim-map" | "live-runner-verdicts") => {
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
      navigateScreen("runner");
    }
  };

  const hasActiveCase = Boolean(state.currentCase);
  const isIngestionActive = state.activeScreen === "entry";
  const isClaimMapActive = state.activeScreen === "confirm";
  const isLiveRunnerActive =
    (state.activeScreen === "runner" || state.activeScreen === "dashboard") &&
    !state.selectedClaimId;

  // Current stage label for mobile
  const currentStageLabel = isIngestionActive
    ? "01 Ingestion"
    : isClaimMapActive
    ? "02 Claim Map"
    : "03 Live Runner";

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
          <button
            type="button"
            onClick={() => setActiveModal("settings")}
            className="flex items-center gap-2 h-8 px-2.5 border border-outline-variant hover:border-primary-container/60 rounded-md select-none font-code-sm text-xs bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer max-w-[210px]"
            title={`Active Engine: ${formatModelName(state.engineInfo?.model)} (${formatProviderName(state.engineInfo?.provider)}) · Click to open Settings`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                state.engineInfo ? "bg-verdict-survived shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-outline animate-pulse"
              }`}
            />
            <span className="text-on-surface font-medium truncate flex items-center gap-1.5">
              <span className="truncate">
                {formatModelName(state.engineInfo?.model)}
              </span>
            </span>
          </button>

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
            disabled={!hasActiveCase || state.currentCase?.status === "extracting"}
            aria-current={isClaimMapActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full ${
              !hasActiveCase || state.currentCase?.status === "extracting"
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
            disabled={!hasActiveCase || (state.currentCase?.status !== "testing" && state.currentCase?.status !== "done")}
            aria-current={isLiveRunnerActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full ${
              !hasActiveCase || (state.currentCase?.status !== "testing" && state.currentCase?.status !== "done")
                ? "text-outline/40 cursor-not-allowed opacity-50"
                : isLiveRunnerActive
                ? "text-on-surface border-b-2 border-primary-container font-medium cursor-pointer"
                : "text-on-surface-variant hover:text-on-surface cursor-pointer"
            }`}
          >
            03 Live Runner
          </button>
        </nav>

        {/* Right Tools */}
        <div className="flex items-center gap-space-3">
          {/* Debug Views Preview Button (Only visible when debug is ON) */}
          {state.isDebugMode && (
            <button
              type="button"
              onClick={() => {
                if (state.previewView) {
                  exitPreview();
                } else {
                  enterPreview("dashboard");
                }
              }}
              data-testid="debug-views-btn"
              aria-label={state.previewView ? "Close debug views preview" : "Open debug views preview"}
              title="Debug: Preview All Views (Hardcoded / 0 Backend Calls)"
              className={`font-code-sm text-code-sm px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                state.previewView
                  ? "bg-primary-container text-on-primary-container border-primary font-semibold shadow-xs"
                  : "bg-surface-container text-primary-container border-outline-variant hover:bg-surface-container-high hover:border-primary-container"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span className="hidden sm:inline font-medium">Views Preview</span>
            </button>
          )}

          {/* Start over - the logo also resets, but nobody finds that */}
          {state.currentCase && (
            <button
              type="button"
              onClick={resetCase}
              data-testid="new-case-btn"
              aria-label="Start a new case"
              title="Start a new case"
              className="font-code-sm text-code-sm px-2.5 py-1 rounded border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high hover:border-primary-container transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span className="hidden sm:inline font-medium">New case</span>
            </button>
          )}

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
