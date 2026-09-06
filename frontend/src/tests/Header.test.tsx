import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { CaseProvider } from "@/context/CaseContext";

describe("Header", () => {
  it("renders branding and ready status indicator", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.getByText("Crossfire")).toBeInTheDocument();
    expect(screen.getByText("Decision Tester")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders brand button and allows clicking to reset", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    const brandBtn = screen.getByRole("button", { name: /Crossfire Decision Tester/i });
    expect(brandBtn).toBeInTheDocument();
    fireEvent.click(brandBtn);
  });
});
