import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { CaseProvider } from "@/context/CaseContext";
import * as CaseContextModule from "@/context/CaseContext";
import * as api from "@/lib/api";
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

    it("handles PDF document upload and displays character count badge", async () => {
      const ingestSpy = vi.spyOn(api, "ingestPdf").mockResolvedValueOnce({
        context: "Extracted strategic memo contents",
        character_count: 1250,
      });

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(["dummy binary pdf"], "memo.pdf", { type: "application/pdf" });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(ingestSpy).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(screen.getByText(/Attached: memo\.pdf \(1,250 chars\)/i)).toBeInTheDocument();
      });

      // Remove attachment
      const removeBtn = screen.getByLabelText("Remove attachment");
      fireEvent.click(removeBtn);
      expect(screen.queryByText(/Attached: memo\.pdf/i)).not.toBeInTheDocument();
    });

    it("displays error alert when PDF ingestion fails", async () => {
      vi.spyOn(api, "ingestPdf").mockRejectedValueOnce(
        new Error("Scanned or image-only PDF detected: no extractable text found. OCR is not supported.")
      );

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["scanned image"], "scanned.pdf", { type: "application/pdf" });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/Scanned or image-only PDF detected/i);
      });
    });

    it("handles image screenshot upload via ingestImage and displays badge", async () => {
      const ingestImageSpy = vi.spyOn(api, "ingestImage").mockResolvedValueOnce({
        context: "Extracted screenshot analytics from chart",
        character_count: 820,
      });

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(["dummy image png bytes"], "dashboard_metrics.png", { type: "image/png" });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(ingestImageSpy).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(screen.getByText(/Attached: Screenshot: dashboard_metrics\.png \(820 chars\)/i)).toBeInTheDocument();
      });

      // Remove attachment
      const removeBtn = screen.getByLabelText("Remove attachment");
      fireEvent.click(removeBtn);
      expect(screen.queryByText(/Attached: Screenshot: dashboard_metrics\.png/i)).not.toBeInTheDocument();
    });

    it("displays error alert when dropped file type is not supported", async () => {
      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      const dropzone = container.querySelector("#dropzone") as HTMLElement;
      expect(dropzone).toBeInTheDocument();

      const invalidFile = new File(["binary"], "program.exe", { type: "application/octet-stream" });
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [invalidFile],
        },
      });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Only PDF documents and image screenshots/i
        );
      });
    });

    it("attaches web URL context when submitted", async () => {
      const ingestSpy = vi.spyOn(api, "ingestUrl").mockResolvedValueOnce({
        context: "Article text from techcrunch",
        character_count: 850,
      });

      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      // Click + Web URL button
      const webUrlToggle = screen.getByText("+ Web URL");
      fireEvent.click(webUrlToggle);

      const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com/i);
      fireEvent.change(urlInput, { target: { value: "https://techcrunch.com/article" } });

      const attachBtn = screen.getByText("Attach URL");
      await act(async () => {
        fireEvent.click(attachBtn);
      });

      expect(ingestSpy).toHaveBeenCalledWith("https://techcrunch.com/article");
      await waitFor(() => {
        expect(screen.getByText(/Attached: techcrunch\.com \(850 chars\)/i)).toBeInTheDocument();
      });
    });

    it("auto-populates URL input when pasting a web URL into textarea", async () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      const textarea = screen.getByPlaceholderText(/unlimited free tier/i);
      fireEvent.paste(textarea, {
        clipboardData: {
          getData: () => "https://nytimes.com/article/tech-analysis",
        },
      });

      expect(screen.getByPlaceholderText(/https:\/\/example\.com/i)).toHaveValue(
        "https://nytimes.com/article/tech-analysis"
      );
      expect(screen.getByText("Attach URL")).toBeInTheDocument();
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
        navigateScreen: vi.fn(),
        setActiveModal: vi.fn(),
        refreshCurrentCase: vi.fn(),
        setDebugMode: vi.fn(),
        enterPreview: vi.fn(),
        setPreviewView: vi.fn(),
        exitPreview: vi.fn(),
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
