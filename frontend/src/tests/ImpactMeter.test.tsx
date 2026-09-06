import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImpactMeter } from "@/components/features/ImpactMeter";

describe("ImpactMeter", () => {
  it("renders with default props and maps high impact correctly", () => {
    const { container } = render(<ImpactMeter impact="high" />);
    expect(screen.getByText("High Impact")).toBeInTheDocument();

    const activeBars = container.querySelectorAll(".bg-zinc-200");
    expect(activeBars.length).toBe(3);
  });

  it("renders medium impact with 2 active bars", () => {
    const { container } = render(<ImpactMeter impact="medium" />);
    expect(screen.getByText("Medium Impact")).toBeInTheDocument();

    const activeBars = container.querySelectorAll(".bg-zinc-200");
    expect(activeBars.length).toBe(2);

    const inactiveBars = container.querySelectorAll(".bg-zinc-800");
    expect(inactiveBars.length).toBe(1);
  });

  it("renders low impact with 1 active bar", () => {
    const { container } = render(<ImpactMeter impact="low" />);
    expect(screen.getByText("Low Impact")).toBeInTheDocument();

    const activeBars = container.querySelectorAll(".bg-zinc-200");
    expect(activeBars.length).toBe(1);
  });

  it("allows direct score override prop", () => {
    const { container } = render(<ImpactMeter score={2} impact="high" />);
    // score prop takes precedence over impact string
    expect(screen.getByText("Medium Impact")).toBeInTheDocument();
    const activeBars = container.querySelectorAll(".bg-zinc-200");
    expect(activeBars.length).toBe(2);
  });

  it("hides label when showLabel is false", () => {
    render(<ImpactMeter impact="high" showLabel={false} />);
    expect(screen.queryByText("High Impact")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<ImpactMeter className="custom-impact-meter" />);
    expect(container.firstChild).toHaveClass("custom-impact-meter");
  });
});
