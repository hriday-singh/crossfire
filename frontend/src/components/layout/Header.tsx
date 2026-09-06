import React from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Loader2, Sparkles } from "lucide-react";

export const Header: React.FC = () => {
  const { state, resetCase } = useCase();

  const getStatusBadge = () => {
    if (state.isStreaming) {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-1 text-xs font-mono text-indigo-400">
          <Loader2 size={12} className="animate-spin" />
          <span>Testing Pipeline</span>
        </div>
      );
    }
    if (state.activeScreen === "dashboard") {
      return (
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs font-mono text-emerald-400">
          <CheckCircle2 size={12} />
          <span>Decision Memo Ready</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-zinc-900/60 px-2.5 py-1 text-xs font-mono text-zinc-400">
        <Sparkles size={12} className="text-zinc-500" />
        <span>Ready</span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      {/* Brand & Connection State */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={resetCase}
          className="group flex items-center gap-2 text-left focus:outline-none"
        >
          <span className="text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
            Crossfire
          </span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-400">
            Decision Tester
          </span>
        </button>

        <div className="h-4 w-px bg-border" />

        {getStatusBadge()}
      </div>

      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        {state.activeScreen !== "entry" && (
          <Button
            size="sm"
            onClick={resetCase}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus size={14} />
            <span>New Decision</span>
          </Button>
        )}
      </div>
    </header>
  );
};
