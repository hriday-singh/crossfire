import React, { useState, useMemo } from "react";
import { useCase } from "@/context/CaseContext";
import { ClaimCard } from "@/components/features/ClaimCard";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import { formatDecisionMemoMarkdown, copyToClipboard } from "@/lib/exportMemo";

export const DashboardScreen: React.FC = () => {
  const { state, selectClaim } = useCase();
  const [filterStatus, setFilterStatus] = useState<"all" | "needs_attention" | "passed">("all");
  const [copiedMemo, setCopiedMemo] = useState(false);

  const currentCase = state.currentCase;
  if (!currentCase) return null;

  const isTesting = state.isStreaming || currentCase.status === "testing";

  // Dynamic Case ID
  const formattedCaseId = currentCase.id.startsWith("CRX-")
    ? currentCase.id
    : `CRX-${currentCase.id.replace(/-/g, "").slice(0, 6).toUpperCase() || "MEMO"}`;

  // Counts
  const totalClaims = currentCase.claims.length;
  const brokenCount = currentCase.claims.filter((c) => c.status === "broken").length;
  const weakenedCount = currentCase.claims.filter((c) => c.status === "weakened").length;
  const unresolvedCount = currentCase.claims.filter((c) => c.status === "unresolved").length;
  const survivedCount = currentCase.claims.filter((c) => c.status === "survived").length;
  const needsAttentionCount = brokenCount + weakenedCount + unresolvedCount;

  // Severity sort
  const severityRank: Record<string, number> = {
    broken: 1,
    unresolved: 2,
    weakened: 3,
    survived: 4,
  };

  const sortedClaims = useMemo(() => {
    return [...currentCase.claims].sort((a, b) => {
      if (a.load_bearing && !b.load_bearing) return -1;
      if (!a.load_bearing && b.load_bearing) return 1;
      const rankA = a.status ? severityRank[a.status] || 99 : 99;
      const rankB = b.status ? severityRank[b.status] || 99 : 99;
      return rankA - rankB;
    });
  }, [currentCase.claims]);

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
                  {isTesting ? "Adversarial Stress Test" : "Evaluation Summary"}
                </span>
                <span className="font-code-sm text-code-sm px-space-2 py-0.5 rounded bg-surface-container-high text-outline">
                  Run #{formattedCaseId}
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
                    <span>Testing claims against live market signals, technical limits, and evidence...</span>
                  </span>
                ) : (
                  <span>
                    {totalClaims} claims evaluated against external market signals, feasibility benchmarks, and customer data.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-space-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-space-3 py-1.5 rounded-xl bg-surface-container text-error border border-outline-variant">
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span className="font-code-sm text-code-sm font-semibold">{brokenCount} Broken</span>
              </div>

              <div className="flex items-center gap-1.5 px-space-3 py-1.5 rounded-xl bg-surface-container text-tertiary border border-outline-variant">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span className="font-code-sm text-code-sm font-semibold">{weakenedCount} Weakened</span>
              </div>

              <div className="flex items-center gap-1.5 px-space-3 py-1.5 rounded-xl bg-surface-container text-secondary border border-outline-variant">
                <span className="material-symbols-outlined text-[16px]">help</span>
                <span className="font-code-sm text-code-sm font-semibold">{unresolvedCount} Unresolved</span>
              </div>

              <div className="flex items-center gap-1.5 px-space-3 py-1.5 rounded-xl bg-surface-container text-primary-container border border-outline-variant">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span className="font-code-sm text-code-sm font-semibold">{survivedCount} Survived</span>
              </div>
            </div>
          </div>

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
                Needs Attention ({needsAttentionCount})
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
                Passed ({survivedCount})
              </button>
            </div>

            <div className="flex items-center gap-space-2 font-code-sm text-code-sm text-outline">
              <span>Sorted by: Criticality</span>
              <span className="material-symbols-outlined text-[16px]">sort</span>
            </div>
          </div>

          {/* Claims Dossier Stack */}
          <div className="space-y-space-5">
            {filteredClaims.map((claim) => {
              const relevantFindings = currentCase.findings.filter((f) => f.claim_id === claim.id);
              const relevantConsequence = currentCase.consequences.find((c) => c.claim_id === claim.id);
              const claimActiveTests = Object.values(state.activeTests).filter(
                (t) => t.target_claim === claim.id
              );

              return (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  tests={claimActiveTests}
                  findings={relevantFindings}
                  consequence={relevantConsequence}
                  isTestingMode={state.isStreaming || currentCase.status === "testing"}
                  onClick={() => selectClaim(claim.id)}
                />
              );
            })}
          </div>
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
            <span>CROSSFIRE Verification Suite</span>
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
