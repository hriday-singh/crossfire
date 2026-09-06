import React from "react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { useCaseStream } from "@/hooks/useCaseStream";
import { Header } from "@/components/layout/Header";
import { ErrorBanner } from "@/components/layout/ErrorBanner";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

const AppContent: React.FC = () => {
  const { state, dispatch } = useCase();

  // Attach live SSE stream when pipeline is active
  useCaseStream();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-indigo-500/20 selection:text-indigo-300">
      {/* Top Header */}
      <Header />

      {/* Pipeline Error Alert Banner */}
      <ErrorBanner
        error={state.error}
        onDismiss={() => dispatch({ type: "CLEAR_ERROR" })}
      />

      {/* Main Screen Canvas */}
      <main className="flex-1 pb-16">
        {state.activeScreen === "entry" && <EntryScreen />}
        {state.activeScreen === "confirm" && <ConfirmScreen />}
        {(state.activeScreen === "runner" || state.activeScreen === "dashboard") && (
          <DashboardScreen />
        )}
      </main>
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
