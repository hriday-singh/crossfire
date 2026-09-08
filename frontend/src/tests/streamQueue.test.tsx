import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CaseProvider, useCase } from '../context/CaseContext';
import { useBackendLiveBridge, eventClaimId } from '../hooks/useBackendLiveBridge';
import { Case } from '../types/crossfire';

const testingCase: Case = {
  id: 'case-queue-1',
  raw_input: 'Automate tier 1 support with an LLM',
  context: null,
  status: 'testing',
  claims: [
    { id: 'c1', statement: 'Handles 100% of tier 1', load_bearing: true, status: 'testing' as any },
    { id: 'c2', statement: 'Ships in one sprint', load_bearing: true, status: 'testing' as any },
  ],
  test_plan: [],
  findings: [],
  consequences: [],
  case_verdict: null,
} as any;

let sendEvent: (event: string, data: Record<string, unknown>) => void = () => {};

const StreamHarness: React.FC = () => {
  const { dispatch } = useCase();
  useEffect(() => {
    dispatch({ type: 'LOAD_CASE', payload: testingCase });
    dispatch({ type: 'SET_STREAMING', payload: true });
    sendEvent = (event, data) => dispatch({ type: 'SSE_EVENT', payload: { event, data } });
  }, [dispatch]);
  return null;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CaseProvider>
    <StreamHarness />
    {children}
  </CaseProvider>
);

const packetsFor = (spy: ReturnType<typeof vi.fn>, predicate: (p: any) => boolean) =>
  spy.mock.calls.map((c) => c[0]).filter(predicate);

describe('bullpen stage queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reads the claim off whichever field the frame used', () => {
    expect(eventClaimId({ data: { claim_id: 'c1' } })).toBe('c1');
    expect(eventClaimId({ data: { target_claim_id: 'c2' } })).toBe('c2');
    expect(eventClaimId({ data: { finding: { claim_id: 'c3' } } })).toBe('c3');
    expect(eventClaimId({ data: {} })).toBeNull();
  });

  it('holds a second claim off the stage until the first claim closes', () => {
    const onDispatchPacket = vi.fn();
    renderHook(() => useBackendLiveBridge({ onDispatchPacket, playbackSpeed: 1 }), { wrapper });

    // Backend runs claim groups concurrently, so claim 2 frames arrive interleaved.
    act(() => {
      sendEvent('claim_started', {
        claim_id: 'c1',
        claim_index: 0,
        total_claims: 2,
        claim_statement: 'Handles 100% of tier 1',
        agents: ['builder'],
      });
      sendEvent('claim_started', {
        claim_id: 'c2',
        claim_index: 1,
        total_claims: 2,
        claim_statement: 'Ships in one sprint',
        agents: ['operator'],
      });
      sendEvent('test_started', {
        test_id: 't2',
        target_claim_id: 'c2',
        evaluator: 'Operator',
        claim_statement: 'Ships in one sprint',
      });
      sendEvent('test_started', {
        test_id: 't1',
        target_claim_id: 'c1',
        evaluator: 'Builder',
        claim_statement: 'Handles 100% of tier 1',
      });
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Claim 1 is on stage: its agent typed, claim 2's did not.
    expect(packetsFor(onDispatchPacket, (p) => p.speaker_id === 'builder' && p.action === 'type')).toHaveLength(1);
    expect(packetsFor(onDispatchPacket, (p) => p.speaker_id === 'operator')).toHaveLength(0);

    act(() => {
      sendEvent('claim_complete', { claim_id: 'c1', finding_count: 1 });
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Claim 1 closed, so claim 2 takes the stage.
    expect(packetsFor(onDispatchPacket, (p) => p.speaker_id === 'operator' && p.action === 'type')).toHaveLength(1);
  });

  it('lets a cross-examination finding play after its claim already closed', () => {
    const onDispatchPacket = vi.fn();
    renderHook(() => useBackendLiveBridge({ onDispatchPacket, playbackSpeed: 1 }), { wrapper });

    act(() => {
      sendEvent('claim_started', { claim_id: 'c1', claim_index: 0, total_claims: 1, agents: ['builder'] });
      sendEvent('claim_complete', { claim_id: 'c1', finding_count: 0 });
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      sendEvent('finding_ready', {
        target_claim_id: 'c1',
        finding: { evaluator: 'Researcher', result: 'Probe contradicts the blocker.', confidence: 0.8 },
      });
      vi.advanceTimersByTime(1000);
    });

    expect(
      packetsFor(onDispatchPacket, (p) => p.speaker_id === 'researcher' && p.action === 'walk_to')
    ).not.toHaveLength(0);
  });

  it('still animates the exit when done closes the stream in the same commit', () => {
    const onDispatchPacket = vi.fn();
    renderHook(() => useBackendLiveBridge({ onDispatchPacket, playbackSpeed: 1 }), { wrapper });

    // `done` sets status=done and isStreaming=false in one reducer pass.
    act(() => {
      sendEvent('done', { case_id: 'case-queue-1' });
      vi.advanceTimersByTime(2000);
    });

    const exit = packetsFor(
      onDispatchPacket,
      (p) => p.speaker_id === 'steelman' && p.target === 'right_door'
    );
    expect(exit).toHaveLength(1);
    expect(exit[0]).toMatchObject({ isSynthesisDone: true, isLoadingDone: true, progress: 100 });
  });

  it('opens the gate rather than stranding the run when a claim never closes', () => {
    const onDispatchPacket = vi.fn();
    renderHook(() => useBackendLiveBridge({ onDispatchPacket, playbackSpeed: 1 }), { wrapper });

    act(() => {
      sendEvent('claim_started', { claim_id: 'c1', claim_index: 0, total_claims: 2, agents: ['builder'] });
      // c1 never gets its claim_complete; c2's frames would queue forever.
      sendEvent('test_started', {
        test_id: 't2',
        target_claim_id: 'c2',
        evaluator: 'Operator',
        claim_statement: 'Ships in one sprint',
      });
      vi.advanceTimersByTime(1000);
    });

    expect(packetsFor(onDispatchPacket, (p) => p.speaker_id === 'operator')).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(packetsFor(onDispatchPacket, (p) => p.speaker_id === 'operator' && p.action === 'type')).toHaveLength(1);
  });
});
