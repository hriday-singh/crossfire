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
      aria-label="Steel Man Prompt Fixer Workbench"
      id="prompt-fixer-workbench"
      className={cn(
        "rounded-xl border border-primary-container/40 bg-surface-container-low p-space-6 space-y-space-5 shadow-lg text-left",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-3 pb-space-4 border-b border-outline-variant/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-primary-container text-[22px]">
              auto_fix_high
            </span>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Fix Original Prompt with Steel Man Solutions
            </h2>
            <span className="font-code-sm text-code-sm px-2 py-0.5 rounded-full bg-primary-container/15 text-primary-container border border-primary-container/30 font-semibold">
              {selectedCount} of {totalSalvageable} fix{totalSalvageable > 1 ? "es" : ""} selected
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Select the solutions proposed by the Steel Man to replace failed claims, then load the improved prompt back into the starting screen to test again.
          </p>
        </div>

        {/* Batch selection buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={isAllSelected ? onClearAll : onSelectAll}
            className="px-3 py-1.5 rounded-lg border border-outline-variant hover:border-outline bg-surface-container hover:bg-surface-container-high text-xs font-code-sm text-on-surface font-medium transition-colors cursor-pointer"
          >
            {isAllSelected ? "Deselect All" : "Select All Failed"}
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={onResetPrompt}
              className="px-3 py-1.5 rounded-lg border border-outline-variant hover:border-outline bg-surface-container hover:bg-surface-container-high text-xs font-code-sm text-outline hover:text-on-surface transition-colors cursor-pointer"
              title="Reset prompt back to original statement"
            >
              Reset to Original
            </button>
          )}
        </div>
      </div>

      {/* Failed Claims Checklist */}
      <div className="space-y-space-3">
        <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold block">
          Failed Claims & Steel Man Replacements:
        </span>
        <div className="space-y-2.5">
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
                  "p-space-3.5 rounded-lg border transition-all cursor-pointer select-none",
                  isSelected
                    ? "bg-primary-container/10 border-primary-container/60 shadow-xs"
                    : "bg-surface-container border-outline-variant/60 hover:border-outline"
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleClaim(claim.id)}
                    aria-label={`Replace claim ${displayNum}`}
                    className="mt-1 w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container accent-blue-600 shrink-0 cursor-pointer"
                  />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-code-sm text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-highest text-outline">
                        Claim #{displayNum}
                      </span>
                      {claim.status === "broken" ? (
                        <span className="font-code-sm text-xs font-semibold px-2 py-0.5 rounded bg-error-container/30 text-error border border-error/30">
                          Refuted
                        </span>
                      ) : (
                        <span className="font-code-sm text-xs font-semibold px-2 py-0.5 rounded bg-tertiary-container/30 text-tertiary border border-tertiary/30">
                          Weakened
                        </span>
                      )}
                      {claim.fatal_flaw && (
                        <span className="font-body-xs text-xs text-error/90 truncate">
                          [Flaw: {cleanUiText(claim.fatal_flaw)}]
                        </span>
                      )}
                    </div>

                    {/* Original Claim (strikethrough when selected) */}
                    <div className="font-body-sm text-xs text-on-surface-variant flex items-baseline gap-1.5">
                      <span className="text-outline shrink-0 font-mono">Original:</span>
                      <span className={cn(isSelected && "line-through opacity-70")}>
                        <SerpApiText text={cleanUiText(claim.statement)} />
                      </span>
                    </div>

                    {/* Steel Man Salvaged Claim */}
                    <div className="font-body-sm text-sm text-on-surface flex items-baseline gap-1.5">
                      <span className="text-primary-container font-semibold font-mono shrink-0">
                        Steel Man Solution:
                      </span>
                      <span className="font-medium text-on-surface">
                        <SerpApiText text={cleanUiText(salvageText)} />
                      </span>
                    </div>

                    {claim.tradeoff_acknowledged && (
                      <div className="text-[11px] font-mono text-outline">
                        Trade-off: {cleanUiText(claim.tradeoff_acknowledged)}
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
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label
            htmlFor="improved-prompt-textarea"
            className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px] text-primary-container">edit_note</span>
            <span>Improved Decision Prompt (Editable):</span>
          </label>
          <div className="flex items-center gap-2">
            {onRefineWithAi && (
              <button
                type="button"
                disabled={isRefiningAi || selectedCount === 0}
                onClick={onRefineWithAi}
                className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-xs font-code-sm text-primary-container font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors"
                title="Use Crossfire LLM to naturally polish and re-weave the proposal prose"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isRefiningAi ? "progress_activity" : "magic_button"}
                </span>
                <span>{isRefiningAi ? "Polishing..." : "Refine with AI"}</span>
              </button>
            )}
            <span className="font-code-sm text-xs text-outline">
              {improvedPrompt.length} chars
            </span>
          </div>
        </div>

        <textarea
          id="improved-prompt-textarea"
          value={improvedPrompt}
          onChange={(e) => onChangeImprovedPrompt(e.target.value)}
          rows={4}
          className="w-full bg-surface-container-lowest text-on-surface p-3.5 font-body-md text-sm rounded-lg border border-outline-variant focus:border-primary-container outline-none leading-relaxed transition-colors resize-y shadow-inner"
          placeholder="Your improved decision proposal..."
        />

        {refineError && (
          <p className="text-xs font-code-sm text-error">{refineError}</p>
        )}
      </div>

      {/* Action Row */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-outline-variant/60">
        <span className="font-body-xs text-xs text-on-surface-variant">
          Puts the improved prompt into the starting screen textarea for a fresh run.
        </span>

        <button
          type="button"
          id="put-into-starting-screen-btn"
          onClick={onPutIntoStartingScreen}
          disabled={!improvedPrompt.trim()}
          className="px-5 py-2.5 rounded-lg bg-primary-container hover:bg-blue-600 text-white font-body-sm text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">replay</span>
          <span>Put Improved Prompt into Starting Screen</span>
        </button>
      </div>
    </section>
  );
};
