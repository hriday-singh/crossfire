import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { SettingsModal } from "@/components/features/SettingsModal";

const TestWrapper: React.FC = () => {
  const { setActiveModal, dispatch } = useCase();
  return (
    <div>
      <button onClick={() => setActiveModal("settings")}>Open Settings</button>
      <button
        onClick={() =>
          dispatch({
            type: "SET_ENGINE_INFO",
            payload: { status: "ok", provider: "openai_compat", model: "gemini-3.7-flash" },
          })
        }
      >
        Set Engine Info
      </button>
      <SettingsModal />
    </div>
  );
};

describe("SettingsModal", () => {
  it("renders system settings when activeModal is settings", () => {
    render(
      <CaseProvider>
        <TestWrapper />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open Settings"));
    expect(screen.getByRole("heading", { name: "System Settings" })).toBeInTheDocument();
    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
    expect(screen.getByText(/LLM Provider & Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Gemini Web Models/i)).toBeInTheDocument();
    expect(screen.queryByText(/Adversarial Evaluator Suite/i)).not.toBeInTheDocument();
  });

  it("displays model, provider protocol, and LLM endpoint while excluding backend API endpoint", () => {
    render(
      <CaseProvider>
        <TestWrapper />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Set Engine Info"));
    fireEvent.click(screen.getByText("Open Settings"));

    expect(screen.getByText("gemini-3.7-flash")).toBeInTheDocument();
    expect(screen.getByText("openai_compat")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:8081")).toBeInTheDocument();
    expect(screen.queryByText("http://localhost:8000")).not.toBeInTheDocument();
  });

  it("closes when close button is clicked", () => {
    render(
      <CaseProvider>
        <TestWrapper />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open Settings"));
    const closeBtn = screen.getByLabelText("Close settings modal");
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("heading", { name: "System Settings" })).not.toBeInTheDocument();
  });

  it("allows selecting a different model and updates engineInfo and notice", () => {
    render(
      <CaseProvider>
        <TestWrapper />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open Settings"));
    const thinkingModelBtn = screen.getByRole("button", { name: /Gemini 3.5 Flash Thinking/i });
    fireEvent.click(thinkingModelBtn);

    expect(
      screen.getByText(/Switched active engine model to Gemini 3.5 Flash Thinking/i)
    ).toBeInTheDocument();
  });
});
