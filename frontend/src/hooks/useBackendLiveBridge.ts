import { useEffect, useRef, useState, useCallback } from 'react';
import { useCase } from '../context/CaseContext';

export const AGENT_HOME_DESKS: Record<string, string> = {
  devils_advocate: 'cubicle_2_desk',
  receipts: 'cubicle_3_desk',
  builder: 'cubicle_1_desk',
  operator: 'cubicle_4_desk',
  judge: 'judge_chair',
};

export const COGNITIVE_TAGS: Record<string, string> = {
  devils_advocate: '[Assumption Pre-Mortem]',
  receipts: '[Citation Audit]',
  builder: '[Feasibility Test]',
  operator: '[Friction Test]',
  judge: '[Steelman]',
};

export function getCognitiveTag(agentId: string): string {
  return COGNITIVE_TAGS[agentId] || '[Audit Task]';
}

export function normalizeEvaluatorId(tagOrName: string | undefined): string {
  if (!tagOrName) return 'devils_advocate';
  const lower = tagOrName.toLowerCase();
  if (lower.includes('devil')) return 'devils_advocate';
  if (lower.includes('receipt') || lower.includes('research') || lower.includes('evidence')) return 'receipts';
  if (lower.includes('build') || lower.includes('feasib') || lower.includes('mechanic') || lower.includes('latency')) return 'builder';
  if (lower.includes('operat') || lower.includes('procure') || lower.includes('friction') || lower.includes('overthink')) return 'operator';
  if (lower.includes('judge') || lower.includes('arbit') || lower.includes('steel') || lower.includes('magistrate')) return 'judge';
  return 'devils_advocate';
}

interface UseBackendLiveBridgeProps {
  onDispatchPacket?: (packet: any) => void;
}

export function useBackendLiveBridge({ onDispatchPacket }: UseBackendLiveBridgeProps = {}) {
  const { state } = useCase();
  const currentCase = state.currentCase;
  const isStreaming = state.isStreaming;

  const [isReplaying, setIsReplaying] = useState(false);
  const processedEventCountRef = useRef(0);
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dispatchPacket = useCallback((packet: any) => {
    onDispatchPacket?.(packet);
  }, [onDispatchPacket]);

  // Handle live streaming events from backend SSE stream
  useEffect(() => {
    if (!isStreaming) {
      processedEventCountRef.current = state.eventLog.length;
      return;
    }

    const unprocessed = state.eventLog.slice(processedEventCountRef.current);
    if (unprocessed.length === 0) return;

    processedEventCountRef.current = state.eventLog.length;

    unprocessed.forEach((item, idx) => {
      const delay = idx * 600;
      setTimeout(() => {
        const { event, data } = item;

        if (event === 'test_started') {
          // 1. test_started: Fired when an evaluator begins testing a specific claim
          const agentId = normalizeEvaluatorId(String(data.evaluator || data.failure_mode || ''));
          const desk = AGENT_HOME_DESKS[agentId] || 'cubicle_1_desk';
          const targetClaimId = data.target_claim_id || data.claim_id;
          const claimStatement =
            data.claim_statement ||
            currentCase?.claims?.find((c: any) => c.id === targetClaimId)?.statement ||
            'Core Claim';
          const cognitiveTag = getCognitiveTag(agentId);

          let initialThought = `Testing implicit premises in "${claimStatement}"`;
          if (agentId === 'receipts') {
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
          const desk = AGENT_HOME_DESKS[agentId] || 'cubicle_1_desk';
          const cognitiveTag = data.tag || getCognitiveTag(agentId);

          dispatchPacket({
            speaker_id: agentId,
            action: agentId === 'judge' ? 'inspect' : 'type',
            target: desk,
            cognitive_tag: cognitiveTag,
            stage: data.text || 'Processing Investigation Step',
            thought: data.text || 'Processing Investigation Step',
            timestamp: data.timestamp || new Date().toISOString(),
            dialogue: null,
          });
        } else if (event === 'load_bearing_ready') {
          // 3. load_bearing_ready: Judge assesses whether claim is load-bearing
          const stageText = data.load_bearing
            ? 'Identified Load-Bearing Claim'
            : 'Peripheral Assumption Evaluated';
          dispatchPacket({
            speaker_id: 'judge',
            action: 'inspect',
            target: 'judge_chair',
            cognitive_tag: '[Steelman]',
            stage: stageText,
            thought: data.reason || (data.load_bearing ? 'Critical core assumption under test' : 'Peripheral assumption'),
            dialogue: data.reason || null,
          });
        } else if (event === 'finding_ready') {
          // 4. finding_ready: Evaluator completes LLM evaluation and walks to judge table
          const finding: any = data.finding || data;
          const agentId = normalizeEvaluatorId(String(finding.evaluator || data.evaluator || ''));
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

          // Step 1: Walk to Judge approach
          dispatchPacket({
            speaker_id: agentId,
            action: 'walk_to',
            target: 'judge_approach',
            stage: 'Approaching Magistrate',
            thought: `Delivering finding: ${verdictStatus.toUpperCase()} (${confidencePercent}% objection)`,
            dialogue: null,
          });

          // Step 2: Report findings at table
          setTimeout(() => {
            dispatchPacket({
              speaker_id: agentId,
              action: 'inspect',
              target: 'judge_approach',
              gesture: 'point',
              stage: 'Delivering Evidence Finding',
              verdict: verdictStatus,
              confidence: confidencePercent,
              dialogue: dialogueText,
              reasoning: finding.reasoning,
              contradiction: finding.contradiction,
              evidence: finding.evidence || [],
            });

            // Judge reviews finding
            dispatchPacket({
              speaker_id: 'judge',
              action: 'inspect',
              target: 'judge_chair',
              stage: `Reviewing Finding from ${agentId}`,
              thought: `Reviewing ${agentId} objection: ${verdictStatus.toUpperCase()} (${confidencePercent}%)`,
            });

            // Step 3: Return to workstation
            setTimeout(() => {
              dispatchPacket({
                speaker_id: agentId,
                action: 'walk_to',
                target: desk,
                stage: 'Returning to Workstation',
                dialogue: null,
              });

              // Step 4: Sit back down
              setTimeout(() => {
                dispatchPacket({
                  speaker_id: agentId,
                  action: 'sit',
                  target: desk,
                  stage: 'Desk Standby',
                  thought: null,
                  dialogue: null,
                });
              }, 2000);
            }, 3800);
          }, 2200);
        } else if (event === 'verdict_ready') {
          // 5. verdict_ready: Judge reconciles findings for a single claim
          const status = data.status || 'survived';
          const stageText = `Reconciling ${String(status).toUpperCase()}`;
          const dialogueText =
            data.verdict_reasoning || data.fatal_flaw || data.salvaged_claim || 'Claim reconciled.';

          dispatchPacket({
            speaker_id: 'judge',
            action: 'inspect',
            target: 'judge_chair',
            cognitive_tag: '[Steel Man Reconciliation]',
            stage: stageText,
            verdict: status,
            dialogue: dialogueText,
            fatal_flaw: data.fatal_flaw,
            salvaged_claim: data.salvaged_claim,
          });
        } else if (event === 'case_verdict') {
          // 6. case_verdict: Final case decision and summary
          const verdict: any = data.case_verdict || data.verdict || data;
          const decisionState = verdict.decision_state || 'proceed';

          dispatchPacket({
            speaker_id: 'judge',
            action: 'inspect',
            target: 'judge_chair',
            gesture: 'point',
            stage: `Adjudicating Decision Memo: ${String(decisionState).toUpperCase()}`,
            verdict: decisionState,
            dialogue: verdict.summary || verdict.headline || 'Verdict delivered.',
          });
        } else if (event === 'run_complete') {
          // 7. run_complete: All evaluators return to seated workstations in standby
          Object.entries(AGENT_HOME_DESKS).forEach(([agentId, desk]) => {
            dispatchPacket({
              speaker_id: agentId,
              action: 'sit',
              target: desk,
              stage: 'Run Complete',
              thought: null,
              dialogue: null,
            });
          });
        }
      }, delay);
    });
  }, [state.eventLog, isStreaming, currentCase, dispatchPacket]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    };
  }, []);

  // Replay a completed case's findings in the bullpen
  const replayCaseInBullpen = useCallback(() => {
    if (!currentCase || !currentCase.findings || currentCase.findings.length === 0) return;

    setIsReplaying(true);
    const findings = currentCase.findings;
    const verdict = currentCase.case_verdict;
    const claims = currentCase.claims || [];

    let totalOffset = 0;

    findings.forEach((finding: any, idx) => {
      const agentId = normalizeEvaluatorId(finding.evaluator);
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

      setTimeout(() => {
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
        setTimeout(() => {
          dispatchPacket({
            speaker_id: agentId,
            action: 'walk_to',
            target: 'judge_approach',
            stage: `Replay Finding #${idx + 1}`,
            thought: `Delivering finding: ${verdictStatus.toUpperCase()} (${confidencePercent}% objection)`,
            dialogue: null,
          });

          // Step 3: Present
          setTimeout(() => {
            dispatchPacket({
              speaker_id: agentId,
              action: 'inspect',
              target: 'judge_approach',
              gesture: 'point',
              stage: 'Reporting Finding',
              verdict: verdictStatus,
              confidence: confidencePercent,
              dialogue: dialogueText,
              reasoning: finding.reasoning,
              contradiction: finding.contradiction,
              evidence: finding.evidence || [],
            });

            // Judge reviews
            dispatchPacket({
              speaker_id: 'judge',
              action: 'inspect',
              target: 'judge_chair',
              stage: `Reviewing Finding #${idx + 1} from ${agentId}`,
              thought: `Reviewing ${agentId} objection: ${verdictStatus.toUpperCase()} (${confidencePercent}%)`,
            });

            // Step 4: Return
            setTimeout(() => {
              dispatchPacket({
                speaker_id: agentId,
                action: 'walk_to',
                target: desk,
                stage: 'Returning to Workstation',
                dialogue: null,
              });

              setTimeout(() => {
                dispatchPacket({
                  speaker_id: agentId,
                  action: 'sit',
                  target: desk,
                  stage: 'Workstation Standby',
                  thought: null,
                  dialogue: null,
                });
              }, 1800);
            }, 3200);
          }, 2200);
        }, 1200);
      }, totalOffset);

      totalOffset += 8800;
    });

    // After all findings, Judge summarizes
    if (verdict) {
      setTimeout(() => {
        dispatchPacket({
          speaker_id: 'judge',
          action: 'inspect',
          target: 'judge_chair',
          stage: `Adjudicating Decision Memo: ${String(verdict.decision_state || 'proceed').toUpperCase()}`,
          verdict: verdict.decision_state || 'drop',
          dialogue: verdict.summary || verdict.headline || 'All findings reconciled.',
        });
        setIsReplaying(false);
      }, totalOffset + 500);
    } else {
      setTimeout(() => setIsReplaying(false), totalOffset);
    }
  }, [currentCase, dispatchPacket]);

  return {
    isLiveBackendActive: isStreaming || currentCase?.status === 'testing',
    currentCase,
    isReplaying,
    replayCaseInBullpen,
  };
}

export default useBackendLiveBridge;
