import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { IconClose, IconTerminal } from "@/components/icons/KeylineIcons";
import { Button } from "@/components/ui/button";

interface DebugDockProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DebugDock: React.FC<DebugDockProps> = ({ isOpen, onClose }) => {
  const { state, setPlaybackSpeed, toggleMockMode } = useCase();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCase = state.currentCase;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-72 flex-col border-t border-border bg-zinc-950/95 backdrop-blur-md shadow-2xl transition-all">
      {/* Dock Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-4 py-2 bg-card/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-300">
            <IconTerminal size={15} className="text-blue-400" />
            <span>ENGINE INSPECTOR & SSE FEED</span>
          </div>

          <div className="h-3 w-px bg-border" />

          {/* State Tracker */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-muted-foreground">State:</span>
            <span className="rounded-xs bg-zinc-800 px-1.5 py-0.5 text-blue-300 font-bold uppercase">
              {currentCase?.status || "IDLE"}
            </span>
          </div>

          {/* Active Mode */}
          <button
            type="button"
            onClick={toggleMockMode}
            className="font-mono text-[11px] underline text-zinc-400 hover:text-white"
          >
            Mode: {state.isMockMode ? "Mock Sim" : "Live SSE"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Controls */}
          {state.isMockMode && (
            <div className="flex items-center gap-1 font-mono text-[11px] bg-zinc-900 border border-border rounded px-1.5 py-0.5">
              <span className="text-zinc-500 mr-1">Speed:</span>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(1)}
                className={`px-1 rounded ${state.playbackSpeed === 1 ? "bg-blue-500/20 text-blue-400" : "text-zinc-400"}`}
              >
                1x
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(2)}
                className={`px-1 rounded ${state.playbackSpeed === 2 ? "bg-blue-500/20 text-blue-400" : "text-zinc-400"}`}
              >
                2x
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(0)}
                className={`px-1 rounded ${state.playbackSpeed === 0 ? "bg-blue-500/20 text-blue-400" : "text-zinc-400"}`}
              >
                Instant
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-zinc-400 hover:text-foreground"
          >
            <IconClose size={15} />
          </Button>
        </div>
      </div>

      {/* Dock Content: Two Columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Event Stream List */}
        <div className="w-1/2 border-r border-border overflow-y-auto p-2 space-y-1">
          {state.eventLog.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-muted-foreground">
              Awaiting events... Click "Test this" or run a decision to see real-time SSE frames.
            </div>
          ) : (
            state.eventLog.map((item) => {
              const isSelected = selectedEventId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedEventId(item.id)}
                  className={`w-full flex items-center justify-between rounded px-2.5 py-1.5 text-left font-mono text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-500/15 border border-blue-500/30 text-blue-300"
                      : "hover:bg-zinc-900 border border-transparent text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] text-zinc-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-semibold text-zinc-200">
                      event: {item.event}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 shrink-0">
                    {Object.keys(item.data).length} keys
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Event Payload or Current Case JSON */}
        <div className="w-1/2 overflow-y-auto p-3 font-mono text-xs text-zinc-300 bg-zinc-950">
          {selectedEventId ? (
            <div>
              <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground">
                <span>EVENT PAYLOAD</span>
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="underline hover:text-foreground"
                >
                  View Case State
                </button>
              </div>
              <pre className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(
                  state.eventLog.find((e) => e.id === selectedEventId)?.data,
                  null,
                  2
                )}
              </pre>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground">
                <span>CASE STATE MACHINE</span>
                <span className="text-zinc-500">
                  {currentCase ? currentCase.id : "None"}
                </span>
              </div>
              <pre className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(
                  currentCase || { status: "IDLE", message: "No active case" },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
