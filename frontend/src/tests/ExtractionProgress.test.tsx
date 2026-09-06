import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExtractionProgress } from "@/components/features/ExtractionProgress";

describe("ExtractionProgress", () => {
  it("renders stepped checklist for extraction with proposal title", () => {
    render(<ExtractionProgress hasAttachedContext={false} agentMode="auto" />);

    expect(screen.getByText("Deconstructing Proposal...")).toBeInTheDocument();
    expect(screen.getByText("Parsing proposal statement")).toBeInTheDocument();
    expect(
      screen.getByText("Isolating falsifiable, load-bearing assumptions")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Composing adversarial stress-test panel")
    ).toBeInTheDocument();
  });

  it("renders attachment parsing label when hasAttachedContext is true", () => {
    render(<ExtractionProgress hasAttachedContext={true} agentMode="auto" />);

    expect(
      screen.getByText("Parsing proposal & curated attachment")
    ).toBeInTheDocument();
  });

  it("renders custom agent count when in custom agentMode", () => {
    render(
      <ExtractionProgress
        hasAttachedContext={false}
        agentMode="custom"
        selectedAgentsCount={3}
      />
    );

    expect(
      screen.getByText("Configuring 3 selected adversarial evaluators")
    ).toBeInTheDocument();
  });
});
