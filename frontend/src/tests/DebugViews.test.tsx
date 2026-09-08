import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { Header } from "@/components/layout/Header";
import { SettingsModal } from "@/components/features/SettingsModal";
import { AppContent } from "@/App";
import * as api from "@/lib/api";

const SAMPLE_REAL_CASE = {
  id: "case-real-active",
  raw_input: "Launch AI legal assistant for high school debate teams",
  context: null,
  status: "awaiting_confirmation" as const,
  claims: [
    {
      id: "claim-real-1",
      statement: "Debaters will rely on real-time argument synthesis during rounds",
      load_bearing: true,
      status: null,
    },
  ],
  test_plan: [],
  findings: [],
  consequences: [],
};

const TestHelper = () => {
  const { state, dispatch, setDebugMode, enterPreview, exitPreview } = useCase();
  return (
    <div>
      <button onClick={() => setDebugMode(true)}>Enable Debug Mode</button>
      <button onClick={() => setDebugMode(false)}>Disable Debug Mode</button>
      <button onClick={() => enterPreview("dashboard")}>Direct Enter Preview</button>
      <button onClick={exitPreview}>Direct Exit Preview</button>
      <button onClick={() => dispatch({ type: "LOAD_CASE", payload: SAMPLE_REAL_CASE })}>
        Load Real Active Case
      </button>
      <span data-testid="is-debug">{String(state.isDebugMode)}</span>
      <span data-testid="preview-view">{String(state.previewView)}</span>
    </div>
  );
};

describe("Debug Views Preview & View Catalog", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debug views button is hidden when debug mode is disabled", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.queryByTestId("debug-views-btn")).not.toBeInTheDocument();
  });

  it("debug mode can be toggled via SettingsModal and persists in localStorage", async () => {
    render(
      <CaseProvider>
        <Header />
        <SettingsModal />
        <TestHelper />
      </CaseProvider>
    );

    // Open Settings modal
    const settingsBtn = screen.getByRole("button", { name: /view settings/i });
    fireEvent.click(settingsBtn);

    // Toggle switch in settings
    const toggleBtn = screen.getByTestId("debug-mode-toggle");
    expect(toggleBtn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("crossfire_debug")).toBe("true");

    // Header now renders the Views Preview button
    expect(screen.getByTestId("debug-views-btn")).toBeInTheDocument();

    // Toggle off
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("crossfire_debug")).toBe("false");
    expect(screen.queryByTestId("debug-views-btn")).not.toBeInTheDocument();
  });

  it("entering preview mode displays DebugViewsToolbar and loads realistic hardcoded data without backend calls", async () => {
    const createCaseSpy = vi.spyOn(api, "createCase");
    const confirmCaseSpy = vi.spyOn(api, "confirmCase");

    render(
      <CaseProvider>
        <TestHelper />
        <AppContent />
      </CaseProvider>
    );

    // Turn on debug mode
    fireEvent.click(screen.getByText("Enable Debug Mode"));

    // Click Views Preview button in Header
    const previewBtn = screen.getByTestId("debug-views-btn");
    fireEvent.click(previewBtn);

    // Debug toolbar should appear
    expect(screen.getByRole("region", { name: /Debug Views Preview Switcher/i })).toBeInTheDocument();
    expect(screen.getByText(/Preview Fixture/i)).toBeInTheDocument();

    // Should display Decision Memo view by default, led by the verdict
    expect(screen.getByText("Don't proceed as written.")).toBeInTheDocument();
    expect(screen.getByText(/1 refuted/)).toBeInTheDocument();

    // Verify ZERO backend API calls were made
    expect(createCaseSpy).not.toHaveBeenCalled();
    expect(confirmCaseSpy).not.toHaveBeenCalled();
  });

  it("allows 1-click navigation across all 10 view variations in preview mode", async () => {
    render(
      <CaseProvider>
        <TestHelper />
        <AppContent />
      </CaseProvider>
    );

    // Turn on debug mode and enter preview
    fireEvent.click(screen.getByText("Enable Debug Mode"));
    fireEvent.click(screen.getByTestId("debug-views-btn"));

    // 1. Ingestion view
    fireEvent.click(screen.getByTestId("preview-btn-entry"));
    expect(screen.getByPlaceholderText(/customer support to a fine tuned LLM/i)).toBeInTheDocument();

    // 2. Extracting view
    fireEvent.click(screen.getByTestId("preview-btn-extracting"));
    expect(screen.getAllByText(/Extracting Core Assumptions/i)[0]).toBeInTheDocument();

    // 3. Claim Map view
    fireEvent.click(screen.getByTestId("preview-btn-confirm"));
    expect(screen.getByText(/We identified/i)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise general counsel and risk officers/i)).toBeInTheDocument();

    // 4. Live Runner view (Page 3 Live View)
    fireEvent.click(screen.getByTestId("preview-btn-runner"));
    expect(
      screen.queryByTestId("live-view-loading") ||
      (await screen.findByText(/Live 2.5D Bullpen|Steelman Voice|Loading 2.5D Live View/i))
    ).toBeInTheDocument();

    // 5. Decision Memo view
    fireEvent.click(screen.getByTestId("preview-btn-dashboard"));
    expect(screen.getByText("Don't proceed as written.")).toBeInTheDocument();
    expect(screen.getByText(/Result|Testing your decision/i)).toBeInTheDocument();

    // 6. Evidence Drawer view
    fireEvent.click(screen.getByTestId("preview-btn-evidence"));
    const evidenceBtn = screen.queryByRole("button", { name: /evidence test/i });
    if (evidenceBtn) {
      fireEvent.click(evidenceBtn);
    }
    // The drawer and the verdict block's source credit both name it.
    expect(screen.getAllByText(/ABA Formal Opinion 512/i).length).toBeGreaterThan(0);

    // 7. Telemetry Logs view
    fireEvent.click(screen.getByTestId("preview-btn-logs"));
    expect(screen.getByText(/Live Pipeline Stream/i)).toBeInTheDocument();

    // 8. Case History view
    fireEvent.click(screen.getByTestId("preview-btn-history"));
    expect(screen.getByRole("heading", { name: "Case History" })).toBeInTheDocument();

    // 9. FAQ view
    fireEvent.click(screen.getByTestId("preview-btn-faq"));
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();

    // 10. Settings view
    fireEvent.click(screen.getByTestId("preview-btn-settings"));
    expect(screen.getByText("System Settings")).toBeInTheDocument();
  });

  it("exiting preview mode restores previous active state cleanly with zero state corruption", async () => {
    render(
      <CaseProvider>
        <TestHelper />
        <AppContent />
      </CaseProvider>
    );

    // Populate real active case
    fireEvent.click(screen.getByText("Load Real Active Case"));

    // Verify real case is active on confirm screen
    expect(screen.getByText("Launch AI legal assistant for high school debate teams")).toBeInTheDocument();
    expect(screen.getByText("Debaters will rely on real-time argument synthesis during rounds")).toBeInTheDocument();

    // Enable debug mode & enter preview
    fireEvent.click(screen.getByText("Enable Debug Mode"));
    fireEvent.click(screen.getByTestId("debug-views-btn"));

    // Now in preview: shows preview fixture instead of real case
    expect(screen.getByRole("region", { name: /Debug Views Preview Switcher/i })).toBeInTheDocument();
    expect(screen.getByText(/1 refuted/)).toBeInTheDocument();

    // Click Exit Preview
    const exitBtn = screen.getByRole("button", { name: /Exit Debug Views Preview/i });
    fireEvent.click(exitBtn);

    // Toolbar disappears
    expect(screen.queryByRole("region", { name: /Debug Views Preview Switcher/i })).not.toBeInTheDocument();

    // Original real case on confirm screen is completely restored
    expect(screen.getByText("Launch AI legal assistant for high school debate teams")).toBeInTheDocument();
    expect(screen.getByText("Debaters will rely on real-time argument synthesis during rounds")).toBeInTheDocument();

  }, 15000);
});
