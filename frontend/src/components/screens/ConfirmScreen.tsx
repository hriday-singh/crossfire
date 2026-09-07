import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { AssignedAgentsCard } from "@/components/features/AssignedAgentsCard";
import { DEFAULT_AGENT_IDS } from "@/lib/agents";
import { SerpApiIcon } from "@/components/ui/serpapi";

export const ConfirmScreen: React.FC = () => {
  const { state, dispatch, confirmAndRun, navigateScreen, toggleAgentSelection } = useCase();
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newClaimText, setNewClaimText] = useState("");

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

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] justify-between">
      <div className="flex flex-col w-full">
        <div className="w-full max-w-[760px] mx-auto py-10 px-4">

          {/* Header Title & Subtext */}
          <div className="mb-6">
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

          {/* Input Gate Advisory Banner (if needs_input returned a redirect guidance) */}
          {currentCase.gate_message && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-body-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-amber-500 shrink-0 mt-0.5">info</span>
              <div className="space-y-1">
                <p className="font-semibold text-on-surface">Specific Decision Guidance</p>
                <p className="text-on-surface-variant leading-relaxed">{currentCase.gate_message}</p>
                {currentCase.claims.length === 0 && (
                  <p className="text-primary-container font-medium text-xs mt-1">
                    Please use "+ Add an assumption" below to specify your hypothesis before running tests.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-2">
            <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant font-semibold">
              Assumptions to Validate
            </span>
            <span className="font-body-xs text-body-xs text-outline">
              {currentCase.claims.length} ready to verify
            </span>
          </div>

          {/* Assumptions Table */}
          <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-low shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container text-label-mono font-label-mono text-xs uppercase tracking-wider text-outline select-none">
                  <th scope="col" className="py-3 px-4 w-12 text-center font-medium">#</th>
                  <th scope="col" className="py-3 px-4 font-medium">Assumption</th>
                  <th scope="col" className="py-3 px-4 w-36 text-center font-medium">Type</th>
                  <th scope="col" className="py-3 px-4 w-24 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody id="claims-container" className="divide-y divide-outline-variant/30">
                {currentCase.claims.map((claim, index) => {
                  const isEditing = editingClaimId === claim.id;
                  const isLoadBearing = claim.load_bearing ?? true;
                  const itemNumber = index + 1;

                  return (
                    <tr
                      key={claim.id}
                      data-id={String(itemNumber)}
                      className="claim-card hover:bg-surface-container-high/60 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center align-top font-code-md text-code-md text-primary-container font-semibold select-none">
                        {itemNumber}
                      </td>

                      <td className="py-3.5 px-4 align-top min-w-0">
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
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveEdit(claim.id)}
                                className="h-7 text-xs bg-primary-container hover:bg-blue-600 text-white transition-colors"
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
                            className="claim-text font-body-md text-body-md font-medium text-on-surface leading-normal outline-none cursor-pointer hover:text-primary transition-colors"
                            title="Click to edit assumption"
                          >
                            {claim.statement}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
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
                      </td>

                      <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing
                                ? handleSaveEdit(claim.id)
                                : handleStartEdit(claim.id, claim.statement)
                            }
                            className="btn-edit p-1.5 text-outline hover:text-primary transition-colors rounded hover:bg-surface-container min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
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
                            className="btn-delete p-1.5 text-outline hover:text-error transition-colors rounded hover:bg-surface-container min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                            title="Remove Claim"
                            aria-label={`Remove claim ${itemNumber}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table Footer: Add Assumption Button / Inline Form */}
            <div className="p-3 bg-surface-container/30 border-t border-outline-variant/40">
              {!isAdding ? (
                <button
                  type="button"
                  id="add-claim-btn"
                  onClick={() => setIsAdding(true)}
                  className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add an assumption</span>
                </button>
              ) : (
                <form
                  onSubmit={handleAddClaimSubmit}
                  className="space-y-3 p-3 bg-surface-container rounded-lg border border-dashed border-outline-variant"
                >
                  <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider font-semibold text-xs">
                    Add New Hypothesis Statement
                  </span>
                  <input
                    type="text"
                    value={newClaimText}
                    onChange={(e) => setNewClaimText(e.target.value)}
                    placeholder="Enter testable hypothesis or architectural assertion..."
                    autoFocus
                    className="w-full bg-surface-container-lowest text-on-surface p-2.5 font-body-md rounded-lg border border-outline-variant outline-none focus:border-primary-container"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      className="bg-primary-container hover:bg-blue-600 text-white transition-colors"
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
            </div>
          </div>

          {/* Assigned Adversarial Agents Suite & Decision Callout */}
          <AssignedAgentsCard
            agentMode={currentCase.agent_mode || "auto"}
            selectedAgents={currentCase.selected_agents || [...DEFAULT_AGENT_IDS]}
            agentRationales={currentCase.agent_rationales}
            onToggleAgent={toggleAgentSelection}
          />

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between gap-4 mt-8 pt-4 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={() => navigateScreen("entry")}
              className="font-body-sm text-body-sm text-outline hover:text-on-surface transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-surface-container cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back</span>
            </button>

              <Button
                type="button"
                id="confirm-run-btn"
                variant="primary"
                onClick={handleConfirmAndRun}
                disabled={
                  currentCase.claims.length === 0 ||
                  state.isConfirming ||
                  state.isStreaming ||
                  currentCase.status === "testing" ||
                  (currentCase.selected_agents && currentCase.selected_agents.length === 0)
                }
                className="bg-primary-container hover:bg-blue-600 text-white font-body-sm text-body-sm font-semibold px-6 py-2.5 rounded-lg active:scale-[0.99] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {state.isConfirming || state.isStreaming || currentCase.status === "testing" ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>INITIALIZING RUNNER...</span>
                  </>
                ) : (
                  <>
                    <span>Run Tests</span>
                    <span className="sr-only">Confirm & Run Tests</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </Button>
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
