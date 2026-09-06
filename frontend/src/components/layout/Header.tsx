import React from "react";
import { useCase } from "@/context/CaseContext";
import { LiveDot } from "@/components/features/LiveDot";
import { Button } from "@/components/ui/button";
import {
  IconHistory,
  IconPlus,
  IconSettings,
  IconTerminal,
} from "@/components/icons/KeylineIcons";

interface HeaderProps {
  onToggleDebugDock: () => void;
  isDebugDockOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleDebugDock,
  isDebugDockOpen,
}) => {
  const { state, resetCase, setActiveModal, toggleMockMode } = useCase();

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-card/90 px-5 backdrop-blur-md">
      {/* Left side brand + live indicator */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={resetCase}
          className="flex items-center gap-2 text-left focus:outline-none"
        >
          <span className="font-mono text-sm font-bold tracking-widest text-zinc-100 uppercase hover:text-blue-400 transition-colors">
            Crossfire
          </span>
          <span className="rounded-xs bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            CI/CD RIG
          </span>
        </button>

        <div className="h-4 w-px bg-border" />

        <LiveDot
          isLive={state.isStreaming}
          label={
            state.isStreaming
              ? "STREAMING"
              : state.activeScreen === "dashboard"
              ? "COMPLETED"
              : "IDLE"
          }
        />
      </div>

      {/* Right side tools and controls */}
      <div className="flex items-center gap-2">
        {/* Mock Mode indicator pill */}
        <button
          type="button"
          onClick={toggleMockMode}
          title="Click to toggle Mock Simulation vs Live Backend"
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
            state.isMockMode
              ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${state.isMockMode ? "bg-purple-400" : "bg-emerald-400"}`} />
          <span>{state.isMockMode ? "MOCK SIM" : "LIVE BACKEND"}</span>
        </button>

        {/* Reality Check Demo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveModal("reality_check")}
          className="hidden md:inline-flex font-mono text-xs text-zinc-400 hover:text-foreground h-8 px-2.5"
        >
          Reality Check
        </Button>

        {/* History drawer trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveModal("history")}
          title="Past Crash Tests"
          className="h-8 w-8 text-zinc-400 hover:text-foreground"
        >
          <IconHistory size={17} />
        </Button>

        {/* Settings modal trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveModal("settings")}
          title="Engine & Provider Settings"
          className="h-8 w-8 text-zinc-400 hover:text-foreground"
        >
          <IconSettings size={17} />
        </Button>

        {/* Debug Dock Toggle */}
        <Button
          variant={isDebugDockOpen ? "secondary" : "ghost"}
          size="icon"
          onClick={onToggleDebugDock}
          title="Toggle Engine Inspector / Raw SSE Dock"
          className="h-8 w-8 text-zinc-400 hover:text-foreground"
        >
          <IconTerminal size={17} />
        </Button>

        {/* New test button */}
        {state.activeScreen !== "entry" && (
          <Button
            size="sm"
            onClick={resetCase}
            className="ml-1 h-8 gap-1 text-xs"
          >
            <IconPlus size={14} />
            <span className="hidden sm:inline">New Decision</span>
          </Button>
        )}
      </div>
    </header>
  );
};
