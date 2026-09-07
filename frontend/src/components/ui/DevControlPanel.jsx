import React, { useState } from 'react';
import { AGENT_CONFIGS } from '../../constants/agentConfigs';
import { WAYPOINTS } from '../../constants/roomLayout';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Send,
  Radio,
  Sliders,
  Terminal,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

/**
 * DevControlPanel Component
 * Comprehensive developer & operator panel:
 * - Scenario switcher, play/pause, step forward, playback speed
 * - Live WebSocket server connector
 * - Manual event packet builder & dispatcher
 * - Quick action test presets
 * - Live packet stream inspector
 */
export function DevControlPanel({
  socketUrl,
  setSocketUrl,
  connectionStatus,
  connectSocket,
  disconnectSocket,
  isAutoPlaying,
  setIsAutoPlaying,
  currentScenarioKey,
  setCurrentScenarioKey,
  scenarios,
  stepForward,
  resetScenario,
  playbackSpeed,
  setPlaybackSpeed,
  eventHistory = [],
  triggerManualEvent,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('simulation'); // 'simulation' | 'dispatcher' | 'stream'

  // Manual Packet Form State
  const [speakerId, setSpeakerId] = useState('agent_1');
  const [action, setAction] = useState('walk_to');
  const [target, setTarget] = useState('whiteboard');
  const [gesture, setGesture] = useState('point');
  const [dialogue, setDialogue] = useState('Let us examine the architecture diagram on the whiteboard.');

  const handleSendManual = (e) => {
    e?.preventDefault();
    triggerManualEvent({
      speaker_id: speakerId,
      action: action,
      target: target || null,
      gesture: gesture || null,
      dialogue: dialogue.trim() || null,
      audio_url: null,
    });
  };

  // Quick Preset Dispatchers
  const quickPresets = [
    {
      label: 'Aris to Whiteboard',
      packet: {
        speaker_id: 'agent_1',
        action: 'walk_to',
        target: 'whiteboard',
        gesture: 'point',
        dialogue: 'Focusing our attention on the critical fallback invariants.',
      },
    },
    {
      label: 'Marcus to Podium',
      packet: {
        speaker_id: 'agent_3',
        action: 'walk_to',
        target: 'presentation_podium',
        gesture: 'talk',
        dialogue: 'Presenting the live distributed cluster telemetry metrics.',
      },
    },
    {
      label: 'Elena Agree & Sit',
      packet: {
        speaker_id: 'agent_2',
        action: 'sit',
        target: 'chair_east',
        gesture: 'agree',
        dialogue: 'Governance guidelines are completely aligned with this architecture.',
      },
    },
    {
      label: 'Sarah to Doorway',
      packet: {
        speaker_id: 'agent_4',
        action: 'walk_to',
        target: 'doorway',
        gesture: 'talk',
        dialogue: 'Retrieving the physical cryptographic token from the secure vestibule.',
      },
    },
    {
      label: 'All Sit at Table',
      packet: {
        speaker_id: 'agent_1',
        action: 'sit',
        target: 'chair_north',
        gesture: 'idle',
        dialogue: 'Quorum assembled at the conference table. Beginning vote.',
      },
    },
  ];

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-2xl transition-all duration-200">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-200">
            Simulation Control & Telemetry Panel
          </span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : connectionStatus === 'connecting'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse'
                : 'bg-slate-800 text-sky-300 border-slate-700'
            }`}
          >
            {connectionStatus === 'connected'
              ? '● Live Socket'
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : '● Mock Engine'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Tab buttons */}
          <div className="flex bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 mr-2">
            <button
              onClick={() => { setActiveTab('simulation'); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                activeTab === 'simulation' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Simulation
            </button>
            <button
              onClick={() => { setActiveTab('dispatcher'); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                activeTab === 'dispatcher' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Packet Dispatcher
            </button>
            <button
              onClick={() => { setActiveTab('stream'); setIsExpanded(true); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                activeTab === 'stream' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Event Log ({eventHistory.length})
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title={isExpanded ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* TAB 1: SIMULATION CONTROLS */}
          {activeTab === 'simulation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                {/* Scenario Selector */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Discussion Scenario
                  </label>
                  <select
                    value={currentScenarioKey}
                    onChange={(e) => {
                      setCurrentScenarioKey(e.target.value);
                      resetScenario();
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {Object.entries(scenarios).map(([key, sc]) => (
                      <option key={key} value={key}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-all ${
                      isAutoPlaying
                        ? 'bg-amber-600/90 hover:bg-amber-500 text-white'
                        : 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isAutoPlaying ? 'Pause' : 'Auto Play'}
                  </button>

                  <button
                    onClick={stepForward}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors shadow"
                    title="Step to next event packet"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-sky-400" />
                    Step
                  </button>

                  <button
                    onClick={resetScenario}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    title="Restart Scenario"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400 mr-1">Speed:</span>
                  {[0.5, 1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                        playbackSpeed === spd
                          ? 'bg-sky-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Quick Action Presets
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => triggerManualEvent(preset.packet)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs text-slate-200 hover:text-white transition-all shadow-sm"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live WebSocket Server Connection Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-2.5">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 min-w-max">
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span>External WebSocket:</span>
                </div>
                <input
                  type="text"
                  value={socketUrl}
                  onChange={(e) => setSocketUrl(e.target.value)}
                  placeholder="ws://localhost:4000 or http://localhost:4000"
                  className="flex-1 w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                />
                {connectionStatus === 'connected' ? (
                  <button
                    onClick={disconnectSocket}
                    className="px-3 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <WifiOff className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => connectSocket(socketUrl)}
                    className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    Connect Live
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PACKET DISPATCHER */}
          {activeTab === 'dispatcher' && (
            <form onSubmit={handleSendManual} className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Speaker */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Speaker ID</label>
                  <select
                    value={speakerId}
                    onChange={(e) => setSpeakerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {AGENT_CONFIGS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Action</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="walk_to">walk_to</option>
                    <option value="sit">sit</option>
                    <option value="gesture">gesture</option>
                    <option value="idle">idle</option>
                  </select>
                </div>

                {/* Target Waypoint */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Waypoint</label>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {Object.keys(WAYPOINTS).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gesture */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Gesture</label>
                  <select
                    value={gesture}
                    onChange={(e) => setGesture(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="talk">talk</option>
                    <option value="point">point</option>
                    <option value="listen">listen</option>
                    <option value="agree">agree</option>
                  </select>
                </div>
              </div>

              {/* Dialogue Text */}
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Dialogue Text</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dialogue}
                    onChange={(e) => setDialogue(e.target.value)}
                    placeholder="Enter agent speech or thoughts..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Dispatch
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: PACKET STREAM LOG */}
          {activeTab === 'stream' && (
            <div className="space-y-2">
              <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
                {eventHistory.length === 0 ? (
                  <div className="text-slate-500 italic p-2 text-center">No events captured yet.</div>
                ) : (
                  eventHistory.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300 flex items-start justify-between gap-3 hover:border-slate-700"
                    >
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sky-400 font-bold">{evt.speaker_id}</span>
                          <span className="text-amber-300 font-semibold">{evt.action}</span>
                          {evt.target && <span className="text-slate-400">→ {evt.target}</span>}
                          {evt.gesture && (
                            <span className="text-purple-300 bg-purple-950/60 px-1 py-0.2 rounded border border-purple-800 text-[10px]">
                              {evt.gesture}
                            </span>
                          )}
                        </div>
                        {evt.dialogue && (
                          <div className="text-slate-400 text-[10px] truncate font-sans">
                            "{evt.dialogue}"
                          </div>
                        )}
                      </div>
                      <span className="text-slate-600 text-[9px]">
                        {new Date(evt.timestamp || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DevControlPanel;
