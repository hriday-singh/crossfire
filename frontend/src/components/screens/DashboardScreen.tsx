import React, { useState, useMemo, useEffect } from "react";
import { useCase } from "@/context/CaseContext";
import { ClaimCard } from "@/components/features/ClaimCard";
import { LiveActivityFeed } from "@/components/features/LiveActivityFeed";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import { VerdictBlock } from "@/components/features/VerdictBlock";
import { formatDecisionMemoMarkdown, copyToClipboard } from "@/lib/exportMemo";
import { SelectDropdown, DropdownOption } from "@/components/ui/dropdown-menu";

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
  const { state, selectClaim } = useCase();
  const [filterStatus, setFilterStatus] = useState<"all" | "needs_attention" | "passed">("all");
  const [sortBy, setSortBy] = useState<ClaimSortOption>("criticality");
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [claimsOpen, setClaimsOpen] = useState(false);

  const currentCase = state.currentCase;
  const isTesting = state.isStreaming || currentCase?.status === "testing";

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
              className="w-full flex items-center gap-space-2 pt-space-4 border-t border-outline-variant font-code-sm text-code-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {claimsOpen ? "expand_less" : "expand_more"}
              </span>
              <span>
                {claimsOpen
                  ? "Hide all claims"
                  : `All ${totalClaims} claims (${survivedCount} held up)`}
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
