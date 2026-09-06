import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { AssignedAgentsCard } from "@/components/features/AssignedAgentsCard";
import { DEFAULT_AGENT_IDS } from "@/lib/agents";
import { PoweredBySerpApiBadge, SerpApiIcon } from "@/components/ui/serpapi";

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

  const getClaimCategory = (statement: string, index: number) => {
    const s = statement.toLowerCase();
    if (s.includes("trust") || s.includes("student") || s.includes("user") || s.includes("customer")) {
      return "Behavioral trust & adoption";
    }
    if (s.includes("competitor") || s.includes("market") || s.includes("pricing") || s.includes("revenue") || s.includes("cost")) {
      return "Market dynamics & unit economics";
    }
    if (s.includes("portal") || s.includes("api") || s.includes("technical") || s.includes("infra") || s.includes("scale") || s.includes("ai")) {
      return "Technical feasibility";
    }
    if (s.includes("legal") || s.includes("compliance") || s.includes("security") || s.includes("privacy")) {
      return "Regulatory & compliance";
    }
    return index % 2 === 0 ? "Strategic premise" : "Operational requirement";
  };

  const getClaimRisk = (claim: { load_bearing?: boolean | null }) => {
    if (claim.load_bearing === false) {
      return { label: "Supporting", color: "text-outline" };
    }
    if (claim.load_bearing === true) {
      return { label: "High Impact", color: "text-error" };
    }
    return { label: "Awaiting Scrutiny", color: "text-tertiary" };
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] justify-between">
      <div className="flex flex-col w-full">
        <div className="w-full max-w-[760px] mx-auto py-10 px-4">
          {/* Clean Step Indicator */}
          <div className="flex items-center gap-2 mb-3 text-body-xs font-code-sm uppercase tracking-wider text-primary-container font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-primary-container" />
            <span>Step 2 of 4 · Review Extracted Claims</span>
          </div>

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

          {/* SerpApi Live Evidence Verification Banner */}
          <PoweredBySerpApiBadge variant="banner" className="mb-6" />

          {/* Section Header */}
          <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant font-semibold">
                Assumptions to Validate
              </span>
              <PoweredBySerpApiBadge variant="header" />
            </div>
            <span className="font-body-xs text-body-xs text-outline">
              {currentCase.claims.length} ready to verify
            </span>
          </div>

          {/* Vertical Stack of Assumption Cards */}
          <div className="flex flex-col gap-3" id="claims-container">
            {currentCase.claims.map((claim, index) => {
              const isEditing = editingClaimId === claim.id;
              const formattedId = `C-${String(index + 1).padStart(2, "0")}`;
              const category = getClaimCategory(claim.statement, index);
              const risk = getClaimRisk(claim);
              const isLoadBearing = claim.load_bearing ?? true;

              return (
                <div
                  key={claim.id}
                  data-id={formattedId}
                  className="claim-card bg-surface-container border border-outline-variant/40 rounded-xl p-5 flex items-start justify-between group transition-all duration-150 hover:border-outline-variant hover:bg-surface-container-high"
                >
                  <div className="flex items-start min-w-0 pr-4 flex-1">
                    <span className="font-code-md text-code-md text-primary-container font-semibold mr-3 select-none shrink-0 pt-0.5">
                      [{formattedId}]
                    </span>

                    <div className="flex-1 min-w-0">
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
                          className="claim-text font-body-md text-body-md font-medium text-on-surface leading-normal outline-none cursor-pointer"
                        >
                          {claim.statement}
                        </div>
                      )}

                      {!isEditing && (
                        <div className="font-body-xs text-body-xs text-outline mt-2 flex items-center gap-2.5 flex-wrap">
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
                          <span className="text-on-surface-variant">{category}</span>
                          <span className="w-1 h-1 rounded-full bg-outline-variant" />
                          <span className={`${risk.color} font-medium`}>{risk.label}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() =>
                        isEditing
                          ? handleSaveEdit(claim.id)
                          : handleStartEdit(claim.id, claim.statement)
                      }
                      className="btn-edit p-2 text-outline hover:text-primary transition-colors rounded hover:bg-surface-container-lowest min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title={isEditing ? "Save Claim" : "Edit Claim"}
                      aria-label={isEditing ? `Save claim ${formattedId}` : `Edit claim ${formattedId}`}
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
                      aria-label={`Remove claim ${formattedId}`}
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
                onClick={confirmAndRun}
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
