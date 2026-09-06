import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { CaseProvider } from "@/context/CaseContext";
import * as CaseContextModule from "@/context/CaseContext";
import { INITIAL_STATE } from "@/context/caseReducer";

describe("Screen Components", () => {
  describe("EntryScreen", () => {
    it("renders proposal textarea, sample presets, and submit button", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      expect(screen.getByPlaceholderText(/unlimited free tier/i)).toBeInTheDocument();
      expect(screen.getByText("College Admissions AI Agent")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Test Decision/i })).toBeInTheDocument();
    });

    it("populates textarea when clicking a preset button", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      const edTechPreset = screen.getByText("College Admissions AI Agent");
      fireEvent.click(edTechPreset);

      const textarea = screen.getByPlaceholderText(/unlimited free tier/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain("apply to college");
    });
  });

  describe("ConfirmScreen", () => {
    it("renders null if state.currentCase is null", () => {
      const { container } = render(
        <CaseProvider>
          <ConfirmScreen />
        </CaseProvider>
      );

      // In initial state currentCase is null
      expect(container).toBeEmptyDOMElement();
    });

    it("renders claims to confirm and allows confirmation when currentCase exists", () => {
      const mockConfirm = vi.fn();
      const mockDispatch = vi.fn();

      vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
        state: {
          ...INITIAL_STATE,
          activeScreen: "confirm",
          currentCase: {
            id: "case-confirm-1",
            raw_input: "Launch B2B invoice matching",
            context: "EU enterprise market",
            status: "awaiting_confirmation",
            claims: [
              {
                id: "c-1",
                statement: "Accountants will accept automated reconciliation",
                load_bearing: true,
                status: null,
              },
            ],
            test_plan: [],
            findings: [],
            consequences: [],
          },
        },
        dispatch: mockDispatch,
        confirmAndRun: mockConfirm,
        startExtracting: vi.fn(),
        selectClaim: vi.fn(),
        resetCase: vi.fn(),
        loadPreset: vi.fn(),
        setActiveModal: vi.fn(),
        refreshCurrentCase: vi.fn(),
      });

      render(<ConfirmScreen />);

      expect(screen.getByText(/Launch B2B invoice matching/i)).toBeInTheDocument();
      expect(
        screen.getByText("Accountants will accept automated reconciliation")
      ).toBeInTheDocument();

      const runBtn = screen.getByRole("button", { name: /Confirm & Run Tests/i });
      fireEvent.click(runBtn);
      expect(mockConfirm).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });
});
