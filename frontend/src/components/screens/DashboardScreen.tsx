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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [claimsExpanded, setClaimsExpanded] = useState(true);

  const currentCase = state.currentCase;
  const isTesting = state.isStreaming || currentCase?.status === "testing";

  // Steel Man prompt fixer state
  const [selectedFixClaimIds, setSelectedFixClaimIds] = useState<Set<string>>(() => {
    if (!currentCase) return new Set();
    const salvageable = getSalvageableClaims(currentCase);
    return new Set(salvageable.map((c) => c.id));
  });

  const [improvedPrompt, setImprovedPrompt] = useState<string>(() => {
    if (!currentCase) return "";
    const salvageable = getSalvageableClaims(currentCase);
    const allIds = new Set(salvageable.map((c) => c.id));
    return generateImprovedPrompt(currentCase.raw_input, currentCase.claims, allIds, currentCase);
  });

  // Sync when case changes
  useEffect(() => {
    if (currentCase) {
      const salvageable = getSalvageableClaims(currentCase);
      const allIds = new Set(salvageable.map((c) => c.id));
      setSelectedFixClaimIds(allIds);
      setImprovedPrompt(
        generateImprovedPrompt(currentCase.raw_input, currentCase.claims, allIds, currentCase)
      );
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
  }, [currentCase]);

  const handleClearAllFixes = useCallback(() => {
    if (!currentCase) return;
    setSelectedFixClaimIds(new Set());
    setImprovedPrompt(currentCase.raw_input);
  }, [currentCase]);

  const handleResetPrompt = useCallback(() => {
    if (!currentCase) return;
    setSelectedFixClaimIds(new Set());
    setImprovedPrompt(currentCase.raw_input);
  }, [currentCase]);

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

  const handleCopy = async () => {
    const brief = formatDecisionMemoMarkdown(currentCase);
    await copyToClipboard(brief);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
  };

  const handleDownloadMD = () => {
    const brief = formatDecisionMemoMarkdown(currentCase);
    const blob = new Blob([brief], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Crossfire_Decision_Memo.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    const brief = formatDecisionMemoMarkdown(currentCase);
    
    // Very basic markdown to HTML for printing
    const lines = brief.split('\n');
    let formattedHtml = '';
    let inList = false;

    lines.forEach(line => {
      // Bold, Italic, Code, Links
      let formattedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:#eee;padding:2px 4px;border-radius:3px;">$1</code>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#0056b3;text-decoration:none;">$1</a>');

      if (formattedLine.startsWith('### ')) {
        formattedHtml += `<h3>${formattedLine.substring(4)}</h3>\n`;
      } else if (formattedLine.startsWith('## ')) {
        formattedHtml += `<h2>${formattedLine.substring(3)}</h2>\n`;
      } else if (formattedLine.startsWith('# ')) {
        formattedHtml += `<h1>${formattedLine.substring(2)}</h1>\n`;
      } else if (formattedLine.startsWith('> ')) {
        formattedHtml += `<blockquote style="border-left: 4px solid #ccc; margin: 10px 0; padding: 10px 20px; background: #f9f9f9; color: #555;">${formattedLine.substring(2)}</blockquote>\n`;
      } else if (formattedLine.startsWith('- ')) {
        if (!inList) { formattedHtml += '<ul>\n'; inList = true; }
        formattedHtml += `<li>${formattedLine.substring(2)}</li>\n`;
      } else if (formattedLine.startsWith('---')) {
        formattedHtml += '<hr style="border:0; border-top:1px solid #ddd; margin:20px 0;" />\n';
      } else {
        if (inList && !formattedLine.trim()) return; // skip empty lines right after list
        if (inList && formattedLine.trim()) { formattedHtml += '</ul>\n'; inList = false; }
        if (formattedLine.trim() !== '') {
          formattedHtml += `<p>${formattedLine}</p>\n`;
        }
      }
    });
    if (inList) formattedHtml += '</ul>\n';

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Decision Memo</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
            h1, h2, h3 { color: #222; margin-top: 1.5em; margin-bottom: 0.5em; }
            h1 { font-size: 2em; border-bottom: 2px solid #eaeaea; padding-bottom: 0.3em; }
            h2 { font-size: 1.5em; border-bottom: 1px solid #eaeaea; padding-bottom: 0.3em; }
            h3 { font-size: 1.17em; }
            p { margin: 0.5em 0; }
            ul { margin: 0.5em 0; padding-left: 20px; }
            li { margin: 0.3em 0; }
            blockquote p { margin: 0; }
            @media print {
              body { padding: 0; max-width: 100%; }
            }
          </style>
        </head>
        <body>
          ${formattedHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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

            <div className="flex items-center">
               <Dialog>
                 <DialogTrigger asChild>
                   <button
                     className="px-6 py-3 rounded-lg bg-on-surface hover:bg-on-surface/90 text-surface font-body-sm text-sm font-medium transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap"
                   >
                     <span className="material-symbols-outlined text-[18px]">file_download</span>
                     Export Memo
                   </button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-md bg-surface-container-lowest border-outline-variant shadow-lg rounded-2xl p-6">
                   <DialogHeader className="mb-4">
                     <DialogTitle className="font-headline-sm text-headline-sm font-semibold text-on-surface">Export Memo</DialogTitle>
                   </DialogHeader>
                   <div className="flex flex-col gap-3">
                     <button onClick={handleCopy} className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low hover:border-outline-variant hover:bg-surface-container transition-all cursor-pointer w-full text-left">
                       <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">{copiedMemo ? "check" : "content_copy"}</span>
                       <div>
                         <div className="font-title-sm text-title-sm text-on-surface font-semibold">{copiedMemo ? "Copied!" : "Copy to Clipboard"}</div>
                         <div className="font-body-sm text-[13px] text-on-surface-variant">Copy the full markdown to your clipboard</div>
                       </div>
                     </button>
                     <button onClick={handleDownloadMD} className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low hover:border-outline-variant hover:bg-surface-container transition-all cursor-pointer w-full text-left">
                       <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">article</span>
                       <div>
                         <div className="font-title-sm text-title-sm text-on-surface font-semibold">Export as .MD</div>
                         <div className="font-body-sm text-[13px] text-on-surface-variant">Save as a Markdown file</div>
                       </div>
                     </button>
                     <button onClick={handlePrintPDF} className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low hover:border-outline-variant hover:bg-surface-container transition-all cursor-pointer w-full text-left">
                       <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">picture_as_pdf</span>
                       <div>
                         <div className="font-title-sm text-title-sm text-on-surface font-semibold">Export to PDF</div>
                         <div className="font-body-sm text-[13px] text-on-surface-variant">Print or save as a PDF document</div>
                       </div>
                     </button>
                   </div>
                 </DialogContent>
               </Dialog>
            </div>
          </div>

          {/* Verdict Block */}
          <VerdictBlock
            currentCase={currentCase}
            onSelectClaim={(id) => selectClaim(id)}
            isTesting={isTesting}
            onStatusClick={(statusFilter) => {
              setFilterStatus(statusFilter);
              const el = document.getElementById("claims-in-detail");
              if (el) el.scrollIntoView({ behavior: "smooth" });
              setClaimsExpanded(true);
            }}
          />
          {/* Claims in Detail Section */}
          <div id="claims-in-detail" className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest overflow-hidden mt-space-6 shadow-sm">
            {/* Header / Expand Collapse */}
            <div 
              onClick={() => setClaimsExpanded(!claimsExpanded)}
              className="flex items-center justify-between px-space-6 py-space-5 hover:bg-surface-container transition-colors cursor-pointer select-none"
            >
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Claims in Detail
              </h3>
              <div className="flex items-center gap-3">
                <div className="p-1 text-on-surface flex items-center justify-center pointer-events-none">
                  <span 
                    className="material-symbols-outlined text-[24px] transition-transform duration-200"
                    style={{ transform: claimsExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {claimsExpanded && (
              <div className="px-space-6 pb-space-6 border-t border-outline-variant/60 pt-space-6">
                {/* Filter & Sort Bar */}
                <div className="flex items-center justify-between gap-space-4 mb-space-5">
                  <div className="flex items-center gap-space-2 flex-wrap">
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
              </div>
            )}
          </div>

          {/* Steel Man Prompt Fixer Workbench */}
          {!isTesting && (
            <div id="quick-fix-section" className="mt-space-6">
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
              />
            </div>
          )}

          {/* Live Activity Feed */}
          <div className="mt-space-6">
            {(isTesting || state.activities.length > 0 || (currentCase?.activities && currentCase.activities.length > 0)) && (
              <LiveActivityFeed
                activities={state.activities.length > 0 ? state.activities : (currentCase?.activities || [])}
                isStreaming={isTesting}
              />
            )}
          </div>
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
