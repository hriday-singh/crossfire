import React, { useState } from "react";
import { IconAlertTriangle, IconClose } from "@/components/icons/KeylineIcons";
import { useCase } from "@/context/CaseContext";

interface ErrorBannerProps {
  error: { stage: string; message: string; details?: unknown } | null;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { toggleMockMode, state } = useCase();

  if (!error) return null;

  return (
    <div className="w-full border-b border-red-500/30 bg-red-500/10 px-5 py-3 transition-all">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-red-400 shrink-0">
            <IconAlertTriangle size={18} />
          </span>
          <div className="text-xs text-red-200 truncate">
            <span className="font-mono uppercase font-semibold text-red-400 mr-2">
              [{error.stage}]
            </span>
            {error.message}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!state.isMockMode && (
            <button
              type="button"
              onClick={toggleMockMode}
              className="text-xs font-mono underline text-red-300 hover:text-white"
            >
              Switch to Mock Sim
            </button>
          )}

          {Boolean(error.details) && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-mono text-zinc-400 hover:text-foreground underline"
            >
              {showDetails ? "Hide details" : "Details"}
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="text-zinc-400 hover:text-foreground"
            title="Dismiss error"
          >
            <IconClose size={16} />
          </button>
        </div>
      </div>

      {Boolean(showDetails && error.details) && (
        <div className="mx-auto mt-2 max-w-5xl rounded-md bg-zinc-950 p-3 font-mono text-xs text-red-300 overflow-x-auto border border-red-500/20">
          <pre>{JSON.stringify(error.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
