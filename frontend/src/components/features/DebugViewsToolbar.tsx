import React from "react";
import { useCase } from "@/context/CaseContext";
import { PreviewView } from "@/context/caseReducer";

interface ViewOption {
  id: NonNullable<PreviewView>;
  label: string;
  badge?: string;
}

export const DebugViewsToolbar: React.FC = () => {
  const { state, setPreviewView, exitPreview } = useCase();

  if (!state.previewView) return null;

  const views: ViewOption[] = [
    { id: "entry", label: "01 Ingestion" },
    { id: "extracting", label: "01b Extracting" },
    { id: "confirm", label: "02 Claim Map" },
    { id: "runner", label: "03 Live Runner" },
    { id: "dashboard", label: "04 Decision Memo" },
    { id: "evidence", label: "05 Evidence Drawer" },
    { id: "logs", label: "06 Telemetry Logs" },
    { id: "history", label: "07 Case History" },
    { id: "faq", label: "08 FAQ" },
    { id: "settings", label: "09 Settings" },
  ];

  return (
    <div
      role="region"
      aria-label="Debug Views Preview Switcher"
      className="sticky top-14 left-0 right-0 z-40 bg-surface-container-high/95 backdrop-blur-md border-b border-primary-container/40 px-space-4 py-2 shadow-md flex items-center justify-between gap-space-3"
    >
      <div className="flex items-center gap-space-3 overflow-x-auto py-0.5 scrollbar-none flex-1 min-w-0">
        {/* Isolated Environment Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant text-outline shrink-0 select-none">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse inline-block" />
          <span className="font-code-sm text-[11px] uppercase tracking-wider font-semibold text-tertiary">
            Preview Fixture
          </span>
          <span className="font-code-sm text-[11px] text-outline hidden md:inline">
            (0 backend calls)
          </span>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {views.map((v) => {
            const isActive = state.previewView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setPreviewView(v.id)}
                data-testid={`preview-btn-${v.id}`}
                className={`font-code-sm text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-primary-container text-on-primary-container font-semibold shadow-xs"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest border border-outline-variant/50"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Exit Button */}
      <button
        type="button"
        onClick={exitPreview}
        aria-label="Exit Debug Views Preview"
        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-error/15 hover:bg-error/25 border border-error/40 text-error font-code-sm text-xs transition-colors cursor-pointer"
        title="Exit preview and restore active app session"
      >
        <span className="material-symbols-outlined text-[15px]">close</span>
        <span className="hidden sm:inline font-medium">Exit Preview</span>
      </button>
    </div>
  );
};
