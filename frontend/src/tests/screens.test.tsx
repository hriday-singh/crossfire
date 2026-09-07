import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { ConfirmScreen } from "@/components/screens/ConfirmScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";
import { CaseProvider } from "@/context/CaseContext";
import * as CaseContextModule from "@/context/CaseContext";
import * as api from "@/lib/api";
import { INITIAL_STATE } from "@/context/caseReducer";

describe("Screen Components", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe("EntryScreen", () => {
    it("renders proposal textarea, sample presets, and submit button", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      expect(
        screen.getByPlaceholderText(/customer support to a fine tuned LLM/i),
      ).toBeInTheDocument();
      const submitBtn = screen.getByRole("button", { name: /Test Decision/i });
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toHaveClass(
        "bg-primary-container",
        "text-on-primary-container",
      );
      expect(screen.getByText("(Optional)")).toBeInTheDocument();
    });

    it("populates textarea when clicking a preset button", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const edTechPreset = screen.getByText("College Admissions AI Agent");
      fireEvent.click(edTechPreset);

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      ) as HTMLTextAreaElement;
      expect(textarea.value).toContain("apply to college");
    });

    it("populates textarea when clicking the AI code review PR gate preset", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const codeReviewPreset = screen.getByText("AI code review gating PRs");
      fireEvent.click(codeReviewPreset);

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe(
        "Require automated LLM code reviews to block pull requests before human review.",
      );
    });

    it("renders simplified header without Decision Proposal kicker or subtitle", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      expect(
        screen.getByRole("heading", {
          name: /What decision are you testing\?/i,
        }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Decision Proposal")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Describe your proposal or strategic assumption/i),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Grounded by SerpAPI")).toBeInTheDocument();
      expect(
        screen.queryByText("Real-time Web Grounding"),
      ).not.toBeInTheDocument();
    });

    it("handles PDF document upload and displays attachment pill", async () => {
      const ingestSpy = vi.spyOn(api, "ingestPdf").mockResolvedValueOnce({
        context: "Extracted strategic memo contents",
        character_count: 1250,
      });

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(["dummy binary pdf"], "memo.pdf", {
        type: "application/pdf",
      });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(ingestSpy).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(screen.getByText("memo.pdf")).toBeInTheDocument();
      });

      // Remove attachment
      const removeBtn = screen.getByLabelText(/Remove attachment memo\.pdf/i);
      fireEvent.click(removeBtn);
      expect(screen.queryByText("memo.pdf")).not.toBeInTheDocument();
    });

    it("displays error alert when PDF ingestion fails", async () => {
      vi.spyOn(api, "ingestPdf").mockRejectedValueOnce(
        new Error(
          "Scanned or image-only PDF detected: no extractable text found. OCR is not supported.",
        ),
      );

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["scanned image"], "scanned.pdf", {
        type: "application/pdf",
      });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Unable to read text from "scanned\.pdf"/i,
        );
      });
    });

    it("handles image screenshot upload via ingestImage and displays pill", async () => {
      const ingestImageSpy = vi
        .spyOn(api, "ingestImage")
        .mockResolvedValueOnce({
          context: "Extracted screenshot analytics from chart",
          character_count: 820,
        });

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(
        ["dummy image png bytes"],
        "dashboard_metrics.png",
        { type: "image/png" },
      );
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(ingestImageSpy).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(
          screen.getByText(/Screenshot: dashboard_metrics\.png/i),
        ).toBeInTheDocument();
      });

      // Remove attachment
      const removeBtn = screen.getByLabelText(
        /Remove attachment Screenshot: dashboard_metrics\.png/i,
      );
      fireEvent.click(removeBtn);
      expect(
        screen.queryByText(/Screenshot: dashboard_metrics\.png/i),
      ).not.toBeInTheDocument();
    });

    it("handles Markdown file upload via ingestMarkdown and displays pill", async () => {
      const ingestMdSpy = vi
        .spyOn(api, "ingestMarkdown")
        .mockResolvedValueOnce({
          context: "Extracted strategy notes from PRD markdown file",
          character_count: 540,
        });

      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(
        ["# Product Spec\n\nGoal: Scale auth service"],
        "spec.md",
        { type: "text/markdown" },
      );
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(ingestMdSpy).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(screen.getByText(/Notes: spec\.md/i)).toBeInTheDocument();
      });

      // Remove attachment
      const removeBtn = screen.getByLabelText(
        /Remove attachment Notes: spec\.md/i,
      );
      fireEvent.click(removeBtn);
      expect(screen.queryByText(/Notes: spec\.md/i)).not.toBeInTheDocument();
    });

    it("displays error alert when dropped file type is not supported", async () => {
      const { container } = render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const dropzone = container.querySelector("#dropzone") as HTMLElement;
      expect(dropzone).toBeInTheDocument();

      const invalidFile = new File(["binary"], "program.exe", {
        type: "application/octet-stream",
      });
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [invalidFile],
        },
      });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Supported formats: PDF documents, screenshots\/images, or text files/i,
        );
      });
    });

    it("adds URL attachment instantly without network ingestion when submitted via URL input", async () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      // Click + Web URL button
      const webUrlToggle = screen.getByText("+ Web URL");
      fireEvent.click(webUrlToggle);

      const urlInput = screen.getByPlaceholderText(/example\.com/i);
      fireEvent.change(urlInput, {
        target: { value: "https://techcrunch.com/article" },
      });

      const attachBtn = screen.getByText("Attach URL");
      await act(async () => {
        fireEvent.click(attachBtn);
      });

      // URL should be added as attachment pill instantly without calling ingestUrl
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(screen.getByText("techcrunch.com")).toBeInTheDocument();
      });
    });

    it("adds URL as attachment pill when pasting a web URL into textarea", async () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );
      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: {
            getData: () => "https://nytimes.com/article/tech-analysis",
          },
        });
      });

      // URL should be added as an attachment pill
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(screen.getByText("nytimes.com")).toBeInTheDocument();
      });
    });

    it("extracts and adds web URL as attachment when typed with delimiter", async () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // Type proposal containing a web URL followed by space
      await act(async () => {
        fireEvent.change(textarea, {
          target: {
            value:
              "We should adopt this strategy: https://techcrunch.com/article/plg ",
          },
        });
      });

      // Verify the URL was separated out from the proposal text
      expect(textarea).toHaveValue("We should adopt this strategy:");

      // Verify URL was added as attachment pill (no ingestUrl call)
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(screen.getByText("techcrunch.com")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
          /Web URL techcrunch\.com/i,
        );
      });
    });

    it("does not inject synthetic analyzing text when only a web URL is typed", async () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // Type standalone web URL followed by space
      await act(async () => {
        fireEvent.change(textarea, {
          target: { value: "https://github.com/fastapi/fastapi " },
        });
      });

      // Verify no synthetic analyzing text was injected
      expect(textarea).toHaveValue("");

      // Verify URL was added as attachment pill
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(screen.getByText("github.com")).toBeInTheDocument();
      });
    });

    it("attaches full copied text into a context block when pasting text exceeding 500 characters", async () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // Paste text that exceeds 500 characters
      const longText =
        "Strategic memo detailing enterprise adoption trends. ".repeat(20);
      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: {
            getData: () => longText,
          },
        });
      });

      // Verify proposal input receives first 500 characters
      expect((textarea as HTMLTextAreaElement).value).toBe(
        longText.slice(0, 500),
      );

      // Verify the ENTIRE pasted text became a context block attachment
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /^Context Block #1$/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
          /First 500 characters placed in proposal.*attached as context block/i,
        );
      });
    });

    it("disables run test button when textarea has 0 to 5 characters and no attachments", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const runBtn = screen.getByRole("button", { name: /Test Decision/i });
      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // Initially empty (0 characters)
      expect(runBtn).toBeDisabled();

      // 3 characters
      fireEvent.change(textarea, { target: { value: "abc" } });
      expect(runBtn).toBeDisabled();

      // Exactly 5 characters
      fireEvent.change(textarea, { target: { value: "abcde" } });
      expect(runBtn).toBeDisabled();

      // 5 characters with whitespace padding
      fireEvent.change(textarea, { target: { value: "   hi   " } });
      expect(runBtn).toBeDisabled();
    });

    it("enables run test button when textarea has more than 5 characters", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const runBtn = screen.getByRole("button", { name: /Test Decision/i });
      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // 6 characters
      fireEvent.change(textarea, { target: { value: "abcdef" } });
      expect(runBtn).not.toBeDisabled();

      // Valid proposal
      fireEvent.change(textarea, {
        target: { value: "We should pivot to enterprise sales" },
      });
      expect(runBtn).not.toBeDisabled();
    });

    it("displays character count without '/ 500' both when empty and when populated", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // Initially empty: should say "0 characters", NOT "0 / 500 characters"
      expect(screen.getByText("0 characters")).toBeInTheDocument();
      expect(screen.queryByText(/500/)).not.toBeInTheDocument();

      // When text is typed: shows length without / 500
      fireEvent.change(textarea, { target: { value: "Pivot to B2B SaaS" } });
      expect(screen.getByText("17 characters")).toBeInTheDocument();
      expect(screen.queryByText(/500/)).not.toBeInTheDocument();
    });

    it("enables run test button when a content block is attached even if textarea is empty", async () => {
      const createCaseSpy = vi.spyOn(api, "createCase").mockResolvedValueOnce({
        id: "case-blob-test",
        raw_input: "Attached proposal document",
        context: null,
        status: "awaiting_confirmation",
        claims: [],
        test_plan: [],
        findings: [],
        consequences: [],
      });

      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>,
      );

      const runBtn = screen.getByRole("button", { name: /Test Decision/i });
      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      );

      // Initially empty -> disabled
      expect(runBtn).toBeDisabled();

      // Paste a large text block exceeding 500 characters
      const largeDoc =
        "Quarterly business review proposing automated sales. ".repeat(20);
      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: { getData: () => largeDoc },
        });
      });

      // Clear the textarea to verify the button is enabled even when textarea is empty
      fireEvent.change(textarea, { target: { value: "" } });
      expect((textarea as HTMLTextAreaElement).value).toBe("");

      // Content block pill is present
      await waitFor(() => {
        expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
      });

      // Button should now be ENABLED despite empty textarea
      expect(runBtn).not.toBeDisabled();

      // Submitting should invoke createCase with fallback text and the context
      await act(async () => {
        fireEvent.click(runBtn);
      });

      expect(createCaseSpy).toHaveBeenCalled();
    });

    it("loads draftPrompt into textarea when provided in context", () => {
      vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
        state: {
          ...INITIAL_STATE,
          draftPrompt: "Draft prompt from Steel Man fix",
        },
        dispatch: vi.fn(),
        loadPromptIntoEntry: vi.fn(),
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
        toggleAgentSelection: vi.fn(),
        setAgentMode: vi.fn(),
        setSelectedAgents: vi.fn(),
        selectModel: vi.fn(),
        cancelExtraction: vi.fn(),
        confirmAndRun: vi.fn(),
      });

      render(<EntryScreen />);

      const textarea = screen.getByPlaceholderText(
        /customer support to a fine tuned LLM/i,
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe("Draft prompt from Steel Man fix");
      expect(
        screen.getByText(/Improved prompt loaded with Steel Man solutions applied/i)
      ).toBeInTheDocument();

      vi.restoreAllMocks();
    });
  });

  describe("ConfirmScreen", () => {
    it("renders null if state.currentCase is null", () => {
      const { container } = render(
        <CaseProvider>
          <ConfirmScreen />
        </CaseProvider>,
      );

      // In initial state currentCase is null
      expect(container).toBeEmptyDOMElement();
    });

    it("renders claims to confirm and allows confirmation when currentCase exists", () => {
      const mockConfirm = vi.fn();
      const mockDispatch = vi.fn();

      const useCaseSpy = vi
        .spyOn(CaseContextModule, "useCase")
        .mockReturnValue({
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
          toggleAgentSelection: vi.fn(),
          setAgentMode: vi.fn(),
          setSelectedAgents: vi.fn(),
          selectModel: vi.fn(),
        cancelExtraction: vi.fn(),
        loadPromptIntoEntry: vi.fn(),
        });

      render(<ConfirmScreen />);

      expect(
        screen.getByText(/Launch B2B invoice matching/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Accountants will accept automated reconciliation"),
      ).toBeInTheDocument();

      const addBtn = screen.getByRole("button", { name: /Add an assumption/i });
      const agentsSection = screen.getByTestId("assigned-agents-panel");
      expect(addBtn).toBeInTheDocument();
      expect(agentsSection).toBeInTheDocument();
      expect(
        Boolean(
          addBtn.compareDocumentPosition(agentsSection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ).toBe(true);

      const runBtn = screen.getByRole("button", {
        name: /Confirm & Run Tests/i,
      });
      fireEvent.click(runBtn);
      expect(mockConfirm).toHaveBeenCalledTimes(1);

      useCaseSpy.mockRestore();
    });
  });

  describe("DashboardScreen", () => {
    it("renders null if state.currentCase is null", () => {
      const { container } = render(
        <CaseProvider>
          <DashboardScreen />
        </CaseProvider>,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("automatically scrolls window to top when mounted in testing mode so live intelligence is visible", () => {
      const scrollToSpy = vi.spyOn(window, "scrollTo");

      vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
        state: {
          ...INITIAL_STATE,
          activeScreen: "runner",
          isStreaming: true,
          currentCase: {
            id: "case-dashboard-scroll",
            raw_input: "Launch B2B invoice matching",
            context: "EU enterprise market",
            status: "testing",
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
        dispatch: vi.fn(),
        confirmAndRun: vi.fn(),
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
        toggleAgentSelection: vi.fn(),
        setAgentMode: vi.fn(),
        setSelectedAgents: vi.fn(),
        selectModel: vi.fn(),
        cancelExtraction: vi.fn(),
        loadPromptIntoEntry: vi.fn(),
      });

      render(<DashboardScreen />);

      expect(scrollToSpy).toHaveBeenCalledWith(
        expect.objectContaining({ top: 0 }),
      );

      vi.restoreAllMocks();
    });

    it("renders interactive Sorted by dropdown menu and reorders claims on selection", async () => {
      const mockCase = {
        id: "case-sort-test",
        raw_input: "Launch automated invoice verification",
        context: null,
        status: "done" as const,
        claims: [
          {
            id: "c-survived",
            statement: "Passed claim that held up",
            load_bearing: false,
            status: "survived" as const,
          },
          {
            id: "c-broken",
            statement: "Refuted claim that failed",
            load_bearing: false,
            status: "broken" as const,
          },
          {
            id: "c-critical",
            statement: "Load bearing claim that is critical",
            load_bearing: true,
            status: "survived" as const,
          },
        ],
        test_plan: [],
        findings: [],
        consequences: [],
      };

      vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
        state: {
          ...INITIAL_STATE,
          activeScreen: "dashboard",
          currentCase: mockCase,
        },
        dispatch: vi.fn(),
        confirmAndRun: vi.fn(),
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
        toggleAgentSelection: vi.fn(),
        setAgentMode: vi.fn(),
        setSelectedAgents: vi.fn(),
        selectModel: vi.fn(),
        cancelExtraction: vi.fn(),
        loadPromptIntoEntry: vi.fn(),
      });

      render(<DashboardScreen />);

      // Switch to Full Audit Trail tab to access claims table and sorting
      const auditTabBtn = screen.getByRole("button", { name: /Full Audit Trail/i });
      fireEvent.click(auditTabBtn);

      // Expand all claims if collapsed
      const expandClaimsBtn = screen.queryByRole("button", {
        name: /all 3 claims/i,
      });
      if (expandClaimsBtn) {
        fireEvent.click(expandClaimsBtn);
      }

      // Sort dropdown trigger exists and is interactive (not static text)
      const sortTrigger = screen.getByRole("button", { name: /sort claims/i });
      expect(sortTrigger).toBeInTheDocument();
      expect(sortTrigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByText("Criticality")).toBeInTheDocument();

      // Open sort menu
      fireEvent.click(sortTrigger);
      expect(sortTrigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Select "Outcome Severity"
      const severityOption = screen.getByRole("menuitem", {
        name: /outcome severity/i,
      });
      fireEvent.click(severityOption);

      // Verify dropdown closed and value updated
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(sortTrigger).toHaveTextContent("Outcome Severity");

      // Verify reordering: In Outcome Severity, broken (c-broken) comes before survived (c-survived & c-critical)
      const claimCards = screen.getAllByText(/claim that/i);
      expect(claimCards[0]).toHaveTextContent("Refuted claim that failed");

      // Now switch to "Held Up First"
      fireEvent.click(sortTrigger);
      const passedFirstOption = screen.getByRole("menuitem", {
        name: /held up first/i,
      });
      fireEvent.click(passedFirstOption);

      expect(sortTrigger).toHaveTextContent("Held Up First");
      const reorderedCards = screen.getAllByText(/claim that/i);
      expect(reorderedCards[0]).toHaveTextContent("Passed claim that held up");

      vi.restoreAllMocks();
    });

    it("renders PromptFixerWorkbench when failed claims have salvage and handles put into starting screen", () => {
      const mockLoadPromptIntoEntry = vi.fn();
      const caseWithSalvage = {
        id: "case-fix-test",
        raw_input: "We will charge $50 without free trial.",
        context: null,
        status: "done" as const,
        claims: [
          {
            id: "c-salvage-1",
            statement: "We will charge $50 without free trial",
            load_bearing: true,
            status: "broken" as const,
            salvaged_claim: "Charge $29 with 14-day trial",
          },
        ],
        test_plan: [],
        findings: [],
        consequences: [
          {
            claim_id: "c-salvage-1",
            impact: "fatal",
            recommended_change: "Add trial",
            next_validation: "User tests",
            salvaged_claim: "Charge $29 with 14-day trial",
            verdict_reasoning: "Test reasoning",
          },
        ],
      };

      vi.spyOn(CaseContextModule, "useCase").mockReturnValue({
        state: {
          ...INITIAL_STATE,
          activeScreen: "dashboard",
          currentCase: caseWithSalvage,
        },
        dispatch: vi.fn(),
        loadPromptIntoEntry: mockLoadPromptIntoEntry,
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
        toggleAgentSelection: vi.fn(),
        setAgentMode: vi.fn(),
        setSelectedAgents: vi.fn(),
        selectModel: vi.fn(),
        cancelExtraction: vi.fn(),
        confirmAndRun: vi.fn(),
      });

      render(<DashboardScreen />);

      // Verify PromptFixerWorkbench is rendered
      expect(
        screen.getByText(/Revise Proposal/i)
      ).toBeInTheDocument();
      expect(
        screen.getAllByText("We will charge $50 without free trial").length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(/Charge \$29 with 14-day trial/i).length
      ).toBeGreaterThanOrEqual(1);

      // Click "Test Revised Proposal"
      const putIntoEntryBtn = screen.getByRole("button", {
        name: /Test Revised Proposal/i,
      });
      fireEvent.click(putIntoEntryBtn);

      expect(mockLoadPromptIntoEntry).toHaveBeenCalledWith(
        "Charge $29 with 14-day trial."
      );

      vi.restoreAllMocks();
    });
  });
});
