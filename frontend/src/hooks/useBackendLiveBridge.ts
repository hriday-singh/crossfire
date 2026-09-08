import { useEffect, useRef, useState, useCallback } from 'react';
import { useCase } from '../context/CaseContext';

export const AGENT_HOME_DESKS: Record<string, string> = {
  devils_advocate: 'cubicle_2_desk',
  researcher: 'cubicle_3_desk',
  builder: 'cubicle_1_desk',
  operator: 'cubicle_4_desk',
  steelman: 'steelman_chair',
};

export const COGNITIVE_TAGS: Record<string, string> = {
  devils_advocate: '[Assumption Pre-Mortem]',
  researcher: '[Citation Audit]',
  builder: '[Feasibility Test]',
  operator: '[Friction Test]',
  steelman: '[Steelman]',
};

/**
 * Stage choreography. The backend runs claim groups concurrently, so frames from
 * different claims interleave on the wire; the bullpen plays exactly one claim at a
 * time and queues the rest. BEAT_MS is how long each frame owns the stage.
 */
const GATED_EVENTS = new Set(['claim_started', 'test_started', 'finding_ready', 'claim_complete']);
const TERMINAL_EVENTS = new Set(['run_complete', 'done']);

const BEAT_MS: Record<string, number> = {
  claim_started: 600,
  test_started: 450,
  finding_ready: 1900,
  claim_complete: 400,
  load_bearing_ready: 300,
  verdict_ready: 700,
  case_verdict: 3000,
  activity: 200,
  run_complete: 300,
  done: 300,
};

// A frame belongs to the claim it names, whichever field the backend used for it.
export function eventClaimId(item: any): string | null {
  const data = item?.data || {};
  return data.claim_id || data.target_claim_id || data.finding?.claim_id || null;
}

export function getCognitiveTag(agentId: string): string {
  return COGNITIVE_TAGS[agentId] || '[Audit Task]';
}

export function normalizeEvaluatorId(tagOrName: string | undefined): string {
  if (!tagOrName) return 'devils_advocate';
  const lower = tagOrName.toLowerCase();
  if (lower.includes('devil')) return 'devils_advocate';
  if (lower.includes('receipt') || lower.includes('research') || lower.includes('evidence')) return 'researcher';
  if (lower.includes('build') || lower.includes('feasib') || lower.includes('mechanic') || lower.includes('latency')) return 'builder';
  if (lower.includes('operat') || lower.includes('procure') || lower.includes('friction') || lower.includes('overthink')) return 'operator';
  if (lower.includes('steelman') || lower.includes('arbit') || lower.includes('steel') || lower.includes('magistrate')) return 'steelman';
  return 'devils_advocate';
}

interface UseBackendLiveBridgeProps {
  onDispatchPacket?: (packet: any) => void;
  isPaused?: boolean;
  playbackSpeed?: number;
  selectedAgentIds?: string[] | null;
}

export function useBackendLiveBridge({
  onDispatchPacket,
  isPaused = false,
  playbackSpeed = 1.5,
  selectedAgentIds = null,
}: UseBackendLiveBridgeProps = {}) {
  const { state } = useCase();
  const currentCase = state.currentCase;
  const isStreaming = state.isStreaming;

  const [isReplaying, setIsReplaying] = useState(false);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const lastCaseIdRef = useRef<string | null>(null);
  const activeTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Serial stage queue: pending frames, the claim currently on stage, and the claims
  // already closed (their late cross-examination findings are free to play).
  const queueRef = useRef<any[]>([]);
  const busyRef = useRef(false);
  const activeClaimRef = useRef<string | null>(null);
  const finishedClaimsRef = useRef<Set<string>>(new Set());
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isAgentSelected = useCallback((agentId: string) => {
    if (agentId === 'steelman') return true;
    const list = selectedAgentIds || currentCase?.selected_agents || null;
    if (!list || list.length === 0) return true;
    const norm = normalizeEvaluatorId(agentId);
    return list.some((id) => normalizeEvaluatorId(id) === norm);
  }, [selectedAgentIds, currentCase?.selected_agents]);

  const dispatchPacket = useCallback((packet: any) => {
    onDispatchPacket?.(packet);
  }, [onDispatchPacket]);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      activeTimersRef.current.delete(timer);
      fn();
    }, ms);
    activeTimersRef.current.add(timer);
    return timer;
  }, []);

  const clearAllTimers = useCallback(() => {
    activeTimersRef.current.forEach((t) => clearTimeout(t));
    activeTimersRef.current.clear();
  }, []);

  // Reset processed IDs on new case
  useEffect(() => {
    if (currentCase?.id !== lastCaseIdRef.current) {
      lastCaseIdRef.current = currentCase?.id || null;
      processedEventIdsRef.current.clear();
      queueRef.current = [];
      busyRef.current = false;
      activeClaimRef.current = null;
      finishedClaimsRef.current.clear();
      stallTimerRef.current = null;
      clearAllTimers();
    }
  }, [currentCase?.id, clearAllTimers]);

  // Plays one stream frame. Returns how long that beat holds the stage, in ms.
  const playEvent = useCallback((item: any) => {
    const speedMultiplier = playbackSpeed > 0 ? 1 / playbackSpeed : 1;
    const { event, data } = item;

        if (event === 'claim_started') {
          // 0. claim_started: this claim takes the stage; only its agents wake.
          const claimIndex = typeof data.claim_index === 'number' ? data.claim_index : 0;
          const totalClaims = typeof data.total_claims === 'number' ? data.total_claims : 1;
          const claimStatement =
            data.claim_statement ||
            currentCase?.claims?.find((c: any) => c.id === data.claim_id)?.statement ||
            'Core Claim';

          dispatchPacket({
            speaker_id: 'steelman',
            action: 'inspect',
            target: 'steelman_chair',
            cognitive_tag: '[Steelman]',
            target_claim_id: data.claim_id,
            claim_statement: claimStatement,
            stage: `Claim ${claimIndex + 1} of ${totalClaims} on the stand`,
            thought: claimStatement,
            dialogue: null,
          });
        } else if (event === 'claim_complete') {
          // 8. claim_complete: every agent for this claim is seated again.
          const findingCount = typeof data.finding_count === 'number' ? data.finding_count : 0;
          dispatchPacket({
            speaker_id: 'steelman',
            action: 'inspect',
            target: 'steelman_chair',
            cognitive_tag: '[Steelman]',
            target_claim_id: data.claim_id,
            stage: `Claim closed // ${findingCount} finding${findingCount === 1 ? '' : 's'} on record`,
            thought: null,
            dialogue: null,
          });
        } else if (event === 'test_started') {
          // 1. test_started: Fired when an evaluator begins testing a specific claim
          const agentId = normalizeEvaluatorId(String(data.evaluator || data.failure_mode || ''));
          if (!isAgentSelected(agentId)) return;
          const desk = AGENT_HOME_DESKS[agentId] || 'cubicle_1_desk';
          const targetClaimId = data.target_claim_id || data.claim_id;
          const claimStatement =
            data.claim_statement ||
            currentCase?.claims?.find((c: any) => c.id === targetClaimId)?.statement ||
            'Core Claim';
          const cognitiveTag = getCognitiveTag(agentId);

          let initialThought = `Testing implicit premises in "${claimStatement}"`;
          if (agentId === 'researcher') {
            initialThought = `Searching market citations for "${claimStatement}"`;
          } else if (agentId === 'builder') {
            initialThought = `Auditing Day-1 architecture & blockers for "${claimStatement}"`;
          } else if (agentId === 'operator') {
            initialThought = `Auditing procurement & adoption friction for "${claimStatement}"`;
          }

          dispatchPacket({
            speaker_id: agentId,
            action: 'type',
            target: desk,
            test_id: data.test_id,
            target_claim_id: targetClaimId,
            claim_statement: claimStatement,
            cognitive_tag: cognitiveTag,
            stage: `${cognitiveTag} ${initialThought}`,
            thought: initialThought,
            dialogue: null,
          });
        } else if (event === 'activity') {
          // 2. activity: Continuous telemetry of backend LLM inference
          const agentId = data.evaluator
            ? normalizeEvaluatorId(String(data.evaluator))
            : data.tag
            ? normalizeEvaluatorId(String(data.tag))
            : 'devils_advocate';
          if (agentId !== 'steelman' && !isAgentSelected(agentId)) return;
          const desk = AGENT_HOME_DESKS[agentId] || 'cubicle_1_desk';
          const cognitiveTag = data.tag || getCognitiveTag(agentId);

          dispatchPacket({
            speaker_id: agentId,
            action: agentId === 'steelman' ? 'inspect' : 'type',
            target: desk,
            cognitive_tag: cognitiveTag,
            stage: data.text || 'Processing Investigation Step',
            thought: data.text || 'Processing Investigation Step',
            timestamp: data.timestamp || new Date().toISOString(),
            dialogue: null,
          });
        } else if (event === 'load_bearing_ready') {
          // 3. load_bearing_ready: Steelman assesses whether claim is load-bearing
          const stageText = data.load_bearing
            ? 'Identified Load-Bearing Claim'
            : 'Peripheral Assumption Evaluated';
          dispatchPacket({
            speaker_id: 'steelman',
            action: 'inspect',
            target: 'steelman_chair',
            cognitive_tag: '[Steelman]',
            stage: stageText,
            thought: data.reason || (data.load_bearing ? 'Critical core assumption under test' : 'Peripheral assumption'),
            dialogue: data.reason || null,
          });
        } else if (event === 'finding_ready') {
          // 4. finding_ready: Evaluator completes LLM evaluation and walks to steelman table
          const finding: any = data.finding || data;
          const agentId = normalizeEvaluatorId(String(finding.evaluator || data.evaluator || ''));
          if (!isAgentSelected(agentId)) return;
          const desk = AGENT_HOME_DESKS[agentId] || 'cubicle_1_desk';

          const confidenceVal = typeof finding.confidence === 'number' ? finding.confidence : 0.5;
          const verdictStatus =
            finding.verdict ||
            (confidenceVal >= 0.7 || finding.contradiction
              ? 'broken'
              : confidenceVal >= 0.35
              ? 'weakened'
              : 'survived');
          const dialogueText = finding.result || finding.contradiction || 'Empirical evidence audit complete.';
          const confidencePercent = Math.round(confidenceVal * 100);

          // Step 1: Walk to Steelman approach
          dispatchPacket({
            speaker_id: agentId,
            action: 'walk_to',
            target: 'steelman_approach',
            stage: 'Approaching Magistrate',
            thought: `Delivering finding: ${verdictStatus.toUpperCase()} (${confidencePercent}% objection)`,
            dialogue: null,
          });

          // Step 2: Report findings at table
          addTimer(() => {
            dispatchPacket({
              speaker_id: agentId,
              action: 'inspect',
              target: 'steelman_approach',
              gesture: 'point',
              stage: 'Delivering Evidence Finding',
              verdict: verdictStatus,
              confidence: confidencePercent,
              dialogue: dialogueText,
              reasoning: finding.reasoning,
              contradiction: finding.contradiction,
              evidence: finding.evidence || [],
            });

            // Steelman reviews finding
            dispatchPacket({
              speaker_id: 'steelman',
              action: 'inspect',
              target: 'steelman_chair',
              stage: `Reviewing Finding from ${agentId}`,
              thought: `Reviewing ${agentId} objection: ${verdictStatus.toUpperCase()} (${confidencePercent}%)`,
            });

            // Step 3: Return to workstation
            addTimer(() => {
              dispatchPacket({
                speaker_id: agentId,
                action: 'walk_to',
                target: desk,
                stage: 'Returning to Workstation',
                dialogue: null,
              });

              // Step 4: Sit back down
              addTimer(() => {
                dispatchPacket({
                  speaker_id: agentId,
                  action: 'sit',
                  target: desk,
                  stage: 'Desk Standby',
                  thought: null,
                  dialogue: null,
                });
              }, Math.round(350 * speedMultiplier));
            }, Math.round(700 * speedMultiplier));
          }, Math.round(400 * speedMultiplier));
        } else if (event === 'verdict_ready') {
          // 5. verdict_ready: Steelman reconciles findings for a single claim
          const status = data.status || 'survived';
          const stageText = `Reconciling ${String(status).toUpperCase()}`;
          const dialogueText =
            data.verdict_reasoning || data.fatal_flaw || data.salvaged_claim || 'Claim reconciled.';

          dispatchPacket({
            speaker_id: 'steelman',
            action: 'inspect',
            target: 'steelman_chair',
            cognitive_tag: '[Steel Man Reconciliation]',
            stage: stageText,
            verdict: status,
            dialogue: dialogueText,
            fatal_flaw: data.fatal_flaw,
            salvaged_claim: data.salvaged_claim,
          });
        } else if (event === 'case_verdict') {
          // 6. case_verdict: Final case decision and summary (Crucible Synthesis)
          const verdict: any = data.case_verdict || data.verdict || data;
          const decisionState = verdict.decision_state || 'proceed';

          dispatchPacket({
            speaker_id: 'steelman',
            action: 'inspect',
            target: 'steelman_chair',
            gesture: 'point',
            stage: `Crucible Synthesis: ${String(decisionState).toUpperCase()}`,
            verdict: decisionState,
            dialogue: verdict.summary || verdict.headline || 'Crucible synthesis verdict delivered.',
            isSynthesisDone: true,
          });

          // Steelman leaves the judge room ONLY when synthesis is completed AND loading is 100%
          addTimer(() => {
            dispatchPacket({
              speaker_id: 'steelman',
              action: 'walk_to',
              target: 'right_door',
              stage: 'Synthesis Complete // Exiting Chamber',
              thought: 'Adjudication synthesis completed. Exiting chamber...',
              isSynthesisDone: true,
              isLoadingDone: true,
              progress: 100,
            });
          }, Math.round(2500 * speedMultiplier));
        } else if (event === 'run_complete' || event === 'done') {
          // 7. run_complete / done: All evaluators return to seated workstations in standby
          Object.entries(AGENT_HOME_DESKS).forEach(([agentId, desk]) => {
            if (agentId !== 'steelman') {
              dispatchPacket({
                speaker_id: agentId,
                action: 'sit',
                target: desk,
                stage: 'Run Complete',
                thought: null,
                dialogue: null,
                isSynthesisDone: true,
                isLoadingDone: true,
                progress: 100,
              });
            }
          });

          // Trigger Steelman exit animation to right chamber door on done signal
          dispatchPacket({
            speaker_id: 'steelman',
            action: 'walk_to',
            target: 'right_door',
            stage: 'Synthesis Complete // Exiting Chamber',
            thought: 'Adjudication synthesis completed. Exiting chamber...',
            isSynthesisDone: true,
            isLoadingDone: true,
            progress: 100,
          });
        }

    return Math.round((BEAT_MS[event] ?? 150) * speedMultiplier);
  }, [currentCase, dispatchPacket, playbackSpeed, addTimer, isAgentSelected]);

  const playEventRef = useRef(playEvent);
  playEventRef.current = playEvent;
  const pumpRef = useRef<() => void>(() => {});

  // A frame may take the stage only when its claim is the one being played.
  const isPlayable = useCallback((item: any) => {
    if (TERMINAL_EVENTS.has(item.event)) {
      // The run ends after every real frame has played. The backend sends both
      // run_complete and done, so gate on "nothing left to show", not on queue length.
      return !queueRef.current.some((pending) => !TERMINAL_EVENTS.has(pending.event));
    }
    if (!GATED_EVENTS.has(item.event)) return true;
    const claimId = eventClaimId(item);
    if (!claimId) return true;
    // Cross-examination probes land after their claim closed; let them through.
    if (finishedClaimsRef.current.has(claimId)) return true;
    if (item.event === 'claim_started') return activeClaimRef.current === null;
    return claimId === activeClaimRef.current;
  }, []);

  // Drains the queue one beat at a time.
  const pump = useCallback(() => {
    if (busyRef.current || isPaused) return;
    const queue = queueRef.current;
    const index = queue.findIndex(isPlayable);

    if (index === -1) {
      // A claim never closed (dropped frame, backend error). Open the gate rather
      // than stranding the run - an un-exited stage is what forces a manual click.
      if (queue.length > 0 && !stallTimerRef.current) {
        stallTimerRef.current = addTimer(() => {
          stallTimerRef.current = null;
          activeClaimRef.current = null;
          queueRef.current.forEach((pending) => {
            const claimId = eventClaimId(pending);
            if (claimId) finishedClaimsRef.current.add(claimId);
          });
          pumpRef.current();
        }, 6000);
      }
      return;
    }

    // A frame moved, so the run is not stalled. Disarm the watchdog.
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      activeTimersRef.current.delete(stallTimerRef.current);
      stallTimerRef.current = null;
    }

    const [item] = queue.splice(index, 1);
    if (item.event === 'claim_started') {
      activeClaimRef.current = eventClaimId(item);
    }

    busyRef.current = true;
    const duration = playEventRef.current(item) || 150;

    if (item.event === 'claim_complete') {
      const claimId = eventClaimId(item);
      if (claimId) finishedClaimsRef.current.add(claimId);
      activeClaimRef.current = null;
    }

    addTimer(() => {
      busyRef.current = false;
      pumpRef.current();
    }, duration);
  }, [addTimer, isPaused, isPlayable]);
  pumpRef.current = pump;

  // Enqueue new SSE frames, then keep the stage moving.
  useEffect(() => {
    // `done` flips isStreaming false in the same commit that logs the frame, so the
    // terminal frames must stay processable once the case has finished.
    if (isPaused) return;
    if (!isStreaming && currentCase?.status !== 'testing' && currentCase?.status !== 'done') {
      return;
    }

    // state.eventLog is prepended (newest at index 0). Reverse to iterate oldest -> newest
    const chronological = [...state.eventLog].reverse();
    const unprocessed = chronological.filter((item) => !processedEventIdsRef.current.has(item.id));
    if (unprocessed.length === 0) return;

    unprocessed.forEach((item) => {
      processedEventIdsRef.current.add(item.id);
      queueRef.current.push(item);
    });

    pump();
  }, [state.eventLog, isStreaming, currentCase, isPaused, pump]);

  // Pause handling: clear active in-flight timers when paused
  useEffect(() => {
    if (isPaused) {
      clearAllTimers();
      busyRef.current = false;
      stallTimerRef.current = null;
    } else {
      pumpRef.current();
    }
  }, [isPaused, clearAllTimers]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Replay a completed case's findings in the bullpen
  const replayCaseInBullpen = useCallback(() => {
    if (!currentCase || !currentCase.findings || currentCase.findings.length === 0) return;

    clearAllTimers();
    setIsReplaying(true);
    const findings = currentCase.findings;
    const verdict = currentCase.case_verdict;
    const claims = currentCase.claims || [];

    let totalOffset = 0;
    const speedMultiplier = playbackSpeed > 0 ? 1 / playbackSpeed : 1;
    const baseStep = Math.round(1600 * speedMultiplier);

    findings.forEach((finding: any, idx) => {
      const agentId = normalizeEvaluatorId(finding.evaluator);
      if (!isAgentSelected(agentId)) return;
      const desk = AGENT_HOME_DESKS[agentId] || 'cubicle_1_desk';
      const targetClaim = claims.find((c: any) => c.id === finding.claim_id);
      const claimText = targetClaim?.statement || 'Target Claim';

      const confidenceVal = typeof finding.confidence === 'number' ? finding.confidence : 0.5;
      const verdictStatus =
        finding.verdict ||
        (confidenceVal >= 0.7 || finding.contradiction
          ? 'broken'
          : confidenceVal >= 0.35
          ? 'weakened'
          : 'survived');
      const dialogueText = finding.result || finding.contradiction || 'Empirical citation audit.';
      const confidencePercent = Math.round(confidenceVal * 100);
      const cognitiveTag = getCognitiveTag(agentId);

      addTimer(() => {
        // Step 1: Active thinking at desk
        dispatchPacket({
          speaker_id: agentId,
          action: 'type',
          target: desk,
          cognitive_tag: cognitiveTag,
          stage: `${cognitiveTag} Auditing: "${claimText}"`,
          thought: `Auditing: "${claimText}"`,
          dialogue: null,
        });

        // Step 2: Walk to table
        addTimer(() => {
          dispatchPacket({
            speaker_id: agentId,
            action: 'walk_to',
            target: 'steelman_approach',
            stage: `Replay Finding #${idx + 1}`,
            thought: `Delivering finding: ${verdictStatus.toUpperCase()} (${confidencePercent}% objection)`,
            dialogue: null,
          });

          // Step 3: Present
          addTimer(() => {
            dispatchPacket({
              speaker_id: agentId,
              action: 'inspect',
              target: 'steelman_approach',
              gesture: 'point',
              stage: 'Reporting Finding',
              verdict: verdictStatus,
              confidence: confidencePercent,
              dialogue: dialogueText,
              reasoning: finding.reasoning,
              contradiction: finding.contradiction,
              evidence: finding.evidence || [],
            });

            // Steelman reviews
            dispatchPacket({
              speaker_id: 'steelman',
              action: 'inspect',
              target: 'steelman_chair',
              stage: `Reviewing Finding #${idx + 1} from ${agentId}`,
              thought: `Reviewing ${agentId} objection: ${verdictStatus.toUpperCase()} (${confidencePercent}%)`,
            });

            // Step 4: Return
            addTimer(() => {
              dispatchPacket({
                speaker_id: agentId,
                action: 'walk_to',
                target: desk,
                stage: 'Returning to Workstation',
                dialogue: null,
              });

              addTimer(() => {
                dispatchPacket({
                  speaker_id: agentId,
                  action: 'sit',
                  target: desk,
                  stage: 'Workstation Standby',
                  thought: null,
                  dialogue: null,
                });
              }, Math.round(300 * speedMultiplier));
            }, Math.round(600 * speedMultiplier));
          }, Math.round(350 * speedMultiplier));
        }, Math.round(250 * speedMultiplier));
      }, totalOffset);

      totalOffset += baseStep;
    });

    // After all findings, Steelman delivers synthesis at chair and then exits to right door
    if (verdict) {
      addTimer(() => {
        dispatchPacket({
          speaker_id: 'steelman',
          action: 'inspect',
          target: 'steelman_chair',
          stage: `Crucible Synthesis: ${String(verdict.decision_state || 'proceed').toUpperCase()}`,
          verdict: verdict.decision_state || 'drop',
          dialogue: verdict.summary || verdict.headline || 'All findings reconciled.',
          isSynthesisDone: true,
        });

        addTimer(() => {
          dispatchPacket({
            speaker_id: 'steelman',
            action: 'walk_to',
            target: 'right_door',
            stage: 'Synthesis Complete // Exiting Chamber',
            thought: 'All findings reconciled. Exiting chamber...',
            isSynthesisDone: true,
            isLoadingDone: true,
            progress: 100,
          });
          setIsReplaying(false);
        }, Math.round(2500 * speedMultiplier));
      }, totalOffset + 150);
    } else {
      addTimer(() => setIsReplaying(false), totalOffset);
    }
  }, [currentCase, dispatchPacket, playbackSpeed, addTimer, clearAllTimers, isAgentSelected]);

  return {
    isLiveBackendActive: isStreaming || currentCase?.status === 'testing',
    currentCase,
    isReplaying,
    replayCaseInBullpen,
  };
}

export default useBackendLiveBridge;
