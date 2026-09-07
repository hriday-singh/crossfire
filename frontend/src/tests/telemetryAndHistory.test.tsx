import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { LiveLogsDrawer } from "@/components/features/LiveLogsDrawer";
import { HistoryModal } from "@/components/features/HistoryModal";
import { EntryFooter } from "@/components/features/EntryFooter";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
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

  it("opens history modal, renders cases, suppresses zero counts and IDs, and uses dustbin buttons", () => {
    localStorage.setItem(
      "crossfire_case_history",
      JSON.stringify([
        {
          ...mockCase,
          claims: [
            { id: "c-1", statement: "Claim 1", load_bearing: true, status: "survived" },
            { id: "c-2", statement: "Claim 2", load_bearing: false, status: "weakened" },
          ],
        },
      ])
    );

    render(
      <CaseProvider>
        <TestController />
        <HistoryModal />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open History"));
    expect(screen.getByText("Case History")).toBeInTheDocument();
    expect(screen.queryByText("Example Decision Models")).not.toBeInTheDocument();
    expect(screen.queryByText(/API Target/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Recent Decision Runs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved decision tests/i)).not.toBeInTheDocument();

    // Verify case ID #CASE-HIST-1 is removed
    expect(screen.queryByText(/#CASE-HIST/i)).not.toBeInTheDocument();

    // Verify claims stats: 2 claims, 1 weakened, 1 survived, but 0 broken is omitted
    expect(screen.getByText(/2 claims/i)).toBeInTheDocument();
    expect(screen.getByText(/1 weakened/i)).toBeInTheDocument();
    expect(screen.getByText(/1 survived/i)).toBeInTheDocument();
    expect(screen.queryByText(/broken/i)).not.toBeInTheDocument();

    // Verify action buttons: View Memo on left, small dustbin on right
    expect(screen.getByRole("button", { name: /view memo/i })).toBeInTheDocument();
    const deleteBtn = screen.getByLabelText("Delete run case-hist-1");
    expect(deleteBtn).toBeInTheDocument();
    expect(screen.queryByLabelText(/options for case/i)).not.toBeInTheDocument();
    expect(screen.queryByText("more_vert")).not.toBeInTheDocument();

    // Clear history dustbin button in header
    expect(screen.getByLabelText("Clear history")).toBeInTheDocument();

    // Clicking full card loads case
    fireEvent.click(screen.getByText("Launch AI Coding IDE"));
    expect(screen.getByTestId("current-case-id").textContent).toBe("case-hist-1");
  });

  it("Header integrates with logs and history modals without fake telemetry pings", () => {
    render(
      <CaseProvider>
        <Header />
        <TestController />
      </CaseProvider>
    );

    // Terminal / live telemetry button should be hidden
    expect(screen.queryByLabelText(/View live pipeline telemetry and logs/i)).not.toBeInTheDocument();

    // History button should open history
    const historyBtn = screen.getByLabelText(/View case history/i);
    fireEvent.click(historyBtn);
    expect(screen.getByTestId("active-modal").textContent).toBe("history");

    // Settings button should open settings
    const settingsBtn = screen.getByLabelText(/View settings/i);
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId("active-modal").textContent).toBe("settings");

    // Profile avatar should not be present
    expect(screen.queryByText("CF")).not.toBeInTheDocument();
  });

  it("verifies EntryFooter does not render a Telemetry button", () => {
    render(<EntryFooter onOpenModal={() => {}} />);
    expect(screen.queryByRole("button", { name: /telemetry/i })).not.toBeInTheDocument();
  });

  it("verifies DashboardScreen does not render token breakdown and telemetry stats", () => {
    render(
      <CaseProvider>
        <TestController />
        <DashboardScreen />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Set Current Case"));
    expect(screen.queryByText(/Agent Token Breakdown/i)).not.toBeInTheDocument();
  });
});
