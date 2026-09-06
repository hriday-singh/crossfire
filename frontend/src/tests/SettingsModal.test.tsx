import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsModal } from "@/components/features/SettingsModal";
import { CaseProvider } from "@/context/CaseContext";

describe("SettingsModal", () => {
  it("renders when open={true} and shows providers and mock settings", () => {
    render(
      <CaseProvider>
        <SettingsModal open={true} onClose={() => {}} />
      </CaseProvider>
    );

    expect(screen.getByText("Engine & Model Provider Settings")).toBeInTheDocument();
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("Anthropic Claude")).toBeInTheDocument();
    expect(screen.getByText("OpenAI GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("Local Ollama")).toBeInTheDocument();
  });

  it("does not render modal content when open={false}", () => {
    render(
      <CaseProvider>
        <SettingsModal open={false} onClose={() => {}} />
      </CaseProvider>
    );

    expect(screen.queryByText("Engine & Model Provider Settings")).not.toBeInTheDocument();
  });

  it("handles provider selection and speed clicks", () => {
    render(
      <CaseProvider>
        <SettingsModal open={true} onClose={() => {}} />
      </CaseProvider>
    );

    const anthropicBtn = screen.getByText("Anthropic Claude").closest("button");
    if (anthropicBtn) {
      fireEvent.click(anthropicBtn);
    }

    const speed2x = screen.getByRole("button", { name: "2x" });
    fireEvent.click(speed2x);
    expect(speed2x).toHaveClass("bg-blue-600");
  });

  it("triggers onClose when clicking Done", () => {
    const handleClose = vi.fn();
    render(
      <CaseProvider>
        <SettingsModal open={true} onClose={handleClose} />
      </CaseProvider>
    );

    const doneBtn = screen.getByRole("button", { name: "Done" });
    fireEvent.click(doneBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
