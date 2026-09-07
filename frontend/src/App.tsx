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
import { DebugViewsToolbar } from "@/components/features/DebugViewsToolbar";

const DiscussionApp = React.lazy(() => import("./components/DiscussionApp"));

export const AppContent: React.FC = () => {
  const { state, dispatch } = useCase();
  const [activeAppMode, setActiveAppMode] = React.useState<"crossfire" | "simulation">("crossfire");

  // Attach live SSE stream when pipeline is active
  useCaseStream();

  // Scroll to top whenever the active screen changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [state.activeScreen]);

  if (activeAppMode === "simulation") {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-100">
        <div className="fixed top-3 right-4 z-50">
          <button
            type="button"
            onClick={() => setActiveAppMode("crossfire")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-container-high/90 hover:bg-surface-container border border-outline-variant text-xs font-mono font-medium text-on-surface shadow-xl backdrop-blur transition-all cursor-pointer"
          >
            ← Back to Crossfire Frontend
          </button>
        </div>
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400 font-mono text-sm">Loading 2.5D Simulation...</div>}>
          <DiscussionApp />
        </React.Suspense>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-indigo-500/20 selection:text-indigo-300">
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
      <main className="flex-1 pt-14">
        {state.activeScreen === "entry" && <EntryScreen />}
        {state.activeScreen === "confirm" && <ConfirmScreen />}
        {(state.activeScreen === "runner" || state.activeScreen === "dashboard") && (
          <DashboardScreen />
        )}
      </main>

      {/* Real-time Telemetry Log Viewer */}
      <LiveLogsDrawer />

      {/* Case History Drawer */}
      <HistoryModal />

      {/* Frequently Asked Questions Drawer */}
      <FaqDrawer />

      {/* System Settings Modal */}
      <SettingsModal />

      {/* Floating Quick Access to 2.5D Simulation */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setActiveAppMode("simulation")}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-surface-container-high/95 hover:bg-surface-container border border-primary/50 text-primary hover:text-primary-container shadow-2xl backdrop-blur font-code-sm text-xs font-semibold tracking-wide transition-all cursor-pointer group"
          title="Switch to 2.5D Discussion Simulation"
        >
          <span className="w-2 h-2 rounded-full bg-verdict-survived animate-pulse" />
          <span>2.5D Simulation View</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary-container/20 text-primary-container border border-primary-container/40 group-hover:bg-primary-container/30">
            Preview
          </span>
        </button>
      </div>
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
