import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { ClaimCard } from "@/components/features/ClaimCard";
import { EvidenceDrawer } from "@/components/features/EvidenceDrawer";
import { Button } from "@/components/ui/button";
import { formatDecisionMemoMarkdown, copyToClipboard } from "@/lib/exportMemo";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Copy,
  FileText,
  Loader2,
  Plus,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const DashboardScreen: React.FC = () => {
  const { state, selectClaim, resetCase } = useCase();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const currentCase = state.currentCase;
  if (!currentCase) return null;

  const isTesting = state.isStreaming || currentCase.status === "testing";

  // Scoreboard counts
  const totalClaims = currentCase.claims.length;
  const survivedCount = currentCase.claims.filter((c) => c.status === "survived").length;
  const weakenedCount = currentCase.claims.filter((c) => c.status === "weakened").length;
  const brokenCount = currentCase.claims.filter((c) => c.status === "broken").length;
  const unresolvedCount = currentCase.claims.filter((c) => c.status === "unresolved").length;
  const loadBearingBroken = currentCase.claims.filter(
    (c) => c.load_bearing && (c.status === "broken" || c.status === "weakened")
  ).length;

  // Strategic Assessment Header Logic
  const getStrategicAssessment = () => {
    if (isTesting) {
      return {
        verdict: "Adversarial Audit In Progress",
        summary: "Querying empirical web evidence, historical case studies, and counterarguments...",
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
        icon: <Loader2 size={16} className="animate-spin text-indigo-700 shrink-0" />,
      };
    }
    if (brokenCount > 0 && loadBearingBroken > 0) {
      return {
        verdict: `High Strategic Risk: ${loadBearingBroken} Core Foundation(s) Broken`,
        summary:
          "Crucial load-bearing assumptions failed adversarial audit. Fundamental plan revision required before committing capital.",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        icon: <ShieldAlert size={16} className="text-rose-700 shrink-0" />,
      };
    }
    if (brokenCount > 0 || weakenedCount > 0) {
      return {
        verdict: `Moderate Strategic Risk: ${brokenCount + weakenedCount} Assumption(s) Weakened`,
        summary:
          "Supporting assumptions were challenged by empirical evidence. Targeted tactical adjustments advised.",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        icon: <AlertTriangle size={16} className="text-amber-700 shrink-0" />,
      };
    }
    if (unresolvedCount > 0) {
      return {
        verdict: `Inconclusive: ${unresolvedCount} Assumption(s) Unresolved`,
        summary:
          "Insufficient empirical data was found to definitively confirm or refute all assumptions. Run targeted pilot tests.",
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
        icon: <AlertTriangle size={16} className="text-indigo-700 shrink-0" />,
      };
    }
    return {
      verdict: "Validated Strategy: Foundational Assumptions Hold",
      summary:
        "All tested core assumptions withstood adversarial stress-testing. Proceed with execution.",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      icon: <ShieldCheck size={16} className="text-emerald-700 shrink-0" />,
    };
  };

  const assessment = getStrategicAssessment();

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

  const handleToggleClaimExpand = (claimId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    if (expandedIds.size === filteredClaims.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(filteredClaims.map((c) => c.id)));
    }
  };

  const handleCopyMemo = async () => {
    const markdown = formatDecisionMemoMarkdown(currentCase);
    const ok = await copyToClipboard(markdown);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 pt-8 pb-24">
      {/* Executive Memorandum Header Card */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-100 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
              <FileText size={13} className="text-zinc-600" />
              <span>Decision Testing Memorandum</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 leading-relaxed font-sans">
              "{currentCase.raw_input}"
            </h1>
            {currentCase.context && (
              <p className="mt-2 text-xs font-mono text-zinc-500">
                Context: {currentCase.context}
              </p>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 self-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyMemo}
              className="h-8 gap-1.5 text-xs text-zinc-700 hover:text-zinc-950 border-zinc-200 bg-white"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Memo Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Memo</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              title="Print or export to PDF"
              className="h-8 px-2.5 text-xs text-zinc-700 hover:text-zinc-950 border-zinc-200 bg-white"
            >
              <Printer size={13} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={resetCase}
              className="h-8 gap-1.5 text-xs text-zinc-700 hover:text-zinc-950 border-zinc-200 bg-white"
            >
              <Plus size={13} />
              <span>New</span>
            </Button>
          </div>
        </div>

        {/* Executive Verdict Assessment Callout */}
        <div className={cn("mt-6 rounded-lg border p-4 sm:p-5 flex items-start gap-3.5", assessment.badgeClass)}>
          {assessment.icon}
          <div>
            <h3 className="text-sm font-semibold tracking-tight leading-snug">
              {assessment.verdict}
            </h3>
            <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">
              {assessment.summary}
            </p>
          </div>
        </div>

        {/* Scoreboard & Filter Controls */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={cn(
                "rounded-full px-3 py-1 transition-colors border",
                filterStatus === "all"
                  ? "bg-zinc-950 text-white border-zinc-950 font-medium"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              )}
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

            {brokenCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus("broken")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors border",
                  filterStatus === "broken"
                    ? "bg-rose-700 text-white border-rose-700 font-medium"
                    : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                )}
              >
                Broken ({brokenCount})
              </button>
            )}

            {weakenedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus("weakened")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors border",
                  filterStatus === "weakened"
                    ? "bg-amber-700 text-white border-amber-700 font-medium"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                )}
              >
                Weakened ({weakenedCount})
              </button>
            )}

            {survivedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus("survived")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors border",
                  filterStatus === "survived"
                    ? "bg-emerald-700 text-white border-emerald-700 font-medium"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                )}
              >
                Survived ({survivedCount})
              </button>
            )}

            {unresolvedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus("unresolved")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors border",
                  filterStatus === "unresolved"
                    ? "bg-indigo-700 text-white border-indigo-700 font-medium"
                    : "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
                )}
              >
                Unresolved ({unresolvedCount})
              </button>
            )}
          </div>

          {/* Expand/Collapse All Button */}
          {filteredClaims.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-900 transition-colors self-end sm:self-auto"
            >
              <ChevronsUpDown size={13} />
              <span>
                {expandedIds.size === filteredClaims.length ? "Collapse All" : "Expand All"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Claims Dossier Stack */}
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
              isExpanded={expandedIds.has(claim.id)}
              onToggleExpand={() => handleToggleClaimExpand(claim.id)}
            />
          );
        })}
      </div>

      {/* Slide-over Evidence Drawer fallback */}
      <EvidenceDrawer
        claimId={state.selectedClaimId}
        currentCase={currentCase}
        onClose={() => selectClaim(null)}
      />
    </div>
  );
};
