import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import * as api from "@/lib/api";

const TestConsumer: React.FC = () => {
  const {
    state,
    resetCase,
    selectClaim,
    loadPreset,
    setActiveModal,
    startExtracting,
    confirmAndRun,
    toggleAgentSelection,
    setAgentMode,
    setSelectedAgents,
  } = useCase();

  return (
    <div>
      <div data-testid="active-screen">{state.activeScreen}</div>
      <div data-testid="is-streaming">{String(state.isStreaming)}</div>
      <div data-testid="selected-claim">{state.selectedClaimId || "none"}</div>
      <div data-testid="active-modal">{state.activeModal}</div>
      <div data-testid="claims-count">{state.currentCase?.claims.length || 0}</div>
      <div data-testid="agent-mode">{state.currentCase?.agent_mode || "none"}</div>
      <div data-testid="selected-agents">
        {(state.currentCase?.selected_agents || []).join(",")}
      </div>

      <button onClick={resetCase}>Reset</button>
      <button onClick={() => selectClaim("claim-abc")}>Select Claim</button>
      <button onClick={() => loadPreset("college-ai")}>Load Preset</button>
      <button onClick={() => setActiveModal("history")}>Open History</button>
      <button onClick={() => startExtracting("Test proposal")}>Extract</button>
      <button onClick={confirmAndRun}>Confirm and Run</button>
      <button onClick={() => toggleAgentSelection("builder")}>Toggle Builder</button>
      <button onClick={() => setAgentMode("custom")}>Set Custom Mode</button>
      <button onClick={() => setSelectedAgents(["researcher", "builder"])}>Set Researcher Builder</button>
    </div>
  );
};

describe("CaseContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("provides initial state and allows state mutations via actions", () => {
    render(
      <CaseProvider>
        <TestConsumer />
      </CaseProvider>
    );

    expect(screen.getByTestId("active-screen")).toHaveTextContent("entry");
    expect(screen.getByTestId("is-streaming")).toHaveTextContent("false");
    expect(screen.getByTestId("active-modal")).toHaveTextContent("none");

    // Test select claim
    fireEvent.click(screen.getByText("Select Claim"));
    expect(screen.getByTestId("selected-claim")).toHaveTextContent("claim-abc");

    // Test modal toggle
    fireEvent.click(screen.getByText("Open History"));
    expect(screen.getByTestId("active-modal")).toHaveTextContent("history");

    // Test reset
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("active-screen")).toHaveTextContent("entry");
    expect(screen.getByTestId("selected-claim")).toHaveTextContent("none");
  });

  it("handles backend extraction through api.createCase", async () => {
    vi.spyOn(api, "createCase").mockResolvedValueOnce({
      id: "case-api-1",
      raw_input: "Input text",
      context: null,
      status: "awaiting_confirmation",
      claims: [
        { id: "c1", statement: "Extracted statement", load_bearing: true, status: null },
      ],
      test_plan: [],
      findings: [],
      consequences: [],
    });

    render(
      <CaseProvider>
        <TestConsumer />
      </CaseProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Extract"));
    });

    expect(api.createCase).toHaveBeenCalledWith(
      "Test proposal",
      undefined,
      undefined,
      undefined,
      undefined,
      expect.anything()
    );
    expect(screen.getByTestId("active-screen")).toHaveTextContent("confirm");
  });

  it("loads presets into currentCase via startExtracting", async () => {
    vi.spyOn(api, "createCase").mockResolvedValueOnce({
      id: "case-preset-1",
      raw_input: "College Admissions AI Agent",
      context: null,
      status: "awaiting_confirmation",
      claims: [
        { id: "c-preset", statement: "Sample claim", load_bearing: true, status: null },
      ],
      test_plan: [],
      findings: [],
      consequences: [],
    });

    render(
      <CaseProvider>
        <TestConsumer />
      </CaseProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Load Preset"));
    });

    expect(api.createCase).toHaveBeenCalled();
    expect(screen.getByTestId("active-screen")).toHaveTextContent("confirm");
    expect(screen.getByTestId("claims-count")).toHaveTextContent("1");
  });

  it("launches confirmation pipeline via api.confirmCase and enters streaming mode", async () => {
    vi.spyOn(api, "createCase").mockResolvedValueOnce({
      id: "case-confirm-test",
      raw_input: "Testing proposition",
      context: null,
      status: "awaiting_confirmation",
      agent_mode: "auto",
      selected_agents: ["devils_advocate", "researcher"],
      claims: [
        { id: "c-1", statement: "Claim 1", load_bearing: true, status: null },
      ],
      test_plan: [],
      findings: [],
      consequences: [],
    });
    vi.spyOn(api, "confirmCase").mockResolvedValueOnce({
      case_id: "case-confirm-test",
      status: "testing",
      message: "Case confirmed and pipeline launched",
    });

    render(
      <CaseProvider>
        <TestConsumer />
      </CaseProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Extract"));
    });

    expect(screen.getByTestId("active-screen")).toHaveTextContent("confirm");

    await act(async () => {
      fireEvent.click(screen.getByText("Confirm and Run"));
    });

    expect(screen.getByTestId("active-screen")).toHaveTextContent("runner");
    expect(screen.getByTestId("is-streaming")).toHaveTextContent("true");
    await waitFor(() => {
      expect(api.confirmCase).toHaveBeenCalledWith(
        "case-confirm-test",
        [{ id: "c-1", statement: "Claim 1", load_bearing: true, status: null }],
        ["devils_advocate", "researcher"]
      );
    });
  });

  it("allows updating agent mode and toggling agent selection", async () => {
    vi.spyOn(api, "createCase").mockResolvedValueOnce({
      id: "case-agent-test",
      raw_input: "Agent test proposition",
      context: null,
      status: "awaiting_confirmation",
      agent_mode: "auto",
      selected_agents: ["devils_advocate", "researcher", "builder", "operator"],
      claims: [
        { id: "c-1", statement: "Claim 1", load_bearing: true, status: null },
      ],
      test_plan: [],
      findings: [],
      consequences: [],
    });

    render(
      <CaseProvider>
        <TestConsumer />
      </CaseProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Extract"));
    });

    expect(screen.getByTestId("agent-mode")).toHaveTextContent("auto");
    expect(screen.getByTestId("selected-agents")).toHaveTextContent(
      "devils_advocate,researcher,builder,operator"
    );

    // Toggle builder
    act(() => {
      fireEvent.click(screen.getByText("Toggle Builder"));
    });
    expect(screen.getByTestId("selected-agents")).toHaveTextContent(
      "devils_advocate,researcher,operator"
    );

    // Set custom mode
    act(() => {
      fireEvent.click(screen.getByText("Set Custom Mode"));
    });
    expect(screen.getByTestId("agent-mode")).toHaveTextContent("custom");

    // Set specific agents
    act(() => {
      fireEvent.click(screen.getByText("Set Researcher Builder"));
    });
    expect(screen.getByTestId("selected-agents")).toHaveTextContent("researcher,builder");
  });
});
