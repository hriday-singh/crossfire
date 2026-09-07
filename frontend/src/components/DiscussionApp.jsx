import React, { useState, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import StageContainer from './canvas/StageContainer';
import DialogueOverlay from './ui/DialogueOverlay';
import SideControlPanel from './ui/SideControlPanel';
import CruciblePageTransition from './ui/CruciblePageTransition';
import { AGENT_CONFIGS, AGENT_MAP, STEELMAN_CONFIG } from '../constants/agentConfigs';
import { WAYPOINTS } from '../constants/roomLayout';
import useSocketSimulation from '../hooks/useSocketSimulation';
import useAudioPlayback from '../hooks/useAudioPlayback';
import useBackendLiveBridge from '../hooks/useBackendLiveBridge';
import { useOptionalCase } from '../context/CaseContext';
import { cn } from '../lib/utils';

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
      steelman: { x: WAYPOINTS.steelman_chair.x, y: WAYPOINTS.steelman_chair.y },
    });
  });

  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [activeDialogue, setActiveDialogue] = useState(null);
  const [hoveredAgentId, setHoveredAgentId] = useState(null);
  const [evaluatorFindings, setEvaluatorFindings] = useState({});
  const [isSteelmanExiting, setIsSteelmanExiting] = useState(false);
  const [isPageTransitionActive, setIsPageTransitionActive] = useState(false);
  const exitTriggeredRef = useRef(false);
  const progressRef = useRef(0);
  const isSynthesisDoneRef = useRef(false);
  const hasSynthesizedRef = useRef(false);
  const maxProgressRef = useRef(0);
  const prevCaseIdRef = useRef(currentCase?.id);

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

  const selectedAgentIds = currentCase?.selected_agents || null;

  // Position update callback from CharacterSprite GSAP tweens
  const handlePositionUpdate = useCallback((agentId, x, y) => {
    setCharacterPositions((prev) => ({
      ...prev,
      [agentId]: { x, y },
    }));

    // If Steelman reaches near the right chamber door (x > 840, y near 285), trigger the page transition animation ONLY when synthesis is done AND loading is 100%
    if (agentId === 'steelman' && x >= 840 && !exitTriggeredRef.current) {
      const isDone = (currentCase?.status === 'done' || !!currentCase?.case_verdict || isSynthesisDoneRef.current) && (progressRef.current >= 100);
      if (isDone) {
        exitTriggeredRef.current = true;
        setIsPageTransitionActive(true);
      }
    }
  }, [currentCase?.status, currentCase?.case_verdict]);

  // Event received handler from Socket or Mock simulation runner
  const handleEventReceived = useCallback((eventPacket) => {
    const speakerId = eventPacket.speaker_id;

    // Detect Steelman exit event - strictly when synthesis is done AND loading is 100%
    if (speakerId === 'steelman' && eventPacket.target === 'right_door') {
      const isDone =
        Boolean(currentCase?.status === 'done' ||
        !!currentCase?.case_verdict ||
        eventPacket.isSynthesisDone ||
        eventPacket.stage?.includes('Synthesis')) &&
        Boolean(progressRef.current >= 100 || eventPacket.isLoadingDone || (typeof eventPacket.progress === 'number' && eventPacket.progress >= 100));
      if (isDone) {
        setIsSteelmanExiting(true);
      }
    }

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

      // Play synthesized audio strictly if Steelman (enforced in playSpeech)
      playSpeech({
        speakerId: speakerId,
        dialogue: eventPacket.dialogue,
        audioUrl: eventPacket.audio_url || null,
        onEnd: () => {
          setActiveSpeakerId(null);
          // Keep finding card visible briefly, then clear
          setTimeout(() => {
            setActiveDialogue((curr) => (curr?.id === eventPacket.id ? null : curr));
          }, 1000);
        },
      });
    } else {
      // If action has no dialogue (e.g. typing or standing), highlight active evaluator briefly
      setActiveSpeakerId(speakerId);
      setTimeout(() => setActiveSpeakerId(null), 800);
    }
  }, [playSpeech, currentCase?.status, currentCase?.case_verdict]);

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
    selectedAgentIds: selectedAgentIds,
  });

  // GSAP Playback Speed scaling across all sprite animations
  useEffect(() => {
    gsap.globalTimeline.timeScale(playbackSpeed || 1.5);
  }, [playbackSpeed]);

  // GSAP Pause / Resume synchronization with user controls
  useEffect(() => {
    if (!isAutoPlaying) {
      gsap.globalTimeline.pause();
    } else {
      gsap.globalTimeline.resume();
    }
  }, [isAutoPlaying]);

  // Real Backend SSE Pipeline Bridge
  const {
    isLiveBackendActive,
    isReplaying,
    replayCaseInBullpen,
  } = useBackendLiveBridge({
    onDispatchPacket: triggerManualEvent,
    isPaused: !isAutoPlaying,
    playbackSpeed: playbackSpeed || 1.5,
    selectedAgentIds: selectedAgentIds,
  });

  // Handle transition completion to navigate to the Decision Memo / Dashboard screen
  const handleTransitionComplete = useCallback(() => {
    setIsPageTransitionActive(false);
    setIsSteelmanExiting(false);
    if (caseContext?.navigateScreen) {
      caseContext.navigateScreen('dashboard');
    } else if (caseContext?.dispatch) {
      caseContext.dispatch({ type: 'NAVIGATE_SCREEN', payload: 'dashboard' });
    }
  }, [caseContext]);

  // Reset persistent latches when a new case proposal is loaded
  if (prevCaseIdRef.current !== currentCase?.id) {
    prevCaseIdRef.current = currentCase?.id;
    hasSynthesizedRef.current = false;
    maxProgressRef.current = 0;
    exitTriggeredRef.current = false;
  }

  // Calculate live progress and stage
  const caseStatus = currentCase?.status;
  const rawSynthesisDone =
    caseStatus === 'done' ||
    !!currentCase?.case_verdict ||
    Boolean(lastEvent?.isSynthesisDone) ||
    Boolean(lastEvent?.stage?.includes('Crucible Synthesis')) ||
    false;

  if (rawSynthesisDone) {
    hasSynthesizedRef.current = true;
  }

  const isSynthesisDone = hasSynthesizedRef.current;
  const isFinished = isSynthesisDone || (caseStatus === 'done' && !isLiveBackendActive);
  const isTesting = !isFinished && (isLiveBackendActive || caseStatus === 'testing');

  const claimsCount = currentCase?.claims?.length || 0;
  const findingsCount = currentCase?.findings?.length || 0;
  const activeAgentsCount = currentCase?.selected_agents?.length || 3;
  const totalExpectedFindings = Math.max(1, claimsCount * activeAgentsCount);
  const reconciledCount = currentCase?.claims?.filter((c) => c.status)?.length || 0;

  let currentPhase = 'Initialization';
  let progressPercent = 0;
  let phaseDetail = 'Awaiting pipeline dispatch...';

  if (isFinished || isSynthesisDone) {
    currentPhase = 'Evaluation Complete';
    progressPercent = 100;
    phaseDetail = 'Pipeline verification complete, memo assembled.';
    maxProgressRef.current = 100;
  } else if (isTesting) {
    if (reconciledCount > 0) {
      currentPhase = 'Phase 3: Steelman Reconciliation';
      progressPercent = Math.min(95, 75 + Math.round((reconciledCount / Math.max(1, claimsCount)) * 20));
      phaseDetail = `Reconciling evidence for claim ${reconciledCount} of ${claimsCount}...`;
    } else if (findingsCount > 0) {
      currentPhase = 'Phase 2: Adversarial Stress-Testing';
      const findingProgress = Math.min(1, findingsCount / totalExpectedFindings);
      progressPercent = Math.min(75, 25 + Math.round(findingProgress * 50));
      phaseDetail = `Gathering empirical evidence (${findingsCount} findings evaluated)...`;
    } else {
      currentPhase = 'Phase 1: Load-Bearing Scrutiny';
      const eventActivityBonus = Math.min(10, (caseContext?.state?.eventLog?.length || 1) * 2);
      progressPercent = Math.min(24, 14 + eventActivityBonus);
      phaseDetail = 'Steelman evaluating critical core premises...';
    }
    maxProgressRef.current = Math.max(maxProgressRef.current, progressPercent);
    progressPercent = maxProgressRef.current;
  } else if (isReplaying) {
    currentPhase = 'Replaying Findings in Bullpen';
    progressPercent = 100;
    phaseDetail = 'Reviewing telemetry and delivered verdicts.';
    maxProgressRef.current = 100;
  } else if (isAutoPlaying || eventHistory?.length > 0) {
    const currentScenario = scenarios?.[currentScenarioKey];
    const totalScenarioEvents = currentScenario?.events?.length || 12;
    const currentMockIndex = Math.min(totalScenarioEvents, Math.max(1, (eventHistory?.length || 1)));
    if (currentMockIndex >= totalScenarioEvents || lastEvent?.isSynthesisDone) {
      progressPercent = 100;
      currentPhase = 'Evaluation Complete';
      phaseDetail = 'Pipeline verification complete, memo assembled.';
      maxProgressRef.current = 100;
    } else {
      progressPercent = Math.min(95, Math.max(12, Math.round((currentMockIndex / totalScenarioEvents) * 100)));
      currentPhase = lastEvent?.stage || 'Simulation Live Stream';
      phaseDetail = lastEvent?.thought || lastEvent?.dialogue || 'Autonomous evaluators auditing proposal in bullpen...';
      maxProgressRef.current = Math.max(maxProgressRef.current, progressPercent);
      progressPercent = maxProgressRef.current;
    }
  } else {
    currentPhase = 'Pipeline Standby';
    progressPercent = Math.max(8, maxProgressRef.current);
    phaseDetail = 'Ready to launch adversarial evaluation...';
  }

  const clampedProgress = Math.max(0, Math.min(100, progressPercent));
  const isLoadingDone = clampedProgress >= 100;
  progressRef.current = clampedProgress;
  isSynthesisDoneRef.current = isSynthesisDone;

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-transparent text-on-surface flex flex-col font-sans selection:bg-primary-container/30">
      {/* Main Content Area: Simulation Stage + Side Control Panel */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row items-start gap-6">
        {/* Simulation Canvas Stage with In-World Finding / Telemetry Card */}
        <section className="relative flex-1 w-full min-w-0">
          {/* Minimalist Live Progress Header */}
          <div className="mb-space-4 rounded-xl bg-surface border border-outline-variant p-space-5 relative">
            <div className="flex flex-col gap-space-4 pb-space-4">
              <div className="flex items-start justify-between gap-space-4">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-outline uppercase tracking-wider">
                    Testing Proposal
                  </span>
                  <span className="font-headline-lg text-headline-lg text-on-surface font-semibold truncate">
                    {currentCase?.raw_input || 'Testing decision proposal'}
                  </span>
                </div>
                <div className="flex items-center gap-space-2 shrink-0 pt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isFinished
                        ? 'bg-verdict-survived'
                        : isTesting
                        ? 'bg-primary animate-pulse'
                        : isReplaying
                        ? 'bg-secondary animate-pulse'
                        : 'bg-outline'
                    }`}
                  />
                  <span className="font-mono text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
                    {isFinished ? 'Complete' : isTesting ? 'Live' : isReplaying ? 'Replay' : 'Standby'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar & Phase Tracker */}
            <div className="space-y-space-2 pt-space-2 border-t border-outline-variant/50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-on-surface">
                  {currentPhase}
                </span>
                <span className="font-mono text-outline">{clampedProgress}%</span>
              </div>

              {/* Minimal Track */}
              <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${clampedProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-outline pt-1">
                <span className="truncate">{phaseDetail}</span>
              </div>
            </div>

            {/* Finished Banner */}
            {isFinished && currentCase?.case_verdict && (
              <div className="mt-space-3 p-space-3 rounded-lg bg-surface-container border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-space-3 animate-in fade-in slide-in-from-top-1">
                <div className="flex flex-col items-start gap-1 min-w-0">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border",
                    currentCase.case_verdict.decision_state?.toLowerCase() === 'survived' ? "bg-verdict-survived/20 text-verdict-survived border-verdict-survived/40" :
                    currentCase.case_verdict.decision_state?.toLowerCase() === 'broken' ? "bg-verdict-broken/20 text-verdict-broken border-verdict-broken/40" :
                    currentCase.case_verdict.decision_state?.toLowerCase() === 'weakened' ? "bg-verdict-weakened/20 text-verdict-weakened border-verdict-weakened/40" :
                    currentCase.case_verdict.decision_state?.toLowerCase() === 'unresolved' ? "bg-verdict-unresolved/20 text-verdict-unresolved border-verdict-unresolved/40" :
                    "text-on-surface-variant bg-surface border-outline-variant"
                  )}>
                    {currentCase.case_verdict.decision_state || 'COMPLETE'}
                  </span>
                  <span className="text-sm text-on-surface font-medium truncate">
                    {currentCase.case_verdict.headline || 'Live stress test complete.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSteelmanExiting(true);
                    setIsPageTransitionActive(true);
                  }}
                  className="px-space-4 py-space-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                >
                  Proceed to Decision Memo
                </button>
              </div>
            )}
          </div>

          <StageContainer
            agents={AGENT_CONFIGS}
            selectedAgentIds={selectedAgentIds}
            isSynthesisDone={isSynthesisDone}
            isLoadingDone={isLoadingDone}
            loadingProgress={clampedProgress}
            characterPositions={characterPositions}
            currentActionPacket={lastEvent}
            activeSpeakerId={activeSpeakerId}
            hoveredAgentId={hoveredAgentId}
            isSteelmanExiting={isSteelmanExiting}
            onHoverAgent={setHoveredAgentId}
            onPositionUpdate={handlePositionUpdate}
            playSfx={playSfx}
          >
            {/* In-world Workstation Telemetry HUD with Hover-Only Visibility and Persistent Steelman Pill */}
            <DialogueOverlay
              activeDialogue={activeDialogue}
              characterPositions={characterPositions}
              hoveredAgentId={hoveredAgentId}
              evaluatorFindings={evaluatorFindings}
              onHoverAgent={setHoveredAgentId}
            />
          </StageContainer>

          {/* Cinematic Crucible Next Page Transition Animation */}
          <CruciblePageTransition
            isActive={isPageTransitionActive}
            onComplete={handleTransitionComplete}
            verdictHeadline={currentCase?.case_verdict?.headline || 'Adjudication Complete'}
            verdictState={currentCase?.case_verdict?.decision_state || 'PROCEED'}
          />
        </section>

        {/* Side Panel: Exclusively Active Workstation Feed */}
        <SideControlPanel
          eventHistory={eventHistory}
          hoveredAgentId={hoveredAgentId}
        />
      </div>
    </div>
  );
}

export default DiscussionApp;
