import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { AssignedAgentsCard } from "@/components/features/AssignedAgentsCard";
import { DEFAULT_AGENT_IDS } from "@/lib/agents";
import { SerpApiIcon } from "@/components/ui/serpapi";

export const ConfirmScreen: React.FC = () => {
  const { state, dispatch, confirmAndRun, navigateScreen, toggleAgentSelection, acceptProvisionalClaim } = useCase();
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newClaimText, setNewClaimText] = useState("");
  const [clarifyText, setClarifyText] = useState("");
  const { clarify } = useCase();

  const currentCase = state.currentCase;
  if (!currentCase) return null;

  const handleStartEdit = (claimId: string, currentStatement: string) => {
    setEditingClaimId(claimId);
    setEditingText(currentStatement);
  };

  const handleSaveEdit = (claimId: string) => {
    if (editingText.trim()) {
      dispatch({
        type: "UPDATE_CLAIM_STATEMENT",
        payload: { claimId, statement: editingText.trim() },
      });
    }
    setEditingClaimId(null);
  };

  const handleDeleteClaim = (e: React.MouseEvent, claimId: string) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_CLAIM", payload: { claimId } });
  };

  const handleToggleLoadBearing = (e: React.MouseEvent, claimId: string) => {
    e.stopPropagation();
    dispatch({ type: "TOGGLE_CLAIM_LOAD_BEARING", payload: { claimId } });
  };

  const handleAddClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimText.trim()) return;
    dispatch({ type: "ADD_CLAIM", payload: { statement: newClaimText.trim() } });
    setNewClaimText("");
    setIsAdding(false);
  };

  const handleConfirmAndRun = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    confirmAndRun();
  };

  const handleClarifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyText.trim()) return;
    clarify(clarifyText.trim());
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] justify-between">
      <div className="flex flex-col w-full">
        <div className="w-full max-w-[760px] mx-auto py-10 px-4">

          {/* Header Title & Subtext */}
          <div className="mb-6">
            {currentCase.status === "needs_input" ? (
              <div className="space-y-4 mb-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-500 font-semibold font-label-mono uppercase tracking-wider text-xs">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Clarification Required
                  </div>
                  <h1 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-2">
                    {currentCase.gate_message}
                  </h1>
                  {currentCase.clarify_interpretation && (
                    <p className="text-on-surface-variant font-body-sm text-sm mb-4 leading-relaxed">
                      {currentCase.clarify_interpretation}
                    </p>
                  )}
                  {currentCase.clarify_missing && currentCase.clarify_missing.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-on-surface-variant mb-5 space-y-1">
                      {currentCase.clarify_missing.map((missing, i) => (
                        <li key={i}>{missing}</li>
                      ))}
                    </ul>
                  )}
                  
                  <form onSubmit={handleClarifySubmit} className="mt-4 flex flex-col gap-3">
                    <textarea
                      value={clarifyText}
                      onChange={(e) => setClarifyText(e.target.value)}
                      placeholder="Add this detail..."
                      className="w-full bg-surface-container-lowest text-on-surface p-3 font-body-sm rounded-lg border border-outline-variant outline-none focus:border-primary-container"
                      rows={3}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!clarifyText.trim() || state.isConfirming || state.isStreaming}
                      className="w-fit bg-primary-container hover:brightness-110 text-on-primary-container transition-colors shadow-sm self-end disabled:opacity-50 flex items-center gap-2"
                    >
                      {state.isConfirming || state.isStreaming ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">
                            progress_activity
                          </span>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <span>Add this detail</span>
                          <span className="material-symbols-outlined text-[18px]">send</span>
                        </>
                      )}
                    </Button>
                  </form>
                </div>
                {currentCase.clarify_round && currentCase.clarify_round >= 1 && currentCase.claims.length === 0 && (
                  <div className="text-center">
                    <p className="text-primary-container font-medium text-sm mb-2">
                      Alternatively, specify your own hypotheses directly:
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAdding(true)}
                      className="text-sm font-medium text-on-surface-variant hover:text-on-surface flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded hover:bg-surface-container transition-colors border border-outline-variant/40 hover:border-outline-variant"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      + Add an assumption
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="font-headline-lg text-headline-lg font-semibold text-on-surface tracking-tight mb-1.5">
                    We identified{" "}
                    <span className="text-primary-container" id="claim-count">
                      {currentCase.claims.length}
                    </span>{" "}
                    claims to test
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Review the extracted assumptions below. You can edit, remove, or add claims before running tests.
                  </p>
                </div>

                {/* Prominent Steelman Bot Head on the right */}
                <div className="flex flex-col items-center shrink-0 p-2.5 rounded-xl bg-surface-container-low border border-red-500/30 shadow-lg" title="Crucible Arbiter / Steelman Bot">
                  <div className="relative group cursor-pointer">
                    <div className="w-14 h-14 rounded-xl bg-surface-container border border-red-500/40 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.3)] group-hover:border-red-500/70 transition-colors">
                      <img
                        src="/steelman_head.webp"
                        alt="Steelman Bot Head"
                        className="w-11 h-11 object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] group-hover:scale-110 transition-transform"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Clean Decision Echo Card */}
          <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-space-4 mb-8">
            <div className="text-label-mono font-label-mono uppercase tracking-wider text-outline font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">lightbulb</span>
              <span>Decision Under Test</span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface font-medium leading-relaxed">
              {currentCase.raw_input}
            </p>
            {currentCase.context && (
              <div className="mt-3 pt-3 border-t border-outline-variant/30 text-left">
                <div className="flex items-center gap-1 text-[11px] font-code-sm text-outline mb-1 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[13px] text-primary">attach_file</span>
                  <span>Attached Context & References</span>
                </div>
                <div className="font-code-sm text-xs text-on-surface-variant bg-surface-container rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {currentCase.context}
                </div>
              </div>
            )}
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-2">
            <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant font-semibold">
              Assumptions to Validate
            </span>
            <span className="font-body-xs text-body-xs text-outline">
              {currentCase.claims.length} ready to verify
            </span>
          </div>

          {/* Vertical Stack of Assumption Cards */}
          <div className="flex flex-col gap-3" id="claims-container">
            {currentCase.claims.map((claim, index) => {
              const isEditing = editingClaimId === claim.id;
              const itemNumber = index + 1;
              const isLoadBearing = claim.load_bearing ?? true;

              return (
                <div
                  key={claim.id}
                  data-id={String(itemNumber)}
                  className={`claim-card bg-surface-container border rounded-xl p-5 flex items-start justify-between group transition-all duration-150 ${
                    claim.provisional
                      ? "border-amber-400/60 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/10"
                      : "border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-high"
                  }`}
                >
                  <div className="flex items-start min-w-0 pr-4 flex-1">
                    <span className="font-code-md text-code-md text-primary-container font-semibold mr-3 select-none shrink-0 pt-0.5">
                      {itemNumber}
                    </span>

                    <div className="flex-1 min-w-0">
                      {claim.provisional && !isEditing && (
                        <div className="mb-2">
                          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            Provisional
                          </span>
                        </div>
                      )}
                      
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit(claim.id);
                              } else if (e.key === "Escape") {
                                setEditingClaimId(null);
                              }
                            }}
                            className="w-full rounded-lg bg-surface-container-lowest text-on-surface p-2 font-body-md border border-outline-variant outline-none focus:border-primary-container"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleSaveEdit(claim.id)}
                              className="h-7 text-xs bg-primary-container hover:brightness-110 text-on-primary-container transition-colors"
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingClaimId(null)}
                              className="h-7 text-xs text-outline hover:text-on-surface"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleStartEdit(claim.id, claim.statement)}
                          className="claim-text font-body-md text-body-md font-medium text-on-surface leading-normal outline-none cursor-pointer"
                        >
                          {claim.statement}
                        </div>
                      )}

                      {!isEditing && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleLoadBearing(e, claim.id)}
                            title="Click to toggle load-bearing"
                            className={`px-2 py-0.5 rounded font-code-sm text-code-sm font-medium border transition-colors cursor-pointer ${
                              isLoadBearing
                                ? "bg-primary-container/10 text-primary-container border-primary-container/20 hover:bg-primary-container/20"
                                : "bg-surface-container-high text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-highest"
                            }`}
                          >
                            {isLoadBearing ? "Load-bearing" : "Secondary"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {claim.provisional && !isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptProvisionalClaim(claim.id);
                        }}
                        className="p-2 text-amber-600 hover:text-amber-500 hover:bg-amber-500/10 transition-colors rounded min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                        title="Accept inferred claim"
                        aria-label="Accept provisional claim"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? handleSaveEdit(claim.id)
                          : handleStartEdit(claim.id, claim.statement)
                      }
                      className="btn-edit p-2 text-outline hover:text-primary transition-colors rounded hover:bg-surface-container-lowest min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title={isEditing ? "Save Claim" : "Edit Claim"}
                      aria-label={isEditing ? `Save claim ${itemNumber}` : `Edit claim ${itemNumber}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isEditing ? "check" : "edit"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClaim(e, claim.id)}
                      className="btn-delete p-2 text-outline hover:text-error transition-colors rounded hover:bg-surface-container-lowest min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title="Remove Claim"
                      aria-label={`Remove claim ${itemNumber}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Assumption Button */}
          {!isAdding && (
            <div className="mt-3">
              <button
                type="button"
                id="add-claim-btn"
                onClick={() => setIsAdding(true)}
                className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface flex items-center gap-2 cursor-pointer py-2 px-3 rounded-lg hover:bg-surface-container transition-colors justify-center sm:justify-start border border-outline-variant/40 hover:border-outline-variant w-fit"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add an assumption</span>
              </button>
            </div>
          )}

          {/* Inline Add Claim Form */}
          {isAdding && (
            <form
              onSubmit={handleAddClaimSubmit}
              className="mt-4 bg-surface-container border border-dashed border-outline-variant rounded-xl p-4 space-y-3"
            >
              <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider font-semibold">
                Add New Hypothesis Statement
              </span>
              <input
                type="text"
                value={newClaimText}
                onChange={(e) => setNewClaimText(e.target.value)}
                placeholder="Enter testable hypothesis or architectural assertion..."
                autoFocus
                className="w-full bg-surface-container-lowest text-on-surface p-3 font-body-md rounded-lg border border-outline-variant outline-none focus:border-primary-container"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  className="bg-primary-container hover:brightness-110 text-on-primary-container transition-colors"
                >
                  Save Hypothesis
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                  className="text-outline hover:text-on-surface"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Assigned Adversarial Agents Suite & Decision Callout */}
          <AssignedAgentsCard
            agentMode={currentCase.agent_mode || "auto"}
            selectedAgents={currentCase.selected_agents || [...DEFAULT_AGENT_IDS]}
            agentRationales={currentCase.agent_rationales}
            onToggleAgent={toggleAgentSelection}
          />

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between gap-4 mt-8 pt-4 border-t border-outline-variant/30 flex-wrap">
            <button
              type="button"
              onClick={() => navigateScreen("entry")}
              className="font-body-sm text-body-sm text-outline hover:text-on-surface transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-surface-container cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back</span>
            </button>

            {currentCase.status !== "needs_input" && (
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  id="confirm-run-btn"
                  variant="primary"
                  onClick={handleConfirmAndRun}
                  disabled={
                    currentCase.claims.length === 0 ||
                    currentCase.claims.some((c) => c.provisional) ||
                    state.isConfirming ||
                    state.isStreaming ||
                    currentCase.status === "testing" ||
                    (currentCase.selected_agents && currentCase.selected_agents.length === 0)
                  }
                  className="bg-primary-container hover:brightness-110 text-on-primary-container font-body-sm text-body-sm font-semibold px-6 py-2.5 rounded-lg active:scale-[0.99] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {state.isConfirming || state.isStreaming || currentCase.status === "testing" ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Test already running</span>
                    </>
                  ) : currentCase.status === "done" ? (
                    <>
                      <span>Rerun</span>
                      <span className="sr-only">Rerun Tests</span>
                      <span className="material-symbols-outlined text-[18px]">replay</span>
                    </>
                  ) : (
                    <>
                      <span>Run Tests</span>
                      <span className="sr-only">Confirm & Run Tests</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </Button>
                {currentCase.claims.some((c) => c.provisional) && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-500 font-medium">
                    Confirm or remove the inferred claims first.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-space-3 px-space-6 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-space-4 font-body-xs text-body-xs text-outline flex-wrap">
          <span>Crossfire Decision Verification</span>
          <span>·</span>
          <a
            href="https://serpapi.com?utm_source=crossfire&utm_medium=confirm_footer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-on-surface transition-colors"
          >
            <span>Search powered by</span>
            <SerpApiIcon size={12} />
            <span className="font-semibold text-primary">SerpApi</span>
          </a>
        </div>
        <div className="font-body-xs text-body-xs text-outline">Crossfire</div>
      </footer>
    </div>
  );
};
