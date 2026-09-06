import React, { useState } from "react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { useCaseStream } from "@/hooks/useCaseStream";
import { Header } from "@/components/layout/Header";
import { ErrorBanner } from "@/components/layout/ErrorBanner";
import { DebugDock } from "@/components/layout/DebugDock";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { SettingsModal } from "@/components/features/SettingsModal";
import { HistoryDrawer } from "@/components/features/HistoryDrawer";
import { RealityCheckModal } from "@/components/screens/RealityCheckModal";

const AppContent: React.FC = () => {
  const { state, dispatch } = useCase();
  const [isDebugDockOpen, setIsDebugDockOpen] = useState(false);

  // Hook handles live SSE stream or simulated playback based on mode
  useCaseStream();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-blue-500/20 selection:text-blue-300">
      {/* Top Header */}
      <Header
        onToggleDebugDock={() => setIsDebugDockOpen(!isDebugDockOpen)}
        isDebugDockOpen={isDebugDockOpen}
      />

      {/* Pipeline Error Banner */}
      <ErrorBanner
        error={state.error}
        onDismiss={() => dispatch({ type: "CLEAR_ERROR" })}
      />

      {/* Main Canvas View Switcher */}
      <main className="flex-1 pb-16">
        {state.activeScreen === "entry" && <EntryScreen />}
        {state.activeScreen === "confirm" && <ConfirmScreen />}
        {(state.activeScreen === "runner" || state.activeScreen === "dashboard") && (
          <DashboardScreen />
        )}
      </main>

      {/* Engine & SSE Debug Dock */}
      <DebugDock
        isOpen={isDebugDockOpen}
        onClose={() => setIsDebugDockOpen(false)}
      />

      {/* Global Modals & Drawers */}
      <SettingsModal
        open={state.activeModal === "settings"}
        onClose={() => dispatch({ type: "SET_ACTIVE_MODAL", payload: "none" })}
      />
      <HistoryDrawer
        open={state.activeModal === "history"}
        onClose={() => dispatch({ type: "SET_ACTIVE_MODAL", payload: "none" })}
      />
      <RealityCheckModal
        open={state.activeModal === "reality_check"}
        onClose={() => dispatch({ type: "SET_ACTIVE_MODAL", payload: "none" })}
      />
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
