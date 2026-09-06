import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { DECISION_PRESETS } from "@/lib/mockData";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconFastForward } from "@/components/icons/KeylineIcons";

export const EntryScreen: React.FC = () => {
  const { state, startExtracting } = useCase();
  const [rawInput, setRawInput] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim() || state.isExtracting) return;
    startExtracting(rawInput, context);
  };

  if (state.isExtracting) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[640px] flex-col items-center justify-center px-6">
        <div className="w-full space-y-4 rounded-lg border border-border bg-card p-8 shadow-md text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
            <h3 className="font-mono text-sm font-semibold tracking-wider text-blue-400 uppercase">
              Extracting Core Assumptions...
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Deconstructing decision into discrete falsifiable claims
          </p>

          <div className="space-y-3 pt-4 text-left">
            <Skeleton className="h-12 w-full bg-zinc-800/80" />
            <Skeleton className="h-12 w-full bg-zinc-800/60" />
            <Skeleton className="h-12 w-3/4 bg-zinc-800/40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-[640px] flex-col justify-center px-6 py-12">
      {/* Quick-fill presets pill bar */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>SAMPLE DECISION PRESETS</span>
          <span className="text-[11px] text-zinc-500">1-click test</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DECISION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setRawInput(preset.rawInput);
                setContext(preset.contextHint || "");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-blue-400/50 hover:bg-zinc-900 hover:text-foreground"
            >
              <IconFastForward size={13} className="text-blue-400" />
              <span>{preset.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Decision Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg"
      >
        <div className="space-y-2">
          <label
            htmlFor="decision-input"
            className="block text-base font-semibold text-foreground"
          >
            What are you considering?
          </label>
          <Textarea
            id="decision-input"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="e.g. I want to build an AI that helps students apply to college, including submitting applications on their behalf."
            className="min-h-[130px] leading-relaxed text-sm bg-zinc-950 border-zinc-800 focus-visible:border-blue-400 focus-visible:ring-blue-400"
          />
        </div>

        {/* Optional Context Dropzone / Toggle */}
        {!showContext ? (
          <button
            type="button"
            onClick={() => setShowContext(true)}
            className="text-xs font-mono text-muted-foreground hover:text-foreground underline transition-colors"
          >
            + Attach context, PDF link, or background parameters (optional)
          </button>
        ) : (
          <div className="space-y-1.5 rounded-md border border-dashed border-border p-3.5 bg-zinc-950/40">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>SUPPORTING CONTEXT / URL</span>
              <button
                type="button"
                onClick={() => setShowContext(false)}
                className="text-[11px] underline text-zinc-500 hover:text-zinc-300"
              >
                Hide
              </button>
            </div>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Paste pitch deck URL, target constraints, or customer persona context..."
              className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-xs text-foreground placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2">
          <span className="font-mono text-xs text-zinc-500">
            {rawInput.length > 0 ? `${rawInput.length} chars` : "Press Enter or click Test"}
          </span>

          <Button
            type="submit"
            disabled={!rawInput.trim() || state.isExtracting}
            className="h-10 px-6 font-semibold shadow-md"
          >
            Test this
          </Button>
        </div>
      </form>
    </div>
  );
};
