import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveActivityFeed } from "@/components/features/LiveActivityFeed";
import { ActivityItem } from "@/types/crossfire";

describe("LiveActivityFeed", () => {
  const sampleActivities: ActivityItem[] = [
    {
      id: "act-1",
      case_id: "case-1",
      tag: "Evidence Test",
      text: 'Querying DuckDuckGo: "uscis bot submission terms"',
      timestamp: "2026-09-06T12:00:00Z",
      claim_id: "c-1",
      action: "search",
    },
    {
      id: "act-2",
      case_id: "case-1",
      tag: "Feasibility Test",
      text: "Evaluating sandbox execution constraints against API quotas...",
      timestamp: "2026-09-06T12:00:02Z",
      claim_id: "c-2",
      action: "evaluate",
    },
    {
      id: "act-3",
      case_id: "case-1",
      tag: "Steelman",
      text: "Reconciling evidence for: AI assistant can submit forms...",
      timestamp: "2026-09-06T12:00:05Z",
      claim_id: "c-1",
      action: "reconcile",
    },
  ];

  it("renders empty state placeholder when no activities yet", () => {
    render(<LiveActivityFeed activities={[]} isStreaming={true} />);

    expect(screen.getByText("Live Investigation Feed")).toBeInTheDocument();
    expect(screen.getByText(/\[0 ops\]/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Initializing\.\.\./i)
    ).toBeInTheDocument();
  });

  it("renders live activities with formatted tags and content", () => {
    render(<LiveActivityFeed activities={sampleActivities} isStreaming={true} />);

    expect(screen.getByText("Live Investigation Feed")).toBeInTheDocument();
    expect(screen.getByText(/\[3 ops\]/i)).toBeInTheDocument();
    expect(screen.getByText(/Scrutiny in Progress\.\.\./i)).toBeInTheDocument();

    expect(screen.getByText(/evidence test/i)).toBeInTheDocument();
    expect(
      screen.getByText(/uscis bot submission terms/)
    ).toBeInTheDocument();

    expect(screen.getByText(/feasibility test/i)).toBeInTheDocument();
    expect(
      screen.getByText("Evaluating sandbox execution constraints against API quotas...")
    ).toBeInTheDocument();

    expect(screen.getByText(/steelman/i)).toBeInTheDocument();
    expect(
      screen.getByText("Reconciling evidence for: AI assistant can submit forms...")
    ).toBeInTheDocument();
  });

  it("toggles collapse and expand when toggle header clicked", () => {
    render(<LiveActivityFeed activities={sampleActivities} isStreaming={true} />);

    expect(
      screen.getByText(/uscis bot submission terms/)
    ).toBeInTheDocument();

    const hideToggle = screen.getByText(/hide/i);
    fireEvent.click(hideToggle);

    // Collapsed: items not in document
    expect(
      screen.queryByText(/uscis bot submission terms/)
    ).not.toBeInTheDocument();

    // Expand again
    const showToggle = screen.getByText(/show/i);
    fireEvent.click(showToggle);

    expect(
      screen.getByText(/uscis bot submission terms/)
    ).toBeInTheDocument();
  });

  it("auto-scrolls feed container to bottom as new activities arrive while streaming", () => {
    const { rerender } = render(
      <LiveActivityFeed activities={sampleActivities.slice(0, 1)} isStreaming={true} />
    );

    const container = screen.getByTestId("activity-feed-container");
    expect(container).toBeInTheDocument();

    // Mock scrollHeight
    Object.defineProperty(container, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 200, configurable: true });

    rerender(<LiveActivityFeed activities={sampleActivities} isStreaming={true} />);

    expect(container.scrollTop).toBe(container.scrollHeight);
  });

  it("pauses auto-scroll when user scrolls up and shows resume button", () => {
    render(<LiveActivityFeed activities={sampleActivities} isStreaming={true} />);

    const container = screen.getByTestId("activity-feed-container");
    Object.defineProperty(container, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 200, configurable: true });

    // User scrolls up (scrollTop = 100, which is far from 600 - 200 = 400)
    container.scrollTop = 100;
    fireEvent.scroll(container);

    const resumeBtn = screen.getByRole("button", { name: /resume auto-scroll/i });
    expect(resumeBtn).toBeInTheDocument();

    // Clicking resume button re-scrolls to bottom
    fireEvent.click(resumeBtn);
    expect(container.scrollTop).toBe(container.scrollHeight);
    expect(screen.queryByRole("button", { name: /resume auto-scroll/i })).not.toBeInTheDocument();
  });
});
