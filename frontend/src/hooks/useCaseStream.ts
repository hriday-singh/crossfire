import { useEffect, useRef } from "react";
import { useCase } from "@/context/CaseContext";
import { getStreamUrl } from "@/lib/api";
import { MOCK_STREAM_STEPS } from "@/lib/mockData";
import { SSEEventName } from "@/types/crossfire";

export function useCaseStream() {
  const { state, dispatch } = useCase();
  const eventSourceRef = useRef<EventSource | null>(null);
  const simulationTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // Only connect or simulate when actively in runner or testing status
    if (!state.isStreaming || !state.currentCase) {
      // Clean up any ongoing connections
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      simulationTimeoutsRef.current.forEach(clearTimeout);
      simulationTimeoutsRef.current = [];
      return;
    }

    if (state.isMockMode) {
      // Clear any prior timeouts
      simulationTimeoutsRef.current.forEach(clearTimeout);
      simulationTimeoutsRef.current = [];

      let accumulatedTime = 100;
      const speed = state.playbackSpeed <= 0 ? 0 : state.playbackSpeed;

      MOCK_STREAM_STEPS.forEach((step) => {
        const stepDelay = speed === 0 ? 0 : Math.round(step.delayMs / speed);
        accumulatedTime += stepDelay;

        const timeout = setTimeout(() => {
          dispatch({
            type: "SSE_EVENT",
            payload: {
              event: step.event,
              data: step.data,
            },
          });
        }, accumulatedTime);

        simulationTimeoutsRef.current.push(timeout);
      });

      return () => {
        simulationTimeoutsRef.current.forEach(clearTimeout);
        simulationTimeoutsRef.current = [];
      };
    }

    // Real backend SSE connection
    const streamUrl = getStreamUrl(state.currentCase.id);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    const eventTypes: SSEEventName[] = [
      "claim_map_ready",
      "awaiting_confirmation",
      "test_started",
      "finding_ready",
      "verdict_ready",
      "consequence_ready",
      "run_complete",
      "error",
    ];

    eventTypes.forEach((eventName) => {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          const parsed = e.data ? JSON.parse(e.data) : {};
          dispatch({
            type: "SSE_EVENT",
            payload: {
              event: eventName,
              data: parsed,
            },
          });

          if (eventName === "run_complete" || eventName === "error") {
            es.close();
            eventSourceRef.current = null;
            dispatch({ type: "SET_STREAMING", payload: false });
          }
        } catch (err) {
          console.error("Failed to parse SSE event data:", err);
        }
      });
    });

    es.onerror = (err) => {
      console.warn("SSE connection encountered error:", err);
      // Don't immediately crash; EventSource retries automatically.
    };

    return () => {
      if (es.readyState !== EventSource.CLOSED) {
        es.close();
      }
      eventSourceRef.current = null;
    };
  }, [state.isStreaming, state.isMockMode, state.currentCase?.id, state.playbackSpeed, dispatch]);

  return {
    isStreaming: state.isStreaming,
    streamLogs: state.eventLog,
  };
}
