import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { DECISION_PRESETS } from "@/lib/presets";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Loader2 } from "lucide-react";

export const EntryScreen: React.FC = () => {
  const { state, startExtracting } = useCase();
  const [rawInput, setRawInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim() || state.isExtracting) return;
    startExtracting(rawInput.trim(), null);
  };

  if (state.isExtracting) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[640px] flex-col items-center justify-center px-6">
        <div className="w-full space-y-4 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-300">
            <Loader2 size={16} className="animate-spin text-zinc-400" />
            <span className="text-sm font-medium">Extracting core assumptions...</span>
          </div>

          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full bg-zinc-800" />
            <Skeleton className="h-4 w-5/6 bg-zinc-800" />
            <Skeleton className="h-4 w-3/4 bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[65vh] w-full max-w-[640px] flex-col justify-center px-6 pt-16 pb-12">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2.5">
          <label
            htmlFor="decision-input"
            className="block text-xl font-semibold tracking-tight text-zinc-100"
          >
            What are you considering?
          </label>
          <Textarea
            id="decision-input"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="e.g. We should offer an unlimited free tier for our AI coding assistant to acquire developers at zero CAC, monetizing only on enterprise teams."
            className="min-h-[140px] leading-relaxed text-sm bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 rounded-lg p-4"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          {/* Subtle preset helpers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">Example:</span>
            {DECISION_PRESETS.slice(0, 2).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setRawInput(preset.rawInput)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-2"
              >
                {preset.title}
              </button>
            ))}
          </div>

          <Button
            type="submit"
            disabled={!rawInput.trim() || state.isExtracting}
            className="h-10 px-6 font-medium bg-white text-zinc-950 hover:bg-zinc-200 rounded-md shadow-sm gap-2"
          >
            <span>Test Decision</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      </form>
    </div>
  );
};
