import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBanner } from "@/components/layout/ErrorBanner";
import { CaseProvider } from "@/context/CaseContext";

describe("ErrorBanner", () => {
  it("renders null when error is null", () => {
    const { container } = render(
      <CaseProvider>
        <ErrorBanner error={null} onDismiss={() => {}} />
      </CaseProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders error stage and message when error is present", () => {
    const error = {
      stage: "extraction",
      message: "LLM rate limit reached",
    };

    render(
      <CaseProvider>
        <ErrorBanner error={error} onDismiss={() => {}} />
      </CaseProvider>
    );

    expect(screen.getByText("[extraction]")).toBeInTheDocument();
    expect(screen.getByText(/LLM rate limit reached/i)).toBeInTheDocument();
  });

  it("calls onDismiss when close button is clicked", () => {
    const handleDismiss = vi.fn();
    const error = {
      stage: "stream",
      message: "Connection dropped",
    };

    render(
      <CaseProvider>
        <ErrorBanner error={error} onDismiss={handleDismiss} />
      </CaseProvider>
    );

    const closeBtn = screen.getByTitle("Dismiss error");
    fireEvent.click(closeBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("toggles error details when details are present", () => {
    const error = {
      stage: "network",
      message: "Failed to connect",
      details: { code: "ECONNREFUSED", port: 8000 },
    };

    render(
      <CaseProvider>
        <ErrorBanner error={error} onDismiss={() => {}} />
      </CaseProvider>
    );

    const detailsBtn = screen.getByRole("button", { name: "Details" });
    expect(screen.queryByText(/ECONNREFUSED/i)).not.toBeInTheDocument();

    // Click to show details
    fireEvent.click(detailsBtn);
    expect(screen.getByText(/ECONNREFUSED/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide details" })).toBeInTheDocument();

    // Click to hide details
    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText(/ECONNREFUSED/i)).not.toBeInTheDocument();
  });
});
