import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CaseProvider, useCase } from '../context/CaseContext';
import {
  useBackendLiveBridge,
  normalizeEvaluatorId,
  getCognitiveTag,
  AGENT_HOME_DESKS,
} from '../hooks/useBackendLiveBridge';
import { Case } from '../types/crossfire';

const LoadCase: React.FC<{ caseData: Case }> = ({ caseData }) => {
  const { dispatch } = useCase();
  useEffect(() => {
    dispatch({ type: "LOAD_CASE", payload: caseData });
  }, [caseData, dispatch]);
  return null;
};

describe('useBackendLiveBridge Hook & Evaluator Mapping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('normalizes evaluator tags and names to correct sprite IDs, desks, and cognitive tags', () => {
    expect(normalizeEvaluatorId("Devil's Advocate")).toBe('devils_advocate');
    expect(normalizeEvaluatorId('devils_advocate')).toBe('devils_advocate');
    expect(normalizeEvaluatorId('Researcher')).toBe('researcher');
    expect(normalizeEvaluatorId('Researcher')).toBe('researcher');
    expect(normalizeEvaluatorId('Builder')).toBe('builder');
    expect(normalizeEvaluatorId('Operator')).toBe('operator');
    expect(normalizeEvaluatorId('Steelman')).toBe('steelman');
    expect(normalizeEvaluatorId('Crucible Arbiter')).toBe('steelman');

    expect(AGENT_HOME_DESKS['devils_advocate']).toBe('cubicle_2_desk');
    expect(AGENT_HOME_DESKS['researcher']).toBe('cubicle_3_desk');
    expect(AGENT_HOME_DESKS['builder']).toBe('cubicle_1_desk');
    expect(AGENT_HOME_DESKS['operator']).toBe('cubicle_4_desk');
    expect(AGENT_HOME_DESKS['steelman']).toBe('steelman_chair');

    expect(getCognitiveTag('devils_advocate')).toBe('[Assumption Pre-Mortem]');
    expect(getCognitiveTag('researcher')).toBe('[Citation Audit]');
    expect(getCognitiveTag('builder')).toBe('[Feasibility Test]');
    expect(getCognitiveTag('operator')).toBe('[Friction Test]');
    expect(getCognitiveTag('steelman')).toBe('[Steelman]');
  });

  it('translates test_started event to active typing and cognitive thought at workstation desk', () => {
    const onDispatchPacket = vi.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CaseProvider>
        {children}
      </CaseProvider>
    );

    renderHook(() => useBackendLiveBridge({ onDispatchPacket }), { wrapper });

    // Manually trigger a test_started event packet
    act(() => {
      onDispatchPacket({
        speaker_id: 'devils_advocate',
        action: 'type',
        target: 'cubicle_2_desk',
        cognitive_tag: '[Assumption Pre-Mortem]',
        stage: '[Assumption Pre-Mortem] Testing implicit premises in "Handles 100% of tier 1"',
        thought: 'Testing: "Handles 100% of tier 1"',
        claim_statement: 'Handles 100% of tier 1',
      });
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'devils_advocate',
        action: 'type',
        target: 'cubicle_2_desk',
        cognitive_tag: '[Assumption Pre-Mortem]',
        thought: 'Testing: "Handles 100% of tier 1"',
      })
    );
  });

  it('translates activity, load_bearing_ready, and verdict_ready events', () => {
    const onDispatchPacket = vi.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CaseProvider>
        {children}
      </CaseProvider>
    );

    renderHook(() => useBackendLiveBridge({ onDispatchPacket }), { wrapper });

    // Activity event
    act(() => {
      onDispatchPacket({
        speaker_id: 'researcher',
        action: 'type',
        target: 'cubicle_3_desk',
        cognitive_tag: '[Citation Audit]',
        stage: 'Querying SerpApi: "LLM tier 1 support benchmarks"',
        thought: 'Querying SerpApi: "LLM tier 1 support benchmarks"',
      });
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'researcher',
        action: 'type',
        thought: 'Querying SerpApi: "LLM tier 1 support benchmarks"',
      })
    );

    // Load-bearing ready event for Steelman
    act(() => {
      onDispatchPacket({
        speaker_id: 'steelman',
        action: 'inspect',
        target: 'steelman_chair',
        stage: 'Assessing Load-Bearing: Critical Core Assumption',
        thought: 'Core assumption required for viable deployment',
      });
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'steelman',
        action: 'inspect',
        target: 'steelman_chair',
        stage: 'Assessing Load-Bearing: Critical Core Assumption',
      })
    );
  });

  it('replays a completed case findings through active desk thinking, table presentation, and Steelman synthesis', () => {
    const onDispatchPacket = vi.fn();

    const mockCase: Case = {
      id: 'case-done-1',
      raw_input: 'Automate tier 1 support with LLM',
      context: null,
      status: 'done',
      claims: [{ id: 'c1', statement: 'Handles 100% of tier 1', load_bearing: true, status: 'broken' as const }],
      test_plan: [],
      findings: [
        {
          claim_id: 'c1',
          test_id: 't1',
          evaluator: 'Researcher',
          result: 'Containment tops out at 65% in production.',
          verdict: 'broken',
          confidence: 0.85,
          contradiction: 'Containment tops out at 65% in production.',
          reasoning: 'Industry benchmarks from 12 production deployments report mean deflection of 58%.',
          evidence: [
            {
              source_url: 'https://example.com/study',
              title: 'Support Study',
              snippet: 'Deflection benchmarks from deployments',
              retrieved_at: new Date().toISOString(),
            },
          ],
          created_at: new Date().toISOString(),
        } as any,
      ],
      consequences: [],
      case_verdict: {
        decision_state: 'drop',
        headline: "Don't proceed as written.",
        summary: 'Real tier-1 containment tops out at 45-65%.',
        survived: [],
        broken: ['c1'],
        unproven: [],
        next_actions: [],
      },
    };

    const CustomWrapper = ({ children }: { children: React.ReactNode }) => (
      <CaseProvider>
        <LoadCase caseData={mockCase} />
        {children}
      </CaseProvider>
    );

    const { result } = renderHook(() => useBackendLiveBridge({ onDispatchPacket }), {
      wrapper: CustomWrapper,
    });

    // Trigger replay
    act(() => {
      result.current.replayCaseInBullpen();
    });

    // Advance time to allow Step 1 (active thinking at desk)
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'researcher',
        action: 'type',
        target: 'cubicle_3_desk',
        cognitive_tag: '[Citation Audit]',
      })
    );

    // Advance time to allow walk to table (1200ms)
    act(() => {
      vi.advanceTimersByTime(1250);
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'researcher',
        action: 'walk_to',
        target: 'steelman_approach',
      })
    );

    // Advance time to allow reporting step (2200ms)
    act(() => {
      vi.advanceTimersByTime(2300);
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'researcher',
        action: 'inspect',
        gesture: 'point',
        verdict: 'broken',
        confidence: 85,
        dialogue: 'Containment tops out at 65% in production.',
        reasoning: 'Industry benchmarks from 12 production deployments report mean deflection of 58%.',
      })
    );

    // Advance time to allow return and final Steelman adjudication
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'steelman',
        action: 'inspect',
        verdict: 'drop',
        dialogue: 'Real tier-1 containment tops out at 45-65%.',
      })
    );

    // Advance time to verify Steelman leaves judge room upon synthesis completion
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'steelman',
        action: 'walk_to',
        target: 'right_door',
      })
    );
  });

  it('pauses dispatching and clears in-flight timers when isPaused is true', () => {
    const onDispatchPacket = vi.fn();

    const { rerender } = renderHook(
      ({ isPaused }) => useBackendLiveBridge({ onDispatchPacket, isPaused }),
      {
        initialProps: { isPaused: false },
        wrapper: ({ children }) => <CaseProvider>{children}</CaseProvider>,
      }
    );

    // Switch to paused
    rerender({ isPaused: true });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should not dispatch additional actions while paused
    expect(onDispatchPacket).not.toHaveBeenCalled();
  });

  it('filters out events for evaluators that are not in selectedAgentIds so they stay stationary', () => {
    const onDispatchPacket = vi.fn();
    const caseData: Case = {
      id: 'case_unselected_test',
      raw_input: 'Self-driving delivery bots',
      context: null,
      claims: [{ id: 'claim_1', statement: 'Autonomous navigation in snow', load_bearing: true, status: null }],
      test_plan: [],
      findings: [
        {
          claim_id: 'claim_1',
          test_id: 'test_1',
          evaluator: 'builder',
          result: 'LiDAR sensors freeze in blizzards.',
          evidence: [],
          reasoning: 'Hardware limitation',
          confidence: 0.9,
          contradiction: null,
        },
        {
          claim_id: 'claim_1',
          test_id: 'test_2',
          evaluator: 'operator',
          result: 'City municipal bans on snow sidewalk bots.',
          evidence: [],
          reasoning: 'Governance friction',
          confidence: 0.85,
          contradiction: null,
        },
      ],
      consequences: [],
      case_verdict: {
        decision_state: 'drop',
        summary: 'Cannot operate in winter snow without heated LiDAR and city permits.',
        survived: [],
        broken: ['claim_1'],
        unproven: [],
        next_actions: [],
      },
      status: 'done',
      selected_agents: ['builder'], // Only builder selected; operator is NOT selected
    };

    const { result } = renderHook(
      () => useBackendLiveBridge({ onDispatchPacket, selectedAgentIds: ['builder'] }),
      {
        wrapper: ({ children }) => (
          <CaseProvider>
            <LoadCase caseData={caseData} />
            {children}
          </CaseProvider>
        ),
      }
    );

    // Replay findings in bullpen
    act(() => {
      result.current.replayCaseInBullpen();
    });

    // Advance time for builder actions
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Builder was dispatched
    expect(onDispatchPacket).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'builder',
      })
    );

    // Operator was NOT selected, so operator was NOT dispatched
    expect(onDispatchPacket).not.toHaveBeenCalledWith(
      expect.objectContaining({
        speaker_id: 'operator',
      })
    );
  });
});
