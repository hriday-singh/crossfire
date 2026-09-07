import React, { useState, useCallback, useEffect } from 'react';
import StageContainer from './canvas/StageContainer';
import DialogueOverlay from './ui/DialogueOverlay';
import SideControlPanel from './ui/SideControlPanel';
import { AGENT_CONFIGS, AGENT_MAP, JUDGE_CONFIG } from '../constants/agentConfigs';
import { WAYPOINTS } from '../constants/roomLayout';
import useSocketSimulation from '../hooks/useSocketSimulation';
import useAudioPlayback from '../hooks/useAudioPlayback';
import useBackendLiveBridge from '../hooks/useBackendLiveBridge';
import { useOptionalCase } from '../context/CaseContext';
import {
  ShieldCheck,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  CheckCircle2,
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

    // Cache latest telemetry, thought & finding per evaluator for real-time thought bubbles and hover inspection
    if (eventPacket.dialogue || eventPacket.action || eventPacket.thought !== undefined) {
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

  // Real Backend SSE Pipeline Bridge
  const {
    isLiveBackendActive,
    isReplaying,
    replayCaseInBullpen,
  } = useBackendLiveBridge({
    onDispatchPacket: triggerManualEvent,
  });

  // When live backend is streaming or replaying, pause mock simulation auto-player
  useEffect(() => {
    if (isLiveBackendActive || isReplaying) {
      setIsAutoPlaying(false);
    }
  }, [isLiveBackendActive, isReplaying, setIsAutoPlaying]);

  // Calculate live progress and stage
  const caseStatus = currentCase?.status;
  const isFinished = caseStatus === 'done' && !isLiveBackendActive;
  const isTesting = isLiveBackendActive || caseStatus === 'testing';

  const claimsCount = currentCase?.claims?.length || 0;
  const findingsCount = currentCase?.findings?.length || 0;
  const activeAgentsCount = currentCase?.selected_agents?.length || 3;
  const totalExpectedFindings = Math.max(1, claimsCount * activeAgentsCount);
  const reconciledCount = currentCase?.claims?.filter((c) => c.status)?.length || 0;

  let currentPhase = 'Initialization';
  let progressPercent = 0;
  let phaseDetail = 'Awaiting pipeline dispatch...';

  if (isFinished) {
    currentPhase = 'Evaluation Complete';
    progressPercent = 100;
    phaseDetail = 'Decision memo assembled & final verdict synthesized.';
  } else if (isTesting) {
    if (reconciledCount > 0) {
      currentPhase = 'Phase 3: Steelman Reconciliation';
      progressPercent = Math.min(90, 75 + Math.round((reconciledCount / Math.max(1, claimsCount)) * 15));
      phaseDetail = `Reconciling evidence for claim ${reconciledCount} of ${claimsCount}...`;
    } else if (findingsCount > 0) {
      currentPhase = 'Phase 2: Adversarial Stress-Testing';
      const findingProgress = Math.min(1, findingsCount / totalExpectedFindings);
      progressPercent = Math.min(75, 25 + Math.round(findingProgress * 50));
      phaseDetail = `Gathering empirical evidence (${findingsCount} findings evaluated)...`;
    } else {
      currentPhase = 'Phase 1: Load-Bearing Scrutiny';
      progressPercent = 15;
      phaseDetail = 'Steelman evaluating critical core premises...';
    }
  } else if (isReplaying) {
    currentPhase = 'Replaying Findings in Bullpen';
    progressPercent = 100;
    phaseDetail = 'Reviewing telemetry and delivered verdicts.';
  }

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-surface-container-lowest text-on-surface flex flex-col font-sans selection:bg-primary-container/30">
      {/* Main Content Area: Simulation Stage + Side Control Panel */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row items-start gap-6">
        {/* Simulation Canvas Stage with In-World Finding / Telemetry Card */}
        <section className="relative flex-1 w-full min-w-0">
          {/* Live Progress & Finish Status Header */}
          <div className="mb-3 rounded-xl bg-surface-container-high/90 border border-outline-variant/60 shadow-md p-3.5 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-outline uppercase tracking-wider font-semibold text-[10px] shrink-0 font-mono">
                  Decision Under Test:
                </span>
                <span className="text-on-surface font-medium text-xs truncate">
                  {currentCase?.raw_input || 'Testing decision proposal'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isFinished
                      ? 'bg-verdict-survived ring-4 ring-verdict-survived/20'
                      : isTesting
                      ? 'bg-primary-container animate-ping'
                      : isReplaying
                      ? 'bg-secondary animate-pulse'
                      : 'bg-outline'
                  }`}
                />
                <span className="font-mono text-xs font-semibold text-primary-container">
                  {isFinished ? 'FINISHED' : isTesting ? 'LIVE RUNNING' : isReplaying ? 'REPLAY' : 'STANDBY'}
                </span>
              </div>
            </div>

            {/* Progress Bar & Phase Tracker */}
            <div className="space-y-1.5 pt-1 border-t border-outline-variant/40">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-semibold text-on-surface flex items-center gap-1.5">
                  {isFinished ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-verdict-survived inline" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 text-primary-container animate-spin inline" />
                  )}
                  <span>{currentPhase}</span>
                </span>
                <span className="text-outline">{progressPercent}% Completed</span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant/30">
                <div
                  className={`h-full transition-all duration-500 ease-out rounded-full ${
                    isFinished
                      ? 'bg-verdict-survived'
                      : 'bg-gradient-to-r from-primary-container via-blue-500 to-indigo-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-outline pt-0.5">
                <span className="truncate">{phaseDetail}</span>
                {isFinished ? (
                  <span className="text-verdict-survived font-semibold">Ready for Review</span>
                ) : isTesting ? (
                  <span className="text-primary-container">Live Stream Active</span>
                ) : null}
              </div>
            </div>

            {/* Finished Banner with Final Verdict Callout */}
            {isFinished && currentCase?.case_verdict && (
              <div className="mt-2.5 p-2 rounded-lg bg-verdict-survived/10 border border-verdict-survived/30 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-verdict-survived/20 text-verdict-survived border border-verdict-survived/40 shrink-0">
                    {currentCase.case_verdict.decision_state || 'COMPLETE'}
                  </span>
                  <span className="text-xs font-sans text-on-surface font-medium truncate">
                    {currentCase.case_verdict.headline || 'Live stress test complete.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => caseContext?.setActiveModal?.('evidence')}
                  className="px-2.5 py-1 rounded bg-surface-container-highest hover:bg-surface-container border border-outline-variant/60 text-[11px] font-mono font-semibold text-primary transition-colors cursor-pointer shrink-0"
                >
                  View Decision Memo
                </button>
              </div>
            )}
          </div>

          <StageContainer
            agents={AGENT_CONFIGS}
            characterPositions={characterPositions}
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
          isLiveBackendActive={isLiveBackendActive}
          isReplaying={isReplaying}
          replayCaseInBullpen={replayCaseInBullpen}
          hasCaseFindings={Boolean(currentCase?.findings?.length)}
        />
      </div>
    </div>
  );
}

export default DiscussionApp;
