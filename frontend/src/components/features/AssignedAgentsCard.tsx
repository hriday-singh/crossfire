import React from "react";
import { ALL_AGENTS } from "@/lib/agents";

interface AssignedAgentsCardProps {
  agentMode?: "auto" | "custom";
  selectedAgents: string[];
  agentRationales?: Record<string, string>;
  onToggleAgent: (agentId: string) => void;
}

export const AssignedAgentsCard: React.FC<AssignedAgentsCardProps> = ({
  agentMode = "auto",
  selectedAgents,
  agentRationales = {},
  onToggleAgent,
}) => {
  const activeCount = selectedAgents.length;
  const isAuto = agentMode === "auto";

  // Build the list of active agent names and corresponding tests
  const activeAgentDescriptions = ALL_AGENTS.filter((a) =>
    selectedAgents.some(
      (id) => (id === "receipts" ? "researcher" : id === "overthinker" ? "operator" : id) === a.id
    )
  ).map((a) => `${a.name} (${a.testName})`);

  return (
    <div
      data-testid="assigned-agents-panel"
      className="mt-8 bg-surface-container-low border border-outline-variant/60 rounded-xl p-space-5 space-y-space-4"
    >
      {/* Header & Decision Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/40 pb-3">
        <div>
          <div className="text-label-mono font-label-mono uppercase tracking-wider text-outline font-semibold mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary-container">
              psychology
            </span>
            <span>Assigned Adversarial Agents</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {activeCount} of {ALL_AGENTS.length} agents armed for execution
          </h2>
        </div>

        <span
          className={`font-code-sm text-code-sm px-2.5 py-1 rounded-full border self-start sm:self-auto ${
            isAuto
              ? "bg-primary-container/10 border-primary-container/30 text-primary-container font-medium"
              : "bg-surface-container-high border-outline-variant text-on-surface"
          }`}
        >
          {isAuto ? "Mode: Auto (Claim-Tailored)" : "Mode: Custom"}
        </span>
      </div>

      {/* Auto Decision Callout ("I'm going to use this, this, this") */}
      <div
        data-testid="agent-decision-callout"
        className="bg-surface-container rounded-lg p-3 border border-outline-variant/50 text-body-sm leading-relaxed"
      >
        <span className="text-on-surface font-medium">Crossfire Pipeline: </span>
        {activeAgentDescriptions.length > 0 ? (
          <span className="text-on-surface-variant">
            I'm going to use{" "}
            <span className="text-primary-container font-semibold">
              {activeAgentDescriptions.join(", ")}
            </span>
            . You can select or deselect any agents below before starting.
          </span>
        ) : (
          <span className="text-error font-medium">
            No agents selected. Please select at least one agent to run tests.
          </span>
        )}
      </div>

      {/* Grid of Interactive Agent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_AGENTS.map((agent) => {
          const isSelected = selectedAgents.some(
            (id) => (id === "receipts" ? "researcher" : id === "overthinker" ? "operator" : id) === agent.id
          );
          const rationale =
            agentRationales[agent.id] ||
            (agent.id === "researcher" ? agentRationales["receipts"] : undefined);

          return (
            <div
              key={agent.id}
              data-testid={`agent-card-${agent.id}`}
              onClick={() => onToggleAgent(agent.id)}
              className={`rounded-xl p-4 border transition-all duration-150 cursor-pointer select-none flex flex-col justify-between min-h-[110px] ${
                isSelected
                  ? "bg-surface-container border-primary-container/60 hover:border-primary-container shadow-xs"
                  : "bg-surface-container/30 border-outline-variant/30 hover:border-outline-variant/60 opacity-60 hover:opacity-85"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      id={`confirm-agent-${agent.id}`}
                      checked={isSelected}
                      onChange={() => onToggleAgent(agent.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-primary cursor-pointer mt-0.5"
                    />
                    <label
                      htmlFor={`confirm-agent-${agent.id}`}
                      className="font-headline-sm text-headline-sm text-on-surface font-semibold text-xs cursor-pointer truncate"
                    >
                      {agent.name}
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-code-sm text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-container-high text-outline border border-outline-variant/40">
                      Runs {agent.testName}
                    </span>
                    <span
                      className={`font-code-sm text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        isSelected
                          ? "bg-verdict-survived/15 text-verdict-survived border border-verdict-survived/30"
                          : "bg-surface-container-high text-outline"
                      }`}
                    >
                      {isSelected ? "Active" : "Excluded"}
                    </span>
                  </div>
                </div>

                <p className="font-code-sm text-code-sm text-outline mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-outline">
                    {agent.icon}
                  </span>
                  <span>{agent.shortRole}</span>
                </p>

                {/* Show auto rationale if available, otherwise agent general description */}
                {isAuto && rationale ? (
                  <p className="font-body-xs text-body-xs text-primary-container bg-primary-container/10 border border-primary-container/20 rounded p-1.5 leading-snug">
                    <span className="font-medium">Why selected: </span>
                    {rationale}
                  </p>
                ) : (
                  <p className="font-body-xs text-body-xs text-on-surface-variant leading-normal line-clamp-2">
                    {agent.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeCount === 0 && (
        <div
          role="alert"
          className="bg-error-container/20 border border-error/40 text-error px-3 py-2 rounded-lg text-body-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>At least 1 test agent must be active to initiate verification.</span>
        </div>
      )}
    </div>
  );
};
