import React from "react";
import { SerpApiIcon } from "@/components/ui/serpapi";

interface EntryFooterProps {
  onOpenModal: (modal: "faq" | "logs" | "history") => void;
}

export const EntryFooter: React.FC<EntryFooterProps> = ({ onOpenModal }) => {
  return (
    <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-space-3 px-space-6 flex items-center justify-between">
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-outline font-code-sm text-code-sm flex-wrap gap-2">
        <div className="flex items-center gap-space-3 flex-wrap">
          <span>Crossfire: Open-source decision testing platform.</span>
          <span className="text-outline-variant hidden sm:inline">·</span>
          <a
            href="https://serpapi.com?utm_source=crossfire&utm_medium=footer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-on-surface transition-colors"
            title="Search results powered by SerpApi"
          >
            <span>Search powered by</span>
            <SerpApiIcon size={13} />
            <span className="font-semibold text-primary">SerpApi</span>
          </a>
        </div>
        <div className="flex items-center gap-space-4">
          <a
            className="hover:text-on-surface transition-colors"
            href="https://github.com/hriday-singh/crossfire"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={() => onOpenModal("faq")}
            className="hover:text-on-surface transition-colors cursor-pointer"
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("logs")}
            className="hover:text-on-surface transition-colors cursor-pointer"
          >
            Telemetry
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("history")}
            className="hover:text-on-surface transition-colors cursor-pointer"
          >
            History
          </button>
        </div>
      </div>
    </footer>
  );
};
