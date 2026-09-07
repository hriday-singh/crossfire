import React, { useState } from 'react';
import { AGENT_CONFIGS, AGENT_MAP, JUDGE_CONFIG } from '../../constants/agentConfigs';
import { WAYPOINTS } from '../../constants/roomLayout';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Sparkles,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Send,
  Activity,
  Mic,
  MicOff,
} from 'lucide-react';

/**
 * SideControlPanel Component
 * Evaluator Bullpen control dock styled with Crossfire's terminal dark UI tokens:
 * - Playback control (Play/Pause, Step Forward, Reset)
 * - Playback Speed selector
 * - Sound Volume & Voice Readout (TTS) toggle
 * - Scenario switcher (Crossfire Adversarial Evaluation Scenarios)
 * - Active Evaluator Finding readout with verdict chips
 * - Quick Actions (Stand up at cubicle, sit down, type telemetry, inspect screen)
 * - Custom Evaluator Packet Dispatcher
 * @param {{
 *   isAutoPlaying?: any;
 *   setIsAutoPlaying?: any;
 *   playbackSpeed?: any;
 *   setPlaybackSpeed?: any;
 *   isMuted?: any;
 *   setIsMuted?: any;
 *   speechSynthesisEnabled?: boolean;
 *   setSpeechSynthesisEnabled?: any;
 *   volume?: any;
 *   setVolume?: any;
 *   currentScenarioKey?: any;
 *   setCurrentScenarioKey?: any;
 *   scenarios?: any;
 *   stepForward?: any;
 *   resetScenario?: any;
 *   lastEvent?: any;
 *   activeSpeakerId?: any;
 *   hoveredAgentId?: string | null;
 *   triggerManualEvent?: any;
 *   connectionStatus?: any;
 *   connectSocket?: any;
 *   disconnectSocket?: any;
 *   socketUrl?: any;
 *   setSocketUrl?: any;
 * }} props
 */
export function SideControlPanel({
  isAutoPlaying,
  setIsAutoPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  isMuted,
  setIsMuted,
  speechSynthesisEnabled = true,
  setSpeechSynthesisEnabled = () => {},
  volume = 0.8,
  setVolume = () => {},
  currentScenarioKey,
  setCurrentScenarioKey,
  scenarios = {},
  stepForward,
  resetScenario,
  lastEvent,
  hoveredAgentId = null,
  triggerManualEvent,
  connectionStatus,
  socketUrl,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDispatcher, setShowDispatcher] = useState(false);

  // Manual Packet Dispatcher Form
  const [manualSpeaker, setManualSpeaker] = useState('devils_advocate');
  const [manualAction, setManualAction] = useState('type');
  const [manualTarget, setManualTarget] = useState('cubicle_1_desk');
  const [manualGesture, setManualGesture] = useState('idle');
  const [manualVerdict, setManualVerdict] = useState('');
  const [manualDialogue, setManualDialogue] = useState('Premise 2 contains an unstated regulatory assumption.');

  const handleSendManual = (e) => {
    e?.preventDefault();
    if (!triggerManualEvent) return;
    triggerManualEvent({
      speaker_id: manualSpeaker,
      action: manualAction,
      target: manualTarget || null,
      gesture: manualGesture || null,
      verdict: manualVerdict || null,
      dialogue: manualDialogue.trim() || null,
      audio_url: null,
    });
  };

  const inspectedAgent = hoveredAgentId ? AGENT_MAP[hoveredAgentId] : null;
  const activeAgent = inspectedAgent || (lastEvent?.speaker_id ? AGENT_MAP[lastEvent.speaker_id] : null);

  return (
    <aside className="w-full lg:w-84 xl:w-96 flex-shrink-0 flex flex-col gap-4">
      {/* Primary Control Card */}
      <div className="bg-surface-container/95 backdrop-blur-md border border-outline-variant/70 rounded-xl p-4 shadow-xl flex flex-col gap-4">
        {/* Header & Status */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary-container" />
            <h2 className="text-sm font-semibold text-on-surface tracking-wide">
              Bullpen Controls
            </h2>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/50 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isAutoPlaying ? 'bg-verdict-survived animate-pulse' : 'bg-verdict-weakened'
              }`}
            />
            <span className={isAutoPlaying ? 'text-verdict-survived font-medium' : 'text-verdict-weakened'}>
              {isAutoPlaying ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>
        </div>

        {/* 1. Play / Pause & Step Navigation */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-outline">
            Playback
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-xs transition-all shadow-md cursor-pointer ${
                isAutoPlaying
                  ? 'bg-verdict-weakened/15 hover:bg-verdict-weakened/25 text-verdict-weakened border border-verdict-weakened/40'
                  : 'bg-verdict-survived/20 hover:bg-verdict-survived/30 text-verdict-survived border border-verdict-survived/50'
              }`}
            >
              {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isAutoPlaying ? 'Pause' : 'Auto Play'}</span>
            </button>

            <button
              type="button"
              onClick={stepForward}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 text-on-surface text-xs font-mono transition-colors cursor-pointer"
              title="Advance to next evaluator finding"
            >
              <SkipForward className="w-3.5 h-3.5 text-primary-container" />
              <span>Step</span>
            </button>

            <button
              type="button"
              onClick={resetScenario}
              className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 text-outline hover:text-on-surface transition-colors cursor-pointer"
              title="Reset scenario run"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Playback Speed */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-outline flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-primary-container" />
              <span>Speed</span>
            </span>
            <span className="text-on-surface font-semibold">{playbackSpeed}x</span>
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant/40">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaybackSpeed(spd)}
                className={`py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* 3. Audio & Voice Readout (TTS) Options */}
        <div className="space-y-2 pt-1 border-t border-outline-variant/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-outline flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-primary-container" />
              <span>Audio & Voice</span>
            </span>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="text-[10px] font-mono text-outline hover:text-on-surface flex items-center gap-1 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-error" /> : <Volume2 className="w-3.5 h-3.5 text-verdict-survived" />}
              <span>{isMuted ? 'Muted' : 'Unmuted'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              disabled={isMuted}
              className="w-full accent-primary-container h-1.5 bg-surface-container-highest rounded-lg cursor-pointer disabled:opacity-40"
            />
            <span className="text-[11px] font-mono text-outline w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Voice Readout (TTS) Option Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-outline-variant/40">
            <div className="flex items-center gap-1.5">
              {speechSynthesisEnabled ? (
                <Mic className="w-3.5 h-3.5 text-primary-container" />
              ) : (
                <MicOff className="w-3.5 h-3.5 text-outline" />
              )}
              <div>
                <span className="text-xs font-sans text-on-surface block">Judge Voice (TTS)</span>
                <span className="text-[9px] text-outline font-mono block">Arbiter only; AI evaluators silent</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Voice Readout: ${speechSynthesisEnabled ? 'ENABLED' : 'MUTED'}`}
              onClick={() => setSpeechSynthesisEnabled(!speechSynthesisEnabled)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer border transition-colors ${
                speechSynthesisEnabled
                  ? 'bg-primary-container/20 text-primary-container border-primary-container/40'
                  : 'bg-surface-container-high text-outline border-outline-variant/50'
              }`}
            >
              {speechSynthesisEnabled ? 'ENABLED' : 'MUTED'}
            </button>
          </div>
        </div>

        {/* 4. Evaluation Scenario Switcher */}
        <div className="space-y-1.5 pt-1 border-t border-outline-variant/50">
          <label className="text-[11px] font-mono uppercase tracking-wider text-outline">
            Evaluation Scenario
          </label>
          <select
            value={currentScenarioKey}
            onChange={(e) => setCurrentScenarioKey(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-lg p-2 text-xs font-sans text-on-surface cursor-pointer focus:border-primary-container outline-hidden"
          >
            {Object.keys(scenarios).map((key) => (
              <option key={key} value={key} className="bg-surface-container">
                {scenarios[key].name}
              </option>
            ))}
          </select>
          {scenarios[currentScenarioKey]?.description && (
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              {scenarios[currentScenarioKey].description}
            </p>
          )}
        </div>
      </div>

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
                <span className="text-[10px] text-outline font-mono">
                  {lastEvent?.action ? `Status: ${lastEvent.action}` : 'Active'}
                  {lastEvent?.target ? ` → ${lastEvent.target.replace(/_/g, ' ')}` : ''}
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
            ) : (
              <div className="p-2 rounded-lg bg-surface-container-lowest/50 border border-outline-variant/40 text-[11px] text-outline font-mono italic">
                Performing workstation routine...
              </div>
            )}
          </div>
        ) : (
          <div className="py-3 text-center text-xs text-outline font-mono italic">
            Awaiting evaluator telemetry...
          </div>
        )}
      </div>

      {/* Quick Agent Presets & Dispatcher Collapsible */}
      <div className="bg-surface-container/95 backdrop-blur-md border border-outline-variant/70 rounded-xl p-4 shadow-xl flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between text-xs font-semibold text-on-surface hover:text-primary-container transition-colors cursor-pointer w-full"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-tertiary" />
            <span>Quick Evaluator Actions</span>
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-outline" />
          ) : (
            <ChevronDown className="w-4 h-4 text-outline" />
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() =>
                triggerManualEvent({
                  speaker_id: 'devils_advocate',
                  action: 'stand',
                  target: 'cubicle_1_stand',
                  gesture: 'point',
                  dialogue: 'Inspecting assumption matrix on pinboard: unstated enterprise dependency found.',
                  verdict: 'weakened',
                })
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/50 text-xs text-on-surface transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Devil's Advocate → Stand & Audit</span>
              <span className="text-[10px] font-mono text-primary-container">Stand</span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerManualEvent({
                  speaker_id: 'receipts',
                  action: 'type',
                  target: 'cubicle_2_desk',
                  gesture: 'idle',
                  dialogue: 'Querying live market receipts and web citations on enterprise pilot churn.',
                  verdict: 'survived',
                })
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/50 text-xs text-on-surface transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Receipts → Query Citations</span>
              <span className="text-[10px] font-mono text-verdict-survived">Type</span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerManualEvent({
                  speaker_id: 'builder',
                  action: 'inspect',
                  target: 'cubicle_3_desk',
                  gesture: 'idle',
                  dialogue: 'Benchmarking P99 GPU barrier overhead: within certified 4ms threshold.',
                  verdict: 'survived',
                })
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/50 text-xs text-on-surface transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Builder → Inspect Latency</span>
              <span className="text-[10px] font-mono text-verdict-weakened">Inspect</span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerManualEvent({
                  speaker_id: 'operator',
                  action: 'stand',
                  target: 'cubicle_4_stand',
                  gesture: 'point',
                  dialogue: 'Procurement policy requires 3-month vendor security review prior to deployment.',
                  verdict: 'broken',
                })
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/50 text-xs text-on-surface transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Operator → Audit Red Tape</span>
              <span className="text-[10px] font-mono text-verdict-broken">Stand</span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerManualEvent({
                  speaker_id: 'judge',
                  action: 'inspect',
                  target: 'judge_desk',
                  gesture: 'idle',
                  dialogue: 'Crucible synthesis complete: 2 claims survived, 1 weakened, 1 broken.',
                  verdict: 'weakened',
                })
              }
              className="w-full text-left p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/50 text-xs text-on-surface transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Crucible Arbiter → Synthesize</span>
              <span className="text-[10px] font-mono text-primary-container">Verdict</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDispatcher(!showDispatcher)}
              className="w-full text-center py-1.5 text-[11px] font-mono text-outline hover:text-on-surface transition-colors"
            >
              {showDispatcher ? 'Hide Packet Dispatcher ▲' : 'Open Custom Packet Dispatcher ▼'}
            </button>

            {showDispatcher && (
              <form onSubmit={handleSendManual} className="space-y-2 pt-2 border-t border-outline-variant/50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-outline block mb-0.5">Evaluator</label>
                    <select
                      value={manualSpeaker}
                      onChange={(e) => setManualSpeaker(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-lg p-1.5 text-[11px] text-on-surface"
                    >
                      {AGENT_CONFIGS.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                      <option value="judge">{JUDGE_CONFIG.name}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-outline block mb-0.5">Action</label>
                    <select
                      value={manualAction}
                      onChange={(e) => setManualAction(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-lg p-1.5 text-[11px] text-on-surface"
                    >
                      <option value="type">type (Keyboard)</option>
                      <option value="inspect">inspect (Screen)</option>
                      <option value="think">think (Analyze)</option>
                      <option value="stand">stand (Stand Up)</option>
                      <option value="sit">sit (Sit Down)</option>
                      <option value="walk_to">walk_to</option>
                      <option value="idle">idle</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-outline block mb-0.5">Station Target</label>
                    <select
                      value={manualTarget}
                      onChange={(e) => setManualTarget(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-lg p-1.5 text-[11px] text-on-surface"
                    >
                      {Object.keys(WAYPOINTS).map((wp) => (
                        <option key={wp} value={wp}>{wp}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-outline block mb-0.5">Verdict Tag</label>
                    <select
                      value={manualVerdict}
                      onChange={(e) => setManualVerdict(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-lg p-1.5 text-[11px] text-on-surface"
                    >
                      <option value="">None</option>
                      <option value="survived">survived</option>
                      <option value="weakened">weakened</option>
                      <option value="broken">broken</option>
                      <option value="unresolved">unresolved</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-outline block mb-0.5">Finding Note</label>
                  <input
                    type="text"
                    value={manualDialogue}
                    onChange={(e) => setManualDialogue(e.target.value)}
                    placeholder="Enter evaluator finding..."
                    className="w-full bg-surface-container-lowest border border-outline-variant/70 rounded-lg p-1.5 text-[11px] text-on-surface focus:border-primary-container outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 rounded-lg bg-primary-container hover:bg-primary-container/90 text-on-primary-container font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Evaluator Telemetry</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Network / WebSocket Connection Status */}
      <div className="p-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl flex items-center justify-between text-[11px] font-mono text-outline">
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi className="w-3.5 h-3.5 text-verdict-survived" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-outline" />
          )}
          <span>{connectionStatus === 'connected' ? 'WebSocket Live' : 'Simulation Engine'}</span>
        </div>
        <span className="text-[10px] text-outline/80">
          {connectionStatus === 'connected' ? socketUrl : 'Deterministic Runner'}
        </span>
      </div>
    </aside>
  );
}

export default SideControlPanel;
