import React, { useState, useCallback } from 'react';
import StageContainer from './canvas/StageContainer';
import DialogueOverlay from './ui/DialogueOverlay';
import SideControlPanel from './ui/SideControlPanel';
import { AGENT_CONFIGS, AGENT_MAP, JUDGE_CONFIG } from '../constants/agentConfigs';
import { WAYPOINTS } from '../constants/roomLayout';
import useSocketSimulation from '../hooks/useSocketSimulation';
import useAudioPlayback from '../hooks/useAudioPlayback';
import {
  ShieldCheck,
  Terminal,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

/**
 * DiscussionApp (EvaluatorBullpenApp) Component
 * Top-level orchestrator view for Crossfire's 2.5D Evaluator Bullpen & Crucible Court.
 * Agents work at their dedicated cubicles independently without cross-talk.
 */
export function DiscussionApp() {
  // Real-time character position tracker for UI overlays
  const [characterPositions, setCharacterPositions] = useState(() => {
    return AGENT_CONFIGS.reduce((acc, a) => {
      const wp = WAYPOINTS[a.initialWaypoint] || WAYPOINTS.cubicle_1_desk;
      acc[a.id] = { x: wp.x, y: wp.y };
      return acc;
    }, {
      judge: { x: WAYPOINTS.judge_chair.x, y: WAYPOINTS.judge_chair.y },
    });
  });

  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [activeDialogue, setActiveDialogue] = useState(null);
  const [hoveredAgentId, setHoveredAgentId] = useState(null);
  const [evaluatorFindings, setEvaluatorFindings] = useState({});

  // Audio Playback Hook with Voice Readout (TTS) state
  const {
    isMuted,
    setIsMuted,
    speechSynthesisEnabled,
    setSpeechSynthesisEnabled,
    volume,
    setVolume,
    playSpeech,
    stopSpeech,
    playSfx,
  } = useAudioPlayback();

  // Position update callback from CharacterSprite GSAP tweens
  const handlePositionUpdate = useCallback((agentId, x, y) => {
    setCharacterPositions((prev) => ({
      ...prev,
      [agentId]: { x, y },
    }));
  }, []);

  // Event received handler from Socket or Mock simulation runner
  const handleEventReceived = useCallback((eventPacket) => {
    const speakerId = eventPacket.speaker_id;

    // Cache latest telemetry & finding per evaluator for hover inspection
    if (eventPacket.dialogue || eventPacket.action) {
      setEvaluatorFindings((prev) => ({
        ...prev,
        [speakerId]: eventPacket,
      }));
    }

    if (eventPacket.dialogue) {
      setActiveSpeakerId(speakerId);
      setActiveDialogue(eventPacket);

      // Play synthesized audio strictly if Judge (enforced in playSpeech)
      playSpeech({
        speakerId: speakerId,
        dialogue: eventPacket.dialogue,
        audioUrl: eventPacket.audio_url || null,
        onEnd: () => {
          setActiveSpeakerId(null);
          // Keep finding card visible briefly, then clear
          setTimeout(() => {
            setActiveDialogue((curr) => (curr?.id === eventPacket.id ? null : curr));
          }, 2400);
        },
      });
    } else {
      // If action has no dialogue (e.g. typing or standing), highlight active evaluator briefly
      setActiveSpeakerId(speakerId);
      setTimeout(() => setActiveSpeakerId(null), 2000);
    }
  }, [playSpeech]);

  // Socket & Mock Simulation Engine
  const {
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
    lastEvent,
    eventHistory,
    triggerManualEvent,
  } = useSocketSimulation({
    onEventReceived: handleEventReceived,
  });

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface flex flex-col font-sans selection:bg-primary-container/30">
      {/* Top Application Navigation Bar - Crossfire Theme */}
      <header className="border-b border-outline-variant/60 bg-surface-container-low/80 backdrop-blur-md sticky top-0 z-40 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-container-highest border border-outline-variant flex items-center justify-center shadow-md">
              <Terminal className="w-4 h-4 text-primary-container" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-on-surface tracking-tight">
                  Crossfire Adversarial Bullpen
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface-container-highest border border-outline-variant/60 text-primary-container font-semibold">
                  Independent Evaluator Workstations
                </span>
              </div>
              <p className="text-[11px] text-outline font-mono">
                Judge Table & 4 Isolated Cubicle Workstations // 2.5D Real-Time Telemetry
              </p>
            </div>
          </div>

          {/* Crossfire Evaluator Badges in Header */}
          <div className="hidden lg:flex items-center gap-2">
            {AGENT_CONFIGS.map((agent) => {
              const isActingNow = activeSpeakerId === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all duration-200 ${
                    isActingNow
                      ? 'bg-surface-container border-primary-container shadow-md shadow-primary-container/10 scale-105'
                      : 'bg-surface-container-low border-outline-variant/50 text-outline'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isActingNow ? 'animate-ping' : ''}`}
                    style={{ backgroundColor: agent.color }}
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-semibold text-on-surface block truncate">{agent.name}</span>
                    <span className="text-[9px] text-outline font-mono">
                      {isActingNow ? 'Testing' : (agent.cubicle?.split(' ')[0] || 'Active')}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Judge Arbiter Badge */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all duration-200 ${
                activeSpeakerId === 'judge'
                  ? 'bg-surface-container border-primary-container shadow-md shadow-primary-container/10 scale-105'
                  : 'bg-surface-container-low border-outline-variant/50 text-outline'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${activeSpeakerId === 'judge' ? 'animate-ping bg-primary-container' : 'bg-outline'}`}
              />
              <div className="text-[11px] leading-tight">
                <span className="font-semibold text-on-surface block">Judge</span>
                <span className="text-[9px] text-outline font-mono">
                  {activeSpeakerId === 'judge' ? 'Verdict' : 'Bench'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area: Simulation Stage + Side Control Panel */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row items-start gap-6">
        {/* Simulation Canvas Stage with In-World Finding / Telemetry Card */}
        <section className="relative flex-1 w-full min-w-0">
          <StageContainer
            agents={AGENT_CONFIGS}
            currentActionPacket={lastEvent}
            activeSpeakerId={activeSpeakerId}
            hoveredAgentId={hoveredAgentId}
            onHoverAgent={setHoveredAgentId}
            onPositionUpdate={handlePositionUpdate}
            playSfx={playSfx}
          >
            {/* In-world Workstation Telemetry HUD with Hover-Only Visibility and Persistent Judge Pill */}
            <DialogueOverlay
              activeDialogue={activeDialogue}
              characterPositions={characterPositions}
              hoveredAgentId={hoveredAgentId}
              evaluatorFindings={evaluatorFindings}
              onHoverAgent={setHoveredAgentId}
            />
          </StageContainer>
        </section>

        {/* Side Controls: Play/Pause, Speed, Volume, Voice TTS, Scenarios, and Presets */}
        <SideControlPanel
          isAutoPlaying={isAutoPlaying}
          setIsAutoPlaying={setIsAutoPlaying}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          speechSynthesisEnabled={speechSynthesisEnabled}
          setSpeechSynthesisEnabled={setSpeechSynthesisEnabled}
          volume={volume}
          setVolume={setVolume}
          currentScenarioKey={currentScenarioKey}
          setCurrentScenarioKey={setCurrentScenarioKey}
          scenarios={scenarios}
          stepForward={stepForward}
          resetScenario={resetScenario}
          lastEvent={lastEvent}
          activeSpeakerId={activeSpeakerId}
          hoveredAgentId={hoveredAgentId}
          triggerManualEvent={triggerManualEvent}
          connectionStatus={connectionStatus}
          connectSocket={connectSocket}
          disconnectSocket={disconnectSocket}
          socketUrl={socketUrl}
          setSocketUrl={setSocketUrl}
        />
      </main>
    </div>
  );
}

export default DiscussionApp;
