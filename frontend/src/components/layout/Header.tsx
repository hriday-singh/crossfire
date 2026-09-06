import React from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Header: React.FC = () => {
  const { state, resetCase } = useCase();

  const getStatusText = () => {
    if (state.isStreaming || state.currentCase?.status === "testing") {
      return "testing claims";
    }
    if (state.activeScreen === "dashboard" || state.currentCase?.status === "done") {
      return "decision memo";
    }
    if (state.activeScreen === "confirm") {
      return "align assumptions";
    }
    return "decision testing";
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border/60 bg-zinc-950/80 px-6 backdrop-blur-md">
      {/* Brand & Subtle Status Text */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={resetCase}
          className="group flex items-baseline gap-2 text-left focus:outline-none"
        >
          <span className="text-base font-semibold tracking-tight text-zinc-100 group-hover:text-white transition-colors">
            Crossfire
          </span>
          <span className="font-mono text-xs text-zinc-500">
            / {getStatusText()}
          </span>
        </button>
      </div>

      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        {state.activeScreen !== "entry" && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetCase}
            className="h-8 gap-1.5 text-xs text-zinc-300 hover:text-white border-zinc-800 bg-zinc-900/60"
          >
            <Plus size={13} />
            <span>New Decision</span>
          </Button>
        )}
      </div>
    </header>
  );
};
