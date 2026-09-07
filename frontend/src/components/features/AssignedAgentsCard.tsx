import React from "react";
import { ALL_AGENTS } from "@/lib/agents";

interface AssignedAgentsCardProps {
  agentMode?: "auto" | "custom";
  selectedAgents: string[];
  agentRationales?: Record<string, string>;
  onToggleAgent: (agentId: string) => void;
}

export function formatConciseRationale(text?: string, maxChars: number = 120): string {
  if (!text) return "";
  const cleaned = text.trim().replace(/\s+/g, " ");
  const stripped = cleaned.replace(
    /^(?:why (?:selected|chosen|recommended):\s*|(?:agent )?rationale:\s*)/i,
    "",
  );
  const match = stripped.match(/^.*?[.!?](?:\s|$)/);
  let sentence = match ? match[0].trim() : stripped;
  if (sentence.length > maxChars) {
    const lastSpace = sentence.lastIndexOf(" ", maxChars);
    sentence =
      (lastSpace > 0 ? sentence.slice(0, lastSpace) : sentence.slice(0, maxChars)).replace(
        /[,;:]$/,
        "",
      ) + "…";
  } else if (!/[.!?…]$/.test(sentence)) {
    sentence += ".";
  }
  return sentence;
}

export const AssignedAgentsCard: React.FC<AssignedAgentsCardProps> = ({
  agentMode = "auto",
  selectedAgents,
  agentRationales = {},
  onToggleAgent,
}) => {
  const activeCount = selectedAgents.length;
  const isAuto = agentMode === "auto";

  return (
    <div
      data-testid="assigned-agents-panel"
      className="mt-8 bg-surface-container-low border border-outline-variant/60 rounded-xl p-space-5 space-y-space-4"
    >
      {/* Clean Minimal Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-outline-variant/30">
        <span className="material-symbols-outlined text-[20px] text-primary-container">
          psychology
        </span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          {activeCount} of {ALL_AGENTS.length} agents armed
        </h2>
      </div>

      {/* Grid of Interactive Agent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_AGENTS.map((agent) => {
          const isSelected = selectedAgents.some(
            (id) => (id === "receipts" ? "researcher" : id === "overthinker" ? "operator" : id) === agent.id
          );
          // ONLY lookup rationale when agent is actually selected/active!
          const rawRationale = isSelected
            ? agentRationales[agent.id] ||
              (agent.id === "researcher" ? agentRationales["receipts"] : undefined) ||
              (agent.id === "operator" ? agentRationales["overthinker"] : undefined)
            : undefined;
          const rationale = isSelected && rawRationale ? formatConciseRationale(rawRationale) : undefined;

          return (
            <div
              key={agent.id}
              data-testid={`agent-card-${agent.id}`}
              onClick={() => onToggleAgent(agent.id)}
              className={`rounded-xl p-4 border transition-all duration-150 cursor-pointer select-none flex flex-col justify-between min-h-[110px] overflow-hidden ${
                isSelected
                  ? "bg-surface-container border-primary-container/60 hover:border-primary-container shadow-xs"
                  : "bg-surface-container/30 border-outline-variant/30 hover:border-outline-variant/60 opacity-60 hover:opacity-85"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                  <div className="flex items-center gap-2 shrink-0">
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
                      className="font-headline-sm text-headline-sm text-on-surface font-semibold text-xs cursor-pointer select-none whitespace-nowrap"
                    >
                      {agent.name}
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span
                      title={`Runs ${agent.testName}`}
                      className="font-code-sm text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-container-high text-outline border border-outline-variant/40 truncate min-w-0"
                    >
                      Runs {agent.testName}
                    </span>

                  </div>
                </div>

                <p className="font-code-sm text-code-sm text-outline mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-outline">
                    {agent.icon}
                  </span>
                  <span>{agent.shortRole}</span>
                </p>

                {/* Show auto rationale ONLY for active/selected agents */}
                {isAuto && isSelected && rationale ? (
                  <p
                    title={rationale}
                    className="font-body-xs text-body-xs text-primary-container bg-primary-container/10 border border-primary-container/20 rounded px-2.5 py-1.5 leading-snug line-clamp-3"
                  >
                    <span className="font-semibold">Why selected: </span>
                    {rationale}
                  </p>
                ) : (
                  <p className="font-body-xs text-body-xs text-on-surface-variant leading-normal line-clamp-3">
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
