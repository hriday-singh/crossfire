import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { Case } from "@/types/crossfire";

const DONE_CASE: Case = {
  id: "case-header-1",
  raw_input: "Test input",
  context: null,
  status: "done",
  claims: [],
  test_plan: [],
  findings: [],
  consequences: [],
};

const LoadCase: React.FC = () => {
  const { state, dispatch } = useCase();
  if (!state.currentCase) dispatch({ type: "LOAD_CASE", payload: DONE_CASE });
  return null;
};

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

  it("disables subsequent tabs when no case is active and does not inject fake data", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    const claimMapBtn = screen.getByRole("button", { name: /02 Claim Map/i });
    const liveRunnerBtn = screen.getByRole("button", { name: /03 Live Runner/i });

    expect(claimMapBtn).toBeDisabled();
    expect(liveRunnerBtn).toBeDisabled();
    expect(screen.queryByRole("button", { name: /04 Audit Sheet/i })).not.toBeInTheDocument();
  });

  it("renders history, faq, and settings buttons in the required order", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    const historyBtn = screen.getByRole("button", { name: /view case history/i });
    const faqBtn = screen.getByRole("button", { name: /view frequently asked questions/i });
    const settingsBtn = screen.getByRole("button", { name: /view settings/i });

    expect(historyBtn).toBeInTheDocument();
    expect(faqBtn).toBeInTheDocument();
    expect(settingsBtn).toBeInTheDocument();

    // Verify ordering in DOM: History before FAQ, FAQ before Settings
    expect(historyBtn.compareDocumentPosition(faqBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(faqBtn.compareDocumentPosition(settingsBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not render v1.4-engine, runner status pill, or profile avatar", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.queryByText("v1.4-engine")).not.toBeInTheDocument();
    expect(screen.queryByText("RUNNER READY")).not.toBeInTheDocument();
    expect(screen.queryByText("RUNNER ACTIVE")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/executive operator profile/i)).not.toBeInTheDocument();
  });

  it("hides the new-case button until a case exists", () => {
    render(
      <CaseProvider>
        <Header />
      </CaseProvider>
    );

    expect(screen.queryByTestId("new-case-btn")).not.toBeInTheDocument();
  });


  it("shows a new-case button once a case is loaded", () => {
    render(
      <CaseProvider>
        <LoadCase />
        <Header />
      </CaseProvider>
    );

    expect(screen.getByTestId("new-case-btn")).toHaveAccessibleName(/start a new case/i);
  });


  it("shows the active engine's model and says so when none is set", () => {
    const SetEngine: React.FC<{ model: string }> = ({ model }) => {
      const { state, dispatch } = useCase();
      if (state.engineInfo?.model !== model)
        dispatch({
          type: "SET_ENGINE_INFO",
          payload: { status: "ok", provider: "custom:box", provider_label: "box", model },
        });
      return null;
    };
    const { rerender } = render(
      <CaseProvider>
        <SetEngine model="qwen2.5-72b" />
        <Header />
      </CaseProvider>
    );

    const badge = screen.getByTestId("engine-badge");
    expect(badge).toHaveTextContent("qwen2.5-72b");
    expect(badge).toHaveAttribute("title", expect.stringContaining("(box)"));
    expect(screen.getByLabelText("Custom endpoint")).toBeInTheDocument();

    rerender(
      <CaseProvider>
        <SetEngine model="" />
        <Header />
      </CaseProvider>
    );
    expect(screen.getByTestId("engine-badge")).toHaveTextContent("No model set");
  });
});
