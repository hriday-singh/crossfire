import React, { useState, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import StageContainer from './canvas/StageContainer';
import DialogueOverlay from './ui/DialogueOverlay';
import SideControlPanel from './ui/SideControlPanel';
import CruciblePageTransition from './ui/CruciblePageTransition';
import { AGENT_CONFIGS } from '../constants/agentConfigs';
import { WAYPOINTS } from '../constants/roomLayout';
import useSocketSimulation from '../hooks/useSocketSimulation';

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
  const isPreview = !!caseContext?.state?.previewView;

  // A real (non-preview) case owns its own completion signal: only `run_complete`/`done`
  // (status) or `case_verdict` may end the run. Scripted/mock packets carrying
  // isSynthesisDone must never terminate a live run mid-test.
  const isRealRun = !!currentCase && !isPreview;
  const caseIsDone = currentCase?.status === 'done' || !!currentCase?.case_verdict;

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
  const [isStageReady, setIsStageReady] = useState(false);
  const exitTriggeredRef = useRef(false);
  const progressRef = useRef(0);
  const isSynthesisDoneRef = useRef(false);
  const hasSynthesizedRef = useRef(false);
  const maxProgressRef = useRef(0);
  const prevCaseIdRef = useRef(currentCase?.id);

  const selectedAgentIds = currentCase?.selected_agents || null;

  // Position update callback from CharacterSprite GSAP tweens
  const handlePositionUpdate = useCallback((agentId, x, y) => {
    setCharacterPositions((prev) => ({
      ...prev,
      [agentId]: { x, y },
    }));

    // If Steelman reaches near the right chamber door (x > 840, y near 285), trigger the page transition animation ONLY when synthesis is done AND loading is 100%
    if (agentId === 'steelman' && x >= 840 && !exitTriggeredRef.current) {
      const isDone = (isRealRun ? caseIsDone : isSynthesisDoneRef.current) && (progressRef.current >= 100);
      if (isDone) {
        exitTriggeredRef.current = true;
        setIsPageTransitionActive(true);
      }
    }
  }, [isRealRun, caseIsDone]);

  // Event received handler from Socket or Mock simulation runner
  const handleEventReceived = useCallback((eventPacket) => {
    const speakerId = eventPacket.speaker_id;

    // Detect Steelman exit event - strictly when synthesis is done AND loading is 100%
    if (speakerId === 'steelman' && eventPacket.target === 'right_door') {
      const doneSignal = isRealRun
        ? caseIsDone
        : Boolean(eventPacket.isSynthesisDone || eventPacket.stage?.includes('Synthesis'));
      const isDone =
        doneSignal &&
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

      // Clear active speaker and dialogue after a brief display window
      setTimeout(() => {
        setActiveSpeakerId(null);
        setActiveDialogue((curr) => (curr?.id === eventPacket.id ? null : curr));
      }, 2000);
    } else {
      // If action has no dialogue (e.g. typing or standing), highlight active evaluator briefly
      setActiveSpeakerId(speakerId);
      setTimeout(() => setActiveSpeakerId(null), 800);
    }
  }, [isRealRun, caseIsDone]);

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
    // Scripted scenario playback would inject its own steelman exit packet mid-run.
    mockEnabled: !isRealRun,
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

  const handleStageReady = useCallback(() => {
    setIsStageReady(true);
  }, []);

  // Auto-trigger replay when navigating to the runner screen for a completed case once the stage is ready
  const hasAutoReplayedRef = useRef(false);
  useEffect(() => {
    if (
      isStageReady &&
      !hasAutoReplayedRef.current &&
      !isLiveBackendActive &&
      caseIsDone &&
      currentCase?.findings?.length > 0
    ) {
      hasAutoReplayedRef.current = true;
      replayCaseInBullpen();
    }
  }, [isStageReady, isLiveBackendActive, caseIsDone, currentCase, replayCaseInBullpen]);

  // Reset the latch when the case changes so a fresh run can replay again
  useEffect(() => {
    hasAutoReplayedRef.current = false;
  }, [currentCase?.id]);

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
  const rawSynthesisDone = isRealRun
    ? caseIsDone
    : Boolean(lastEvent?.isSynthesisDone) ||
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

  let progressPercent = 0;

  if (isFinished || isSynthesisDone) {
    progressPercent = 100;
    maxProgressRef.current = 100;
  } else if (isTesting) {
    if (reconciledCount > 0) {
      progressPercent = Math.min(95, 75 + Math.round((reconciledCount / Math.max(1, claimsCount)) * 20));
    } else if (findingsCount > 0) {
      const findingProgress = Math.min(1, findingsCount / totalExpectedFindings);
      progressPercent = Math.min(75, 25 + Math.round(findingProgress * 50));
    } else {
      const eventActivityBonus = Math.min(10, (caseContext?.state?.eventLog?.length || 1) * 2);
      progressPercent = Math.min(24, 14 + eventActivityBonus);
    }
    maxProgressRef.current = Math.max(maxProgressRef.current, progressPercent);
    progressPercent = maxProgressRef.current;
  } else if (isReplaying) {
    progressPercent = 100;
    maxProgressRef.current = 100;
  } else if (isAutoPlaying || eventHistory?.length > 0) {
    const currentScenario = scenarios?.[currentScenarioKey];
    const totalScenarioEvents = currentScenario?.events?.length || 12;
    const currentMockIndex = Math.min(totalScenarioEvents, Math.max(1, (eventHistory?.length || 1)));
    if (currentMockIndex >= totalScenarioEvents || lastEvent?.isSynthesisDone) {
      progressPercent = 100;
      maxProgressRef.current = 100;
    } else {
      progressPercent = Math.min(95, Math.max(12, Math.round((currentMockIndex / totalScenarioEvents) * 100)));
      maxProgressRef.current = Math.max(maxProgressRef.current, progressPercent);
      progressPercent = maxProgressRef.current;
    }
  } else {
    progressPercent = Math.max(8, maxProgressRef.current);
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
          {/* Proposal Header */}
          <div className="mb-space-4 rounded-xl bg-surface border border-outline-variant px-space-5 py-space-4 relative">
            <div className="flex items-start justify-between gap-space-3 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-outline uppercase tracking-wider">
                    {isReplaying ? 'Replaying' : 'Testing Proposal'}
                  </span>
                  {isReplaying && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border bg-primary/10 text-primary border-primary/30 animate-pulse">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                      </span>
                      Replay
                    </span>
                  )}
                </div>
                <span className="font-headline-lg text-headline-lg text-on-surface font-semibold truncate">
                  {currentCase?.raw_input || 'Testing decision proposal'}
                </span>
              </div>

              {/* Back to Memo button — visible while replaying or when finished */}
              {(isReplaying || isFinished) && caseContext?.navigateScreen && (
                <button
                  type="button"
                  onClick={() => caseContext.navigateScreen('dashboard')}
                  className="shrink-0 px-space-4 py-space-2 rounded border border-outline-variant bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  Back to Memo
                </button>
              )}
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
            onStageReady={handleStageReady}
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
          isReplaying={isReplaying}
        />
      </div>
    </div>
  );
}

export default DiscussionApp;
