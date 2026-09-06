import React from "react";

interface EntryPresetsBarProps {
  onSelectPreset: (presetText: string) => void;
  onOpenFaq: () => void;
}

export const EntryPresetsBar: React.FC<EntryPresetsBarProps> = ({
  onSelectPreset,
  onOpenFaq,
}) => {
  return (
    <>
      {/* Recent Runs Quick-Jump Bar */}
      <div className="mt-space-6 flex items-start gap-space-2 text-outline font-code-sm text-code-sm">
        <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">
          lightbulb
        </span>
        <div className="flex flex-wrap items-center gap-x-space-3 gap-y-1 font-body-sm text-body-sm">
          <span className="text-outline">Example proposals:</span>
          <button
            type="button"
            onClick={() =>
              onSelectPreset(
                "I want to build an AI that helps students apply to college, including submitting applications on their behalf."
              )
            }
            className="text-on-surface-variant hover:text-primary-container transition-colors underline decoration-outline-variant underline-offset-4 cursor-pointer"
          >
            <span>College application submission AI</span>
            <span className="sr-only">College Admissions AI Agent</span>
          </button>
          <span className="text-outline-variant">·</span>
          <button
            type="button"
            onClick={() =>
              onSelectPreset(
                "We should offer an unlimited free tier for our AI coding assistant to acquire developers at zero CAC, monetizing only on enterprise teams."
              )
            }
            className="text-on-surface-variant hover:text-primary-container transition-colors underline decoration-outline-variant underline-offset-4 cursor-pointer"
          >
            Unlimited free-tier SaaS unit economics
          </button>
          <span className="text-outline-variant">·</span>
          <button
            type="button"
            onClick={() =>
              onSelectPreset(
                "A niche vertical AI agent that crawls local dental clinic websites, auto-generates localized patient education blogs, and posts them via WordPress."
              )
            }
            className="text-on-surface-variant hover:text-primary-container transition-colors underline decoration-outline-variant underline-offset-4 cursor-pointer"
          >
            SEO automation for local practices
          </button>
        </div>
      </div>

      {/* FAQ Discovery Quick-Link */}
      <div className="mt-space-4 flex items-center justify-end">
        <button
          type="button"
          onClick={onOpenFaq}
          className="flex items-center gap-1.5 text-outline hover:text-on-surface font-code-sm text-code-sm transition-colors cursor-pointer group"
        >
          <span className="material-symbols-outlined text-[15px] text-outline group-hover:text-primary-container">
            help_outline
          </span>
          <span>How does Crossfire work? View FAQ</span>
        </button>
      </div>
    </>
  );
};
