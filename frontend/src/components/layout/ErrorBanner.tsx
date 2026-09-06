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
    <div className="w-full border-b border-rose-200 bg-rose-50 px-6 py-3 transition-all text-rose-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-rose-600 shrink-0">
            <AlertTriangle size={16} />
          </span>
          <div className="text-xs text-rose-900 truncate">
            <span className="font-mono uppercase font-semibold text-rose-700 mr-2">
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
              className="text-xs font-mono text-rose-700 hover:text-rose-950 underline underline-offset-2"
            >
              {showDetails ? "Hide details" : "Details"}
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="text-rose-600 hover:text-rose-900 transition-colors"
            title="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {Boolean(showDetails && error.details) && (
        <div className="mx-auto mt-2 max-w-5xl rounded-md bg-white p-3 font-mono text-xs text-rose-900 overflow-x-auto border border-rose-200 shadow-xs">
          <pre>{JSON.stringify(error.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
