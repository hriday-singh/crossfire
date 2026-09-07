import React, { useState } from "react";
import { Case } from "@/types/crossfire";
import { useOptionalCase } from "@/context/CaseContext";
import { retestClaim } from "@/lib/api";
import { cleanUiText, formatTestName, truncateUrl } from "@/lib/formatters";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatDecisionMemoMarkdown, copyToClipboard } from "@/lib/exportMemo";
import { PoweredBySerpApiBadge, SerpApiText } from "@/components/ui/serpapi";

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
  const caseContext = useOptionalCase();
  const dispatch = caseContext?.dispatch;
  const [isQueued, setIsQueued] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isRetesting, setIsRetesting] = useState(false);
  const [counterEvidenceText, setCounterEvidenceText] = useState("");
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [retestError, setRetestError] = useState<string | null>(null);

  const isOpen = Boolean(claimId && currentCase);
  const claim = currentCase?.claims.find((c) => c.id === claimId);
  const findings = currentCase?.findings.filter((f) => f.claim_id === claimId) || [];
  const consequence = currentCase?.consequences.find((c) => c.claim_id === claimId);
  const tests = currentCase?.test_plan.filter((t) => t.target_claim === claimId) || [];

  const getDomain = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return "Web Source";
    }
  };

  if (!claim) return null;

  const allEvidence = findings.flatMap((f) => f.evidence || []);
  const claimIndex = currentCase?.claims.findIndex((c) => c.id === claimId) ?? 0;
  const formattedClaimId = `${claimIndex + 1}`;

  const getStatusBadge = () => {
    switch (claim.status) {
      case "broken":
        return {
          label: "Broken",
          icon: "cancel",
          classes: "bg-error-container/30 border-error/40 text-error",
        };
      case "weakened":
        return {
          label: "Weakened",
          icon: "warning",
          classes: "bg-tertiary-container/30 border-tertiary/40 text-tertiary",
        };
      case "unresolved":
        return {
          label: "Unresolved",
          icon: "help",
          classes: "bg-secondary-container/30 border-secondary/40 text-secondary",
        };
      case "survived":
        return {
          label: "Survived",
          icon: "check_circle",
          classes: "bg-primary-container/20 border-primary-container/30 text-primary-container",
        };
      default:
        return {
          label: "Pending",
          icon: "schedule",
          classes: "bg-surface-container-high border-outline-variant text-outline",
        };
    }
  };

  const statusBadge = getStatusBadge();

  const handleCopyJson = async () => {
    const claimData = {
      claim,
      findings,
      consequence,
    };
    await copyToClipboard(JSON.stringify(claimData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleExportBrief = async () => {
    if (currentCase) {
      const brief = formatDecisionMemoMarkdown(currentCase);
      await copyToClipboard(brief);
      alert("Decision brief copied to clipboard!");
    }
  };

  const handleTestSalvaged = async () => {
    if (!currentCase || !claim) return;
    setIsRetesting(true);
    setRetestError(null);
    try {
      const updated = await retestClaim(currentCase.id, claim.id, "test_salvaged");
      dispatch?.({ type: "UPDATE_CASE", payload: updated });
    } catch (err: unknown) {
      setRetestError((err as Error).message || "Failed to retest salvaged claim.");
    } finally {
      setIsRetesting(false);
    }
  };

  const handleSubmitCounterEvidence = async () => {
    if (!currentCase || !claim || !counterEvidenceText.trim()) return;
    setIsRetesting(true);
    setRetestError(null);
    try {
      const updated = await retestClaim(
        currentCase.id,
        claim.id,
        "counter_evidence",
        counterEvidenceText.trim()
      );
      dispatch?.({ type: "UPDATE_CASE", payload: updated });
      setCounterEvidenceText("");
      setShowCounterInput(false);
    } catch (err: unknown) {
      setRetestError((err as Error).message || "Failed to submit counter-evidence.");
    } finally {
      setIsRetesting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[540px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-8 border-b border-outline-variant shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-space-2">
            <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-normal">
              Evidence
            </h2>
            <span className="sr-only">Evidence</span>
            <span className="font-code-sm text-code-sm text-outline px-space-1.5 py-0.5 rounded border border-outline-variant">
              {formattedClaimId}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit drawer"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-space-8 py-space-6 space-y-space-6">
          {/* The claim */}
          <div>
            <div className="flex items-center justify-between gap-space-2 mb-space-2">
              <span className="font-code-sm text-code-sm uppercase tracking-wider text-outline font-medium">
                The claim
              </span>
              <span
                className={`inline-flex items-center gap-1 px-space-2 py-0.5 rounded border font-code-sm text-code-sm font-semibold ${statusBadge.classes}`}
              >
                <span className="material-symbols-outlined text-[14px]">{statusBadge.icon}</span>
                <span>{statusBadge.label}</span>
              </span>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-4">
              <p className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-relaxed">
                {cleanUiText(claim.statement)}
              </p>
            </div>
          </div>

          {/* Why This Matters */}
          <div>
            <div className="font-code-sm text-code-sm uppercase tracking-wider text-outline mb-space-2 font-medium">
              Why This Matters
            </div>
            <div className="bg-surface-container border border-outline-variant/40 rounded p-space-4">
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {claim.load_bearing ? (
                  <>
                    This is a{" "}
                    <strong className="text-on-surface font-semibold text-error underline decoration-error/50">
                      load-bearing assumption
                    </strong>
                    . If invalidated by real-world market signals or technical limits, the product thesis needs to shift immediately.
                  </>
                ) : (
                  <>
                    This assumption is supporting. If invalidated, it introduces operational friction without collapsing the entire proposal.
                  </>
                )}
              </p>
              <span className="sr-only">
                This assumption is load-bearing: if invalidated, the recommended decision or core business model materially changes.
              </span>
            </div>
          </div>

          {/* Judge / Steel Man Verdict & Reconciliation */}
          {consequence?.verdict_reasoning && (
            <div>
              <div className="font-code-sm text-code-sm uppercase tracking-wider text-primary-container mb-space-2 font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">gavel</span>
                <span>Why this call (Steel Man Verdict)</span>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-4 space-y-space-2">
                <p className="font-body-md text-body-md text-on-surface font-medium leading-relaxed">
                  <SerpApiText text={cleanUiText(consequence.verdict_reasoning)} />
                </p>
                {consequence.impact && (
                  <div className="pt-2 flex items-center gap-2 border-t border-outline-variant/40 text-xs font-mono text-outline">
                    <span>Strategic Impact:</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold uppercase">
                      {consequence.impact}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Steel Man Re-Architecture (Break to Rebuild) */}
          {claim && (claim.salvaged_claim || consequence?.salvaged_claim) && (
            <div className="bg-surface-container-lowest border border-primary-container/30 rounded p-space-4 space-y-3">
              <div className="font-code-sm text-code-sm uppercase tracking-wider text-primary-container font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">build_circle</span>
                <span>Steel Man Re-Architecture (Break to Rebuild)</span>
              </div>
              {(claim.fatal_flaw || consequence?.fatal_flaw) && (
                <div className="text-body-sm text-on-surface">
                  <span className="text-error font-semibold font-mono text-xs uppercase mr-1.5">[Fatal Flaw]:</span>
                  <span><SerpApiText text={cleanUiText(claim.fatal_flaw || consequence?.fatal_flaw || "")} /></span>
                </div>
              )}
              <div className="text-body-sm text-on-surface">
                <span className="text-primary font-semibold font-mono text-xs uppercase mr-1.5">[Salvaged Claim]:</span>
                <span className="font-medium"><SerpApiText text={cleanUiText(claim.salvaged_claim || consequence?.salvaged_claim || "")} /></span>
              </div>
              {(claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged) && (
                <div className="text-body-sm text-on-surface-variant text-xs">
                  <span className="text-outline font-semibold font-mono text-xs uppercase mr-1.5">[Trade-off]:</span>
                  <span><SerpApiText text={cleanUiText(claim.tradeoff_acknowledged || consequence?.tradeoff_acknowledged || "")} /></span>
                </div>
              )}

              {/* Interactive Retest / Break to Rebuild Action */}
              <div className="pt-2 border-t border-primary-container/20 space-y-2">
                <button
                  type="button"
                  disabled={isRetesting}
                  onClick={handleTestSalvaged}
                  className="w-full px-3 py-2 bg-primary-container text-on-primary-container font-mono text-xs font-semibold rounded hover:bg-primary-container/90 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isRetesting ? "progress_activity" : "autorenew"}
                  </span>
                  <span>{isRetesting ? "Retesting Salvaged Claim..." : "Test Salvaged Claim"}</span>
                </button>

                {/* Challenge with counter-evidence toggle */}
                <div className="pt-1">
                  {!showCounterInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCounterInput(true)}
                      className="text-xs font-mono text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_circle</span>
                      <span>Challenge finding with counter-evidence</span>
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={counterEvidenceText}
                        onChange={(e) => setCounterEvidenceText(e.target.value)}
                        placeholder="Paste citation URL, statute, or factual proof challenging this finding..."
                        className="w-full text-xs font-mono p-2.5 rounded bg-surface-container border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary resize-none"
                        rows={3}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCounterInput(false)}
                          className="px-2.5 py-1 text-xs font-mono text-outline hover:text-on-surface"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isRetesting || !counterEvidenceText.trim()}
                          onClick={handleSubmitCounterEvidence}
                          className="px-3 py-1 bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-xs font-mono rounded font-semibold border border-outline-variant disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">send</span>
                          <span>Submit Counter-Evidence</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {retestError && (
                    <p className="mt-1 text-xs font-mono text-error">{retestError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tests run (DESIGN.md Screen 4 §3) */}
          {tests.length > 0 && (
            <div>
              <div className="font-code-sm text-code-sm uppercase tracking-wider text-outline mb-space-2 font-medium">
                {tests.length} tests run
              </div>
              <div className="flex flex-wrap gap-2">
                {tests.map((t) => (
                  <div
                    key={t.id}
                    className="font-mono text-xs px-2.5 py-1.5 rounded bg-surface-container border border-outline-variant text-on-surface flex items-center gap-1.5"
                  >
                    <span className="text-primary-container font-semibold">
                      [{formatTestName(t.failure_mode).toUpperCase()}]
                    </span>
                    <span className="text-outline truncate max-w-[260px]">{t.objective}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Found */}
          <div>
            <div className="flex items-center justify-between mb-space-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-code-sm text-code-sm uppercase tracking-wider text-outline font-medium">
                  Evidence Found
                </span>
                <PoweredBySerpApiBadge variant="header" />
              </div>
              <span className="font-code-sm text-code-sm text-outline">Verified Citation</span>
            </div>

            {allEvidence.length > 0 ? (
              <div className="space-y-3">
                {allEvidence.map((ev, i) => (
                  <div
                    key={i}
                    className="bg-surface-container-lowest border border-outline-variant hover:border-primary/50 transition-colors rounded p-space-4"
                  >
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body-md text-body-md font-semibold text-primary hover:underline flex items-center justify-between gap-space-2 group"
                    >
                      <span className="truncate"><SerpApiText text={cleanUiText(ev.title || truncateUrl(ev.source_url, 45))} /></span>
                      <span className="material-symbols-outlined text-[16px] shrink-0 text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                        open_in_new
                      </span>
                    </a>

                    <div className="font-code-sm text-code-sm text-outline mt-space-1.5 flex items-center gap-space-2 flex-wrap">
                      <span className="font-mono text-primary/80">{getDomain(ev.source_url)}</span>
                      <span>·</span>
                      <span>
                        {ev.retrieved_at
                          ? `Retrieved ${new Date(ev.retrieved_at).toLocaleDateString()}`
                          : "Verified Source"}
                      </span>
                      {(ev.provider === "serpapi" || ev.provider === "duckduckgo" || !ev.provider) && (
                        <PoweredBySerpApiBadge variant="inline" />
                      )}
                      {ev.provider === "fixture" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          via Demo Fixture
                        </span>
                      )}
                    </div>

                    <blockquote className="font-body-sm text-body-sm text-on-surface-variant mt-space-3 pl-space-3 border-l-2 border-primary-container leading-relaxed italic bg-surface-container-low/50 py-1.5 rounded-r">
                      "<SerpApiText text={cleanUiText(ev.snippet)} />"
                    </blockquote>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-space-4">
                <p className="font-body-sm text-body-sm text-outline italic">
                  No direct external citations required. Evaluated against adversarial heuristics and domain constraints.
                </p>
              </div>
            )}
          </div>

          {/* Nuance & Counter-points */}
          <div>
            <div className="font-code-sm text-code-sm uppercase tracking-wider text-outline mb-space-2 font-medium">
              What the {findings.length} tests found
            </div>
            {findings.length > 0 ? (
              <div className="space-y-3">
                {findings.map((f, i) => (
                  <div
                    key={f.test_id || i}
                    className="bg-surface-container-lowest border border-outline-variant/50 rounded p-space-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-high text-primary-container uppercase">
                        [{formatTestName(f.evaluator).toUpperCase()}]
                      </span>
                      {f.confidence !== undefined && (
                        <span className="font-code-sm text-code-sm text-outline">
                          Confidence: {(f.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {f.contradiction && (
                      <p className="font-body-sm text-body-sm text-error font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-error shrink-0 select-none">
                          warning
                        </span>
                        <span><SerpApiText text={cleanUiText(f.contradiction)} /></span>
                      </p>
                    )}
                    <p className="font-body-sm text-body-sm text-on-surface font-medium">
                      <SerpApiText text={cleanUiText(f.result)} />
                    </p>
                    {f.reasoning && f.reasoning !== f.result && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed text-xs">
                        <SerpApiText text={cleanUiText(f.reasoning)} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant/50 rounded p-space-4">
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Evaluated against adversarial heuristics, boundary edge-cases, and operational constraints.
                </p>
              </div>
            )}
          </div>

          {/* What Needs to Change */}
          <div>
            <div className="font-code-sm text-code-sm uppercase tracking-wider text-error font-medium mb-space-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">alt_route</span>
              <span>What Needs to Change</span>
            </div>
            <div className="border-l-2 border-error bg-error-container/20 p-space-4 rounded-r">
              <p className="font-body-md text-body-md text-on-surface leading-relaxed font-medium">
                {cleanUiText(
                  consequence?.recommended_change ||
                    "No immediate plan modification indicated: assumption withstands tested failure modes."
                )}
              </p>
            </div>
          </div>

          {/* How to check */}
          <div>
            <div className="font-code-sm text-code-sm uppercase tracking-wider text-primary font-medium mb-space-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">rocket_launch</span>
              <span>How to check</span>
            </div>
            <div className="border border-primary-container/40 bg-on-primary-container/20 rounded p-space-4">
              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed mb-space-4">
                {cleanUiText(
                  consequence?.next_validation ||
                    (claim.status === "survived"
                      ? "Proceed with execution; re-test if foundational dependencies or pricing change."
                      : "Formulate small-batch experiment to validate core assumption directly with users.")
                )}
              </p>
              <div className="pt-space-3 border-t border-outline-variant/40 flex items-center justify-between">
                <span className="font-code-sm text-code-sm text-outline">
                  {claim.load_bearing ? "Priority: Critical" : "Priority: Standard"}
                </span>
                <button
                  type="button"
                  id="queue-experiment-btn"
                  onClick={() => setIsQueued(!isQueued)}
                  className={`font-code-sm text-code-sm font-semibold px-space-4 py-space-2 rounded transition-all shadow flex items-center gap-1.5 cursor-pointer ${
                    isQueued
                      ? "bg-tertiary-container text-on-tertiary"
                      : "bg-primary hover:bg-primary-fixed-dim text-surface-container-lowest"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">task_alt</span>
                  <span id="queue-label">
                    {isQueued ? `Experiment queued (${formattedClaimId})` : "Mark experiment as queued"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-space-4 pb-space-6 px-space-8 border-t border-outline-variant flex items-center justify-between font-code-sm text-code-sm text-outline shrink-0 bg-surface-container-low">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            <span>Audit Ref:</span>
            <span className="text-on-surface-variant font-mono">
              #{formattedClaimId}-{claim.status ? claim.status.toUpperCase() : "EVALUATED"}
            </span>
          </span>

          <div className="flex items-center gap-space-3">
            <button
              type="button"
              onClick={handleCopyJson}
              className="hover:text-on-surface transition-colors flex items-center gap-1 cursor-pointer"
              title="Copy Raw JSON"
            >
              <span className="material-symbols-outlined text-[15px]">code</span>
              <span>{copiedJson ? "Copied!" : "JSON"}</span>
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleExportBrief}
              className="hover:text-on-surface transition-colors flex items-center gap-1 cursor-pointer"
              title="Export Summary Brief"
            >
              <span className="material-symbols-outlined text-[15px]">file_download</span>
              <span>Export Brief</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
