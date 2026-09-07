import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { copyToClipboard } from "@/lib/exportMemo";
import { SSEEventLogItem } from "@/types/crossfire";
import { SerpApiText } from "@/components/ui/serpapi";

export const LiveLogsDrawer: React.FC = () => {
  const { state, setActiveModal } = useCase();
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const isOpen = state.activeModal === "logs";
  const events = state.eventLog;

  const filteredEvents = events.filter((log: SSEEventLogItem) => {
    if (filterEvent === "all") return true;
    return log.event === filterEvent;
  });

  const handleCopyLogs = async () => {
    await copyToClipboard(JSON.stringify(events, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEventBadgeColor = (eventName: string) => {
    switch (eventName) {
      case "verdict_ready":
        return "text-verdict-broken bg-verdict-broken/10 border-verdict-broken/30";
      case "consequence_ready":
        return "text-tertiary bg-tertiary/10 border-tertiary/30";
      case "finding_ready":
        return "text-secondary bg-secondary/10 border-secondary/30";
      case "run_complete":
        return "text-verdict-survived bg-verdict-survived/10 border-verdict-survived/30";
      case "error":
        return "text-error bg-error/10 border-error/30";
      default:
        return "text-primary-container bg-primary-container/10 border-primary-container/30";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[560px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-space-2">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              terminal
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-normal">
              Live Pipeline Stream &amp; Telemetry
            </h2>
            <span className="font-code-sm text-code-sm text-outline px-space-1.5 py-0.5 rounded border border-outline-variant">
              {events.length} frames
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal("none")}
            aria-label="Close telemetry drawer"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-space-6 py-space-3 bg-surface-container border-b border-outline-variant/60 flex items-center justify-between gap-space-3 flex-wrap">
          <div className="flex items-center gap-space-2">
            <span className="font-code-sm text-code-sm text-outline">Filter:</span>
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="bg-surface-container-lowest text-on-surface font-code-sm text-code-sm px-space-2 py-1 rounded border border-outline-variant outline-none"
            >
              <option value="all">All events ({events.length})</option>
              <option value="claim_map_ready">claim_map_ready</option>
              <option value="test_started">test_started</option>
              <option value="finding_ready">finding_ready</option>
              <option value="verdict_ready">verdict_ready</option>
              <option value="consequence_ready">consequence_ready</option>
              <option value="run_complete">run_complete</option>
              <option value="error">error</option>
            </select>
          </div>

          <div className="flex items-center gap-space-2">
            <button
              type="button"
              onClick={handleCopyLogs}
              disabled={events.length === 0}
              className="font-code-sm text-code-sm px-space-3 py-1 rounded bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </button>
          </div>
        </div>

        {/* Log Entries Stream */}
        <div className="flex-1 overflow-y-auto p-space-6 space-y-space-3 font-mono text-xs">
          {filteredEvents.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-space-6 text-outline">
              <span className="material-symbols-outlined text-[32px] mb-space-2 text-outline">
                sync_alt
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant font-medium">
                {state.isStreaming ? "Listening for live SSE events..." : "No telemetry recorded for this run yet."}
              </p>
              <p className="font-code-sm text-code-sm text-outline mt-1">
                Events stream in real time during the adversarial testing phase.
              </p>
            </div>
          ) : (
            filteredEvents.map((item) => (
              <div
                key={item.id}
                className="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-space-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-code-sm text-code-sm px-1.5 py-0.5 rounded border font-semibold uppercase ${getEventBadgeColor(
                        item.event
                      )}`}
                    >
                      {item.event}
                    </span>
                  </div>
                  <span className="text-[11px] text-outline">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <pre className="text-[11px] text-on-surface-variant bg-surface-container-low p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                  <SerpApiText text={JSON.stringify(item.data, null, 2)} />
                </pre>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
