import React from "react";
import { Case, Claim } from "@/types/crossfire";
import { formatImpact, formatTestName, getVerdictConfig, truncateUrl } from "@/lib/formatters";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Anchor,
  CircleCheck,
  CircleHelp,
  CircleX,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

interface EvidenceDrawerProps {
  claimId: string | null;
  currentCase: Case | null;
  onClose: () => void;
}

function renderVerdictIcon(status: Claim["status"], size = 14) {
  switch (status) {
    case "survived":
      return <CircleCheck size={size} className="text-emerald-400 shrink-0" />;
    case "weakened":
      return <TriangleAlert size={size} className="text-amber-400 shrink-0" />;
    case "broken":
      return <CircleX size={size} className="text-rose-400 shrink-0" />;
    case "unresolved":
      return <CircleHelp size={size} className="text-indigo-400 shrink-0" />;
    default:
      return null;
  }
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  claimId,
  currentCase,
  onClose,
}) => {
  const isOpen = Boolean(claimId && currentCase);
  const claim = currentCase?.claims.find((c) => c.id === claimId);
  const findings = currentCase?.findings.filter((f) => f.claim_id === claimId) || [];
  const consequence = currentCase?.consequences.find((c) => c.claim_id === claimId);
  const tests = currentCase?.test_plan.filter((t) => t.target_claim === claimId) || [];

  if (!claim) return null;

  const verdictConfig = getVerdictConfig(claim.status);
  const allEvidence = findings.flatMap((f) => f.evidence || []);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col h-full bg-zinc-900 border-l border-zinc-800 select-text"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            Audit Trail & Evidence
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Section 1: CLAIM & VERDICT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
                Claim & Verdict
              </span>
              {claim.load_bearing && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-0.5 text-[11px] font-mono">
                  <Anchor size={12} className="text-zinc-400 shrink-0" />
                  Core foundation
                </span>
              )}
            </div>

            <h3 className="text-base font-semibold text-zinc-100 leading-snug">
              {claim.statement}
            </h3>

            {claim.status && (
              <div className="flex items-center gap-2 pt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono font-medium",
                    verdictConfig.badgeBg,
                    verdictConfig.badgeText,
                    verdictConfig.badgeBorder
                  )}
                >
                  {renderVerdictIcon(claim.status, 15)}
                  <span>{verdictConfig.label}</span>
                </span>
                {consequence?.impact && (
                  <span className="font-mono text-xs text-zinc-400">
                    {formatImpact(consequence.impact)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 2: WHY IT MATTERS */}
          <div className="space-y-1.5">
            <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
              Why It Matters
            </span>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {claim.load_bearing
                ? "This assumption is load-bearing. If this claim is false, the fundamental unit economics and operational model collapse."
                : "This is a supporting assumption. If false, it introduces friction but does not necessarily invalidate the core strategy."}
            </p>
          </div>

          {/* Section 4: TESTS RUN */}
          <div className="space-y-2">
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Tests Executed
            </span>
            <div className="flex flex-wrap gap-2">
              {tests.length > 0 ? (
                tests.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center rounded-md border border-border bg-zinc-900 px-2.5 py-1 text-xs font-mono text-zinc-300"
                  >
                    [ {formatTestName(t.failure_mode).toUpperCase()} · COMPLETED ]
                  </span>
                ))
              ) : (
                <span className="text-xs font-mono text-muted-foreground">
                  Assumption and evidence tests completed
                </span>
              )}
            </div>
          </div>

          {/* Section 5: EVIDENCE FOUND */}
          <div className="space-y-2.5">
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Primary Source Citations
            </span>

            {allEvidence.length > 0 ? (
              <div className="space-y-3">
                {allEvidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-zinc-950/70 p-4 space-y-2"
                  >
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline break-all"
                    >
                      <span>{ev.title || truncateUrl(ev.source_url, 45)}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>

                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      "{ev.snippet}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-2 border-t border-border/20">
                      <span>{truncateUrl(ev.source_url, 32)}</span>
                      <span>{ev.retrieved_at ? new Date(ev.retrieved_at).toLocaleDateString() : "Verified"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 bg-zinc-950/40 p-4 text-xs text-muted-foreground italic leading-relaxed">
                No external web evidence could be retrieved for this claim. Evaluated using adversarial reasoning and structural feasibility analysis.
              </div>
            )}
          </div>

          {/* Section 6: CONTRADICTIONS & NUANCE */}
          {findings.some((f) => f.contradiction) && (
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Contradictions Surfaced
              </span>
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3.5 text-xs text-amber-200/90 leading-relaxed">
                <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <span>{findings.find((f) => f.contradiction)?.contradiction}</span>
              </div>
            </div>
          )}

          {/* Section 7: RECOMMENDED ADJUSTMENT */}
          {consequence?.recommended_change && (
            <div className="space-y-2">
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Recommended Plan Adjustment
              </span>
              <blockquote className="border-l-2 border-indigo-500/60 bg-indigo-950/20 rounded-r-md px-4 py-2.5 text-sm text-zinc-200 leading-relaxed font-medium">
                "{consequence.recommended_change}"
              </blockquote>
            </div>
          )}

          {/* Section 8: NEXT VALIDATION STEP */}
          {consequence?.next_validation && (
            <div className="space-y-2">
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Next Validation Step
              </span>
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/30 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={13} />
                  <span>Smallest Real-World Experiment</span>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed">
                  {consequence.next_validation}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
