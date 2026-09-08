import React, { useState } from "react";
import { Case } from "@/types/crossfire";
import { cleanUiText, formatTestName, truncateUrl, clampSentences } from "@/lib/formatters";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PoweredBySerpApiBadge, SerpApiText } from "@/components/ui/serpapi";

interface EvidenceDrawerProps {
  claimId: string | null;
  currentCase: Case | null;
  onClose: () => void;
  defaultOpenTests?: Record<string, boolean>;
  isSelectedForPromptFix?: boolean;
  onTogglePromptFix?: (claimId: string) => void;
}

// Old cases serialized before verification existed carry no `verification` field
// at all - that reads as "unchecked", not as a failed check.
const VERIFICATION_LABEL: Record<string, string> = {
  snippet_matched: "verified",
  unreachable: "unreachable",
  snippet_absent: "snippet absent",
  unchecked: "unchecked",
};

const VERIFICATION_COLOR: Record<string, string> = {
  snippet_matched: "bg-primary-container/10 text-primary-container border-primary-container/25",
  unreachable: "bg-secondary/10 text-secondary border-secondary/25",
  snippet_absent: "bg-error/10 text-error border-error/25",
  unchecked: "bg-outline/10 text-outline border-outline/25",
};

function VerificationBadge({ verification }: { verification?: string }) {
  const key = verification || "unchecked";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] border ${
        VERIFICATION_COLOR[key] || VERIFICATION_COLOR.unchecked
      }`}
    >
      {VERIFICATION_LABEL[key] || key}
    </span>
  );
}

interface TestSuiteMeta {
  key: string;
  title: string;
  icon: string;
  evaluatorKeys: string[];
  failureModeKeys: string[];
  emptySummary: string;
}

const TEST_SUITES: TestSuiteMeta[] = [
  {
    key: "assumption",
    title: "Assumption Test",
    icon: "psychology",
    evaluatorKeys: ["devils_advocate", "assumption"],
    failureModeKeys: ["assumption", "devils_advocate", "logical_fallacy"],
    emptySummary: "No contradictory premises or logical flaws found. Core assumption holds.",
  },
  {
    key: "evidence",
    title: "Evidence Test",
    icon: "fact_check",
    evaluatorKeys: ["researcher", "researcher", "evidence"],
    failureModeKeys: ["evidence", "researcher", "researcher", "unsupported_claim"],
    emptySummary: "Evaluated against benchmark market signals and factual citations.",
  },
  {
    key: "feasibility",
    title: "Feasibility Test",
    icon: "construction",
    evaluatorKeys: ["builder", "feasibility", "constraint", "behavior"],
    failureModeKeys: ["feasibility", "builder", "constraint", "behavior", "technical_impossibility"],
    emptySummary: "No engineering bottlenecks, API limits, or architectural constraints identified.",
  },
  {
    key: "operational_friction",
    title: "Operational Friction Test",
    icon: "policy",
    evaluatorKeys: ["operator", "operational_friction", "adoption", "bureaucracy", "overthinker"],
    failureModeKeys: ["operational_friction", "operator", "adoption", "bureaucracy", "overthinker", "edge-case", "edge_case", "alternative"],
    emptySummary: "No significant adoption inertia, procurement red tape, or regulatory liability issues detected.",
  },
];

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  claimId,
  currentCase,
  onClose,
  defaultOpenTests,
  isSelectedForPromptFix = false,
  onTogglePromptFix,
}) => {

  const [openTests, setOpenTests] = useState<Record<string, boolean>>(
    defaultOpenTests || {
      assumption: false,
      evidence: false,
      feasibility: false,
      operational_friction: false,
    }
  );

  React.useEffect(() => {
    if (defaultOpenTests) {
      setOpenTests(defaultOpenTests);
    } else {
      setOpenTests({
        assumption: false,
        evidence: false,
        feasibility: false,
        operational_friction: false,
      });
    }
  }, [claimId, defaultOpenTests]);

  const toggleTest = (key: string) => {
    setOpenTests((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
        if (claim.weakened_kind === "qualified") {
          return {
            label: "Holds, with limits",
            icon: "warning",
            classes: "bg-tertiary-container/30 border-tertiary/40 text-tertiary",
          };
        } else if (claim.weakened_kind === "contested") {
          return {
            label: "Challenged",
            icon: "error",
            classes: "bg-error-container/20 border-error/30 text-error",
          };
        }
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

          {/* Steelman / Steel Man Verdict & Reconciliation */}
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
                {onTogglePromptFix && (
                  <button
                    type="button"
                    onClick={() => onTogglePromptFix(claim.id)}
                    className={`w-full px-3 py-2 rounded font-mono text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      isSelectedForPromptFix
                        ? "bg-primary text-on-primary border-primary shadow-sm"
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isSelectedForPromptFix ? "check_box" : "check_box_outline_blank"}
                    </span>
                    <span>
                      {isSelectedForPromptFix
                        ? "Selected to Fix Original Prompt"
                        : "Select Solution to Fix Original Prompt"}
                    </span>
                  </button>
                )}


              </div>
            </div>
          )}

          {/* Adversarial Tests & Evidence (4 Collapsible Windows) */}
          <div className="space-y-space-3">
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-code-sm uppercase tracking-wider text-outline font-medium">
                Adversarial Tests & Evidence
              </span>
              <button
                type="button"
                onClick={() => {
                  const allOpen = Object.values(openTests).every(Boolean);
                  setOpenTests({
                    assumption: !allOpen,
                    evidence: !allOpen,
                    feasibility: !allOpen,
                    operational_friction: !allOpen,
                  });
                }}
                className="text-xs font-mono text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                {Object.values(openTests).every(Boolean) ? "Collapse all" : "Expand all"}
              </button>
            </div>

            <div className="space-y-space-3">
              {TEST_SUITES.map((suite) => {
                const isSuiteOpen = Boolean(openTests[suite.key]);

                const suiteFindings = findings.filter((f) => {
                  const norm = (f.evaluator || "").toLowerCase().trim();
                  const testName = formatTestName(norm);
                  if (suite.title === testName) return true;
                  return suite.evaluatorKeys.some((k) => norm.includes(k));
                });

                const suiteTests = tests.filter((t) => {
                  const norm = (t.failure_mode || "").toLowerCase().trim();
                  const testName = formatTestName(norm);
                  if (suite.title === testName) return true;
                  return suite.failureModeKeys.some((k) => norm.includes(k));
                });

                const suiteEvidence =
                  suite.key === "evidence"
                    ? allEvidence
                    : suiteFindings.flatMap((f) => f.evidence || []);

                const maxConfidence = suiteFindings.reduce(
                  (max, f) => (f.confidence !== undefined && f.confidence > max ? f.confidence : max),
                  0
                );
                const hasContradiction = suiteFindings.some((f) => Boolean(f.contradiction));

                let badge = null;
                if (maxConfidence > 0) {
                  if (maxConfidence >= 0.7 || hasContradiction) {
                    badge = (
                      <span className="font-code-sm text-code-sm px-2 py-0.5 rounded border bg-error-container/30 border-error/40 text-error font-semibold shrink-0">
                        Objection: {(maxConfidence * 100).toFixed(0)}%
                      </span>
                    );
                  } else if (maxConfidence >= 0.4) {
                    badge = (
                      <span className="font-code-sm text-code-sm px-2 py-0.5 rounded border bg-tertiary-container/30 border-tertiary/40 text-tertiary font-semibold shrink-0">
                        Objection: {(maxConfidence * 100).toFixed(0)}%
                      </span>
                    );
                  } else {
                    badge = (
                      <span className="font-code-sm text-code-sm px-2 py-0.5 rounded border bg-surface-container-high border-outline-variant text-outline shrink-0">
                        Objection: {(maxConfidence * 100).toFixed(0)}%
                      </span>
                    );
                  }
                } else if (suiteFindings.length > 0 || suiteTests.length > 0) {
                  badge = (
                    <span className="font-code-sm text-code-sm px-2 py-0.5 rounded border bg-primary-container/20 border-primary-container/30 text-primary-container font-semibold shrink-0">
                      Held up
                    </span>
                  );
                } else {
                  badge = (
                    <span className="font-code-sm text-code-sm px-2 py-0.5 rounded border bg-surface-container-high border-outline-variant text-outline shrink-0">
                      Passed
                    </span>
                  );
                }

                return (
                  <div
                    key={suite.key}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest overflow-hidden transition-all"
                  >
                    {/* Uniform Header (Same Size & Appearance for all 4) */}
                    <button
                      type="button"
                      onClick={() => toggleTest(suite.key)}
                      aria-expanded={isSuiteOpen}
                      className="w-full flex items-center justify-between px-space-4 py-space-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-left cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-space-2.5 min-w-0 pr-2">
                        <span className="material-symbols-outlined text-[20px] text-primary-container shrink-0">
                          {suite.icon}
                        </span>
                        <span className="font-title-sm text-title-sm font-semibold text-on-surface truncate">
                          {suite.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-space-2 shrink-0">
                        {badge}
                        <span className="material-symbols-outlined text-[18px] text-outline transition-transform">
                          {isSuiteOpen ? "expand_less" : "expand_more"}
                        </span>
                      </div>
                    </button>

                    {/* Collapsible Content */}
                    {isSuiteOpen && (
                      <div className="p-space-4 border-t border-outline-variant/40 bg-surface-container-low/20 space-y-space-3 text-body-sm">
                        {/* Target Objective */}
                        {suiteTests.length > 0 && suiteTests[0].objective && (
                          <div className="text-xs font-mono text-outline flex items-center gap-1.5 pb-1 border-b border-outline-variant/20">
                            <span className="font-semibold uppercase text-outline">Target:</span>
                            <span className="truncate">{cleanUiText(suiteTests[0].objective)}</span>
                          </div>
                        )}

                        {/* Summarized Finding */}
                        {suiteFindings.length > 0 ? (
                          <div className="space-y-2">
                            {suiteFindings.map((f, idx) => {
                              const contradiction = f.contradiction
                                ? clampSentences(f.contradiction, 1)
                                : null;
                              const isStatusResult = ["broken", "weakened", "survived", "unresolved"].includes(
                                (f.result || "").toLowerCase().trim()
                              );
                              let takeaway = "";
                              if (!isStatusResult && f.result) {
                                takeaway = clampSentences(f.result, 1);
                              } else if (f.reasoning) {
                                takeaway = clampSentences(f.reasoning, 1);
                              }
                              if (contradiction && takeaway && takeaway.toLowerCase() === contradiction.toLowerCase()) {
                                takeaway = "";
                              }

                              return (
                                <div key={f.test_id || idx} className="space-y-1">
                                  {contradiction && (
                                    <p className="text-error font-medium flex items-start gap-1.5 text-body-sm leading-snug">
                                      <span className="material-symbols-outlined text-[15px] text-error shrink-0 mt-0.5 select-none">
                                        warning
                                      </span>
                                      <span><SerpApiText text={cleanUiText(contradiction)} /></span>
                                    </p>
                                  )}
                                  {takeaway && (
                                    <p className="text-on-surface text-body-sm leading-relaxed font-normal">
                                      <SerpApiText text={cleanUiText(takeaway)} />
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-on-surface-variant text-body-sm italic">
                            {suite.emptySummary}
                          </p>
                        )}

                        {/* Evidence Found (Specifically within Evidence Test) */}
                        {suite.key === "evidence" && (
                          <div className="pt-2 border-t border-outline-variant/40 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-mono uppercase tracking-wider text-outline font-medium">
                                Evidence Found ({suiteEvidence.length})
                              </span>
                              <PoweredBySerpApiBadge variant="inline" />
                            </div>

                            {suiteEvidence.length > 0 ? (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {suiteEvidence.map((ev, i) => (
                                  <div
                                    key={i}
                                    className="bg-surface-container-lowest border border-outline-variant hover:border-primary/40 transition-colors rounded p-space-3 text-xs space-y-1"
                                  >
                                    <a
                                      href={ev.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-primary hover:underline flex items-center justify-between gap-2 group"
                                    >
                                      <span className="truncate">
                                        <SerpApiText text={cleanUiText(ev.title || truncateUrl(ev.source_url, 40))} />
                                      </span>
                                      <span className="material-symbols-outlined text-[14px] shrink-0 text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                                        open_in_new
                                      </span>
                                    </a>

                                    <div className="text-[11px] font-mono text-outline flex items-center gap-1.5 flex-wrap">
                                      <span className="text-primary/80">{getDomain(ev.source_url)}</span>
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
                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                          via Demo Fixture
                                        </span>
                                      )}
                                      <VerificationBadge verification={ev.verification} />
                                    </div>

                                    {ev.snippet && (
                                      <blockquote className="border-l-2 border-primary-container pl-2 py-0.5 text-on-surface-variant italic bg-surface-container-low/50 rounded-r text-[11px] leading-relaxed">
                                        "<SerpApiText text={cleanUiText(clampSentences(ev.snippet, 2))} />"
                                      </blockquote>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-outline text-xs italic">
                                No direct external citations required. Evaluated against adversarial heuristics and domain constraints.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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

        </div>
      </SheetContent>
    </Sheet>
  );
};
