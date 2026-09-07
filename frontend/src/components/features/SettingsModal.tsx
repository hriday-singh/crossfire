import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { GEMINI_WEB_MODELS, formatModelName, formatProviderName } from "@/lib/models";
import { SerpApiIcon } from "@/components/ui/serpapi";

export const SettingsModal: React.FC = () => {
  const { state, dispatch, setActiveModal, selectModel, setDebugMode, enterPreview } = useCase();
  const isOpen = state.activeModal === "settings";
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);

  const handleClearHistory = () => {
    if (confirm("Clear all locally stored decision cases?")) {
      try {
        localStorage.removeItem("crossfire_case_history");
      } catch {
        // ignore
      }
      dispatch({ type: "CLEAR_HISTORY" });
      setClearedNotice("History cleared successfully.");
      setTimeout(() => setClearedNotice(null), 3000);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[560px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-space-2">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              settings
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-normal">
              System Settings
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal("none")}
            aria-label="Close settings modal"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-space-6 space-y-space-6 scrollbar-visible">
          {clearedNotice && (
            <div className="bg-primary-container/20 border border-primary-container/40 text-primary-container px-space-4 py-space-2 rounded text-body-sm">
              {clearedNotice}
            </div>
          )}
          {selectedNotice && (
            <div className="bg-primary-container/20 border border-primary-container/40 text-primary-container px-space-4 py-space-2 rounded text-body-sm flex items-center gap-2 animate-in fade-in-50">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{selectedNotice}</span>
            </div>
          )}

          {/* LLM Provider & Model Section */}
          <div className="space-y-space-3">
            <div className="flex items-center justify-between">
              <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
                LLM Provider &amp; Model
              </h3>
              <span className="flex items-center gap-1.5 font-code-sm text-code-sm text-verdict-survived">
                <span className="w-2 h-2 rounded-full bg-verdict-survived inline-block" />
                <span>Online</span>
              </span>
            </div>

            <div className="bg-surface-container border border-outline-variant/60 rounded-lg p-space-4 space-y-space-3">
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">Active Model:</span>
                <div className="text-right">
                  <span className="font-headline-sm text-headline-sm font-semibold text-primary-container">
                    {formatModelName(state.engineInfo?.model)}
                  </span>
                  <span className="block font-code-sm text-code-sm text-outline">
                    {state.engineInfo?.model || "gemini-3.7-flash"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">Provider Protocol:</span>
                <div className="text-right">
                  <span className="font-body-sm text-body-sm text-on-surface font-medium">
                    {formatProviderName(state.engineInfo?.provider)}
                  </span>
                  <span className="block font-code-sm text-code-sm text-outline">
                    {state.engineInfo?.provider || "openai_compat"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-on-surface-variant">LLM Endpoint:</span>
                <span className="font-mono text-outline">
                  {state.engineInfo?.llm_base_url?.replace(/\/v1\/?$/, "") || "http://localhost:8081"}
                </span>
              </div>
            </div>
          </div>

          {/* Available Gemini Web Models */}
          <div className="space-y-space-3">
            <div className="flex items-center justify-between">
              <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
                Available Gemini Web Models
              </h3>
              <span className="font-code-sm text-code-sm text-outline">
                {GEMINI_WEB_MODELS.length} configured
              </span>
            </div>

            <div className="space-y-space-2">
              {GEMINI_WEB_MODELS.map((model) => {
                const isActive = (state.engineInfo?.model || "gemini-3.7-flash").toLowerCase() === model.id.toLowerCase();
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      selectModel?.(model.id);
                      setSelectedNotice(`Switched active engine model to ${model.name}`);
                      setTimeout(() => setSelectedNotice(null), 3000);
                    }}
                    className={`w-full text-left rounded-lg p-space-3 border transition-all cursor-pointer ${
                      isActive
                        ? "bg-surface-container-high border-primary-container/60 ring-1 ring-primary-container/30 shadow-xs"
                        : "bg-surface-container border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-high/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-2">
                        <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-primary-container" : "text-outline"}`}>
                          {isActive ? "radio_button_checked" : "radio_button_unchecked"}
                        </span>
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold text-xs">
                          {model.name}
                        </span>
                        {model.tag && (
                          <span className="font-code-sm text-[10px] px-1.5 py-0.5 rounded bg-primary-container/15 text-primary-container font-medium">
                            {model.tag}
                          </span>
                        )}
                      </div>
                      {isActive ? (
                        <span className="flex items-center gap-1 font-code-sm text-code-sm text-verdict-survived font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-verdict-survived" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="font-code-sm text-code-sm text-outline font-mono hover:text-on-surface">
                          Select
                        </span>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 text-xs leading-relaxed pl-6">
                      {model.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Search & Evidence Engine */}
          <div className="space-y-space-3">
            <div className="flex items-center justify-between">
              <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
                Live Search &amp; Evidence Engine
              </h3>
              <span className="flex items-center gap-1.5 font-code-sm text-code-sm text-verdict-survived">
                <span className="w-2 h-2 rounded-full bg-verdict-survived inline-block" />
                <span>Connected</span>
              </span>
            </div>

            <div className="bg-surface-container border border-outline-variant/60 rounded-lg p-space-4 space-y-space-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 shrink-0">
                    <SerpApiIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-headline-sm text-headline-sm font-semibold text-on-surface text-sm">
                        SerpApi
                      </span>
                      <span className="font-code-sm text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold uppercase">
                        Primary Search Engine
                      </span>
                    </div>
                    <p className="font-code-sm text-xs text-outline mt-0.5">
                      Real-time Google search scraping &amp; structured evidence parsing
                    </p>
                  </div>
                </div>
                <a
                  href="https://serpapi.com?utm_source=crossfire&utm_medium=settings_modal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-code-sm text-xs text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
                >
                  <span>serpapi.com</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </div>

              <div className="border-t border-outline-variant/30 pt-2.5 flex items-center justify-between text-xs font-code-sm text-outline">
                <span>Grounding Protocol:</span>
                <span className="text-on-surface-variant font-mono">SERP_API_KEY (REST API)</span>
              </div>
            </div>
          </div>

          {/* Local Data & Storage */}
          <div className="space-y-space-3">
            <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
              Data &amp; Memory Management
            </h3>

            <div className="bg-surface-container border border-outline-variant/60 rounded-lg p-space-4 space-y-space-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-medium">
                    Locally Stored Runs
                  </p>
                  <p className="font-code-sm text-code-sm text-outline">
                    {state.caseHistory.length} decision memos saved in browser storage
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={state.caseHistory.length === 0}
                  className="font-code-sm text-code-sm px-space-3 py-1.5 rounded border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>

          {/* Developer & Debug Mode Section */}
          <div className="space-y-space-3">
            <h3 className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
              Developer &amp; Debug
            </h3>

            <div className="bg-surface-container border border-outline-variant/60 rounded-lg p-space-4 space-y-space-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-medium">
                    Debug Mode &amp; Views Preview
                  </p>
                  <p className="font-code-sm text-code-sm text-outline">
                    Enables the UI views preview toolbar to inspect all screens offline with mock fixtures
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.isDebugMode}
                  onClick={() => setDebugMode(!state.isDebugMode)}
                  data-testid="debug-mode-toggle"
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none shrink-0 ${
                    state.isDebugMode ? "bg-primary-container" : "bg-surface-container-highest"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-on-primary-container transition-transform absolute top-1 left-1 ${
                      state.isDebugMode ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {state.isDebugMode && (
                <div className="border-t border-outline-variant/40 pt-space-3 flex items-center justify-between">
                  <div>
                    <p className="font-body-sm text-body-sm text-on-surface font-medium">
                      Launch Views Preview
                    </p>
                    <p className="font-code-sm text-code-sm text-outline">
                      Inspect all 10 view variations with hardcoded mock data
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal("none");
                      enterPreview("dashboard");
                    }}
                    className="font-code-sm text-code-sm px-space-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:brightness-110 font-medium transition-colors cursor-pointer"
                  >
                    Open Preview
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
