import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveDot } from "@/components/features/LiveDot";

describe("LiveDot", () => {
  it("renders active live indicator with ping animation by default", () => {
    const { container } = render(<LiveDot />);
    expect(screen.getByText("LIVE STREAM")).toBeInTheDocument();
    expect(screen.getByText("LIVE STREAM")).toHaveClass("text-blue-400");

    const pingDot = container.querySelector(".animate-ping");
    expect(pingDot).toBeInTheDocument();
  });

  it("renders static inactive indicator when isLive is false", () => {
    const { container } = render(<LiveDot isLive={false} label="OFFLINE" />);
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
    expect(screen.getByText("OFFLINE")).toHaveClass("text-zinc-500");

    const pingDot = container.querySelector(".animate-ping");
    expect(pingDot).not.toBeInTheDocument();

    const staticDot = container.querySelector(".bg-zinc-600");
    expect(staticDot).toBeInTheDocument();
  });

  it("supports custom className", () => {
    const { container } = render(<LiveDot className="my-custom-live-dot" />);
    expect(container.firstChild).toHaveClass("my-custom-live-dot");
  });
});
