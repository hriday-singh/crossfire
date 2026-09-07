import { useEffect, useRef } from "react";
import { useCase } from "@/context/CaseContext";
import { getStreamUrl } from "@/lib/api";
import { SSEEventName } from "@/types/crossfire";

export function useCaseStream() {
  const { state, dispatch, refreshCurrentCase } = useCase();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Never connect to live backend SSE stream when in preview mode
    if (state.previewView !== null) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Only connect when actively streaming and a case exists
    if (!state.isStreaming || !state.currentCase) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const streamUrl = getStreamUrl(state.currentCase.id);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    const eventTypes: SSEEventName[] = [
      "claim_map_ready",
      "awaiting_confirmation",
      "load_bearing_ready",
      "test_started",
      "finding_ready",
      "verdict_ready",
      "consequence_ready",
      "case_verdict",
      "run_complete",
      "error",
      "activity",
      "done",
    ];

    eventTypes.forEach((eventName) => {
      es.addEventListener(eventName, (e: MessageEvent) => {
        try {
          // 'done' payload is just a raw string "[DONE]" typically, or empty. We handle it safely.
          const isDoneToken = e.data === "[DONE]";
          const parsed = e.data && !isDoneToken ? JSON.parse(e.data) : (isDoneToken ? "[DONE]" : {});
          
          dispatch({
            type: "SSE_EVENT",
            payload: {
              event: eventName,
              data: parsed,
            },
          });

          if (eventName === "done" || eventName === "run_complete") {
            if (eventName === "done" || isDoneToken) {
                es.close();
                eventSourceRef.current = null;
                dispatch({ type: "SET_STREAMING", payload: false });
                // Pull final snapshot to ensure all properties (like load_bearing) are in sync
                refreshCurrentCase();
            }
          } else if (eventName === "error") {
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
    };

    return () => {
      if (es.readyState !== EventSource.CLOSED) {
        es.close();
      }
      eventSourceRef.current = null;
    };
  }, [state.isStreaming, state.currentCase?.id, state.previewView, dispatch, refreshCurrentCase]);

  return {
    isStreaming: state.isStreaming,
    streamLogs: state.eventLog,
  };
}
