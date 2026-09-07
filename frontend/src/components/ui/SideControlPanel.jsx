import React from 'react';
import { AGENT_MAP } from '../../constants/agentConfigs';
import { Activity } from 'lucide-react';

/**
 * SideControlPanel Component
 * Live view panel displaying exclusively the Active Workstation Feed for real-time evaluator telemetry.
 * All extraneous controls (playback, speed, quick actions, status boxes) have been stripped.
 *
 * @param {{
 *   lastEvent?: any;
 *   hoveredAgentId?: string | null;
 *   activeSpeakerId?: string | null;
 * }} props
 */
export function SideControlPanel({
  lastEvent = null,
  hoveredAgentId = null,
  activeSpeakerId = null,
}) {
  const inspectedAgent = hoveredAgentId ? AGENT_MAP[hoveredAgentId] : null;
  const activeAgent =
    inspectedAgent ||
    (lastEvent?.speaker_id ? AGENT_MAP[lastEvent.speaker_id] : null) ||
    (activeSpeakerId ? AGENT_MAP[activeSpeakerId] : null);

  return (
    <aside className="w-full lg:w-84 xl:w-96 flex-shrink-0 flex flex-col gap-4">

      {/* Active Evaluator Finding Card */}
      <div className="bg-surface-container/95 backdrop-blur-md border border-outline-variant/70 rounded-xl p-4 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-outline flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary-container" />
            <span>Active Workstation Feed</span>
          </span>
          {inspectedAgent ? (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border animate-pulse"
              style={{
                backgroundColor: `${inspectedAgent.color}25`,
                borderColor: `${inspectedAgent.color}60`,
                color: inspectedAgent.color,
              }}
            >
              [HOVER] {inspectedAgent.cubicle || inspectedAgent.role}
            </span>
          ) : activeAgent ? (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{
                backgroundColor: `${activeAgent.color}20`,
                borderColor: `${activeAgent.color}50`,
                color: activeAgent.color,
              }}
            >
              {activeAgent.cubicle || activeAgent.role}
            </span>
          ) : null}
        </div>

        {activeAgent ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs border"
                style={{
                  backgroundColor: activeAgent.clothingColor
                    ? `#${activeAgent.clothingColor.toString(16).padStart(6, '0')}`
                    : activeAgent.color,
                  borderColor: activeAgent.color,
                }}
              >
                {activeAgent.avatarBadge || activeAgent.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight min-w-0">
                <span className="text-xs font-semibold text-on-surface block truncate">
                  {activeAgent.name}
                </span>
                <span className="text-[10px] text-primary-container font-mono truncate block">
                  {lastEvent?.cognitive_tag || (activeAgent.id === 'steelman' ? '[Steelman]' : `[${activeAgent.testName || 'Hypothesis Scrutiny'}]`)}
                </span>
              </div>
            </div>

            {lastEvent?.verdict && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-outline">VERDICT:</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${activeAgent.color}25`,
                    color: activeAgent.color,
                    border: `1px solid ${activeAgent.color}60`,
                  }}
                >
                  {lastEvent.verdict}
                </span>
              </div>
            )}

            {lastEvent?.dialogue ? (
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60 text-xs text-on-surface/90 leading-relaxed font-sans">
                {lastEvent.dialogue}
              </div>
            ) : lastEvent?.thought || lastEvent?.stage ? (
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60 text-xs text-on-surface/90 leading-relaxed font-sans">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-outline mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                  <span>ACTIVE COGNITION / THOUGHT</span>
                </div>
                {lastEvent.thought || lastEvent.stage}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-[11px] text-on-surface/80 font-sans italic">
                Stress-testing foundational assumptions and querying evidence...
              </div>
            )}
          </div>
        ) : (
          <div className="py-3 text-center text-xs text-outline font-mono italic">
            Awaiting evaluator telemetry...
          </div>
        )}
      </div>
    </aside>
  );
}

export default SideControlPanel;
