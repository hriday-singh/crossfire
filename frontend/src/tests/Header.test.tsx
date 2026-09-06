import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { CaseProvider } from "@/context/CaseContext";

describe("Header", () => {
  it("renders branding, status indicator, and control buttons", () => {
    render(
      <CaseProvider>
        <Header onToggleDebugDock={() => {}} isDebugDockOpen={false} />
      </CaseProvider>
    );

    expect(screen.getByText("Crossfire")).toBeInTheDocument();
    expect(screen.getByText("CI/CD RIG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new case/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reality check/i })).toBeInTheDocument();
  });

  it("calls onToggleDebugDock when terminal icon is clicked", () => {
    const handleToggle = vi.fn();
    render(
      <CaseProvider>
        <Header onToggleDebugDock={handleToggle} isDebugDockOpen={false} />
      </CaseProvider>
    );

    const terminalBtn = screen.getByTitle("Toggle Engine & SSE Debug Dock");
    fireEvent.click(terminalBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("renders mock toggle pill and allows clicking", () => {
    render(
      <CaseProvider>
        <Header onToggleDebugDock={() => {}} isDebugDockOpen={false} />
      </CaseProvider>
    );

    const mockPill = screen.getByTitle("Click to toggle Mock Simulation vs Live Backend");
    expect(mockPill).toBeInTheDocument();
    fireEvent.click(mockPill);
  });
});
