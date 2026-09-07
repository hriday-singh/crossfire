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
          <React.Suspense
            fallback={
              <div data-testid="live-view-loading" className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-slate-400 font-mono text-sm">
                Loading 2.5D Live View...
              </div>
            }
          >
            <DiscussionApp />
          </React.Suspense>
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
      <ProvidersModal />
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
