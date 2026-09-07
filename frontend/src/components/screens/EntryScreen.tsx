import React, { useState, useEffect, useRef } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { ingestImage, ingestMarkdown, ingestPdf } from "@/lib/api";
import { AgentSelectorPanel } from "@/components/features/AgentSelectorPanel";
import { DEFAULT_AGENT_IDS } from "@/lib/agents";
import {
  AttachmentBar,
  EntryAttachment,
} from "@/components/features/AttachmentBar";
import { EntryPresetsBar } from "@/components/features/EntryPresetsBar";
import { EntryDropzoneBar } from "@/components/features/EntryDropzoneBar";
import { EntryFooter } from "@/components/features/EntryFooter";
import { CubeSpinner } from "@/components/features/CubeSpinner";
import {
  detectWebUrl,
  extractAllWebUrls,
  normalizeWebUrl,
  DetectedWebUrl,
} from "@/lib/urlUtils";
import { SerpApiIcon } from "@/components/ui/serpapi";

const MAX_PROPOSAL_CHARS = 500;

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
};

const isMarkdownFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return [".md", ".markdown", ".txt", ".text"].includes(ext);
};

export const EntryScreen: React.FC = () => {
  const { state, startExtracting, setActiveModal } = useCase();
  const [rawInput, setRawInput] = useState(state.currentCase?.raw_input || "");
  const [attachments, setAttachments] = useState<EntryAttachment[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [smartNotice, setSmartNotice] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<"auto" | "custom">(state.currentCase?.agent_mode || "auto");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    state.currentCase?.selected_agents || [...DEFAULT_AGENT_IDS]
  );
  const [isAgentPanelExpanded, setIsAgentPanelExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleAgentModeChange = (mode: "auto" | "custom") => {
    setAgentMode(mode);
    if (mode === "auto") {
      setSelectedAgents([...DEFAULT_AGENT_IDS]);
    }
  };

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  };

  const isMac =
    typeof window !== "undefined" &&
    (navigator.platform?.includes("Mac") ||
      navigator.userAgent.includes("Mac"));

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(130, textareaRef.current.scrollHeight)}px`;
    }
  }, [rawInput]);

  const addUrlAttachment = (cleanUrl: string, hostname: string) => {
    const id = `url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setAttachments((prev) => {
      // Avoid duplicate URLs
      if (prev.some((a) => a.url === cleanUrl)) return prev;
      return [
        ...prev,
        {
          id,
          type: "url",
          name: hostname,
          url: cleanUrl,
        },
      ];
    });
  };

  const autoAddDetectedUrl = (detected: DetectedWebUrl) => {
    addUrlAttachment(detected.cleanUrl, detected.hostname);
    setRawInput(detected.remainingText);
    setSmartNotice(
      `Web URL ${detected.hostname} detected & added to attachments.`,
    );
  };

  const handleTextChange = (value: string) => {
    // When input exceeds 500 characters:
    if (value.length > MAX_PROPOSAL_CHARS) {
      const insertedCount = value.length - rawInput.length;
      // Bulk insert/paste via context menu, drag-and-drop, or input change:
      if (insertedCount > 5) {
        setRawInput(value.slice(0, MAX_PROPOSAL_CHARS));
        const blobCount =
          attachments.filter((a) => a.type === "text_blob").length + 1;
        const newBlob: EntryAttachment = {
          id: `blob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: "text_blob",
          name: `Context Block #${blobCount}`,
          context: value,
          charCount: value.length,
        };
        setAttachments((prev) => [...prev, newBlob]);
        setSmartNotice(
          `First 500 characters placed in proposal. Full document (${value.length.toLocaleString()} chars) attached as context block.`,
        );
        return;
      }

      // User typing individual keystrokes past 500: cap at 500 without creating snippets
      setRawInput(value.slice(0, MAX_PROPOSAL_CHARS));
      return;
    }

    setRawInput(value);

    // When the user finishes typing a URL with a delimiter (space, comma, semicolon, newline)
    if (/[\s,;]$/.test(value)) {
      const detected = detectWebUrl(value);
      if (detected) {
        autoAddDetectedUrl(detected);
      }
    }
  };

  // Debounced detection when user pauses typing after entering a URL
  useEffect(() => {
    if (!rawInput.trim()) return;

    const timer = setTimeout(() => {
      const detected = detectWebUrl(rawInput);
      if (detected && (!detected.remainingText || /[\s,;]/.test(rawInput))) {
        autoAddDetectedUrl(detected);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [rawInput]);

  const handleBlur = () => {
    if (!rawInput.trim()) return;
    const detected = detectWebUrl(rawInput);
    if (detected) {
      autoAddDetectedUrl(detected);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;

    // 1. Large text (> 500 characters or total combined > 500 characters):
    // Full document MUST go inside the context block, and first 500 characters populate the proposal.
    // This MUST run BEFORE URL extraction so large multi-page documents containing links are NOT shredded.
    if (
      pasted.length > MAX_PROPOSAL_CHARS ||
      rawInput.length + pasted.length > MAX_PROPOSAL_CHARS
    ) {
      e.preventDefault();
      const combined = rawInput ? `${rawInput}\n\n${pasted}`.trim() : pasted;
      setRawInput(combined.slice(0, MAX_PROPOSAL_CHARS));

      const blobCount =
        attachments.filter((a) => a.type === "text_blob").length + 1;
      const newBlob: EntryAttachment = {
        id: `blob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "text_blob",
        name: `Context Block #${blobCount}`,
        context: combined,
        charCount: combined.length,
      };
      setAttachments((prev) => [...prev, newBlob]);
      setSmartNotice(
        `First 500 characters placed in proposal. Full document (${combined.length.toLocaleString()} chars) attached as context block.`,
      );
      return;
    }

    // 2. Short text (<= 500 characters): Check if it contains web URLs
    const detectedMulti = extractAllWebUrls(pasted);
    if (detectedMulti.urls.length > 0) {
      e.preventDefault();
      detectedMulti.urls.forEach((u) =>
        addUrlAttachment(u.cleanUrl, u.hostname),
      );

      const remaining = detectedMulti.remainingText;
      if (remaining) {
        setRawInput((prev) =>
          prev ? `${prev} ${remaining}`.trim() : remaining,
        );
      }
      setSmartNotice(
        detectedMulti.urls.length === 1
          ? `Web URL ${detectedMulti.urls[0].hostname} added to attachments.`
          : `${detectedMulti.urls.length} Web URLs added to attachments.`,
      );
      return;
    }
  };

  const hasContentBlock = attachments.length > 0;
  const hasValidInput = hasContentBlock || rawInput.trim().length > 5;
  const isCustomAgentsEmpty =
    agentMode === "custom" && selectedAgents.length === 0;
  const canRunTest =
    hasValidInput &&
    !state.isExtracting &&
    !isIngesting &&
    !isCustomAgentsEmpty;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canRunTest) {
        handleSubmit();
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      const detected = detectWebUrl(rawInput);
      if (detected) {
        e.preventDefault();
        autoAddDetectedUrl(detected);
      }
    }
  };

  const handleManualUrlSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = urlInputValue.trim();
    if (!target) return;

    const normalized = normalizeWebUrl(target);
    if (!normalized) {
      setIngestError(
        "Please enter a valid web URL (e.g. example.com or https://example.com)",
      );
      return;
    }

    let hostname = normalized;
    try {
      hostname = new URL(normalized).hostname;
    } catch {
      // fallback
    }

    addUrlAttachment(normalized, hostname);
    setUrlInputValue("");
    setShowUrlInput(false);
    setIngestError(null);
  };

  const processFile = async (file: File) => {
    setIngestError(null);
    setIsIngesting(true);

    try {
      const isImage = isImageFile(file.name);
      const isMd = isMarkdownFile(file.name);
      let res;
      let label = file.name;
      if (isImage) {
        res = await ingestImage(file);
        label = `Screenshot: ${file.name}`;
      } else if (isMd) {
        res = await ingestMarkdown(file);
        label = `Notes: ${file.name}`;
      } else {
        res = await ingestPdf(file);
      }
      const newFileAttachment: EntryAttachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "file",
        name: label,
        context: res.context,
        charCount: res.character_count,
      };
      setAttachments((prev) => [...prev, newFileAttachment]);

      // 500-character get: If proposal input is empty, prefill first 500 characters of extracted context
      if (!rawInput.trim() && res.context) {
        const snippet = res.context.slice(0, MAX_PROPOSAL_CHARS).trim();
        if (snippet) {
          setRawInput(snippet);
        }
      }
    } catch (err: unknown) {
      const rawMsg = (err as { message?: string })?.message || "";
      const lower = rawMsg.toLowerCase();
      if (
        lower.includes("could not parse") ||
        lower.includes("failed to extract") ||
        lower.includes("empty") ||
        lower.includes("no extractable text") ||
        lower.includes("invalid") ||
        lower.includes("syntaxerror")
      ) {
        setIngestError(
          `Unable to read text from "${file.name}". You can paste the text directly into the proposal box.`,
        );
      } else {
        setIngestError(
          rawMsg ||
            `Unable to process "${file.name}". Please check the file or paste its content directly.`,
        );
      }
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const allowed = [
      ".pdf",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".md",
      ".markdown",
      ".txt",
      ".text",
    ];
    if (!allowed.includes(ext)) {
      setIngestError(
        "Supported formats: PDF documents, screenshots/images, or text files (.txt, .md). You can also paste text directly.",
      );
      return;
    }

    await processFile(file);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canRunTest) {
      return;
    }

    const agentsPayload = agentMode === "custom" ? selectedAgents : undefined;

    // Build structured context from all attached references
    const contextSections: string[] = [];

    const urlItems = attachments.filter((a) => a.type === "url");
    if (urlItems.length > 0) {
      contextSections.push(
        `Reference URLs for verification:\n${urlItems.map((u) => `- ${u.url || u.name}`).join("\n")}`,
      );
    }

    const textBlobs = attachments.filter(
      (a) => a.type === "text_blob" && a.context,
    );
    if (textBlobs.length > 0) {
      contextSections.push(
        `Supporting Context Blobs:\n${textBlobs.map((b, i) => `[Context #${i + 1}]\n${b.context}`).join("\n\n")}`,
      );
    }

    const fileItems = attachments.filter((a) => a.type === "file" && a.context);
    if (fileItems.length > 0) {
      contextSections.push(
        `Attached Documents / OCR Transcripts:\n${fileItems.map((f) => `[${f.name}]\n${f.context}`).join("\n\n")}`,
      );
    }

    const combinedContext =
      contextSections.length > 0 ? contextSections.join("\n\n---\n\n") : null;

    // Fallback when submitting with a content block but empty textarea
    const fallbackInput =
      attachments
        .find((a) => a.context)
        ?.context?.slice(0, 300)
        .trim() ||
      attachments[0]?.name ||
      "Attached proposal document";
    const effectiveRawInput = rawInput.trim() || fallbackInput;

    startExtracting(
      effectiveRawInput,
      combinedContext,
      agentMode,
      agentsPayload,
    );
  };

  if (state.isExtracting) {
    return (
      <div className="flex flex-col w-full items-center justify-center py-24 px-space-4">
        <CubeSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] justify-between">
      <div className="flex-1 flex flex-col items-center justify-center py-space-6 px-space-4 w-full my-auto">
        {/* Subtle Ambient Glow */}
        <div className="relative w-full max-w-[640px]">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-40 bg-gradient-to-b from-primary-container/10 via-primary-container/5 to-transparent blur-3xl pointer-events-none -z-10" />

          {/* Header Module */}
          <div className="flex flex-col items-center text-center mb-space-5">
            <h1 className="font-headline-lg text-2xl sm:text-3xl md:text-[34px] font-bold text-on-surface tracking-tight leading-tight">
              What decision are you testing?
            </h1>
          </div>

          {/* Form Container */}
          <form
            onSubmit={handleSubmit}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative flex flex-col w-full bg-surface-container-low rounded-xl p-space-4 shadow-xl border border-outline-variant/40"
          >
            {isDragging && (
              <div className="absolute inset-0 bg-surface-container/90 border-2 border-dashed border-primary-container rounded-xl flex flex-col items-center justify-center z-20 pointer-events-none backdrop-blur-xs">
                <span className="material-symbols-outlined text-[36px] text-primary-container animate-bounce">
                  upload_file
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-2">
                  Drop PDF or Screenshot to attach
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Crossfire will extract context and link it to your proposal
                </span>
              </div>
            )}

            {/* Textarea Workspace */}
            <div className="relative w-full">
              <label className="sr-only" htmlFor="proposal-input">
                Decision proposal statement
              </label>
              <textarea
                ref={textareaRef}
                id="proposal-input"
                value={rawInput}
                onChange={(e) => handleTextChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="e.g., Shift 100% of our customer support to a fine tuned LLM to cut costs or Replace our entire QA engineering team with automated test-generation agents."
                rows={4}
                autoFocus
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-md text-body-md rounded-lg p-space-4 resize-none transition-all outline-none focus:bg-surface-container-low min-h-[130px] leading-relaxed border border-transparent focus:border-outline-variant"
              />
              {/* Character Limit Counter */}
              <div className="absolute bottom-3 right-3 flex items-center gap-space-2 pointer-events-none">
                <span className="font-code-sm text-code-sm text-outline px-space-1.5 py-0.5">
                  {rawInput.length} characters
                </span>
              </div>
            </div>

            {/* Smart Notice */}
            {smartNotice && (
              <div
                role="status"
                className="mt-space-2 px-space-3 py-space-1.5 rounded bg-primary-container/15 border border-primary-container/30 text-primary font-body-sm text-xs flex items-center justify-between animate-in fade-in-50"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                    auto_awesome
                  </span>
                  <span className="truncate">{smartNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSmartNotice(null)}
                  className="text-outline hover:text-on-surface p-0.5 rounded cursor-pointer shrink-0 transition-colors"
                  aria-label="Dismiss notice"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.md,.markdown"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Ingestion Error Alert */}
            {ingestError && (
              <div
                role="alert"
                className="mt-space-3 bg-error-container/30 border border-error/50 rounded-lg p-space-3 flex items-center justify-between text-error"
              >
                <div className="flex items-center gap-space-2 min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-error shrink-0">
                    error
                  </span>
                  <span className="font-body-sm text-body-sm truncate">
                    {ingestError}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIngestError(null)}
                  className="text-error hover:text-on-surface p-1 rounded transition-colors cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              </div>
            )}

            {/* Ingestion In Progress */}
            {isIngesting && (
              <div className="mt-space-3 bg-surface-container rounded-lg p-space-3 flex items-center justify-between">
                <div className="flex items-center gap-space-2 text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-primary-container animate-spin">
                    progress_activity
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface">
                    Extracting document context...
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-outline">
                  Processing
                </span>
              </div>
            )}

            {/* Compact Multi-Attachment Pills Bar (1, 2, +1, +2...) */}
            <AttachmentBar
              attachments={attachments}
              onRemoveAttachment={handleRemoveAttachment}
            />

            {/* Always Available Dropzone & URL Trigger (Never Locks) */}
            <EntryDropzoneBar
              isDragging={isDragging}
              showUrlInput={showUrlInput}
              urlInputValue={urlInputValue}
              onDropzoneClick={handleDropzoneClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onToggleUrlInput={() => setShowUrlInput(!showUrlInput)}
              onUrlInputChange={setUrlInputValue}
              onUrlSubmit={handleManualUrlSubmit}
            />

            {/* Agent Suite Selection Panel (Auto vs Custom) */}
            <AgentSelectorPanel
              agentMode={agentMode}
              onAgentModeChange={handleAgentModeChange}
              selectedAgents={selectedAgents}
              onToggleAgent={handleToggleAgent}
              isExpanded={isAgentPanelExpanded}
              onToggleExpand={() => setIsAgentPanelExpanded((prev) => !prev)}
            />

            {/* Action Row */}
            <div className="mt-space-4 pt-space-3 flex items-center justify-between">
              <div className="flex items-center gap-space-3 flex-wrap">
                {/* Keyboard Shortcut Hint */}
                <div className="flex items-center gap-space-1.5 text-outline font-code-sm text-code-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    {isMac ? "keyboard_command_key" : "keyboard"}
                  </span>
                  <span>Press</span>
                  <kbd className="px-space-1.5 py-0.5 bg-surface-container font-code-sm text-code-sm text-on-surface rounded">
                    {isMac ? "⌘" : "Ctrl"}
                  </kbd>
                  <span>+</span>
                  <kbd className="px-space-1.5 py-0.5 bg-surface-container font-code-sm text-code-sm text-on-surface rounded">
                    Enter
                  </kbd>
                  <span>to analyze</span>
                </div>
                <span className="text-outline-variant hidden md:inline">·</span>
                <a
                  href="https://serpapi.com?utm_source=crossfire&utm_medium=entry_grounding"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-1.5 text-outline hover:text-primary transition-colors font-code-sm text-xs group cursor-pointer"
                  title="Search & web grounding powered by SerpAPI"
                >
                  <SerpApiIcon size={12} className="transition-transform group-hover:scale-110" />
                  <span className="hover:underline">Grounded by SerpAPI</span>
                  <span className="material-symbols-outlined text-[12px] opacity-70 group-hover:opacity-100">
                    open_in_new
                  </span>
                </a>
              </div>

              {/* Primary CTA Trigger */}
              <Button
                type="submit"
                id="submit-run-btn"
                variant="primary"
                disabled={!canRunTest || state.isStreaming || state.currentCase?.status === "testing"}
                className="inline-flex items-center justify-center gap-space-2 bg-primary-container hover:bg-blue-600 text-white font-headline-sm text-headline-sm px-space-6 py-space-2 rounded transition-colors active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {state.isStreaming || state.currentCase?.status === "testing" ? "progress_activity" : "play_arrow"}
                </span>
                <span>
                  {state.isStreaming || state.currentCase?.status === "testing"
                    ? "Stress test is running..."
                    : "Run stress test"}
                </span>
                <span className="sr-only">Test Decision</span>
              </Button>
            </div>
          </form>

          {/* Presets and FAQ Discovery Bar */}
          <EntryPresetsBar
            onSelectPreset={setRawInput}
            onOpenFaq={() => setActiveModal("faq")}
          />
        </div>
      </div>

      {/* Footer */}
      <EntryFooter onOpenModal={setActiveModal} />
    </div>
  );
};
