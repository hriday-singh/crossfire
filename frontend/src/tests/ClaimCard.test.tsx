import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaimCard } from "@/components/features/ClaimCard";

describe("ClaimCard", () => {
  it("renders claim statement and load-bearing flag", () => {
    render(
      <ClaimCard
        claim={{
          id: "claim-1",
          statement: "There is no existing competitor solving this well",
          load_bearing: true,
          status: "broken",
        }}
      />
    );

    expect(
      screen.getByText("There is no existing competitor solving this well")
    ).toBeInTheDocument();
    expect(screen.getByText("Broken")).toBeInTheDocument();
    expect(
      screen.getByTitle("Load-bearing assumption — if false, the entire plan fails")
    ).toBeInTheDocument();
  });

  it("handles click to open drawer callback", () => {
    const handleClick = vi.fn();

    render(
      <ClaimCard
        claim={{
          id: "claim-2",
          statement: "Another test claim",
          load_bearing: false,
          status: "survived",
        }}
        onClick={handleClick}
      />
    );

    const card = screen.getByText("Another test claim").closest('div[role="button"]');
    expect(card).toBeInTheDocument();
    if (card) {
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    }
  });
});
