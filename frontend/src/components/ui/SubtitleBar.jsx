import React from 'react';
import { AGENT_MAP } from '../../constants/agentConfigs';
import { Mic, Volume2, VolumeX, Activity, Compass } from 'lucide-react';

/**
 * SubtitleBar Component
 * Bottom broadcast transcript bar showing real-time dialogue, speaker credentials,
 * action states, and audio indicators.
 */
export function SubtitleBar({
  currentEvent = null,
  isMuted = false,
  onToggleMute = () => {},
  isSpeaking = false,
}) {
  if (!currentEvent) {
    return (
      <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-slate-400 text-sm shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
          <span className="font-mono text-xs text-slate-400">SESSION STANDBY — Awaiting Quorum Dispatch</span>
        </div>
        <button
          onClick={onToggleMute}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>
    );
  }

  const agent = AGENT_MAP[currentEvent.speaker_id] || {
    name: currentEvent.speaker_id,
    role: 'Quorum Member',
    color: '#3b82f6',
    organization: 'Autonomous Agents Network',
  };

  return (
    <div className="w-full bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-200">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Speaker Profile & Credentials */}
        <div className="flex items-center gap-3 min-w-max">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-md border"
            style={{
              backgroundColor: agent.clothingColor ? `#${agent.clothingColor.toString(16).padStart(6, '0')}` : agent.color,
              borderColor: agent.color,
            }}
          >
            {agent.avatarBadge || agent.name.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-100">{agent.name}</span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border text-white font-medium"
                style={{
                  backgroundColor: `${agent.color}22`,
                  borderColor: `${agent.color}66`,
                }}
              >
                {agent.role}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>{agent.organization || 'Strategic Planning Quorum'}</span>
              {currentEvent.action && (
                <span className="flex items-center gap-1 text-sky-400">
                  <Compass className="w-3 h-3" />
                  {currentEvent.action}
                  {currentEvent.target ? ` → ${currentEvent.target.replace('_', ' ')}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Broadcast Dialogue Transcript */}
        <div className="flex-1 w-full bg-slate-900/60 rounded-lg px-4 py-2 border border-slate-800/60 min-h-[42px] flex items-center">
          {currentEvent.dialogue ? (
            <p className="text-xs sm:text-sm text-slate-200 font-sans tracking-wide leading-relaxed">
              <span className="text-sky-400 font-mono mr-1.5 font-bold">"</span>
              {currentEvent.dialogue}
              <span className="text-sky-400 font-mono ml-1.5 font-bold">"</span>
            </p>
          ) : (
            <span className="text-xs font-mono text-slate-500 italic flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              Executing {currentEvent.action || 'routine'}...
            </span>
          )}
        </div>

        {/* Audio Status & Sound Toggle */}
        <div className="flex items-center gap-2 self-end md:self-center">
          {isSpeaking && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-sky-950/60 border border-sky-500/30 text-sky-400 text-xs font-mono">
              <Mic className="w-3 h-3 animate-pulse text-sky-400" />
              <span className="hidden sm:inline">LIVE</span>
            </div>
          )}

          <button
            onClick={onToggleMute}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all shadow"
            title={isMuted ? 'Unmute Speech & SFX' : 'Mute Sound'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubtitleBar;
