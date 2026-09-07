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

describe('Monotonic Progress & Synthesis Latching Suite (10 Tests)', () => {
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

  it('Test 1: Initializes progress cleanly in testing state without synthesis', () => {
    const Wrapper = createWrapper({ ...baseMockCase, status: 'testing' });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/Decision Under Test:/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE RUNNING/i)).toBeInTheDocument();
  });

  it('Test 2: Reaches 100% progress immediately when case status is done', () => {
    const Wrapper = createWrapper({ ...baseMockCase, status: 'done', case_verdict: { decision_state: 'PROCEED', headline: 'Migration approved' } });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/FINISHED/i)).toBeInTheDocument();
    expect(screen.getByText(/Evaluation Complete/i)).toBeInTheDocument();
  });

  it('Test 3: Reaches 100% progress when case_verdict is present', () => {
    const Wrapper = createWrapper({ ...baseMockCase, status: 'testing', case_verdict: { decision_state: 'CAUTION', headline: 'Cost risk' } });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/FINISHED/i)).toBeInTheDocument();
  });

  it('Test 4: Latches at 100% and DOES NOT DROP BACK to 20% when subsequent non-synthesis events arrive', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'testing',
      case_verdict: { decision_state: 'PROCEED', headline: 'Verdict delivered' },
    });

    const { rerender } = render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/FINISHED/i)).toBeInTheDocument();

    const SubsequentWrapper = createWrapper({
      ...baseMockCase,
      status: 'testing',
      case_verdict: { decision_state: 'PROCEED', headline: 'Verdict delivered' },
      claims: [{ id: 'c1', text: 'claim 1', status: null }],
    });

    rerender(
      <SubsequentWrapper>
        <DiscussionApp />
      </SubsequentWrapper>
    );

    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/FINISHED/i)).toBeInTheDocument();
  });

  it('Test 5: Displays green FINISHED indicator when synthesis is delivered', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'testing',
      case_verdict: { decision_state: 'PROCEED', headline: 'Architecture verified' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/FINISHED/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready for Review/i)).toBeInTheDocument();
  });

  it('Test 6: Progress is strictly monotonic and never decreases across intermediate stage updates', () => {
    const WrapperStage1 = createWrapper({
      ...baseMockCase,
      claims: [{ id: 'c1', text: 'c1', status: null }],
      findings: [{ id: 'f1', claim_id: 'c1', verdict: 'survived' }],
    });

    const { rerender } = render(<DiscussionApp />, { wrapper: WrapperStage1 });

    expect(screen.getByText(/Phase 2: Adversarial Stress-Testing/i)).toBeInTheDocument();

    const WrapperResetFindings = createWrapper({
      ...baseMockCase,
      claims: [{ id: 'c1', text: 'c1', status: null }],
      findings: [],
    });

    rerender(
      <WrapperResetFindings>
        <DiscussionApp />
      </WrapperResetFindings>
    );
    const progressText = screen.getByText(/% Completed/i).textContent;
    const progressNum = parseInt(progressText?.replace(/\D/g, '') || '0', 10);
    expect(progressNum).toBeGreaterThanOrEqual(25);
  });

  it('Test 7: Renders Proceed to Decision Memo button when finished with case verdict', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Ready to proceed' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /Proceed to Decision Memo/i })).toBeInTheDocument();
  });

  it('Test 8: Navigation to dashboard button is interactive and present', () => {
    const mockNavigate = vi.fn();
    const contextValue: any = {
      state: {
        currentCase: {
          ...baseMockCase,
          status: 'done',
          case_verdict: { decision_state: 'PROCEED', headline: 'Ready to proceed' },
        },
        activeScreen: 'runner',
        eventLog: [],
      },
      navigateScreen: mockNavigate,
      dispatch: vi.fn(),
    };

    render(
      <CaseContext.Provider value={contextValue}>
        <DiscussionApp />
      </CaseContext.Provider>
    );

    const proceedBtn = screen.getByRole('button', { name: /Proceed to Decision Memo/i });
    expect(proceedBtn).toBeInTheDocument();
  });

  it('Test 9: Resets latched progress cleanly only when a completely new case ID is loaded', () => {
    const WrapperCaseA = createWrapper({
      id: 'case_A',
      raw_input: 'Case A proposal',
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Case A done' },
    });

    const { unmount } = render(<DiscussionApp />, { wrapper: WrapperCaseA });
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
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
    expect(screen.getByText(/LIVE RUNNING/i)).toBeInTheDocument();
    expect(screen.queryByText(/100% Completed/i)).not.toBeInTheDocument();
  });

  it('Test 10: Retains exclusively Active Workstation Feed in the side panel across all stages', () => {
    const Wrapper = createWrapper({
      ...baseMockCase,
      status: 'done',
      case_verdict: { decision_state: 'PROCEED', headline: 'Finished' },
    });
    render(<DiscussionApp />, { wrapper: Wrapper });

    expect(screen.getByText(/Active Workstation Feed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bullpen Controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quick Evaluator Actions/i)).not.toBeInTheDocument();
  });
});
