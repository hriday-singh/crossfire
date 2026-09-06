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
});
