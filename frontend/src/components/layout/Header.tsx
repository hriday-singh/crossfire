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

  const getStatusBadge = () => {
    if (state.isExtracting) {
      return {
        label: "Extracting",
        classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
        dot: "bg-indigo-600 animate-pulse",
      };
    }
    if (state.isStreaming || state.currentCase?.status === "testing") {
      return {
        label: "Testing",
        classes: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-600 animate-pulse",
      };
    }
    if (state.activeScreen === "confirm") {
      return {
        label: "Aligning",
        classes: "bg-zinc-100 text-zinc-700 border-zinc-200",
        dot: "bg-zinc-500",
      };
    }
    if (state.activeScreen === "dashboard" || state.currentCase?.status === "done") {
      return {
        label: "Completed",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-600",
      };
    }
    return {
      label: "Ready",
      classes: "bg-zinc-100 text-zinc-600 border-zinc-200",
      dot: "bg-zinc-400",
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-zinc-200 bg-white/90 px-6 backdrop-blur-md">
      {/* Brand & Editorial Masthead */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={resetCase}
          className="group flex items-baseline gap-2 text-left focus:outline-none"
        >
          <span className="text-base font-semibold tracking-tight text-zinc-950 group-hover:text-zinc-700 transition-colors">
            Crossfire
          </span>
          <span className="font-mono text-xs text-zinc-500">
            / {getStatusText()}
          </span>
        </button>

        <span
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-mono font-medium ${statusBadge.classes}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
          {statusBadge.label}
        </span>
      </div>

      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        {state.activeScreen !== "entry" && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetCase}
            className="h-8 gap-1.5 text-xs text-zinc-700 hover:text-zinc-950 border-zinc-200 bg-white shadow-xs hover:bg-zinc-50"
          >
            <Plus size={13} />
            <span>New Decision</span>
          </Button>
        )}
      </div>
    </header>
  );
};
