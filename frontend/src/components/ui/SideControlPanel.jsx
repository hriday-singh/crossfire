import React from 'react';
import { AGENT_MAP } from '../../constants/agentConfigs';
import { cn } from '../../lib/utils';

/**
 * SideControlPanel Component
 * Live view panel displaying exclusively the Active Workstation Feed for real-time evaluator telemetry.
 * Displays up to 10 recent events in a minimalist, expanding list format.
 *
 * @param {{
 *   eventHistory?: any[];
 *   hoveredAgentId?: string | null;
 * }} props
 */
export function SideControlPanel({
  eventHistory = [],
  hoveredAgentId = null,
}) {
  const displayEvents = eventHistory.slice(0, 10);

  return (
    <aside className="w-full lg:w-84 xl:w-96 flex-shrink-0 flex flex-col gap-space-4">
      <div className="bg-surface rounded-xl border border-outline-variant p-space-4 flex flex-col gap-space-4">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface tracking-tight">
            Active Workstation Feed
          </span>
          {hoveredAgentId && AGENT_MAP[hoveredAgentId] && (
            <span className="text-[10px] font-mono px-2 py-0.5 text-outline">
              [HOVER] {AGENT_MAP[hoveredAgentId].name}
            </span>
          )}
        </div>

        {displayEvents.length > 0 ? (
          <div className="flex flex-col gap-space-3 overflow-y-auto max-h-[calc(100vh-12rem)]">
            {displayEvents.map((event, idx) => {
              const activeAgent = AGENT_MAP[event.speaker_id];
              if (!activeAgent) return null;

              return (
                <div
                  key={event.id || idx}
                  className={cn(
                    "flex flex-col gap-1 p-space-3 rounded-lg border",
                    idx === 0 
                      ? "bg-surface-container border-outline-variant/60" 
                      : "bg-surface-container-lowest border-transparent opacity-80 hover:opacity-100 transition-opacity"
                  )}
                >
                  <div className="flex items-center gap-space-2 min-w-0">
                    <span 
                      className="text-sm font-semibold truncate"
                      style={{ color: activeAgent.color }}
                    >
                      {activeAgent.name}
                    </span>
                    <span className="text-xs text-outline font-mono truncate">
                      {event.cognitive_tag || (activeAgent.id === 'steelman' ? '[Steelman]' : `[${activeAgent.testName || 'Hypothesis Scrutiny'}]`)}
                    </span>
                  </div>

                  {event.verdict && (
                    <div className="mt-1">
                      <span 
                        className={cn(
                          "text-xs font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold",
                          event.verdict.toLowerCase() === 'survived' && "bg-verdict-survived/20 text-verdict-survived border-verdict-survived/40",
                          event.verdict.toLowerCase() === 'broken' && "bg-verdict-broken/20 text-verdict-broken border-verdict-broken/40",
                          event.verdict.toLowerCase() === 'weakened' && "bg-verdict-weakened/20 text-verdict-weakened border-verdict-weakened/40",
                          event.verdict.toLowerCase() === 'unresolved' && "bg-verdict-unresolved/20 text-verdict-unresolved border-verdict-unresolved/40",
                          !['survived', 'broken', 'weakened', 'unresolved'].includes(event.verdict.toLowerCase()) && "text-on-surface-variant bg-surface border-outline-variant"
                        )}
                      >
                        VERDICT: {event.verdict}
                      </span>
                    </div>
                  )}

                  {event.dialogue ? (
                    <div className="mt-1 text-sm text-on-surface leading-relaxed">
                      {event.dialogue}
                    </div>
                  ) : event.thought || event.stage ? (
                    <div className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                      {event.thought || event.stage}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-outline italic">
                      Processing...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-space-3 text-sm text-outline italic">
            Awaiting evaluator telemetry...
          </div>
        )}
      </div>
    </aside>
  );
}

export default SideControlPanel;

