import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { CaseProvider } from "@/context/CaseContext";

describe("Header", () => {
  it("renders branding and status text", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.getByText("Crossfire")).toBeInTheDocument();
    expect(screen.getByText(/\/ decision testing/i)).toBeInTheDocument();
  });

  it("renders brand button and allows clicking to reset", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    const brandBtn = screen.getByRole("button", { name: /Crossfire/i });
    expect(brandBtn).toBeInTheDocument();
    fireEvent.click(brandBtn);
  });

  it("disables subsequent tabs when no case is active and does not inject fake data", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    const claimMapBtn = screen.getByRole("button", { name: /02 Claim Map/i });
    const liveRunnerBtn = screen.getByRole("button", { name: /03 Live Runner/i });

    expect(claimMapBtn).toBeDisabled();
    expect(liveRunnerBtn).toBeDisabled();
    expect(screen.queryByRole("button", { name: /04 Audit Sheet/i })).not.toBeInTheDocument();
  });

  it("renders separate history and settings buttons", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.getByRole("button", { name: /view case history/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view settings/i })).toBeInTheDocument();
  });

  it("does not render v1.4-engine, runner status pill, or profile avatar", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.queryByText("v1.4-engine")).not.toBeInTheDocument();
    expect(screen.queryByText("RUNNER READY")).not.toBeInTheDocument();
    expect(screen.queryByText("RUNNER ACTIVE")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/executive operator profile/i)).not.toBeInTheDocument();
  });
});
