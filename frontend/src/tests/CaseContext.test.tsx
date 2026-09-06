import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import * as api from "@/lib/api";

const TestConsumer: React.FC = () => {
  const {
    state,
    resetCase,
    selectClaim,
    toggleMockMode,
    setPlaybackSpeed,
    loadPreset,
    setActiveModal,
    startExtracting,
    confirmAndRun,
  } = useCase();

  return (
    <div>
      <div data-testid="active-screen">{state.activeScreen}</div>
      <div data-testid="is-mock">{String(state.isMockMode)}</div>
      <div data-testid="selected-claim">{state.selectedClaimId || "none"}</div>
      <div data-testid="playback-speed">{state.playbackSpeed}</div>
      <div data-testid="active-modal">{state.activeModal}</div>
      <div data-testid="claims-count">{state.currentCase?.claims.length || 0}</div>

      <button onClick={resetCase}>Reset</button>
      <button onClick={() => selectClaim("claim-abc")}>Select Claim</button>
      <button onClick={toggleMockMode}>Toggle Mock</button>
      <button onClick={() => setPlaybackSpeed(2)}>Set Speed</button>
      <button onClick={() => loadPreset("fintech")}>Load Preset</button>
      <button onClick={() => setActiveModal("settings")}>Open Settings</button>
      <button onClick={() => startExtracting("Test proposal")}>Extract</button>
      <button onClick={confirmAndRun}>Confirm and Run</button>
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
    expect(screen.getByTestId("is-mock")).toHaveTextContent("true");
    expect(screen.getByTestId("playback-speed")).toHaveTextContent("1");
    expect(screen.getByTestId("active-modal")).toHaveTextContent("none");

    // Test select claim
    fireEvent.click(screen.getByText("Select Claim"));
    expect(screen.getByTestId("selected-claim")).toHaveTextContent("claim-abc");

    // Test toggle mock
    fireEvent.click(screen.getByText("Toggle Mock"));
    expect(screen.getByTestId("is-mock")).toHaveTextContent("false");

    // Test set playback speed
    fireEvent.click(screen.getByText("Set Speed"));
    expect(screen.getByTestId("playback-speed")).toHaveTextContent("2");

    // Test modal toggle
    fireEvent.click(screen.getByText("Open Settings"));
    expect(screen.getByTestId("active-modal")).toHaveTextContent("settings");

    // Test reset
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("active-screen")).toHaveTextContent("entry");
    expect(screen.getByTestId("selected-claim")).toHaveTextContent("none");
  });

  it("loads presets into currentCase", () => {
    render(
      <CaseProvider>
        <TestConsumer />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Load Preset"));
    expect(screen.getByTestId("active-screen")).toHaveTextContent("runner");
    expect(Number(screen.getByTestId("claims-count").textContent)).toBeGreaterThan(0);
  });

  it("handles live backend extraction through api.createCase", async () => {
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

    // Switch to live mode first
    fireEvent.click(screen.getByText("Toggle Mock"));
    expect(screen.getByTestId("is-mock")).toHaveTextContent("false");

    await act(async () => {
      fireEvent.click(screen.getByText("Extract"));
    });

    expect(api.createCase).toHaveBeenCalledWith("Test proposal", undefined);
    expect(screen.getByTestId("active-screen")).toHaveTextContent("confirm");
  });
});
