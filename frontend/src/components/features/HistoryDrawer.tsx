import React from "react";
import { Case } from "@/types/crossfire";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/icons/KeylineIcons";

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ open, onClose }) => {
  const { state, dispatch, resetCase } = useCase();

  const handleSelectCase = (c: Case) => {
    dispatch({ type: "LOAD_CASE", payload: c });
    onClose();
  };

  const handleNewTest = () => {
    resetCase();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-[360px] p-0 flex flex-col h-full bg-card border-r border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            Past Crash Tests
          </div>
        </div>

        {/* Case List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {state.caseHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No previous test runs recorded yet.
            </div>
          ) : (
            state.caseHistory.map((c) => {
              const survivedCount = c.claims.filter((cl) => cl.status === "survived").length;
              const weakenedCount = c.claims.filter((cl) => cl.status === "weakened").length;
              const brokenCount = c.claims.filter((cl) => cl.status === "broken").length;
              const unresolvedCount = c.claims.filter((cl) => cl.status === "unresolved").length;
              const isSelected = state.currentCase?.id === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCase(c)}
                  className={`w-full rounded-lg border p-3.5 text-left transition-all ${
                    isSelected
                      ? "border-blue-400 bg-blue-400/10"
                      : "border-border bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <div className="font-mono text-[11px] text-muted-foreground mb-1">
                    {c.id.slice(0, 16)}
                  </div>
                  <div className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                    {c.raw_input}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    {survivedCount > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {survivedCount}
                      </span>
                    )}
                    {weakenedCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {weakenedCount}
                      </span>
                    )}
                    {brokenCount > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        {brokenCount}
                      </span>
                    )}
                    {unresolvedCount > 0 && (
                      <span className="flex items-center gap-1 text-purple-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                        {unresolvedCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 text-xs"
            onClick={handleNewTest}
          >
            <IconPlus size={14} />
            Test a new decision
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
