import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { ClaimCard } from "@/components/features/ClaimCard";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";

export const DashboardScreen: React.FC = () => {
  const { state, selectClaim } = useCase();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const currentCase = state.currentCase;
  if (!currentCase) return null;

  const isTesting = state.isStreaming || currentCase.status === "testing";

  // Scoreboard calculation
  const totalClaims = currentCase.claims.length;
  const survivedCount = currentCase.claims.filter((c) => c.status === "survived").length;
  const weakenedCount = currentCase.claims.filter((c) => c.status === "weakened").length;
  const brokenCount = currentCase.claims.filter((c) => c.status === "broken").length;
  const unresolvedCount = currentCase.claims.filter((c) => c.status === "unresolved").length;
  const testedCount = survivedCount + weakenedCount + brokenCount + unresolvedCount;

  // Sorting rule from DESIGN.md:
  // Load-bearing first, then severity: Broken -> Unresolved -> Weakened -> Survived -> Untested
  const severityRank: Record<string, number> = {
    broken: 1,
    unresolved: 2,
    weakened: 3,
    survived: 4,
  };

  const sortedClaims = [...currentCase.claims].sort((a, b) => {
    // 1. Load-bearing first
    if (a.load_bearing && !b.load_bearing) return -1;
    if (!a.load_bearing && b.load_bearing) return 1;

    // 2. Severity rank
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
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-8">
      {/* Top Banner / Scoreboard */}
      <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {isTesting ? "Execution Progress" : "Verdict Scoreboard"}
            </span>
            <div className="font-mono text-sm font-semibold text-foreground">
              {isTesting
                ? `TESTING IN PROGRESS — ${testedCount} OF ${totalClaims} EVALUATED`
                : `${totalClaims} OF ${totalClaims} CLAIMS TESTED`}
            </div>
          </div>

          {/* Counts readout */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === "broken" ? "all" : "broken")}
              className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                brokenCount > 0 ? "text-red-400 bg-red-500/10 hover:bg-red-500/20" : "text-zinc-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span>{brokenCount} Broken</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === "unresolved" ? "all" : "unresolved")}
              className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                unresolvedCount > 0 ? "text-purple-300 bg-purple-500/15 hover:bg-purple-500/25" : "text-zinc-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <span>{unresolvedCount} Unresolved</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === "weakened" ? "all" : "weakened")}
              className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                weakenedCount > 0 ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" : "text-zinc-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>{weakenedCount} Weakened</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus(filterStatus === "survived" ? "all" : "survived")}
              className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
                survivedCount > 0 ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-zinc-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{survivedCount} Survived</span>
            </button>
          </div>
        </div>

        {/* Original Proposition preview */}
        <div className="mt-3 border-t border-border/50 pt-2 text-xs text-muted-foreground line-clamp-1">
          <span className="font-mono mr-1.5 text-zinc-500">PROPOSITION:</span>
          "{currentCase.raw_input}"
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`rounded px-2.5 py-1 transition-colors ${
              filterStatus === "all" ? "bg-zinc-800 text-foreground font-semibold" : "text-zinc-400 hover:text-foreground"
            }`}
          >
            All Claims ({totalClaims})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("load_bearing")}
            className={`rounded px-2.5 py-1 transition-colors ${
              filterStatus === "load_bearing" ? "bg-zinc-800 text-foreground font-semibold" : "text-zinc-400 hover:text-foreground"
            }`}
          >
            Load-bearing Only
          </button>
        </div>

        <span className="text-xs text-zinc-500 hidden sm:inline">
          Click any card to inspect full evidence audit trail
        </span>
      </div>

      {/* Claim Cards Matrix */}
      <div className="space-y-3.5">
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

      {/* Evidence Slide-over Drawer */}
      <EvidenceDrawer
        claimId={state.selectedClaimId}
        currentCase={currentCase}
        onClose={() => selectClaim(null)}
      />
    </div>
  );
};
