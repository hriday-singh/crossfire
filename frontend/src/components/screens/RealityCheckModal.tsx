import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconAlertTriangle, IconCircleX } from "@/components/icons/KeylineIcons";

interface RealityCheckModalProps {
  open: boolean;
  onClose: () => void;
}

export const RealityCheckModal: React.FC<RealityCheckModalProps> = ({
  open,
  onClose,
}) => {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl p-6">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase text-center">
            WHY CROSSFIRE: THE REALITY CHECK
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Traditional AI Flattery */}
          <div className="flex flex-col justify-between rounded-lg border border-red-500/20 bg-zinc-950 p-5 space-y-4">
            <div className="space-y-3">
              <div className="font-mono text-xs font-semibold text-red-400 uppercase">
                Traditional AI Chat (Sycophantic Agreement)
              </div>

              <div className="rounded-md bg-zinc-900/80 p-3 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-400 block mb-1">PROMPT:</span>
                "I want to build an AI that submits college applications for students."
              </div>

              <div className="rounded-md bg-zinc-900/50 p-3.5 text-xs text-zinc-300 leading-relaxed space-y-2 border border-border/30">
                <span className="font-semibold text-blue-400 block">AI ASSISTANT:</span>
                <p>
                  "That is an incredible and disruptive startup idea! High school seniors and parents are overwhelmed by college applications, and automating this could save hundreds of hours."
                </p>
                <p>
                  "You could easily expand into high school counseling, scholarship matching, and test prep. This could be a multi-million dollar business!"
                </p>
              </div>
            </div>

            <div className="rounded border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 font-mono">
              VERDICT: False confidence. Zero competitor awareness, zero verification of student behavioral friction.
            </div>
          </div>

          {/* Right: Crossfire Crash Test */}
          <div className="flex flex-col justify-between rounded-lg border border-blue-400/30 bg-zinc-950 p-5 space-y-4">
            <div className="space-y-3">
              <div className="font-mono text-xs font-semibold text-blue-400 uppercase">
                Crossfire Crash Test (Evidence & Verification)
              </div>

              {/* Broken assumption */}
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    "No existing competitor already solving this well"
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-red-400 font-bold">
                    <IconCircleX size={14} /> Broken
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  CollegeAI raised $12M seed; live since March 2026 with 40,000 users.
                </p>
              </div>

              {/* Weakened assumption */}
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    "Students will trust an AI to submit without review"
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-400 font-bold">
                    <IconAlertTriangle size={14} /> Weakened
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Pew Research: 42% refusal rate for autonomous academic submissions.
                </p>
              </div>

              {/* Actionable Strategy Update */}
              <div className="rounded-md border border-border bg-zinc-900 p-3 text-xs space-y-1">
                <span className="font-mono text-[10px] text-zinc-500 uppercase font-bold">
                  Recommended Strategy Shift
                </span>
                <p className="text-zinc-200">
                  Pivot from "autonomous submitter" to "transparent audit trail with 1-click student approval".
                </p>
              </div>
            </div>

            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 font-mono">
              VERDICT: Saved 6 months of engineering building the wrong product.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
