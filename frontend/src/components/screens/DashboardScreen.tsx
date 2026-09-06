import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { ClaimCard } from "@/components/features/ClaimCard";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import { Loader2 } from "lucide-react";

export const DashboardScreen: React.FC = () => {
  const { state, selectClaim } = useCase();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const currentCase = state.currentCase;
  if (!currentCase) return null;

  const isTesting = state.isStreaming || currentCase.status === "testing";

  // Scoreboard counts
  const totalClaims = currentCase.claims.length;
  const survivedCount = currentCase.claims.filter((c) => c.status === "survived").length;
  const weakenedCount = currentCase.claims.filter((c) => c.status === "weakened").length;
  const brokenCount = currentCase.claims.filter((c) => c.status === "broken").length;
  const unresolvedCount = currentCase.claims.filter((c) => c.status === "unresolved").length;

  // Sorting rule: Load-bearing first, then severity: Broken -> Unresolved -> Weakened -> Survived
  const severityRank: Record<string, number> = {
    broken: 1,
    unresolved: 2,
    weakened: 3,
    survived: 4,
  };

  const sortedClaims = [...currentCase.claims].sort((a, b) => {
    if (a.load_bearing && !b.load_bearing) return -1;
    if (!a.load_bearing && b.load_bearing) return 1;

    const rankA = a.status ? severityRank[a.status] || 99 : 99;
    const rankB = b.status ? severityRank[b.status] || 99 : 99;
    return rankA - rankB;
  });

  const filteredClaims = sortedClaims.filter((c) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "load_bearing") return c.load_bearing;
    return c.status === filterStatus;
  });

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col px-6 py-8">
      {/* Header Summary Bar per DESIGN.md Screen 3 */}
      <div className="mb-6 space-y-3 border-b border-border/60 pb-5">
        <h2 className="text-base font-medium leading-relaxed text-zinc-100">
          "{currentCase.raw_input}"
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {isTesting ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 size={13} className="animate-spin text-zinc-400" />
              <span>Testing claims against web evidence and counterarguments...</span>
            </div>
          ) : (
            <div className="font-medium text-zinc-200">
              {totalClaims} claims tested: {survivedCount} survived, {weakenedCount} weakened, {brokenCount} broken, {unresolvedCount} unresolved.
            </div>
          )}

          {/* Filter options */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterStatus === "all"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All ({totalClaims})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("load_bearing")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterStatus === "load_bearing"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Core foundation
            </button>
          </div>
        </div>
      </div>

      {/* Claims Matrix */}
      <div className="space-y-4">
        {filteredClaims.map((claim) => {
          const relevantFindings = currentCase.findings.filter(
            (f) => f.claim_id === claim.id
          );
          const relevantConsequence = currentCase.consequences.find(
            (c) => c.claim_id === claim.id
          );
          const activeTestsList = Object.values(state.activeTests);

          return (
            <ClaimCard
              key={claim.id}
              claim={claim}
              tests={activeTestsList}
              findings={relevantFindings}
              consequence={relevantConsequence}
              isTestingMode={isTesting}
              onClick={() => selectClaim(claim.id)}
            />
          );
        })}
      </div>

      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        claimId={state.selectedClaimId}
        currentCase={currentCase}
        onClose={() => selectClaim(null)}
      />
    </div>
  );
};
