import React, { useState, useEffect, useRef } from "react";
import { useCase } from "@/context/CaseContext";
import { DECISION_PRESETS, DecisionPreset } from "@/lib/presets";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  ChevronRight,
  Compass,
  FileCheck2,
  Loader2,
  Scale,
  Sparkles,
} from "lucide-react";

export const EntryScreen: React.FC = () => {
  const { state, startExtracting } = useCase();
  const [rawInput, setRawInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(130, textareaRef.current.scrollHeight)}px`;
    }
  }, [rawInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawInput.trim() || state.isExtracting) return;
    startExtracting(rawInput.trim(), null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectPreset = (preset: DecisionPreset) => {
    setRawInput(preset.rawInput);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  if (state.isExtracting) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
        <div className="w-full space-y-6 rounded-xl border border-zinc-200 bg-white p-8 sm:p-10 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 border border-zinc-200">
              <Loader2 size={18} className="animate-spin text-zinc-900" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-950">
                Extracting core assumptions...
              </h3>
              <p className="text-xs text-zinc-500">
                Deconstructing your proposal into testable, load-bearing premises.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full bg-zinc-100" />
            <Skeleton className="h-4 w-5/6 bg-zinc-100" />
            <Skeleton className="h-4 w-4/6 bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  const strategicPresets = DECISION_PRESETS.slice(0, 3);
  const additionalPresets = DECISION_PRESETS.slice(3);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 pt-12 pb-20">
      {/* Editorial Header */}
      <div className="mb-10 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-mono text-zinc-600 mb-4">
          <Sparkles size={12} className="text-zinc-800" />
          <span>Autonomous Strategic Risk Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 leading-tight">
          Stress-test strategic bets before reality does.
        </h1>
        <p className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed max-w-2xl">
          Extract foundational assumptions, challenge them against real-world
          evidence and counterarguments, and receive an executive decision memo.
        </p>
      </div>

      {/* The Decision Briefing Canvas */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="decision-input"
                className="text-sm font-semibold tracking-tight text-zinc-900"
              >
                What strategic decision are you considering?
              </label>
              <span className="hidden sm:inline font-mono text-xs text-zinc-400">
                Press Cmd+Enter to test
              </span>
            </div>

            <Textarea
              ref={textareaRef}
              id="decision-input"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. We should offer an unlimited free tier for our AI coding assistant to acquire developers at zero CAC, monetizing only on enterprise teams."
              className="min-h-[130px] leading-relaxed text-sm bg-zinc-50/50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-1 focus-visible:ring-zinc-950 focus-visible:bg-white rounded-lg p-4 transition-colors"
              autoFocus
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-zinc-400 uppercase">
                Presets:
              </span>
              {additionalPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="rounded px-2 py-1 text-xs text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors underline decoration-zinc-300 underline-offset-2"
                >
                  {preset.title}
                </button>
              ))}
            </div>

            <Button
              type="submit"
              disabled={!rawInput.trim() || state.isExtracting}
              className="h-10 px-6 font-medium bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg shadow-sm gap-2 shrink-0 self-end sm:self-auto"
            >
              <span>Test Decision</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </form>

        {/* Curated Strategic Presets Cards */}
        <div className="mt-8 border-t border-zinc-100 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Curated Strategic Scenarios
            </span>
            <span className="text-xs text-zinc-400">
              Click to populate briefing
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {strategicPresets.map((preset) => (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className="group cursor-pointer rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-medium text-zinc-500 uppercase">
                    {preset.category}
                  </span>
                  <ChevronRight
                    size={13}
                    className="text-zinc-400 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5"
                  />
                </div>
                <h4 className="mt-1.5 text-xs font-semibold text-zinc-900">
                  {preset.title}
                </h4>
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                  "{preset.rawInput}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Methodology Strip */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-800">
            <Compass size={16} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-950 uppercase font-mono">
              1. Assumption Mapping
            </h4>
            <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
              Extract load-bearing economic, behavioral, and architectural premises.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-800">
            <Scale size={16} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-950 uppercase font-mono">
              2. Adversarial Audit
            </h4>
            <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
              Query empirical evidence, case studies, and counterarguments.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-800">
            <FileCheck2 size={16} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-950 uppercase font-mono">
              3. Decision Memo
            </h4>
            <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
              Synthesize results into an actionable executive memorandum.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
