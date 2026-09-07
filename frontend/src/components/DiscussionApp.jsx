import React, { useState, useCallback } from 'react';
import StageContainer from './canvas/StageContainer';
import DialogueOverlay from './ui/DialogueOverlay';
import SideControlPanel from './ui/SideControlPanel';
import { AGENT_CONFIGS, AGENT_MAP, JUDGE_CONFIG } from '../constants/agentConfigs';
import { WAYPOINTS } from '../constants/roomLayout';
import useSocketSimulation from '../hooks/useSocketSimulation';
import useAudioPlayback from '../hooks/useAudioPlayback';
import { useOptionalCase } from '../context/CaseContext';
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
  const caseContext = useOptionalCase?.();
  const currentCase = caseContext?.state?.currentCase;

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
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-surface-container-lowest text-on-surface flex flex-col font-sans selection:bg-primary-container/30">
      {/* Main Content Area: Simulation Stage + Side Control Panel */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row items-start gap-6">
        {/* Simulation Canvas Stage with In-World Finding / Telemetry Card */}
        <section className="relative flex-1 w-full min-w-0">
          {currentCase?.raw_input && (
            <div className="mb-3 px-3.5 py-2 rounded-lg bg-surface-container-high border border-outline-variant/60 flex items-center justify-between text-xs font-code-sm shadow-sm">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-outline uppercase tracking-wider font-semibold text-[10px] shrink-0">
                  Decision Under Test:
                </span>
                <span className="text-on-surface font-medium truncate">
                  {currentCase.raw_input}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-verdict-survived animate-pulse" />
                <span className="text-primary-container font-mono text-[11px] font-medium">
                  Live 2.5D Bullpen
                </span>
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
}

export default DiscussionApp;
