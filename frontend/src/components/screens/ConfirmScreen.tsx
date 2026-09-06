import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { Plus, X, ArrowRight, Loader2 } from "lucide-react";

export const ConfirmScreen: React.FC = () => {
  const { state, dispatch, confirmAndRun } = useCase();
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [newClaimText, setNewClaimText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const currentCase = state.currentCase;
  if (!currentCase) return null;

  const handleStartEdit = (claimId: string, currentStatement: string) => {
    setEditingClaimId(claimId);
    setEditingText(currentStatement);
  };

  const handleSaveEdit = (claimId: string) => {
    if (editingText.trim()) {
      dispatch({
        type: "UPDATE_CLAIM_STATEMENT",
        payload: { claimId, statement: editingText.trim() },
      });
    }
    setEditingClaimId(null);
  };

  const handleDeleteClaim = (e: React.MouseEvent, claimId: string) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_CLAIM", payload: { claimId } });
  };

  const handleAddClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimText.trim()) return;
    dispatch({ type: "ADD_CLAIM", payload: { statement: newClaimText.trim() } });
    setNewClaimText("");
    setIsAdding(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col px-6 py-10">
      {/* Proposition Echo Header */}
      <div className="mb-6 space-y-1.5 border-b border-border/60 pb-5">
        <p className="text-sm text-zinc-400">
          Review assumptions before testing:
        </p>
        <h2 className="text-base font-medium leading-relaxed text-zinc-100">
          "{currentCase.raw_input}"
        </h2>
      </div>

      {/* Assumptions Instructions */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
          Assumptions ({currentCase.claims.length})
        </span>
        <span className="text-xs text-zinc-500">
          Click an assumption to edit
        </span>
      </div>

      {/* Assumptions Stack */}
      <div className="space-y-3">
        {currentCase.claims.map((claim, index) => {
          const isEditing = editingClaimId === claim.id;

          return (
            <div
              key={claim.id}
              onClick={() => !isEditing && handleStartEdit(claim.id, claim.statement)}
              className="group relative flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-zinc-700 hover:bg-muted/40 cursor-pointer"
            >
              <div className="flex flex-1 items-start gap-3 min-w-0">
                <span className="mt-0.5 font-mono text-xs text-muted-foreground shrink-0">
                  {index + 1}.
                </span>

                {isEditing ? (
                  <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full rounded-md border border-primary bg-zinc-950 p-2 text-sm text-foreground focus:outline-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(claim.id)}
                        className="h-7 text-xs px-3"
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingClaimId(null)}
                        className="h-7 text-xs px-3"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {claim.statement}
                  </p>
                )}
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteClaim(e, claim.id)}
                  title="Remove assumption"
                  className="mt-0.5 rounded p-1 text-muted-foreground opacity-60 hover:text-rose-400 hover:opacity-100 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline Add Assumption */}
      {isAdding ? (
        <form onSubmit={handleAddClaim} className="mt-4 space-y-2 rounded-lg border border-dashed border-border p-4 bg-zinc-950/40">
          <label className="block text-xs font-mono text-muted-foreground uppercase">
            New Assumption Statement
          </label>
          <input
            type="text"
            value={newClaimText}
            onChange={(e) => setNewClaimText(e.target.value)}
            placeholder="e.g. Free-tier users will convert to paid users at standard SaaS rates."
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" className="h-7 text-xs">
              Add Assumption
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={14} />
            <span>Add an assumption</span>
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
        <span className="font-mono text-xs text-muted-foreground">
          Ready to stress-test {currentCase.claims.length} assumptions
        </span>

        <Button
          onClick={confirmAndRun}
          disabled={currentCase.claims.length === 0 || state.isConfirming}
          className="h-10 px-6 font-medium bg-white text-zinc-950 hover:bg-zinc-200 rounded-md shadow-sm gap-2"
        >
          {state.isConfirming ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Launching tests...</span>
            </>
          ) : (
            <>
              <span>Confirm & Run Tests</span>
              <ArrowRight size={15} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
