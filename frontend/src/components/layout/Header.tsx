import React from "react";
import { useCase } from "@/context/CaseContext";
import { DEFAULT_COLLEGE_AI_CASE } from "@/lib/presets";

export const Header: React.FC = () => {
  const { state, dispatch, resetCase, navigateScreen, selectClaim } = useCase();

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b border-outline-variant">
      <div className="h-14 w-full px-space-6 flex items-center justify-between max-w-6xl mx-auto">
        {/* Brand & Engine Version */}
        <div className="flex items-center gap-space-3">
          <button
            type="button"
            onClick={resetCase}
            className="flex items-center gap-space-2 text-left focus:outline-none group"
          >
            <span className="font-code-lg text-code-lg tracking-widest uppercase font-semibold text-on-surface group-hover:text-primary transition-colors">
              Crossfire
            </span>
            <span className="sr-only">/ decision testing</span>
          </button>
          <span className="font-code-sm text-code-sm text-outline px-space-2 py-0.5 border border-outline-variant rounded select-none">
            v1.4-engine
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
            className={`transition-colors flex items-center h-full ${
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
            className={`transition-colors flex items-center h-full ${
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
            className={`transition-colors flex items-center h-full ${
              isLiveRunnerActive
                ? "text-on-surface border-b-2 border-primary-container font-medium"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            03 Live Runner & Verdicts
          </button>

          <button
            type="button"
            onClick={() => handleNav("audit-sheet")}
            data-path="audit-sheet"
            aria-current={isAuditSheetActive ? "page" : undefined}
            className={`transition-colors flex items-center h-full ${
              isAuditSheetActive
                ? "text-on-surface border-b-2 border-primary-container font-medium"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            04 Audit Sheet
          </button>
        </nav>

        {/* Right Tools & Profile */}
        <div className="flex items-center gap-space-4">
          <div className="flex items-center gap-space-2 px-space-2 py-1 bg-surface-container-low border border-outline-variant rounded">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container"></span>
            </span>
            <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface">
              {isRunnerActive ? "RUNNER ACTIVE" : "RUNNER READY"}
            </span>
          </div>

          <button
            type="button"
            className="text-outline hover:text-on-surface transition-colors flex items-center p-space-1 rounded hover:bg-surface-container"
            title="Terminal & Logs"
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
          </button>

          <button
            type="button"
            className="text-outline hover:text-on-surface transition-colors flex items-center p-space-1 rounded hover:bg-surface-container"
            title="Settings"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>

          <img
            alt="Profile"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-outline-variant"
            src="https://lh3.googleusercontent.com/aida/AEtjO1VkXSrQpw5M0xl8nFNHXNETQxEaabYojzIUEfIkxRtXbb7j73IUgu8jjq6TpxNrUO80E_YRGgRh0KxZ7sX6ZfPx_nT-3GIIDA8vNnMeKxcEP7HgJOALbZypuoBzeTCkqdY6hwrVwp7Sf7QuDnmUuL5xHDCNLJBaM-XceAzkY6p_ekPppeLvd72akqzuS87KoaNVBSNUQuW2cheLk7I3kCOpJooGGWH_JnNyd6WYymnjJ2wrINT28kI4wOM"
          />
        </div>
      </div>
    </header>
  );
};
