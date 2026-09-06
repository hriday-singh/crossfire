import React from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DECISION_PRESETS } from "@/lib/presets";
import { Case } from "@/types/crossfire";

export const HistoryModal: React.FC = () => {
  const { state, dispatch, setActiveModal, startExtracting, navigateScreen } = useCase();
  const isOpen = state.activeModal === "history";

  const handleSelectCase = (caseItem: Case) => {
    dispatch({ type: "LOAD_CASE", payload: caseItem });
    navigateScreen("dashboard");
    setActiveModal("none");
  };

  const handleClearHistory = () => {
    if (confirm("Clear all locally stored case history?")) {
      try {
        localStorage.removeItem("crossfire_case_history");
      } catch {
        // ignore
      }
      dispatch({ type: "CLEAR_HISTORY" });
      setActiveModal("none");
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    dispatch({ type: "DELETE_HISTORY_ITEM", payload: caseId });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[540px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-space-2">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              history
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-normal">
              Case History
            </h2>
            <span className="font-code-sm text-code-sm text-outline px-space-1.5 py-0.5 rounded border border-outline-variant">
              {state.caseHistory.length} saved
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal("none")}
            aria-label="Close history modal"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* System Status Banner */}
        <div className="px-space-6 py-space-3 bg-surface-container border-b border-outline-variant/60 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-verdict-survived" />
            <span className="text-on-surface">API Target:</span>
            <span className="text-outline">/cases (Live Engine)</span>
          </div>
          {state.caseHistory.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-error hover:underline cursor-pointer"
            >
              Clear history
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-space-6 space-y-space-6">
          {/* Prior Case Runs */}
          <div>
            <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline mb-space-3 font-semibold">
              Recent Decision Runs
            </h3>

            {state.caseHistory.length === 0 ? (
              <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-space-6 text-center text-outline">
                <span className="material-symbols-outlined text-[28px] mb-2 text-outline">
                  history_toggle_off
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant font-medium">
                  No prior cases saved in local storage.
                </p>
                <p className="font-code-sm text-code-sm text-outline mt-1">
                  Completed decision tests automatically archive here.
                </p>
              </div>
            ) : (
              <div className="space-y-space-3">
                {state.caseHistory.map((item) => {
                  const brokenCount = item.claims.filter((c) => c.status === "broken").length;
                  const survivedCount = item.claims.filter((c) => c.status === "survived").length;
                  const weakenedCount = item.claims.filter((c) => c.status === "weakened").length;
                  const isCurrent = state.currentCase?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`bg-surface-container border rounded-xl p-space-4 transition-all hover:border-outline-variant ${
                        isCurrent
                          ? "border-primary-container/60 bg-surface-container-high"
                          : "border-outline-variant/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-code-sm text-code-sm text-primary-container font-semibold">
                              #{item.id.slice(0, 8).toUpperCase()}
                            </span>
                            {isCurrent && (
                              <span className="font-code-sm text-code-sm px-1.5 py-0.2 rounded bg-primary-container/20 text-primary-container font-medium">
                                Active Case
                              </span>
                            )}
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface font-medium line-clamp-2">
                            {item.raw_input}
                          </p>
                          <div className="flex items-center gap-2 pt-1 font-code-sm text-code-sm text-outline flex-wrap">
                            <span>{item.claims.length} claims</span>
                            <span>·</span>
                            <span className="text-verdict-broken">{brokenCount} broken</span>
                            <span>·</span>
                            <span className="text-tertiary">{weakenedCount} weakened</span>
                            <span>·</span>
                            <span className="text-verdict-survived">{survivedCount} survived</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(e, item.id)}
                            aria-label={`Delete run ${item.id}`}
                            className="text-outline hover:text-error p-1.5 rounded hover:bg-surface-container-highest transition-colors cursor-pointer"
                            title="Delete from history"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectCase(item)}
                            className="font-code-sm text-code-sm px-space-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:brightness-110 transition-all font-semibold shrink-0 cursor-pointer"
                          >
                            View Memo
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick-Load Sample Presets */}
          <div>
            <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline mb-space-3 font-semibold">
              Example Decision Models
            </h3>
            <div className="space-y-space-2">
              {DECISION_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-space-3 flex items-center justify-between gap-space-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-code-sm text-code-sm text-outline uppercase block">
                      {preset.category}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface font-medium truncate block">
                      {preset.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      startExtracting(preset.rawInput, preset.contextHint);
                      setActiveModal("none");
                    }}
                    className="font-code-sm text-code-sm text-primary hover:underline shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <span>Test this</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
