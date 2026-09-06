// Backup of SettingsModal.tsx prior to debug mode toggle additions
import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const SettingsModal: React.FC = () => {
  const { state, dispatch, setActiveModal, resetCase } = useCase();
  const isOpen = state.activeModal === "settings";
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);

  const handleClearHistory = () => {
    if (confirm("Clear all locally stored decision cases?")) {
      try {
        localStorage.removeItem("crossfire_case_history");
      } catch {
        // ignore
      }
      dispatch({ type: "CLEAR_HISTORY" });
      setClearedNotice("History cleared successfully.");
      setTimeout(() => setClearedNotice(null), 3000);
    }
  };

  const handleResetCurrent = () => {
    resetCase();
    setActiveModal("none");
  };

  const evaluators = [
    {
      id: "devils_advocate",
      name: "Assumption Test (Devil's Advocate)",
      description: "Applies adversarial pressure to unearth unstated assumptions and logical contradictions.",
      icon: "psychology",
      active: true,
    },
    {
      id: "receipts",
      name: "Evidence Test (Receipts Search)",
      description: "Retrieves verifiable market signals, web sources, and public citations via search APIs.",
      icon: "fact_check",
      active: true,
    },
    {
      id: "builder",
      name: "Feasibility Test (Builder)",
      description: "Simulates engineering bottlenecks, API constraints, and architectural feasibility limits.",
      icon: "construction",
      active: true,
    },
    {
      id: "overthinker",
      name: "Edge-Case Test (Overthinker)",
      description: "Explores worst-case user behaviors, boundary failures, and second-order consequences.",
      icon: "crisis_alert",
      active: true,
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[560px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-space-2.5">
            <span className="material-symbols-outlined text-primary-container text-[22px]">
              settings
            </span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-normal">
                System Settings
              </h2>
              <p className="font-code-sm text-code-sm text-outline mt-0.5">
                Runtime configuration, active models &amp; evaluators
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal("none")}
            aria-label="Close settings modal"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-space-6 space-y-space-6">
          {clearedNotice && (
            <div className="bg-primary-container/20 border border-primary-container/40 text-primary-container px-space-4 py-space-2 rounded text-body-sm">
              {clearedNotice}
            </div>
          )}

          {/* Active LLM Provider & Model Section */}
          <div className="space-y-space-3">
            <div className="flex items-center justify-between">
              <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
                Active LLM Provider &amp; Model
              </h3>
              <span className="flex items-center gap-1.5 font-code-sm text-code-sm text-verdict-survived">
                <span className="w-2 h-2 rounded-full bg-verdict-survived inline-block" />
                <span>Online</span>
              </span>
            </div>

            <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-space-4 space-y-space-3">
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">Active Model:</span>
                <span className="font-mono font-semibold text-primary-container">
                  {state.engineInfo?.model || "gemini-3.7-flash"}
                </span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">Provider Protocol:</span>
                <span className="font-mono text-on-surface">
                  {state.engineInfo?.provider || "openai_compat"}
                </span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">Backend Endpoint:</span>
                <span className="font-mono text-outline">http://localhost:8000</span>
              </div>
            </div>
          </div>

          {/* Adversarial Evaluator Suite */}
          <div className="space-y-space-3">
            <div className="flex items-center justify-between">
              <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
                Adversarial Evaluator Suite
              </h3>
              <span className="font-code-sm text-code-sm text-outline">
                {evaluators.length} active
              </span>
            </div>

            <div className="space-y-space-2.5">
              {evaluators.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-surface-container border border-outline-variant/50 rounded-xl p-space-4 flex items-start gap-space-3"
                >
                  <span className="material-symbols-outlined text-[20px] text-primary-container mt-0.5 shrink-0">
                    {ev.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-medium text-xs">
                        {ev.name}
                      </span>
                      <span className="font-code-sm text-code-sm text-verdict-survived font-semibold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Local Data & Storage */}
          <div className="space-y-space-3">
            <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
              Data &amp; Memory Management
            </h3>

            <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-space-4 space-y-space-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-medium">
                    Locally Stored Runs
                  </p>
                  <p className="font-code-sm text-code-sm text-outline">
                    {state.caseHistory.length} decision memos saved in browser storage
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={state.caseHistory.length === 0}
                  className="font-code-sm text-code-sm px-space-3 py-1.5 rounded border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Clear History
                </button>
              </div>

              <div className="border-t border-outline-variant/40 pt-space-3 flex items-center justify-between">
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-medium">
                    Reset Current Canvas
                  </p>
                  <p className="font-code-sm text-code-sm text-outline">
                    Clears the active decision proposal canvas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetCurrent}
                  className="font-code-sm text-code-sm px-space-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors cursor-pointer"
                >
                  Reset Canvas
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
