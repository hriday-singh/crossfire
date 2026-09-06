import React from "react";
import { ALL_AGENTS } from "@/lib/agents";

interface AgentSelectorPanelProps {
  agentMode: "auto" | "custom";
  onAgentModeChange: (mode: "auto" | "custom") => void;
  selectedAgents: string[];
  onToggleAgent: (agentId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const AgentSelectorPanel: React.FC<AgentSelectorPanelProps> = ({
  agentMode,
  onAgentModeChange,
  selectedAgents,
  onToggleAgent,
  isExpanded,
  onToggleExpand,
}) => {
  const isCustom = agentMode === "custom";

  return (
    <div
      data-testid="agent-selector-panel"
      className="mt-space-3 bg-surface-container rounded-lg border border-outline-variant/60 overflow-hidden transition-all duration-200"
    >
      {/* Compact Summary Header / Trigger */}
      <div
        onClick={onToggleExpand}
        className="p-space-3 flex items-center justify-between cursor-pointer select-none hover:bg-surface-container-high transition-colors"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="flex items-center gap-space-2.5 min-w-0">
          <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
            tune
          </span>
          <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
            Agent Suite:{" "}
            {agentMode === "auto" ? (
              <span className="text-primary-container">Auto (Recommended)</span>
            ) : (
              <span className="text-on-surface">
                Custom ({selectedAgents.length} of {ALL_AGENTS.length} active)
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-space-2 shrink-0">
          <span className="font-code-sm text-code-sm text-outline hidden sm:inline">
            {isExpanded ? "Collapse" : "Configure"}
          </span>
          <span className="material-symbols-outlined text-[18px] text-outline">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
        </div>
      </div>

      {/* Expandable Configuration Body */}
      {isExpanded && (
        <div className="p-space-4 border-t border-outline-variant/50 bg-surface-container-low space-y-space-4">
          {/* Mode Selector Segmented Tabs */}
          <div className="flex items-center gap-2 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
            <button
              type="button"
              onClick={() => onAgentModeChange("auto")}
              className={`flex-1 py-1.5 px-3 rounded-md font-body-sm text-body-sm transition-all cursor-pointer text-center ${
                agentMode === "auto"
                  ? "bg-primary-container text-on-primary-container font-semibold shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Auto (Recommended)
            </button>
            <button
              type="button"
              onClick={() => onAgentModeChange("custom")}
              className={`flex-1 py-1.5 px-3 rounded-md font-body-sm text-body-sm transition-all cursor-pointer text-center ${
                agentMode === "custom"
                  ? "bg-primary-container text-on-primary-container font-semibold shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Custom Selection
            </button>
          </div>

          {/* Mode Description */}
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {agentMode === "auto"
              ? "Crossfire will analyze your extracted assumptions and automatically select the most rigorous test agents (e.g., Researcher for Empirical Evidence, Builder for Feasibility, Operator for Operational Friction) with transparent rationales."
              : "Choose which specialized adversarial agents will stress-test your proposal. Each agent corresponds to a specific test."}
          </p>

          {/* Agent Selection Grid (Active in Custom mode, or preview in Auto mode) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-2.5">
            {ALL_AGENTS.map((agent) => {
              const isSelected = selectedAgents.some(
                (id) => (id === "receipts" ? "researcher" : id === "overthinker" ? "operator" : id) === agent.id
              );
              const isDisabled = agentMode === "auto";

              return (
                <div
                  key={agent.id}
                  onClick={() => {
                    if (!isDisabled) {
                      onToggleAgent(agent.id);
                    }
                  }}
                  className={`rounded-lg p-3 border transition-all select-none outline-none ${
                    isDisabled
                      ? "bg-surface-container/50 border-outline-variant/30 opacity-70 cursor-default"
                      : isSelected
                        ? "bg-surface-container border-primary-container/60 cursor-pointer shadow-xs"
                        : "bg-surface-container/30 border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container cursor-pointer opacity-80"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id={`agent-checkbox-${agent.id}`}
                      aria-label={agent.name}
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (!isDisabled) {
                          onToggleAgent(agent.id);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 accent-primary cursor-pointer outline-none focus:outline-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold text-xs truncate select-none">
                          {agent.name}
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-outline ml-1 shrink-0 select-none">
                          {agent.icon}
                        </span>
                      </div>
                      <p className="font-code-sm text-[11px] text-primary-container font-medium mt-0.5 select-none">
                        Conducts: {agent.testName}
                      </p>
                      <p className="font-code-sm text-code-sm text-outline mt-0.5 select-none">
                        {agent.shortRole}
                      </p>
                      <p className="font-body-xs text-body-xs text-on-surface-variant mt-1 leading-normal line-clamp-2 select-none">
                        {agent.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isCustom && selectedAgents.length === 0 && (
            <p className="font-code-sm text-code-sm text-error flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">
                warning
              </span>
              <span>
                Please select at least 1 agent to run the stress test.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
