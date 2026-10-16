import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CubeSpinner } from "@/components/features/CubeSpinner";

describe("CubeSpinner", () => {
  it("renders default headline/subtext when no props given", () => {
    render(<CubeSpinner />);

    expect(screen.getByText(/Extracting core assumptions/i)).toBeInTheDocument();
    expect(screen.getByText("Deconstructing decision framework")).toBeInTheDocument();
  });

  it("renders custom headline and subtext when provided", () => {
    render(<CubeSpinner headline="Loading agents" subtext="Booting workstation feeds" />);

    expect(screen.getByText(/Loading agents/i)).toBeInTheDocument();
    expect(screen.getByText("Booting workstation feeds")).toBeInTheDocument();
    expect(screen.queryByText(/Extracting core assumptions/i)).not.toBeInTheDocument();
  });
});
