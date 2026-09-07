import React from 'react';
import { AGENT_CONFIGS, AGENT_MAP, STEELMAN_CONFIG } from '../../constants/agentConfigs';
import {
  CUBICLE_LAYOUTS,
  STEELMAN_TABLE_CONFIG,
  ROOM_DIMENSIONS,
} from '../../constants/roomLayout';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

/**
 * Default cognitive tag per evaluator
 */
function getAgentCognitiveTag(agentId) {
  switch (agentId) {
    case 'devils_advocate':
      return '[Assumption Pre-Mortem]';
    case 'researcher':
      return '[Citation Audit]';
    case 'builder':
      return '[Feasibility Test]';
    case 'operator':
      return '[Friction Test]';
    case 'steelman':
      return '[Steelman]';
    default:
      return '[Audit Task]';
  }
}

/**
 * Concise default status per evaluator workstation
 */
function getAgentDefaultStatus(agentId) {
  switch (agentId) {
    case 'devils_advocate':
      return 'Auditing Assumptions';
    case 'researcher':
      return 'Verifying Citations & Benchmarks';
    case 'builder':
      return 'Testing System Feasibility';
    case 'operator':
      return 'Assessing Operational Friction';
    case 'steelman':
      return 'Monitoring Stations';
    default:
      return 'Workstation Standby';
  }
}

/**
 * Formats concise thoughts for display when hovered
 */
function formatConciseThought(finding, agentId) {
  if (!finding) return getAgentDefaultStatus(agentId);

  if (finding.thought && typeof finding.thought === 'string' && finding.thought !== 'null') {
    return finding.thought
      .replace(/^Testing implicit premises in\s*/i, 'Auditing: ')
      .replace(/^Auditing Day-1 architecture & blockers for\s*/i, 'Feasibility: ')
      .replace(/^Auditing procurement & adoption friction for\s*/i, 'Friction: ')
      .replace(/^Searching market citations for\s*/i, 'Citations: ')
      .replace(/^Delivering finding:\s*/i, '')
      .replace(/^Reviewing\s+/i, 'Reviewing: ');
  }

  if (finding.stage && typeof finding.stage === 'string') {
    return finding.stage;
  }

  if (finding.dialogue && typeof finding.dialogue === 'string') {
    const clean = finding.dialogue.replace(/^(Reporting|Submitting|Verifying)\s+[^:]+:\s*/i, '');
    return clean.length > 55 ? clean.substring(0, 52) + '...' : clean;
  }

  return getAgentDefaultStatus(agentId);
}

/**
 * DialogueOverlay Component
 *
 * Implements hover-only concise thinking labels:
 * 1. AI thinking labels ONLY display when the user hovers over an AI or their cubicle.
 * 2. Formats thinking content in a concise, readable manner.
 * 3. Supports expanded details (empirical citations & reasoning) inside hover card.
 *
 * @param {Object} props
 * @param {any} [props.activeDialogue]
 * @param {Record<string, {x: number, y: number}>} [props.characterPositions]
 * @param {string | null} [props.hoveredAgentId]
 * @param {Record<string, any>} [props.evaluatorFindings]
 * @param {(agentId: string | null) => void} [props.onHoverAgent]
 */
export function DialogueOverlay({
  activeDialogue = null,
  characterPositions = {},
  hoveredAgentId = null,
  evaluatorFindings = {},
  onHoverAgent = () => {},
}) {
  const roomW = ROOM_DIMENSIONS.width || 1000;
  const roomH = ROOM_DIMENSIONS.height || 587;

  // Minimal Verdict Badge Renderer
  const renderVerdictChip = (verdict) => {
    if (!verdict) return null;
    const v = String(verdict).toLowerCase();
    if (v === 'survived' || v === 'proceed') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-survived/20 text-verdict-survived border border-verdict-survived/40">
          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
          SURVIVED
        </span>
      );
    }
    if (v === 'weakened' || v === 'proceed_with_changes') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-weakened/20 text-verdict-weakened border border-verdict-weakened/40">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          WEAKENED
        </span>
      );
    }
    if (v === 'broken' || v === 'drop') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-broken/20 text-verdict-broken border border-verdict-broken/40">
          <XCircle className="w-2.5 h-2.5 shrink-0" />
          BROKEN
        </span>
      );
    }
    if (v === 'unresolved' || v === 'hold') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-unresolved/20 text-verdict-unresolved border border-verdict-unresolved/40">
          <HelpCircle className="w-2.5 h-2.5 shrink-0" />
          UNRESOLVED
        </span>
      );
    }
    return null;
  };

  // Helper to render an uncluttered status pill with cognitive thinking tag and optional details
  const renderAgentPill = ({
    agent,
    pos,
    statusText,
    cognitiveTag = null,
    thought = null,
    verdict = null,
    confidence = null,
    isHovered = false,
    isThinking = false,
    evidence = [],
    reasoning = null,
    testId = undefined,
  }) => {
    if (!agent || !pos) return null;
    const color = agent.color || '#60a5fa';
    const leftPercent = (pos.x / roomW) * 100;
    const topPercent = (pos.y / roomH) * 100;

    return (
      <div
        key={agent.id}
        data-testid={testId}
        className="absolute transition-all duration-200 ease-out flex flex-col items-center pointer-events-none z-30"
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          transform: 'translate(-50%, -100%) translateY(-38px)',
        }}
      >
        <div
          className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest/95 backdrop-blur-md shadow-xl border text-on-surface select-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          style={{
            borderColor: isHovered ? color : `${color}66`,
            boxShadow: isHovered
              ? `0 6px 20px -2px ${color}55, 0 2px 8px -1px rgba(0, 0, 0, 0.7)`
              : isThinking
              ? `0 4px 14px -2px ${color}44, 0 2px 8px -1px rgba(0, 0, 0, 0.5)`
              : '0 4px 12px -2px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Status LED Indicator with Thinking Pulse */}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isThinking ? 'animate-ping' : 'animate-pulse'}`}
            style={{ backgroundColor: color }}
          />

          {/* Agent Name */}
          <span className="text-xs font-semibold text-on-surface tracking-wide">
            {agent.name}
          </span>

          {/* Optional Cognitive Tag */}
          {cognitiveTag && (
            <span
              className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded"
              style={{ backgroundColor: `${color}22`, color: color }}
            >
              {cognitiveTag}
            </span>
          )}

          {/* Minimal Divider */}
          <span className="text-[10px] text-outline/60 font-mono select-none">/</span>

          {/* Concise Thought Label */}
          <span className="text-[11px] font-mono tracking-tight font-medium text-on-surface-variant max-w-[280px] truncate">
            {statusText}
          </span>

          {/* Animated typing dots if thinking */}
          {isThinking && (
            <span className="inline-flex gap-0.5 text-primary-container font-mono text-[10px] font-bold animate-pulse">
              ...
            </span>
          )}

          {/* Optional Verdict Chip */}
          {verdict && renderVerdictChip(verdict)}

          {/* Optional Confidence Percentage */}
          {confidence !== null && confidence !== undefined && (
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant/50 text-outline">
              {confidence}%
            </span>
          )}

          {/* Triangular Tail pointing to agent */}
          <div
            className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px]"
            style={{
              borderTopColor: color,
            }}
          />
        </div>

        {/* Hover Detail Card: Displays full reasoning and evidence citations when hovered */}
        {isHovered && (reasoning || (evidence && evidence.length > 0)) && (
          <div
            className="mt-2 p-3 rounded-lg bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/80 shadow-2xl max-w-sm text-left animate-in fade-in slide-in-from-top-1 duration-150 pointer-events-auto"
            style={{ borderColor: `${color}88` }}
          >
            {reasoning && (
              <p className="text-xs font-sans text-on-surface leading-relaxed mb-2">
                {reasoning}
              </p>
            )}
            {evidence && evidence.length > 0 && (
              <div className="border-t border-outline-variant/40 pt-1.5">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-outline block mb-1">
                  Empirical Sources:
                </span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {evidence.map((ev, i) => (
                    <a
                      key={i}
                      href={ev.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{ev.title || ev.source_url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 1. Resolve Steelman Bubble State (Hover-only)
  const isSteelmanHovered = hoveredAgentId === 'steelman';
  const steelmanPos = characterPositions['steelman'] || {
    x: STEELMAN_TABLE_CONFIG.x,
    y: STEELMAN_TABLE_CONFIG.y - 18,
  };

  let steelmanFinding = evaluatorFindings['steelman'] || (
    activeDialogue?.speaker_id === 'steelman' ||
    activeDialogue?.speaker_id === 'arbiter' ||
    activeDialogue?.speaker_id === 'moderator'
      ? activeDialogue
      : null
  );

  let steelmanStatusText = formatConciseThought(steelmanFinding, 'steelman');
  let steelmanVerdict = steelmanFinding?.verdict || null;

  // 2. Resolve AI Evaluator Bubbles (Hover-only)
  const evaluatorBubbles = AGENT_CONFIGS.map((agent) => {
    const isHovered = hoveredAgentId === agent.id;
    if (!isHovered) {
      return null;
    }

    const finding = evaluatorFindings[agent.id] || (
      activeDialogue?.speaker_id === agent.id ? activeDialogue : null
    );

    const pos = characterPositions[agent.id] || { x: 500, y: 300 };
    const statusText = formatConciseThought(finding, agent.id);
    const cognitiveTag = finding?.cognitive_tag || getAgentCognitiveTag(agent.id);
    const verdict = finding?.verdict || null;
    const confidence = finding?.confidence || null;
    const reasoning = finding?.reasoning || null;
    const evidence = finding?.evidence || [];
    const isThinking = finding?.action === 'type' || Boolean(finding?.thought && finding.thought !== 'null');

    return renderAgentPill({
      agent,
      pos,
      statusText,
      cognitiveTag,
      thought: finding?.thought,
      verdict,
      confidence,
      isHovered,
      isThinking,
      evidence,
      reasoning,
      testId: `bubble-${agent.id}`,
    });
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Interactive Cubicle & Bench Hover Zones calibrated to flplan.webp */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {CUBICLE_LAYOUTS.map((cubicle) => {
          const zoneLeft = (cubicle.bounds.x / roomW) * 100;
          const zoneTop = (cubicle.bounds.y / roomH) * 100;
          const zoneWidth = (cubicle.bounds.width / roomW) * 100;
          const zoneHeight = (cubicle.bounds.height / roomH) * 100;

          return (
            <div
              key={cubicle.id}
              data-testid={`hover-zone-${cubicle.agentId}`}
              onMouseEnter={() => onHoverAgent?.(cubicle.agentId)}
              onMouseLeave={() => onHoverAgent?.(null)}
              className="absolute pointer-events-auto cursor-pointer rounded-xl transition-all duration-150 hover:bg-white/[0.04]"
              style={{
                left: `${zoneLeft}%`,
                top: `${zoneTop}%`,
                width: `${zoneWidth}%`,
                height: `${zoneHeight}%`,
              }}
              title={`Hover to view status for ${cubicle.name}`}
            />
          );
        })}

        {/* Steelman Table Hover Zone */}
        <div
          data-testid="hover-zone-steelman"
          onMouseEnter={() => onHoverAgent?.('steelman')}
          onMouseLeave={() => onHoverAgent?.(null)}
          className="absolute pointer-events-auto cursor-pointer rounded-xl transition-all duration-150 hover:bg-white/[0.04]"
          style={{
            left: `${((STEELMAN_TABLE_CONFIG.x - STEELMAN_TABLE_CONFIG.width / 2) / roomW) * 100}%`,
            top: `${((STEELMAN_TABLE_CONFIG.y - STEELMAN_TABLE_CONFIG.height / 2) / roomH) * 100}%`,
            width: `${(STEELMAN_TABLE_CONFIG.width / roomW) * 100}%`,
            height: `${(STEELMAN_TABLE_CONFIG.height / roomH) * 100}%`,
          }}
          title="Steelman Magistrate Bench"
        />
      </div>

      {/* Hover-Only Steelman Bubble */}
      {isSteelmanHovered &&
        renderAgentPill({
          agent: STEELMAN_CONFIG,
          pos: steelmanPos,
          statusText: steelmanStatusText,
          cognitiveTag: '[Steelman]',
          verdict: steelmanVerdict,
          isHovered: isSteelmanHovered,
          testId: 'bubble-steelman',
        })}

      {/* Hover-Only Evaluator Bubbles */}
      {evaluatorBubbles}
    </div>
  );
}

export default DialogueOverlay;
