import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { FaqDrawer } from "@/components/features/FaqDrawer";
import { Header } from "@/components/layout/Header";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { FAQ_ITEMS } from "@/lib/faqData";

const TestController = () => {
  const { state, setActiveModal } = useCase();
  return (
    <div>
      <button onClick={() => setActiveModal("faq")}>Open FAQ</button>
      <button onClick={() => setActiveModal("none")}>Close Modal</button>
      <span data-testid="active-modal">{state.activeModal}</span>
    </div>
  );
};

describe("FAQ Data & Drawer Component", () => {
  it("contains all 9 compiled FAQ items with questions and answers", () => {
    expect(FAQ_ITEMS).toHaveLength(9);

    const questions = FAQ_ITEMS.map((item) => item.question);
    expect(questions).toContain("What is Crossfire, in one line?");
    expect(questions).toContain("Isn't this just a wrapper around an AI model?");
    expect(questions).toContain("How is this better than just using one AI model directly?");
    expect(questions).toContain("How is this not just an AI assistant or chatbot?");
    expect(questions).toContain("What stops the different tests from just agreeing with each other?");
    expect(questions).toContain("How is this better than someone writing a really good prompt themselves?");
    expect(questions).toContain(
      "How is this different from just using Claude or ChatGPT with search turned on?"
    );
    expect(questions).toContain("How is this different from a research platform, like Perplexity?");
    expect(questions).toContain(
      "How is this different from an AI council, like The AI Council app?"
    );

    // Verify all answers are non-empty strings
    FAQ_ITEMS.forEach((item) => {
      expect(item.answer.length).toBeGreaterThan(20);
      expect(item.category).toBeDefined();
    });
  });

  it("renders as interactive accordion cards and NOT a table element", () => {
    render(
      <CaseProvider>
        <TestController />
        <FaqDrawer />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open FAQ"));

    // Ensure no <table>, <th>, or <td> elements are used
    expect(document.querySelector("table")).toBeNull();
    expect(document.querySelector("th")).toBeNull();
    expect(document.querySelector("td")).toBeNull();

    // Verify FAQ Drawer header exists
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();

    // Verify the first question is open by default
    expect(
      screen.getByText(/It takes a decision you're about to commit to/i)
    ).toBeInTheDocument();
  });

  it("expands and collapses FAQ items when clicked", () => {
    render(
      <CaseProvider>
        <TestController />
        <FaqDrawer />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open FAQ"));

    const wrapperQuestionBtn = screen.getByRole("button", {
      name: /Isn't this just a wrapper around an AI model\?/i,
    });
    expect(wrapperQuestionBtn).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    fireEvent.click(wrapperQuestionBtn);
    expect(wrapperQuestionBtn).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/No\. A wrapper is one prompt in, one answer out\./i)
    ).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(wrapperQuestionBtn);
    expect(wrapperQuestionBtn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(/No\. A wrapper is one prompt in, one answer out\./i)
    ).not.toBeInTheDocument();
  });

  it("filters FAQ items by search keyword", () => {
    render(
      <CaseProvider>
        <TestController />
        <FaqDrawer />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open FAQ"));

    const searchInput = screen.getByPlaceholderText(/Search questions or keywords/i);
    fireEvent.change(searchInput, { target: { value: "Perplexity" } });

    expect(
      screen.getByText(/How is this different from a research platform, like Perplexity\?/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/What is Crossfire, in one line\?/i)
    ).not.toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByLabelText("Clear search");
    fireEvent.click(clearBtn);

    expect(screen.getByText(/What is Crossfire, in one line\?/i)).toBeInTheDocument();
  });

  it("filters FAQ items by category chip", () => {
    render(
      <CaseProvider>
        <TestController />
        <FaqDrawer />
      </CaseProvider>
    );

    fireEvent.click(screen.getByText("Open FAQ"));

    const architectureChip = screen.getByRole("button", { name: "Architecture" });
    fireEvent.click(architectureChip);

    // Architecture category items should be visible
    expect(
      screen.getByText("Isn't this just a wrapper around an AI model?")
    ).toBeInTheDocument();
    expect(
      screen.getByText("What stops the different tests from just agreeing with each other?")
    ).toBeInTheDocument();

    // Items from other categories should not be visible
    expect(screen.queryByText("What is Crossfire, in one line?")).not.toBeInTheDocument();
  });

  it("Header includes an FAQ button that opens the FAQ modal", () => {
    render(
      <CaseProvider>
        <Header />
        <TestController />
      </CaseProvider>
    );

    const faqHeaderBtn = screen.getByLabelText(/View frequently asked questions/i);
    fireEvent.click(faqHeaderBtn);

    expect(screen.getByTestId("active-modal").textContent).toBe("faq");
  });

  it("EntryScreen footer and discovery links trigger opening the FAQ modal", () => {
    render(
      <CaseProvider>
        <EntryScreen />
        <TestController />
      </CaseProvider>
    );

    const faqFooterBtn = screen.getByRole("button", { name: "FAQ" });
    fireEvent.click(faqFooterBtn);

    expect(screen.getByTestId("active-modal").textContent).toBe("faq");
  });
});
