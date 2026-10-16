import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RunStartupOverlay, shouldShowRunStartup } from "@/components/features/RunStartupOverlay";

const live = { isRealRun: true, isTesting: true, isReplaying: false, findingsCount: 0, activeTestCount: 0 };

describe("shouldShowRunStartup", () => {
  it("shows only while a real run is accepted and no agent has started", () => {
    expect(shouldShowRunStartup(live)).toBe(true);
  });

  it("hides once the first test starts or the first finding lands", () => {
    expect(shouldShowRunStartup({ ...live, activeTestCount: 1 })).toBe(false);
    expect(shouldShowRunStartup({ ...live, findingsCount: 1 })).toBe(false);
  });

  it("never shows for previews, replays, or finished runs", () => {
    expect(shouldShowRunStartup({ ...live, isRealRun: false })).toBe(false);
    expect(shouldShowRunStartup({ ...live, isReplaying: true })).toBe(false);
    expect(shouldShowRunStartup({ ...live, isTesting: false })).toBe(false);
  });
});

describe("RunStartupOverlay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when hidden", () => {
    render(<RunStartupOverlay visible={false} message="x" />);
    expect(screen.queryByTestId("run-startup-overlay")).not.toBeInTheDocument();
  });

  it("shows the latest backend activity, or a default line", () => {
    const { rerender } = render(<RunStartupOverlay visible message="Classifying load-bearing assumptions..." />);
    expect(screen.getByRole("status")).toHaveTextContent("Starting up");
    expect(screen.getByRole("status")).toHaveTextContent("Classifying load-bearing assumptions...");

    rerender(<RunStartupOverlay visible message={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Run accepted. Getting the panel ready...");
  });

  it("counts elapsed time while visible", () => {
    vi.useFakeTimers();
    render(<RunStartupOverlay visible />);
    expect(screen.getByLabelText("Elapsed time")).toHaveTextContent("0:00");

    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByLabelText("Elapsed time")).toHaveTextContent("1:05");
  });
});
