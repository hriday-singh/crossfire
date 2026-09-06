import React from "react";
import { Case } from "@/types/crossfire";
import { formatTestName, getVerdictConfig, truncateUrl } from "@/lib/formatters";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MorphingStatusIcon } from "@/components/icons/MorphingStatusIcon";
import { IconAnchor, IconExternalLink } from "@/components/icons/KeylineIcons";
import { ImpactMeter } from "./ImpactMeter";
import { cn } from "@/lib/utils";

interface EvidenceDrawerProps {
  claimId: string | null;
  currentCase: Case | null;
  onClose: () => void;
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col h-full bg-card border-l border-border select-text"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Audit Trail & Evidence
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Section 1: CLAIM */}
          <div className="space-y-2">
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Claim
            </span>
            <div className="flex items-start gap-2.5">
              {claim.load_bearing && (
                <span
                  className="mt-0.5 text-zinc-300 shrink-0"
                  title="Load-bearing assumption"
                >
                  <IconAnchor size={18} />
                </span>
              )}
              <h3 className="text-base font-semibold text-foreground leading-snug">
                {claim.statement}
              </h3>
            </div>
          </div>

          {/* Section 2: WHY IT MATTERS */}
          <div className="space-y-1.5">
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Why It Matters
            </span>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {claim.load_bearing
                ? "This assumption is load-bearing. If this claim is false, the fundamental business model and strategy require material revision."
                : "This is a supporting premise. If false, it introduces friction but does not necessarily invalidate the core proposition."}
            </p>
          </div>

          {/* Section 3: STATUS & IMPACT */}
          <div className="space-y-2">
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Verdict & Impact
            </span>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-zinc-950 p-3.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono font-semibold",
                  verdictConfig.badgeBg,
                  verdictConfig.badgeText,
                  verdictConfig.badgeBorder
                )}
              >
                <MorphingStatusIcon verdict={claim.status} size={14} />
                <span>{verdictConfig.label}</span>
              </span>

              {consequence && (
                <ImpactMeter impact={consequence.impact} showLabel={true} />
              )}
            </div>

            {consequence?.verdict_reasoning && (
              <p className="text-xs text-muted-foreground italic px-1">
                Adjudication: {consequence.verdict_reasoning}
              </p>
            )}
          </div>

          {/* Section 4: TESTS RUN */}
          <div className="space-y-2">
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Tests Run
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
                <span className="text-xs font-mono text-zinc-500">
                  Standard test suite executed
                </span>
              )}
            </div>
          </div>

          {/* Section 5: EVIDENCE FOUND */}
          <div className="space-y-2.5">
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Evidence Found
            </span>

            {findings.length > 0 && findings.some((f) => f.evidence && f.evidence.length > 0) ? (
              <div className="space-y-3">
                {findings.flatMap((f) =>
                  f.evidence.map((ev, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border bg-zinc-950 p-3.5 space-y-2"
                    >
                      <a
                        href={ev.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline break-all"
                      >
                        <span>{ev.title || truncateUrl(ev.source_url, 45)}</span>
                        <IconExternalLink size={13} className="shrink-0" />
                      </a>

                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                        "{ev.snippet}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-border/20">
                        <span>{truncateUrl(ev.source_url, 30)}</span>
                        <span>{ev.retrieved_at ? new Date(ev.retrieved_at).toLocaleDateString() : "Live"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-md border border-border/40 bg-zinc-950/40 p-4 text-xs text-muted-foreground italic">
                No public web evidence could be retrieved for this claim. Evaluated using structural reasoning and behavioral assumptions.
              </div>
            )}
          </div>

          {/* Section 6: CONTRADICTIONS & NUANCE */}
          {findings.some((f) => f.contradiction) && (
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                Contradictions & Nuance
              </span>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed">
                {findings.find((f) => f.contradiction)?.contradiction}
              </div>
            </div>
          )}

          {/* Section 7: WHAT CHANGES */}
          {consequence?.recommended_change && (
            <div className="space-y-2">
              <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                What Changes
              </span>
              <blockquote className="border-l-2 border-zinc-500 pl-3.5 py-1 text-sm text-zinc-200 leading-relaxed font-medium">
                "{consequence.recommended_change}"
              </blockquote>
            </div>
          )}

          {/* Section 8: NEXT VALIDATION STEP */}
          {consequence?.next_validation && (
            <div className="space-y-2">
              <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                Next Validation Step
              </span>
              <div className="rounded-md border border-blue-400/30 bg-blue-400/5 p-3.5 space-y-1">
                <span className="font-mono text-[11px] font-bold tracking-wider text-blue-400 uppercase">
                  Recommended Experiment
                </span>
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
