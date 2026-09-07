import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { AppContent } from "@/App";
import { Case } from "@/types/crossfire";

// Mock DiscussionApp for AppContent routing tests to isolate Pixi WebGL rendering
vi.mock("@/components/DiscussionApp", () => {
  return {
    default: () => (
      <div data-testid="live-view-page3">
        <span data-testid="live-view-title">2.5D Live View Bullpen</span>
      </div>
    ),
    DiscussionApp: () => (
      <div data-testid="live-view-page3">
        <span data-testid="live-view-title">2.5D Live View Bullpen</span>
      </div>
    ),
  };
});

const MOCK_RUNNING_CASE: Case = {
  id: "case-live-view-test",
  raw_input: "Launch B2B Copilot in APAC",
  context: "Enterprise market entry",
  status: "testing",
  claims: [
    {
      id: "c-1",
      statement: "APAC enterprise compliance satisfies local regulations",
      load_bearing: true,
      status: null,
    },
  ],
  test_plan: [],
  findings: [],
  consequences: [],
};

const SetupRunnerScreen: React.FC = () => {
  const { dispatch } = useCase();
  React.useEffect(() => {
    dispatch({ type: "LOAD_CASE", payload: MOCK_RUNNING_CASE });
    dispatch({ type: "NAVIGATE_SCREEN", payload: "runner" });
  }, [dispatch]);
  return null;
};

const SetupDashboardScreen: React.FC = () => {
  const { dispatch } = useCase();
  React.useEffect(() => {
    dispatch({ type: "LOAD_CASE", payload: { ...MOCK_RUNNING_CASE, status: "done" } });
    dispatch({ type: "NAVIGATE_SCREEN", payload: "dashboard" });
  }, [dispatch]);
  return null;
};

describe("Page 3 Live View Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Live View (DiscussionApp) when activeScreen is 'runner'", async () => {
    render(
      <CaseProvider>
        <SetupRunnerScreen />
        <AppContent />
      </CaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-view-page3")).toBeInTheDocument();
      expect(screen.getByTestId("live-view-title")).toHaveTextContent("2.5D Live View Bullpen");
    });
  });

  it("renders DashboardScreen when activeScreen is 'dashboard' and not in preview mode", async () => {
    render(
      <CaseProvider>
        <SetupDashboardScreen />
        <AppContent />
      </CaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Result/i)).toBeInTheDocument();
      expect(screen.queryByTestId("live-view-page3")).not.toBeInTheDocument();
    });
  });

  it("renders pure Live View (DiscussionApp) when activeScreen is 'runner' AND in preview mode", async () => {
    const SetupPreviewScreen: React.FC = () => {
      const { dispatch } = useCase();
      React.useEffect(() => {
        dispatch({ type: "SET_PREVIEW_VIEW", payload: "runner" });
      }, [dispatch]);
      return null;
    };
    render(
      <CaseProvider>
        <SetupPreviewScreen />
        <AppContent />
      </CaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("live-view-page3")).toBeInTheDocument();
      expect(screen.getByTestId("live-view-title")).toHaveTextContent("2.5D Live View Bullpen");
    });
  });

  it("displays '03 Live Runner (Live View)' in the header navigation", async () => {
    render(
      <CaseProvider>
        <SetupRunnerScreen />
        <AppContent />
      </CaseProvider>
    );

    const liveRunnerTab = screen.getByRole("button", {
      name: /03 Live Runner \(Live View\)/i,
    });
    expect(liveRunnerTab).toBeInTheDocument();
  });

  it("hides the floating quick access button when already on Page 3", async () => {
    render(
      <CaseProvider>
        <SetupRunnerScreen />
        <AppContent />
      </CaseProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /03 Live View/i })).not.toBeInTheDocument();
    });
  });
});
