import React from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Case } from "@/types/crossfire";
import { getCase, deleteCase, clearCases } from "@/lib/api";

export const HistoryModal: React.FC = () => {
  const { state, dispatch, setActiveModal, navigateScreen } = useCase();
  const isOpen = state.activeModal === "history";

  const handleSelectCase = (caseItem: Case) => {
    dispatch({ type: "LOAD_CASE", payload: caseItem });
    navigateScreen("dashboard");
    setActiveModal("none");
    // Entries archived before the verdict landed (or by an older build) have no
    // case_verdict - pull the backend copy so the memo isn't missing its call.
    if (!caseItem.case_verdict && caseItem.status === "done") {
      getCase(caseItem.id)
        .then((full) => dispatch({ type: "UPDATE_CASE", payload: full }))
        .catch(() => {
          /* case no longer on the backend - keep the local copy */
        });
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Clear all locally stored case history?")) {
      try {
        await clearCases();
      } catch (err) {
        console.error("Failed to clear cases:", err);
      }
      dispatch({ type: "CLEAR_HISTORY" });
      setActiveModal("none");
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation();
    try {
      await deleteCase(caseId);
    } catch (err) {
      console.error("Failed to delete case:", err);
    }
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

          <div className="flex items-center gap-1">
            {state.caseHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                aria-label="Clear history"
                title="Clear history"
                className="text-on-surface-variant hover:text-error transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              aria-label="Close history modal"
              className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-space-6 space-y-space-4 scrollbar-visible">
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
                    tabIndex={0}
                    onClick={() => handleSelectCase(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectCase(item);
                      }
                    }}
                    aria-label={`Case: ${item.raw_input}`}
                    className={`bg-surface-container border rounded-xl p-space-4 transition-all cursor-pointer hover:border-outline-variant hover:bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary-container ${
                      isCurrent
                        ? "border-primary-container/60 bg-surface-container-high"
                        : "border-outline-variant/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        {isCurrent && (
                          <div className="flex items-center gap-2">
                            <span className="font-code-sm text-code-sm px-1.5 py-0.2 rounded bg-primary-container/20 text-primary-container font-medium">
                              Active Case
                            </span>
                          </div>
                        )}
                        <p className="font-body-sm text-body-sm text-on-surface font-medium line-clamp-2">
                          {item.raw_input}
                        </p>
                        <div className="flex items-center gap-2 pt-1 font-code-sm text-code-sm text-outline flex-wrap">
                          <span>
                            {item.claims.length} {item.claims.length === 1 ? "claim" : "claims"}
                          </span>
                          {brokenCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-verdict-broken">{brokenCount} broken</span>
                            </>
                          )}
                          {weakenedCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-tertiary">{weakenedCount} weakened</span>
                            </>
                          )}
                          {survivedCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-verdict-survived">{survivedCount} survived</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions: View Memo on left, Small Dustbin on right */}
                      <div className="flex items-center gap-2 shrink-0 self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCase(item);
                          }}
                          className="font-code-sm text-code-sm px-space-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:brightness-110 transition-all font-semibold shrink-0 cursor-pointer"
                        >
                          View Memo
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          aria-label={`Delete run ${item.id}`}
                          title="Delete from history"
                          className="text-outline hover:text-error p-1.5 rounded hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center justify-center min-h-[32px] min-w-[32px]"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
