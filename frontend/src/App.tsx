import React from "react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { useCaseStream } from "@/hooks/useCaseStream";
import { Header } from "@/components/layout/Header";
import { ErrorBanner } from "@/components/layout/ErrorBanner";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

import { LiveLogsDrawer } from "@/components/features/LiveLogsDrawer";
import { HistoryModal } from "@/components/features/HistoryModal";
import { FaqDrawer } from "@/components/features/FaqDrawer";
import { SettingsModal } from "@/components/features/SettingsModal";
import { ProvidersModal } from "@/components/features/ProvidersModal";
import { DebugViewsToolbar } from "@/components/features/DebugViewsToolbar";
import SpaceStarfield from "@/components/canvas/SpaceStarfield";
const DiscussionApp = React.lazy(() => import("./components/DiscussionApp"));

export const AppContent: React.FC = () => {
  const { state, dispatch } = useCase();

  // Attach live SSE stream when pipeline is active
  useCaseStream();

  // Scroll to top whenever the active screen changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [state.activeScreen]);

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-foreground selection:bg-indigo-500/20 selection:text-indigo-300">
      {/* Fullscreen Space Starfield background across all slides */}
      <SpaceStarfield className="fixed inset-0 w-full h-full pointer-events-none z-0" />
      {/* Top Header */}
      <Header />

      {/* Debug Views Preview Toolbar (Shown only when preview is active) */}
      <DebugViewsToolbar />

      {/* Pipeline Error Alert Banner */}
      <ErrorBanner
        error={state.error}
        onDismiss={() => dispatch({ type: "CLEAR_ERROR" })}
      />

      {/* Main Screen Canvas */}
      <main className="relative z-10 flex-1 pt-14">
        {state.activeScreen === "entry" && <EntryScreen />}
        {state.activeScreen === "confirm" && <ConfirmScreen />}
        {state.activeScreen === "runner" && (
          state.previewView ? (
            <React.Suspense
              fallback={
                <div data-testid="live-view-loading" className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-slate-400 font-mono text-sm">
                  Loading 2.5D Live View...
                </div>
              }
            >
              <DiscussionApp />
            </React.Suspense>
          ) : (
            <DashboardScreen />
          )
        )}
        {state.activeScreen === "dashboard" && <DashboardScreen />}
      </main>

      {/* Real-time Telemetry Log Viewer */}
      <LiveLogsDrawer />

      {/* Case History Drawer */}
      <HistoryModal />


      {/* Frequently Asked Questions Drawer */}
      <FaqDrawer />

      {/* System Settings Modal */}
      <SettingsModal />
      {/* Provider & Model Management */}
      <ProvidersModal />

      {/* Floating Quick Access to Page 3 Live View (when on entry or confirm screen, but not during slide 1b extraction) */}
      {state.activeScreen !== "runner" && state.activeScreen !== "dashboard" && !state.isExtracting && (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={() => {
              if (!state.currentCase) {
                dispatch({ type: "SET_PREVIEW_VIEW", payload: "runner" });
              } else {
                dispatch({ type: "NAVIGATE_SCREEN", payload: "runner" });
              }
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-surface-container-high/95 hover:bg-surface-container border border-primary/50 text-primary hover:text-primary-container shadow-2xl backdrop-blur font-code-sm text-xs font-semibold tracking-wide transition-all cursor-pointer group"
            title="Switch to Page 3 Live View"
          >
            <span className="w-2 h-2 rounded-full bg-verdict-survived animate-pulse" />
            <span>03 Live View</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CaseProvider>
      <AppContent />
    </CaseProvider>
  );
};

export default App;
