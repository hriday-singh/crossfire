import React from "react";
import { Case, Claim } from "@/types/crossfire";
import { cleanUiText } from "@/lib/formatters";
import { SerpApiText } from "@/components/ui/serpapi";
import { getClaimSalvagedText, getSalvageableClaims } from "@/lib/promptFixer";
import { cn } from "@/lib/utils";

interface PromptFixerWorkbenchProps {
  currentCase: Case;
  selectedClaimIds: Set<string>;
  onToggleClaim: (claimId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onResetPrompt: () => void;
  improvedPrompt: string;
  onChangeImprovedPrompt: (newPrompt: string) => void;
  onPutIntoStartingScreen: () => void;
  onRefineWithAi?: () => Promise<void>;
  isRefiningAi?: boolean;
  refineError?: string | null;
  className?: string;
}

export const PromptFixerWorkbench: React.FC<PromptFixerWorkbenchProps> = ({
  currentCase,
  selectedClaimIds,
  onToggleClaim,
  onSelectAll,
  onClearAll,
  onResetPrompt,
  improvedPrompt,
  onChangeImprovedPrompt,
  onPutIntoStartingScreen,
  onRefineWithAi,
  isRefiningAi = false,
  refineError,
  className = "",
}) => {
  const salvageableClaims = getSalvageableClaims(currentCase);
  if (salvageableClaims.length === 0) return null;

  const totalSalvageable = salvageableClaims.length;
  const selectedCount = salvageableClaims.filter((c) => selectedClaimIds.has(c.id)).length;
  const isAllSelected = selectedCount === totalSalvageable;
  const hasChanges = improvedPrompt.trim() !== currentCase.raw_input.trim();

  return (
    <section
      aria-label="Revise Proposal"
      id="prompt-fixer-workbench"
      className={cn(
        "rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-space-8 space-y-space-8 shadow-sm text-left mt-space-8",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-4 pb-space-6 border-b border-outline-variant/40">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Revise Proposal
            </h2>
            <span className="font-code-sm text-xs px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
              {selectedCount} of {totalSalvageable} revisions selected
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed max-w-2xl">
            Select the suggested fixes to replace failed claims, then test the updated proposal.
          </p>
        </div>

        {/* Batch selection buttons */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap mt-4 md:mt-0">
          <button
            type="button"
            onClick={isAllSelected ? onClearAll : onSelectAll}
            className="px-4 py-2 rounded-lg border border-outline-variant hover:border-outline bg-surface-container-low hover:bg-surface-container text-xs font-code-sm text-on-surface font-medium transition-colors cursor-pointer"
          >
            {isAllSelected ? "Deselect All" : "Select All Revisions"}
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={onResetPrompt}
              className="px-4 py-2 rounded-lg text-xs font-code-sm text-outline hover:text-on-surface transition-colors cursor-pointer"
              title="Reset prompt back to original statement"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Failed Claims Checklist */}
      <div className="space-y-space-4">
        <h3 className="font-title-sm text-title-sm text-on-surface font-medium">
          Available Revisions
        </h3>
        <div className="grid gap-space-4">
          {salvageableClaims.map((claim, idx) => {
            const isSelected = selectedClaimIds.has(claim.id);
            const salvageText = getClaimSalvagedText(claim, currentCase);
            const claimIndex = currentCase.claims.findIndex((c) => c.id === claim.id);
            const displayNum = claimIndex >= 0 ? claimIndex + 1 : idx + 1;

            return (
              <div
                key={claim.id}
                onClick={() => onToggleClaim(claim.id)}
                className={cn(
                  "p-space-6 rounded-xl border transition-all cursor-pointer select-none",
                  isSelected
                    ? "bg-primary-container/5 border-primary-container/40 ring-1 ring-primary-container/20"
                    : "bg-surface-container-low border-outline-variant/60 hover:border-outline-variant hover:bg-surface-container"
                )}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      isSelected 
                        ? "bg-primary-container border-primary-container text-on-primary-container" 
                        : "border-outline-variant bg-surface-container-lowest"
                    )}>
                      {isSelected && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                    </div>
                    
                    <span className="font-title-md text-title-md font-semibold text-on-surface">
                      Claim {displayNum}
                    </span>
                    
                    {claim.status === "broken" ? (
                      <span className="font-code-sm text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-error-container/30 text-error">
                        Refuted
                      </span>
                    ) : (
                      <span className="font-code-sm text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-tertiary-container/30 text-tertiary">
                        Weakened
                      </span>
                    )}
                  </div>

                  <div className="space-y-4 pl-8">
                      {/* Original Claim */}
                      <div>
                        <div className="font-label-mono text-[10px] uppercase tracking-wider text-outline mb-1.5">Original</div>
                        <div className={cn("font-body-sm text-sm text-on-surface-variant", isSelected && "line-through opacity-50")}>
                          <SerpApiText text={cleanUiText(claim.statement)} />
                        </div>
                      </div>

                      {/* Proposed Fix */}
                      <div>
                        <div className="font-label-mono text-[10px] uppercase tracking-wider text-primary mb-1.5">Proposed Fix</div>
                        <div className={cn("font-body-sm text-sm font-medium", isSelected ? "text-on-surface" : "text-on-surface-variant")}>
                          <SerpApiText text={cleanUiText(salvageText)} />
                        </div>
                      </div>

                      {claim.tradeoff_acknowledged && (
                        <div className="mt-4 inline-flex items-start gap-2 text-xs font-mono text-outline/90 bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                          <span className="font-semibold text-on-surface-variant shrink-0">Trade-off:</span>
                          <span className="leading-relaxed">{cleanUiText(claim.tradeoff_acknowledged)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            );
          })}
        </div>
      </div>

      {/* Editable Prompt Area */}
      <div className="space-y-space-4 pt-space-4 border-t border-outline-variant/40">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label
            htmlFor="improved-prompt-textarea"
            className="font-title-sm text-title-sm text-on-surface font-medium"
          >
            Updated Proposal
          </label>
          <div className="flex items-center gap-4">
            {onRefineWithAi && (
              <button
                type="button"
                disabled={isRefiningAi || selectedCount === 0}
                onClick={onRefineWithAi}
                className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline-variant text-xs font-code-sm text-on-surface-variant hover:text-on-surface font-medium flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-colors"
                title="Smooth the prose flow"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isRefiningAi ? "progress_activity" : "edit_document"}
                </span>
                <span>{isRefiningAi ? "Polishing..." : "Smooth Prose"}</span>
              </button>
            )}
            <span className="font-code-sm text-xs text-outline font-medium">
              {improvedPrompt.length} chars
            </span>
          </div>
        </div>

        <textarea
          id="improved-prompt-textarea"
          value={improvedPrompt}
          onChange={(e) => onChangeImprovedPrompt(e.target.value)}
          rows={5}
          className="w-full bg-surface-container-lowest text-on-surface p-5 font-body-md text-sm rounded-xl border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none leading-relaxed transition-all resize-y shadow-sm"
          placeholder="Your revised decision proposal..."
        />

        {refineError && (
          <p className="text-xs font-code-sm text-error">{refineError}</p>
        )}
      </div>

      {/* Action Row */}
      <div className="pt-space-2 flex justify-end">
        <button
          type="button"
          id="put-into-starting-screen-btn"
          onClick={onPutIntoStartingScreen}
          disabled={!improvedPrompt.trim()}
          className="px-6 py-3 rounded-lg bg-on-surface hover:bg-on-surface/90 text-surface font-body-sm text-sm font-medium transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>Test Revised Proposal</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </section>
  );
};
