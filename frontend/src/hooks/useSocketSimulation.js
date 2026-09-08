import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Pre-scripted Crossfire Adversarial Evaluation Scenarios
 * Evaluators work independently at their own cubicle without cross-talk:
 * - Devil's Advocate: Assumption Testing & Premises
 * - Researcher: Live Citations & Empirical Data
 * - Builder: Feasibility & Latency Benchmarks
 * - Operator: Operational Friction & Procurement
 * - Steelman: Crucible Verdict Synthesis
 */
const B2B_COPILOT_SCENARIO = {
  name: 'Enterprise Decision Stress-Test: Autonomous B2B Copilot',
  description: 'Adversarial evaluators independently audit assumptions, retrieve empirical citations, simulate compute bottlenecks, and step up to the Steelman to present findings.',
  events: [
    // 1. Devil's Advocate audits at desk, walks to Steelman to report
    {
      speaker_id: 'devils_advocate',
      action: 'type',
      target: 'cubicle_2_desk',
      gesture: 'idle',
      stage: 'Auditing Assumptions',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Assumptions',
      verdict: 'broken',
      dialogue: 'Reporting critical vulnerability: Load-bearing claim 3 relies on unstated zero-churn incentive structures.',
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'walk_to',
      target: 'cubicle_2_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'sit',
      target: 'cubicle_2_desk',
      gesture: 'idle',
      stage: 'Auditing Assumptions',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 2. Researcher audits citations, walks to Steelman to report
    {
      speaker_id: 'researcher',
      action: 'type',
      target: 'cubicle_3_desk',
      gesture: 'idle',
      stage: 'Verifying Citations',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Evidence',
      verdict: 'broken',
      dialogue: 'Submitting citation proof: Empirical pilot renewal drops 34% when human review is bypassed.',
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'walk_to',
      target: 'cubicle_3_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'sit',
      target: 'cubicle_3_desk',
      gesture: 'idle',
      stage: 'Verifying Citations',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 3. Builder benchmarks latency, walks to Steelman to report
    {
      speaker_id: 'builder',
      action: 'type',
      target: 'cubicle_1_desk',
      gesture: 'idle',
      stage: 'Testing Feasibility',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Feasibility',
      verdict: 'survived',
      dialogue: 'Submitting feasibility confirmation: GPU barrier synchronization overhead verified at 3.8ms within SLA.',
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'walk_to',
      target: 'cubicle_1_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'sit',
      target: 'cubicle_1_desk',
      gesture: 'idle',
      stage: 'Testing Feasibility',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 4. Operator checks compliance, walks to Steelman to report
    {
      speaker_id: 'operator',
      action: 'type',
      target: 'cubicle_4_desk',
      gesture: 'idle',
      stage: 'Assessing Governance',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Governance',
      verdict: 'weakened',
      dialogue: 'Reporting deployment friction: Procurement red tape and missing SOC2 audit trail will delay rollout 6-8 weeks.',
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'walk_to',
      target: 'cubicle_4_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'sit',
      target: 'cubicle_4_desk',
      gesture: 'idle',
      stage: 'Assessing Governance',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 5. Crucible Arbiter (Steelman) delivers synthesis ruling and exits via right door
    {
      speaker_id: 'steelman',
      action: 'stand',
      target: 'steelman_chair',
      gesture: 'idle',
      stage: 'Crucible Synthesis',
      verdict: 'weakened',
      dialogue: 'Crucible Magistrate Verdict: Decision is WEAKENED. 1 claim survived, 2 weakened, 1 broken.',
      audio_url: null,
      isSynthesisDone: true,
    },
    {
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      gesture: 'idle',
      stage: 'Exiting Bullpen to Decision Memo',
      verdict: null,
      dialogue: null,
      audio_url: null,
      isSynthesisDone: true,
      isLoadingDone: true,
      progress: 100,
    },
  ],
};

const INFERENCE_PIPELINE_SCENARIO = {
  name: 'Real-Time Inference Pipeline Feasibility Audit',
  description: 'Independent evaluators stress-test edge caching, compute quotas, memory limits, and step up to the Steelman to report.',
  events: [
    // 1. Builder approaches Steelman
    {
      speaker_id: 'builder',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Feasibility',
      verdict: 'survived',
      dialogue: 'Continuous batching verification: recovered 18% idle GPU capacity with zero packet drops.',
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'walk_to',
      target: 'cubicle_1_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'builder',
      action: 'sit',
      target: 'cubicle_1_desk',
      gesture: 'idle',
      stage: 'Testing Feasibility',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 2. Devil's Advocate approaches Steelman
    {
      speaker_id: 'devils_advocate',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Assumptions',
      verdict: 'weakened',
      dialogue: 'Unstated assumption: Pipeline expects persistent warm GPU cache across unpredictable burst traffic.',
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'walk_to',
      target: 'cubicle_2_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'devils_advocate',
      action: 'sit',
      target: 'cubicle_2_desk',
      gesture: 'idle',
      stage: 'Auditing Assumptions',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 3. Researcher approaches Steelman
    {
      speaker_id: 'researcher',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Evidence',
      verdict: 'survived',
      dialogue: 'Verifying cloud provider pricing researcher: spot instance fallback reduces burst cost by 42%.',
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'walk_to',
      target: 'cubicle_3_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'researcher',
      action: 'sit',
      target: 'cubicle_3_desk',
      gesture: 'idle',
      stage: 'Verifying Citations',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 4. Operator approaches Steelman
    {
      speaker_id: 'operator',
      action: 'walk_to',
      target: 'podium_approach',
      gesture: 'idle',
      stage: 'Approaching Magistrate',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'inspect',
      target: 'podium_approach',
      gesture: 'point',
      stage: 'Reporting Governance',
      verdict: 'survived',
      dialogue: 'Enterprise SLA audit: 99.9% uptime requirement satisfied with dual-region failover.',
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'walk_to',
      target: 'cubicle_4_desk',
      gesture: 'idle',
      stage: 'Returning to Workstation',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },
    {
      speaker_id: 'operator',
      action: 'sit',
      target: 'cubicle_4_desk',
      gesture: 'idle',
      stage: 'Assessing Governance',
      verdict: null,
      dialogue: null,
      audio_url: null,
    },

    // 5. Steelman Ruling and exit via right door
    {
      speaker_id: 'steelman',
      action: 'stand',
      target: 'steelman_chair',
      gesture: 'idle',
      stage: 'Crucible Synthesis',
      verdict: 'survived',
      dialogue: 'Crucible Magistrate Verdict: Pipeline Feasibility SURVIVED. 3 claims survived, 1 weakened.',
      audio_url: null,
      isSynthesisDone: true,
    },
    {
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      gesture: 'idle',
      stage: 'Exiting Bullpen to Decision Memo',
      verdict: null,
      dialogue: null,
      audio_url: null,
      isSynthesisDone: true,
      isLoadingDone: true,
      progress: 100,
    },
  ],
};

export const MOCK_SCENARIOS = {
  b2b_copilot_stress_test: B2B_COPILOT_SCENARIO,
  inference_pipeline_audit: INFERENCE_PIPELINE_SCENARIO,
  // Backward compatibility aliases
  safety_review: B2B_COPILOT_SCENARIO,
  cluster_migration: INFERENCE_PIPELINE_SCENARIO,
};

/**
 * useSocketSimulation Hook
 * Supports dual mode: live WebSocket connection via socket.io-client
 * and rich mock playback simulation with step, auto-play, custom packets, and scenario switching.
 */
export function useSocketSimulation({
  onEventReceived,
  initialSocketUrl = 'http://localhost:4000',
  selectedAgentIds = null,
  mockEnabled = true,
} = {}) {
  const [socketUrl, setSocketUrl] = useState(initialSocketUrl);
  const [connectionStatus, setConnectionStatus] = useState('mock_mode'); // 'mock_mode' | 'connecting' | 'connected' | 'error'
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [currentScenarioKey, setCurrentScenarioKey] = useState('safety_review');
  const [eventIndex, setEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.5); // 0.5x, 1x, 1.5x, 2x (defaults to 1.5x)
  const [eventHistory, setEventHistory] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const onEventReceivedRef = useRef(onEventReceived);

  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  // Dispatch an event to listeners and history
  const dispatchEvent = useCallback((eventPacket) => {
    const enriched = {
      ...eventPacket,
      timestamp: Date.now(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setLastEvent(enriched);
    setEventHistory((prev) => [enriched, ...prev.slice(0, 49)]); // Keep last 50 events
    onEventReceivedRef.current?.(enriched);
  }, []);

  // Filter scenario events by selected agents
  const getFilteredEvents = useCallback(() => {
    const scenario = MOCK_SCENARIOS[currentScenarioKey];
    if (!scenario || !scenario.events) return [];
    if (!selectedAgentIds || selectedAgentIds.length === 0) return scenario.events;
    return scenario.events.filter((packet) => {
      if (packet.speaker_id === 'steelman') return true;
      return selectedAgentIds.includes(packet.speaker_id);
    });
  }, [currentScenarioKey, selectedAgentIds]);

  // Connect to live WebSocket server if requested
  const connectSocket = useCallback((url) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnectionStatus('connecting');
    try {
      const socket = io(url, {
        reconnectionAttempts: 3,
        timeout: 4000,
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        setConnectionStatus('connected');
        console.log('[Socket] Connected to', url);
      });

      socket.on('disconnect', () => {
        setConnectionStatus('disconnected');
        console.log('[Socket] Disconnected from', url);
      });

      socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
        setConnectionStatus('error');
      });

      // Listen for incoming AI events matching schema
      const handleIncoming = (data) => {
        if (data && data.speaker_id) {
          dispatchEvent(data);
        }
      };

      socket.on('ai_event', handleIncoming);
      socket.on('action', handleIncoming);
      socket.on('message', handleIncoming);

      socketRef.current = socket;
    } catch (e) {
      setConnectionStatus('error');
    }
  }, [dispatchEvent]);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus('mock_mode');
  }, []);

  // Step forward in current scenario
  const stepForward = useCallback(() => {
    const events = getFilteredEvents();
    if (!events || events.length === 0) return;

    setEventIndex((prevIndex) => {
      const nextIndex = (prevIndex + 1) % events.length;
      const packet = events[prevIndex % events.length];
      dispatchEvent(packet);
      return nextIndex;
    });
  }, [getFilteredEvents, dispatchEvent]);

  // Restart scenario
  const resetScenario = useCallback(() => {
    setEventIndex(0);
    // Return all bots back to their home workstations
    const homeBots = [
      { speaker_id: 'builder', target: 'cubicle_1_desk' },
      { speaker_id: 'devils_advocate', target: 'cubicle_2_desk' },
      { speaker_id: 'researcher', target: 'cubicle_3_desk' },
      { speaker_id: 'operator', target: 'cubicle_4_desk' },
      { speaker_id: 'steelman', target: 'steelman_chair' },
    ];
    homeBots.forEach((b) => {
      if (b.speaker_id === 'steelman' || !selectedAgentIds || selectedAgentIds.includes(b.speaker_id)) {
        dispatchEvent({
          speaker_id: b.speaker_id,
          action: 'sit',
          target: b.target,
          gesture: 'idle',
        });
      }
    });

    const events = getFilteredEvents();
    if (events && events.length > 0) {
      dispatchEvent(events[0]);
      setEventIndex(1);
    }
  }, [getFilteredEvents, dispatchEvent, selectedAgentIds]);

  // Handle auto-play loop for mock simulation.
  // Disabled whenever a real case drives the stage: the scripted scenario ends with a
  // steelman right_door exit packet, which would otherwise fire mid-run and terminate
  // the live run before the backend's run_complete/done.
  useEffect(() => {
    if (!mockEnabled || connectionStatus !== 'mock_mode' || !isAutoPlaying) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const events = getFilteredEvents();
    if (!events || events.length === 0) return;

    // Delay varies based on action type (walk takes longer than quick gesture)
    const currentPacket = events[eventIndex % events.length];
    let baseDelay = 900;
    if (currentPacket.action === 'walk_to') {
      baseDelay = 1100;
    } else if (currentPacket.action === 'sit') {
      baseDelay = 700;
    } else if (currentPacket.dialogue && currentPacket.dialogue.length > 60) {
      baseDelay = 1300;
    }

    const interval = Math.max(300, baseDelay / playbackSpeed);

    timerRef.current = setTimeout(() => {
      stepForward();
    }, interval);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mockEnabled, connectionStatus, isAutoPlaying, eventIndex, playbackSpeed, stepForward, getFilteredEvents]);

  // Trigger initial event on mount if in mock mode
  useEffect(() => {
    if (mockEnabled && connectionStatus === 'mock_mode' && eventHistory.length === 0) {
      const events = getFilteredEvents();
      const initialPacket = events[0] || MOCK_SCENARIOS.safety_review.events[0];
      if (initialPacket) {
        dispatchEvent(initialPacket);
        setEventIndex(1);
      }
    }
  }, [mockEnabled, connectionStatus, eventHistory.length, dispatchEvent, getFilteredEvents]);

  // Trigger a custom or manual event directly
  const triggerManualEvent = useCallback((customPacket) => {
    dispatchEvent(customPacket);
  }, [dispatchEvent]);

  return {
    socketUrl,
    setSocketUrl,
    connectionStatus,
    connectSocket,
    disconnectSocket,
    isAutoPlaying,
    setIsAutoPlaying,
    currentScenarioKey,
    setCurrentScenarioKey,
    scenarios: MOCK_SCENARIOS,
    stepForward,
    resetScenario,
    playbackSpeed,
    setPlaybackSpeed,
    lastEvent,
    eventHistory,
    triggerManualEvent,
  };
}

export default useSocketSimulation;
