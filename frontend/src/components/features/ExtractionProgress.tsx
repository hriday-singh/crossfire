import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ExtractionProgressProps {
  hasAttachedContext?: boolean;
  agentMode?: "auto" | "custom";
  selectedAgentsCount?: number;
  className?: string;
}

interface StepItem {
  id: number;
  title: string;
  description: string;
  minElapsedMs: number;
}

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  hasAttachedContext = false,
  agentMode = "auto",
  selectedAgentsCount = 4,
  className = "",
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const steps: StepItem[] = [
    {
      id: 1,
      title: hasAttachedContext
        ? "Parsing proposal & curated attachment"
        : "Parsing proposal statement",
      description: "Extracting core arguments and background context",
      minElapsedMs: 0,
    },
    {
      id: 2,
      title: "Isolating falsifiable, load-bearing assumptions",
      description: "Identifying foundational premises that would break the strategy if false",
      minElapsedMs: 1400,
    },
    {
      id: 3,
      title:
        agentMode === "custom"
          ? `Configuring ${selectedAgentsCount} selected adversarial evaluators`
          : "Composing adversarial stress-test panel",
      description: "Formulating empirical, feasibility, and risk test plans",
      minElapsedMs: 3200,
    },
  ];

  const getStepState = (stepIndex: number): "completed" | "active" | "queued" => {
    const nextStep = steps[stepIndex + 1];
    if (nextStep && elapsedMs >= nextStep.minElapsedMs) {
      return "completed";
    }
    if (elapsedMs >= steps[stepIndex].minElapsedMs) {
      return "active";
    }
    return "queued";
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col w-full items-center justify-center py-20 px-space-4",
        className
      )}
    >
      <div className="flex flex-col space-y-6 bg-surface-container-low border border-outline-variant/80 rounded-xl p-space-8 max-w-[500px] w-full text-left shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-4">
          <span className="material-symbols-outlined text-[24px] text-primary-container animate-spin shrink-0">
            progress_activity
          </span>
          <div>
            <h3 className="font-headline-sm text-sm font-semibold text-on-surface">
              Deconstructing Proposal...
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Crossfire is isolating critical assertions for adversarial verification
            </p>
          </div>
        </div>

        {/* Stepped Progress List */}
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const stepState = getStepState(idx);

            return (
              <div key={step.id} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {stepState === "completed" ? (
                    <span className="material-symbols-outlined text-[18px] text-verdict-survived">
                      check_circle
                    </span>
                  ) : stepState === "active" ? (
                    <span className="material-symbols-outlined text-[18px] text-primary-container animate-spin">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px] text-outline opacity-40">
                      radio_button_unchecked
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div
                    className={cn(
                      "font-body-md text-xs font-semibold tracking-tight transition-colors",
                      stepState === "completed"
                        ? "text-on-surface"
                        : stepState === "active"
                        ? "text-primary-container font-semibold"
                        : "text-outline"
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-container-highest rounded-full h-1 overflow-hidden">
          <div
            className="bg-primary-container h-full transition-all duration-300 rounded-full"
            style={{
              width:
                elapsedMs < 1400
                  ? "30%"
                  : elapsedMs < 3200
                  ? "65%"
                  : "90%",
            }}
          />
        </div>
      </div>
    </div>
  );
};
