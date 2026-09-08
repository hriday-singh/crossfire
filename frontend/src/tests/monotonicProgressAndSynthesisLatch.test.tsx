import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscussionApp } from '../components/DiscussionApp';
import { CaseContext } from '../context/CaseContext';

vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn().mockResolvedValue({ source: { scaleMode: '' } }) },
  Texture: vi.fn().mockImplementation(() => ({})),
  Rectangle: vi.fn(),
  AnimatedSprite: class {},
  Container: class {},
  Graphics: class {},
  Sprite: class {},
  Text: class {},
}));

vi.mock('../components/canvas/StageContainer', () => ({
  default: () => <div data-testid="mock-stage-container">Mock Stage</div>,
}));

vi.mock('@pixi/react', () => ({
  extend: vi.fn(),
  Application: ({ children }: any) => <div data-testid="pixi-app">{children}</div>,
}));

vi.mock('gsap', () => {
  const timelineMock = {
    to: vi.fn().mockReturnThis(),
    kill: vi.fn(),
  };
  return {
    default: {
      to: vi.fn(() => ({ kill: vi.fn() })),
      timeline: vi.fn(() => timelineMock),
      globalTimeline: {
        timeScale: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      },
    },
  };
});

vi.mock('../hooks/useAudioPlayback', () => ({
  default: () => ({
    isMuted: false,
    setIsMuted: vi.fn(),
    speechSynthesisEnabled: true,
    setSpeechSynthesisEnabled: vi.fn(),
    volume: 0.8,
    setVolume: vi.fn(),
    playSpeech: vi.fn(),
    stopSpeech: vi.fn(),
    playSfx: vi.fn(),
  }),
}));

describe('Bullpen Header & Synthesis Latching Suite', () => {
  const baseMockCase: any = {
    id: 'case_test_latch_1',
    raw_input: 'Should we migrate to edge computing?',
    status: 'testing',
    selected_agents: ['builder', 'devils_advocate', 'researcher', 'operator'],
    claims: [
      { id: 'c1', text: 'Latency reduction under 4ms', status: 'verified' },
      { id: 'c2', text: 'Cost savings of 40%', status: null },
    ],
    findings: [
      { id: 'f1', claim_id: 'c1', evaluator_id: 'builder', verdict: 'survived' },
    ],
  };

  const createWrapper = (currentCase: any, eventLog: any[] = []) => {
    const contextValue: any = {
      state: {
        currentCase,
        activeScreen: 'runner',
        eventLog,
        history: [],
        debugViewsEnabled: false,
        error: null,
      },
      dispatch: vi.fn(),
      navigateScreen: vi.fn(),
      submitCase: vi.fn(),
      resetCurrentCase: vi.fn(),
      loadCaseById: vi.fn(),
    };

    return ({ children }: { children: React.ReactNode }) => (
      <CaseContext.Provider value={contextValue}>{children}</CaseContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1: Shows the proposal under test without a progress bar or phase tracker', () => {
    const Wrapper = createWrapper({ ...baseMockCase, status: 'testing' });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/Testing Proposal/i)).toBeInTheDocument();
    expect(screen.getByText(/Should we migrate to edge computing\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phase \d/i)).not.toBeInTheDocument();
  });

  it('Test 2: Does not render redundant Live / Complete / Standby status chrome', () => {
    const Wrapper = createWrapper({ ...baseMockCase, status: 'testing' });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.queryByText(/^Live$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Standby$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Complete$/i)).not.toBeInTheDocument();
  });

  it('Test 3: Surfaces the verdict banner once the case status is done', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Migration approved' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/Migration approved/i)).toBeInTheDocument();
    expect(screen.getByText(/PROCEED/)).toBeInTheDocument();
  });

  it('Test 4: Surfaces the verdict banner once a case_verdict arrives mid-run (synthesis latch)', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'testing',
      case_verdict: { decision_state: 'CAUTION', headline: 'Cost risk' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/Cost risk/i)).toBeInTheDocument();
  });

  it('Test 5: Renders Proceed to Decision Memo button when finished with case verdict', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Ready to proceed' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /Proceed to Decision Memo/i })).toBeInTheDocument();
  });

  it('Test 6: Hides the verdict banner while the case is still testing with no verdict', () => {
    const Wrapper = createWrapper({ ...baseMockCase, status: 'testing', case_verdict: null });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.queryByRole('button', { name: /Proceed to Decision Memo/i })).not.toBeInTheDocument();
  });

  it('Test 7: Swaps cleanly to a fresh case without leaking the previous verdict', () => {
    const WrapperCaseA = createWrapper({
      id: 'case_A',
      raw_input: 'Case A proposal',
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Case A done' },
    });

    const { unmount } = render(<DiscussionApp />, { wrapper: WrapperCaseA });
    expect(screen.getByText(/Case A done/i)).toBeInTheDocument();
    unmount();

    const WrapperCaseB = createWrapper({
      id: 'case_B_fresh',
      raw_input: 'Case B fresh proposal',
      status: 'testing',
      claims: [{ id: 'c1', text: 'new claim', status: null }],
      findings: [],
    });

    render(<DiscussionApp />, { wrapper: WrapperCaseB });
    expect(screen.getByText(/Case B fresh proposal/i)).toBeInTheDocument();
    expect(screen.queryByText(/Case A done/i)).not.toBeInTheDocument();
  });

  it('Test 8: Retains exclusively Active Workstation Feed in the side panel across all stages', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Finished' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/Active Workstation Feed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bullpen Controls/i)).not.toBeInTheDocument();
  });
});
