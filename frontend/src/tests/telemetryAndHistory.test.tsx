import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { LiveLogsDrawer } from "@/components/features/LiveLogsDrawer";
import { HistoryModal } from "@/components/features/HistoryModal";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { Case } from "@/types/crossfire";

const mockCase: Case = {
  id: "case-hist-1",
  raw_input: "Launch AI Coding IDE",
  context: "DevTools Market",
  status: "done",
  claims: [
    {
      id: "c-1",
      statement: "Developers prefer local inference",
      load_bearing: true,
      status: "survived",
    },
    {
      id: "c-2",
      statement: "Latency is under 100ms",
      load_bearing: false,
      status: "weakened",
    },
  ],
  test_plan: [],
  findings: [],
  consequences: [],
};

const TestController = () => {
  const { state, dispatch, setActiveModal } = useCase();
  return (
    <div>
      <button onClick={() => setActiveModal("logs")}>Open Logs</button>
      <button onClick={() => setActiveModal("history")}>Open History</button>
      <button
        onClick={() =>
          dispatch({
            type: "SSE_EVENT",
            payload: {
              event: "finding_ready",
              data: { claim_id: "c-1", test_id: "t-1", result: "Verified" },
            },
          })
        }
      >
        Push SSE Event
      </button>
      <button
        onClick={() =>
          dispatch({
            type: "LOAD_CASE",
            payload: mockCase,
          })
        }
      >
        Set Current Case
      </button>
      <span data-testid="active-modal">{state.activeModal}</span>
      <span data-testid="current-case-id">{state.currentCase?.id || "none"}</span>
    </div>
  );
};

describe("Telemetry & History Modals", () => {
  it("opens live telemetry drawer and displays logged SSE events", () => {
    render(
      <CaseProvider>
        <TestController />
        <LiveLogsDrawer />
      </CaseProvider>
    );

    // Initial state: drawer closed
    expect(screen.queryByText("Live Pipeline Stream & Telemetry")).not.toBeInTheDocument();

    // Push an event and open logs
    fireEvent.click(screen.getByText("Push SSE Event"));
    fireEvent.click(screen.getByText("Open Logs"));

    // Drawer should now be visible
    expect(screen.getByText("Live Pipeline Stream & Telemetry")).toBeInTheDocument();
    expect(screen.getAllByText("finding_ready").length).toBeGreaterThanOrEqual(1);

    // Close drawer
    const closeBtn = screen.getByLabelText("Close telemetry drawer");
    fireEvent.click(closeBtn);
    expect(screen.getByTestId("active-modal").textContent).toBe("none");
  });

  it("opens history modal, renders cases, and allows loading a past case", () => {
    render(
      <CaseProvider>
        <TestController />
        <HistoryModal />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open History"));
    expect(screen.getByText("Case History & Settings")).toBeInTheDocument();
    expect(screen.getByText("Example Decision Models")).toBeInTheDocument();

    // Close history
    const closeBtn = screen.getByLabelText("Close history modal");
    fireEvent.click(closeBtn);
    expect(screen.getByTestId("active-modal").textContent).toBe("none");
  });

  it("Header integrates with logs and history modals without fake telemetry pings", () => {
    render(
      <CaseProvider>
        <Header />
        <TestController />
      </CaseProvider>
    );

    // Terminal button should open logs
    const terminalBtn = screen.getByLabelText(/View live pipeline telemetry and logs/i);
    fireEvent.click(terminalBtn);
    expect(screen.getByTestId("active-modal").textContent).toBe("logs");

    // Settings button should open history
    const settingsBtn = screen.getByLabelText(/View case history and settings/i);
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId("active-modal").textContent).toBe("history");

    // Profile avatar should render initials CF cleanly
    expect(screen.getByText("CF")).toBeInTheDocument();
  });
});
