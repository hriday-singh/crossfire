import React from 'react';
import { AGENT_MAP, JUDGE_CONFIG } from '../../constants/agentConfigs';
import {
  CUBICLE_LAYOUTS,
  JUDGE_TABLE_CONFIG,
  ROOM_DIMENSIONS,
} from '../../constants/roomLayout';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';

/**
 * Concise default status per evaluator workstation
 */
function getAgentDefaultStatus(agentId) {
  switch (agentId) {
    case 'devils_advocate':
      return 'Auditing Assumptions';
    case 'receipts':
      return 'Verifying Citations & Benchmarks';
    case 'builder':
      return 'Testing System Feasibility';
    case 'operator':
      return 'Assessing Operational Friction';
    case 'judge':
      return 'Monitoring Stations';
    default:
      return 'Workstation Telemetry Active';
  }
}

/**
 * DialogueOverlay Component
 *
 * Requirements:
 * 1. The Crucible Arbiter (Judge) bubble is ALWAYS VISIBLE.
 * 2. Evaluator bubbles appear ONLY on hover over that specific AI or their cubicle.
 * 3. Speech bubbles are uncluttered: ONLY the Agent Name + Status (plus compact verdict chip if applicable).
 *
 * @param {{
 *   activeDialogue?: any;
 *   characterPositions?: Record<string, any>;
 *   hoveredAgentId?: string | null;
 *   evaluatorFindings?: Record<string, any>;
 *   onHoverAgent?: (agentId: string | null) => void;
 * }} props
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
    if (v === 'survived') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-survived/20 text-verdict-survived border border-verdict-survived/40">
          <CheckCircle2 className="w-2.5 h-2.5" />
          SURVIVED
        </span>
      );
    }
    if (v === 'weakened') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-weakened/20 text-verdict-weakened border border-verdict-weakened/40">
          <AlertTriangle className="w-2.5 h-2.5" />
          WEAKENED
        </span>
      );
    }
    if (v === 'broken') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-broken/20 text-verdict-broken border border-verdict-broken/40">
          <XCircle className="w-2.5 h-2.5" />
          BROKEN
        </span>
      );
    }
    if (v === 'unresolved') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-verdict-unresolved/20 text-verdict-unresolved border border-verdict-unresolved/40">
          <HelpCircle className="w-2.5 h-2.5" />
          UNRESOLVED
        </span>
      );
    }
    return null;
  };

  // Helper to render an uncluttered status pill (Agent Name + Status only)
  const renderStatusPill = ({
    agent,
    pos,
    statusText,
    verdict = null,
    isHovered = false,
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
        className="absolute transition-all duration-200 ease-out flex flex-col items-center pointer-events-none"
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
              ? `0 6px 20px -2px ${color}44, 0 2px 8px -1px rgba(0, 0, 0, 0.7)`
              : '0 4px 12px -2px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Status LED Indicator */}
          <span
            className="w-2 h-2 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: color }}
          />

          {/* Agent Name */}
          <span className="text-xs font-semibold text-on-surface tracking-wide">
            {agent.name}
          </span>

          {/* Minimal Divider */}
          <span className="text-[10px] text-outline/60 font-mono select-none">/</span>

          {/* Status Label */}
          <span className="text-[11px] font-mono tracking-tight font-medium text-on-surface-variant">
            {statusText}
          </span>

          {/* Optional Verdict Chip */}
          {verdict && renderVerdictChip(verdict)}

          {/* Triangular Tail pointing to agent */}
          <div
            className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px]"
            style={{
              borderTopColor: color,
            }}
          />
        </div>
      </div>
    );
  };

  // 1. Resolve Judge Bubble State (ALWAYS VISIBLE)
  const judgePos = characterPositions['judge'] || {
    x: JUDGE_TABLE_CONFIG.x,
    y: JUDGE_TABLE_CONFIG.y - 18,
  };
  const isJudgeHovered = hoveredAgentId === 'judge';
  const isJudgeActive =
    activeDialogue &&
    (activeDialogue.speaker_id === 'judge' ||
      activeDialogue.speaker_id === 'arbiter' ||
      activeDialogue.speaker_id === 'moderator');

  let judgeStatusText = 'Monitoring Stations';
  let judgeVerdict = null;

  if (isJudgeActive) {
    if (activeDialogue.verdict) {
      judgeStatusText = 'Verdict Ruling';
      judgeVerdict = activeDialogue.verdict;
    } else if (activeDialogue.stage) {
      judgeStatusText = activeDialogue.stage;
    } else {
      judgeStatusText = 'Magistrate In Session';
    }
  } else if (isJudgeHovered) {
    judgeStatusText = 'Crucible Magistrate Bench';
  }

  // 2. Resolve AI Evaluator Bubble:
  // Visible when hovered, or when actively reporting findings to the Judge
  const activeReportingSpeakerId =
    activeDialogue &&
    activeDialogue.speaker_id !== 'judge' &&
    activeDialogue.speaker_id !== 'arbiter' &&
    activeDialogue.speaker_id !== 'moderator'
      ? activeDialogue.speaker_id
      : null;

  const targetEvaluatorId =
    hoveredAgentId && hoveredAgentId !== 'judge'
      ? hoveredAgentId
      : activeReportingSpeakerId;

  let hoveredEvaluatorBubble = null;
  if (targetEvaluatorId) {
    const agent = AGENT_MAP[targetEvaluatorId];
    if (agent) {
      const pos = characterPositions[targetEvaluatorId] || { x: 500, y: 300 };
      const finding = evaluatorFindings[targetEvaluatorId] || (
        activeDialogue?.speaker_id === targetEvaluatorId ? activeDialogue : null
      );

      let statusText = getAgentDefaultStatus(targetEvaluatorId);
      let verdict = null;

      if (finding) {
        if (finding.stage) {
          statusText = finding.stage;
        } else if (finding.action === 'walk_to') {
          statusText = 'Approaching Magistrate';
        } else if (finding.action === 'stand') {
          statusText = 'Reporting to Judge';
        } else if (finding.action === 'type') {
          statusText = 'Active Audit Logging';
        } else if (finding.action === 'inspect') {
          statusText = 'Reporting to Judge';
        }
        if (finding.verdict) {
          verdict = finding.verdict;
        }
      }

      hoveredEvaluatorBubble = renderStatusPill({
        agent,
        pos,
        statusText,
        verdict,
        isHovered: hoveredAgentId === targetEvaluatorId,
        testId: `bubble-${targetEvaluatorId}`,
      });
    }
  }

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

        {/* Judge Table Hover Zone */}
        <div
          data-testid="hover-zone-judge"
          onMouseEnter={() => onHoverAgent?.('judge')}
          onMouseLeave={() => onHoverAgent?.(null)}
          className="absolute pointer-events-auto cursor-pointer rounded-xl transition-all duration-150 hover:bg-white/[0.04]"
          style={{
            left: `${((JUDGE_TABLE_CONFIG.x - JUDGE_TABLE_CONFIG.width / 2) / roomW) * 100}%`,
            top: `${((JUDGE_TABLE_CONFIG.y - JUDGE_TABLE_CONFIG.height / 2) / roomH) * 100}%`,
            width: `${(JUDGE_TABLE_CONFIG.width / roomW) * 100}%`,
            height: `${(JUDGE_TABLE_CONFIG.height / roomH) * 100}%`,
          }}
          title="Crucible Arbiter Bench"
        />
      </div>

      {/* REQUIREMENT 1: Crucible Arbiter (Judge) bubble is ALWAYS VISIBLE */}
      {renderStatusPill({
        agent: JUDGE_CONFIG,
        pos: judgePos,
        statusText: judgeStatusText,
        verdict: judgeVerdict,
        isHovered: isJudgeHovered,
        testId: 'bubble-judge',
      })}

      {/* REQUIREMENT 2 & 3: AI Evaluator bubble appears ONLY ON HOVER, streamlined to Name + Status */}
      {hoveredEvaluatorBubble}
    </div>
  );
}

export default DialogueOverlay;
