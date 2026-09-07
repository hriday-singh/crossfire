import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useCase } from "@/context/CaseContext";
import { ClaimCard } from "@/components/features/ClaimCard";
import { LiveActivityFeed } from "@/components/features/LiveActivityFeed";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import { VerdictBlock } from "@/components/features/VerdictBlock";
import { PromptFixerWorkbench } from "@/components/features/PromptFixerWorkbench";
import { formatDecisionMemoMarkdown, copyToClipboard } from "@/lib/exportMemo";
import { SelectDropdown, DropdownOption } from "@/components/ui/dropdown-menu";
import { getSalvageableClaims, generateImprovedPrompt } from "@/lib/promptFixer";
import { improvePrompt } from "@/lib/api";

export type ClaimSortOption =
  | "criticality"
  | "severity"
  | "passed_first"
  | "original"
  | "load_bearing";

const SORT_OPTIONS: DropdownOption<ClaimSortOption>[] = [
  { id: "criticality", label: "Criticality", icon: "priority_high" },
  { id: "severity", label: "Outcome Severity", icon: "warning" },
  { id: "passed_first", label: "Held Up First", icon: "check_circle" },
  { id: "original", label: "Original Order", icon: "format_list_numbered" },
  { id: "load_bearing", label: "Load-Bearing First", icon: "star" },
];

export const DashboardScreen: React.FC = () => {
  const { state, selectClaim, loadPromptIntoEntry } = useCase();
  const [filterStatus, setFilterStatus] = useState<"all" | "needs_attention" | "passed">("all");
  const [sortBy, setSortBy] = useState<ClaimSortOption>("criticality");
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [claimsOpen, setClaimsOpen] = useState(true);

  const currentCase = state.currentCase;
  const isTesting = state.isStreaming || currentCase?.status === "testing";

  // Steel Man prompt fixer state
  const [selectedFixClaimIds, setSelectedFixClaimIds] = useState<Set<string>>(() => new Set());

  const [improvedPrompt, setImprovedPrompt] = useState<string>(() => {
    return currentCase?.raw_input || "";
  });

  const [isRefiningAi, setIsRefiningAi] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  // Sync when case changes
  useEffect(() => {
    if (currentCase) {
      setSelectedFixClaimIds(new Set());
      setImprovedPrompt(currentCase.raw_input);
    }
  }, [currentCase?.id]);

  const handleToggleClaimFix = useCallback(
    (claimId: string) => {
      if (!currentCase) return;
      setSelectedFixClaimIds((prev) => {
        const next = new Set(prev);
        if (next.has(claimId)) {
          next.delete(claimId);
        } else {
          next.add(claimId);
        }
        setImprovedPrompt(
          generateImprovedPrompt(currentCase.raw_input, currentCase.claims, next, currentCase)
        );
        return next;
      });
      setRefineError(null);
    },
    [currentCase]
  );

  const handleSelectAllFixes = useCallback(() => {
    if (!currentCase) return;
    const salvageable = getSalvageableClaims(currentCase);
    const allIds = new Set(salvageable.map((c) => c.id));
    setSelectedFixClaimIds(allIds);
    setImprovedPrompt(
      generateImprovedPrompt(currentCase.raw_input, currentCase.claims, allIds, currentCase)
    );
    setRefineError(null);
  }, [currentCase]);

  const handleClearAllFixes = useCallback(() => {
    if (!currentCase) return;
    setSelectedFixClaimIds(new Set());
    setImprovedPrompt(currentCase.raw_input);
    setRefineError(null);
  }, [currentCase]);

  const handleResetPrompt = useCallback(() => {
    if (!currentCase) return;
    setSelectedFixClaimIds(new Set());
    setImprovedPrompt(currentCase.raw_input);
    setRefineError(null);
  }, [currentCase]);

  const handleRefineWithAi = useCallback(async () => {
    if (!currentCase || selectedFixClaimIds.size === 0) return;
    setIsRefiningAi(true);
    setRefineError(null);
    try {
      if (currentCase.id.startsWith("case-preview-")) {
        // Mock the AI polishing delay for preview cases
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // We just keep the locally generated prompt as the "polished" one for the demo
        setImprovedPrompt((prev) => prev);
        return;
      }

      const res = await improvePrompt(currentCase.id, Array.from(selectedFixClaimIds));
      if (res.improved_prompt) {
        setImprovedPrompt(res.improved_prompt);
      }
    } catch (err: unknown) {
      setRefineError((err as Error).message || "Failed to polish prompt with AI.");
    } finally {
      setIsRefiningAi(false);
    }
  }, [currentCase, selectedFixClaimIds]);

  const handlePutIntoStartingScreen = useCallback(() => {
    if (!improvedPrompt.trim()) return;
    loadPromptIntoEntry(improvedPrompt.trim());
  }, [improvedPrompt, loadPromptIntoEntry]);

  // Scroll to top on mount or when testing begins so live intelligence and verdict block are visible
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [isTesting]);

  const severityRank: Record<string, number> = {
    broken: 1,
    unresolved: 2,
    weakened: 3,
    survived: 4,
  };

  const sortedClaims = useMemo(() => {
    if (!currentCase) return [];
    const claims = [...currentCase.claims];
    switch (sortBy) {
      case "criticality":
        return claims.sort((a, b) => {
          if (a.load_bearing && !b.load_bearing) return -1;
          if (!a.load_bearing && b.load_bearing) return 1;
          const rankA = a.status ? severityRank[a.status] || 99 : 99;
          const rankB = b.status ? severityRank[b.status] || 99 : 99;
          return rankA - rankB;
        });

      case "severity":
        return claims.sort((a, b) => {
          const rankA = a.status ? severityRank[a.status] || 99 : 99;
          const rankB = b.status ? severityRank[b.status] || 99 : 99;
          return rankA - rankB;
        });

      case "passed_first": {
        const passedRank: Record<string, number> = {
          survived: 1,
          weakened: 2,
          unresolved: 3,
          broken: 4,
        };
        return claims.sort((a, b) => {
          const rankA = a.status ? passedRank[a.status] || 99 : 99;
          const rankB = b.status ? passedRank[b.status] || 99 : 99;
          return rankA - rankB;
        });
      }

      case "load_bearing":
        return claims.sort((a, b) => {
          if (a.load_bearing && !b.load_bearing) return -1;
          if (!a.load_bearing && b.load_bearing) return 1;
          return 0;
        });

      case "original":
      default:
        return claims;
    }
  }, [currentCase, sortBy]);

  const filteredClaims = useMemo(() => {
    return sortedClaims.filter((c) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "needs_attention") {
        return c.status === "broken" || c.status === "weakened" || c.status === "unresolved";
      }
      if (filterStatus === "passed") {
        return c.status === "survived";
      }
      return true;
    });
  }, [sortedClaims, filterStatus]);

  if (!currentCase) return null;

  // Counts
  const totalClaims = currentCase.claims.length;
  const brokenCount = currentCase.claims.filter((c) => c.status === "broken").length;
  const weakenedCount = currentCase.claims.filter((c) => c.status === "weakened").length;
  const unresolvedCount = currentCase.claims.filter((c) => c.status === "unresolved").length;
  const survivedCount = currentCase.claims.filter((c) => c.status === "survived").length;
  const needsAttentionCount = brokenCount + weakenedCount + unresolvedCount;

  const handleExportMemo = async () => {
    const brief = formatDecisionMemoMarkdown(currentCase);
    await copyToClipboard(brief);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] justify-between">
      <div className="flex flex-col w-full">
        <div className="max-w-5xl mx-auto w-full px-space-6 py-space-8 space-y-space-6">
          {/* Header Module & Metrics */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-4 pb-space-6 border-b border-outline-variant">
            <div className="space-y-1">
              <div className="flex items-center gap-space-2 flex-wrap">
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                  {isTesting ? "Testing your decision" : "Result"}
                </span>
                <button
                  type="button"
                  onClick={handleExportMemo}
                  className="font-code-sm text-code-sm px-2.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary-container transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy full Decision Memo as Markdown"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedMemo ? "check" : "file_download"}
                  </span>
                  <span>{copiedMemo ? "Copied Memo!" : "Export Memo"}</span>
                </button>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {isTesting ? (
                  <span className="flex items-center gap-1.5 text-primary-container">
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Testing each claim against outside sources...</span>
                  </span>
                ) : (
                  <span>
                    {totalClaims} claims tested against outside sources.
                  </span>
                )}
              </p>
            </div>

          </div>

          <VerdictBlock
            currentCase={currentCase}
            onSelectClaim={(id) => selectClaim(id)}
            isTesting={isTesting}
          />

          {/* Steel Man Prompt Fixer Workbench (Visible post-test when failed claims exist) */}
          {!isTesting && (
            <PromptFixerWorkbench
              currentCase={currentCase}
              selectedClaimIds={selectedFixClaimIds}
              onToggleClaim={handleToggleClaimFix}
              onSelectAll={handleSelectAllFixes}
              onClearAll={handleClearAllFixes}
              onResetPrompt={handleResetPrompt}
              improvedPrompt={improvedPrompt}
              onChangeImprovedPrompt={setImprovedPrompt}
              onPutIntoStartingScreen={handlePutIntoStartingScreen}
              onRefineWithAi={handleRefineWithAi}
              isRefiningAi={isRefiningAi}
              refineError={refineError}
            />
          )}

          {/* Live Activity Feed during testing or when activities exist */}
          {(isTesting || state.activities.length > 0) && (
            <LiveActivityFeed
              activities={state.activities}
              isStreaming={isTesting}
            />
          )}

          {/* Every claim, in full - collapsed once the verdict is in. */}
          {!isTesting && (
            <button
              type="button"
              onClick={() => setClaimsOpen((open) => !open)}
              className="w-full flex items-center justify-between pt-space-6 pb-space-2 border-t border-outline-variant font-title-sm text-title-sm text-on-surface hover:text-primary-container transition-colors cursor-pointer"
            >
              <span>
                {claimsOpen
                  ? "Hide all claims"
                  : `All ${totalClaims} claims (${survivedCount} held up)`}
              </span>
              <span 
                className="material-symbols-outlined text-[20px] transition-transform duration-200"
                style={{ transform: claimsOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                expand_more
              </span>
            </button>
          )}

          {(isTesting || claimsOpen) && (
            <>
          {/* Filter & Sort Bar */}
          <div className="flex items-center justify-between gap-space-4">
            <div className="flex items-center gap-space-2">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-space-3 py-1.5 font-code-sm text-code-sm rounded border transition-colors cursor-pointer ${
                  filterStatus === "all"
                    ? "bg-surface-container-highest text-on-surface font-medium border-outline-variant"
                    : "bg-surface-container-low text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                All ({totalClaims})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus("needs_attention")}
                className={`px-space-3 py-1.5 font-code-sm text-code-sm rounded border transition-colors cursor-pointer ${
                  filterStatus === "needs_attention"
                    ? "bg-surface-container-highest text-on-surface font-medium border-outline-variant"
                    : "bg-surface-container-low text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                Didn&apos;t hold ({needsAttentionCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus("passed")}
                className={`px-space-3 py-1.5 font-code-sm text-code-sm rounded border transition-colors cursor-pointer ${
                  filterStatus === "passed"
                    ? "bg-surface-container-highest text-on-surface font-medium border-outline-variant"
                    : "bg-surface-container-low text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                Held up ({survivedCount})
              </button>
            </div>

            <SelectDropdown
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(newSort) => setSortBy(newSort)}
              labelPrefix="Sorted by:"
              ariaLabel="Sort claims"
            />
          </div>

          {/* Claims Dossier Stack */}
          <div className="space-y-space-5">
            {filteredClaims.map((claim, idx) => {
              const relevantFindings = currentCase.findings.filter((f) => f.claim_id === claim.id);
              const relevantConsequence = currentCase.consequences.find((c) => c.claim_id === claim.id);
              const claimActiveTests = Object.values(state.activeTests).filter(
                (t) => t.target_claim === claim.id
              );

              return (
                <ClaimCard
                  key={claim.id}
                  index={idx}
                  claim={claim}
                  tests={claimActiveTests}
                  findings={relevantFindings}
                  consequence={relevantConsequence}
                  isTestingMode={state.isStreaming || currentCase.status === "testing"}
                  activeActivities={state.activeTestActivities}
                  isSelectedForPromptFix={selectedFixClaimIds.has(claim.id)}
                  onTogglePromptFix={() => handleToggleClaimFix(claim.id)}
                  onClick={() => selectClaim(claim.id)}
                />
              );
            })}
          </div>
            </>
          )}
        </div>
      </div>



      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        claimId={state.selectedClaimId}
        currentCase={currentCase}
        onClose={() => selectClaim(null)}
        isSelectedForPromptFix={state.selectedClaimId ? selectedFixClaimIds.has(state.selectedClaimId) : false}
        onTogglePromptFix={handleToggleClaimFix}
      />

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-space-3 px-space-6 flex items-center justify-between">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between font-code-sm text-code-sm text-outline">
          <div className="flex items-center gap-space-3">
            <span>Crossfire</span>
          </div>
          <div className="text-outline font-mono">
            {isTesting ? (
              <span className="text-primary-container animate-pulse">Running live tests...</span>
            ) : state.startedAt && state.completedAt ? (
              <span>Run completed in {((state.completedAt - state.startedAt) / 1000).toFixed(1)}s</span>
            ) : currentCase.started_at && currentCase.completed_at ? (
              <span>Run completed in {((currentCase.completed_at - currentCase.started_at) / 1000).toFixed(1)}s</span>
            ) : (
              <span>Verification complete</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
