import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import {
  Anchor,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const handleKeyDownEdit = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    claimId: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(claimId);
    } else if (e.key === "Escape") {
      setEditingClaimId(null);
    }
  };

  const handleDeleteClaim = (e: React.MouseEvent, claimId: string) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_CLAIM", payload: { claimId } });
  };

  const handleToggleLoadBearing = (e: React.MouseEvent, claimId: string) => {
    e.stopPropagation();
    dispatch({ type: "TOGGLE_CLAIM_LOAD_BEARING", payload: { claimId } });
  };

  const handleAddClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimText.trim()) return;
    dispatch({ type: "ADD_CLAIM", payload: { statement: newClaimText.trim() } });
    setNewClaimText("");
    setIsAdding(false);
  };

  const loadBearingCount = currentCase.claims.filter((c) => c.load_bearing).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-6 pt-10 pb-20">
      {/* Proposition Echo Header */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50/60 p-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">
          <FileText size={13} className="text-zinc-600" />
          <span>Proposition Under Test</span>
        </div>
        <h2 className="text-lg sm:text-xl font-medium leading-relaxed text-zinc-950 font-sans">
          "{currentCase.raw_input}"
        </h2>
        {currentCase.context && (
          <p className="mt-2 text-xs font-mono text-zinc-500">
            Context: {currentCase.context}
          </p>
        )}
      </div>

      {/* Checklist Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <div>
          <h3 className="font-semibold text-zinc-950 text-base">
            Align Foundational Assumptions ({currentCase.claims.length})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Click text to edit statement · Toggle foundation status
          </p>
        </div>
        <div className="font-mono text-xs text-zinc-500">
          <span className="font-semibold text-zinc-900">{loadBearingCount}</span> core /{" "}
          <span>{currentCase.claims.length - loadBearingCount}</span> supporting
        </div>
      </div>

      {/* Assumptions Checklist Stack */}
      <div className="space-y-3">
        {currentCase.claims.map((claim, index) => {
          const isEditing = editingClaimId === claim.id;

          return (
            <div
              key={claim.id}
              onClick={() => !isEditing && handleStartEdit(claim.id, claim.statement)}
              className={cn(
                "group relative rounded-xl border bg-white p-4 sm:p-5 transition-all",
                isEditing
                  ? "border-zinc-950 shadow-sm ring-1 ring-zinc-950"
                  : "border-zinc-200 hover:border-zinc-300 hover:shadow-xs cursor-pointer"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-1 items-start gap-3 min-w-0">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-zinc-400 shrink-0 select-none">
                    {String(index + 1).padStart(2, "0")}.
                  </span>

                  {isEditing ? (
                    <div
                      className="flex-1 space-y-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => handleKeyDownEdit(e, claim.id)}
                        className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(claim.id)}
                          className="h-8 text-xs px-3 bg-zinc-950 text-white hover:bg-zinc-800 gap-1.5"
                        >
                          <Check size={13} />
                          <span>Save</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingClaimId(null)}
                          className="h-8 text-xs px-3 text-zinc-600 hover:text-zinc-950"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base font-medium leading-relaxed text-zinc-900">
                      {claim.statement}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClaim(e, claim.id)}
                    title="Remove assumption"
                    className="rounded p-1 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {/* Sub-bar with Core Foundation Toggle */}
              {!isEditing && (
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">
                  <button
                    type="button"
                    onClick={(e) => handleToggleLoadBearing(e, claim.id)}
                    title={
                      claim.load_bearing
                        ? "Click to convert to supporting assumption"
                        : "Click to mark as core foundation"
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono transition-colors",
                      claim.load_bearing
                        ? "bg-zinc-950 text-white border-zinc-950 font-medium hover:bg-zinc-800"
                        : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
                    )}
                  >
                    <Anchor
                      size={11}
                      className={claim.load_bearing ? "text-white" : "text-zinc-400"}
                    />
                    <span>
                      {claim.load_bearing ? "Core foundation" : "Supporting assumption"}
                    </span>
                  </button>

                  <span className="text-[11px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click text to edit
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline Add Assumption Form */}
      {isAdding ? (
        <form
          onSubmit={handleAddClaim}
          className="mt-4 space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-5"
        >
          <label className="block font-mono text-xs uppercase text-zinc-500 font-semibold">
            Add New Assumption Statement
          </label>
          <input
            type="text"
            value={newClaimText}
            onChange={(e) => setNewClaimText(e.target.value)}
            placeholder="e.g. Free-tier users will convert to paid users at standard SaaS rates."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
            autoFocus
          />
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs bg-zinc-950 text-white hover:bg-zinc-800"
            >
              Add Assumption
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="h-8 text-xs text-zinc-600 hover:text-zinc-950"
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
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-md px-3 py-1.5 transition-colors border border-dashed border-zinc-200"
          >
            <Plus size={14} />
            <span>Add another assumption</span>
          </button>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-200 pt-6">
        <span className="font-mono text-xs text-zinc-500">
          Ready to stress-test {currentCase.claims.length} assumptions
        </span>

        <Button
          onClick={confirmAndRun}
          disabled={currentCase.claims.length === 0 || state.isConfirming}
          className="h-10 px-6 font-medium bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg shadow-sm gap-2"
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
