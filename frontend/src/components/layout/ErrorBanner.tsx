import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ErrorBannerProps {
  error: { stage: string; message: string; details?: unknown } | null;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!error) return null;

  return (
    <div className="w-full border-b border-rose-800/60 bg-rose-950/40 px-6 py-3 transition-all text-rose-300">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-rose-400 shrink-0">
            <AlertTriangle size={16} />
          </span>
          <div className="text-xs text-rose-200 truncate">
            <span className="font-mono uppercase font-semibold text-rose-400 mr-2">
              [{error.stage}]
            </span>
            {error.message}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {Boolean(error.details) && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground underline"
            >
              {showDetails ? "Hide details" : "Details"}
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
            title="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {Boolean(showDetails && error.details) && (
        <div className="mx-auto mt-2 max-w-5xl rounded-md bg-zinc-950 p-3 font-mono text-xs text-rose-300 overflow-x-auto border border-rose-500/20">
          <pre>{JSON.stringify(error.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
