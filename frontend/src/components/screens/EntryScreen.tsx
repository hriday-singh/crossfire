import React, { useState, useEffect, useRef } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { ingestImage, ingestPdf } from "@/lib/api";
import { AgentSelectorPanel } from "@/components/features/AgentSelectorPanel";
import { DEFAULT_AGENT_IDS } from "@/lib/agents";
import {
  AttachmentBar,
  EntryAttachment,
} from "@/components/features/AttachmentBar";
import { EntryPresetsBar } from "@/components/features/EntryPresetsBar";
import { EntryFooter } from "@/components/features/EntryFooter";
import { CubeSpinner } from "@/components/features/CubeSpinner";
import {
  detectWebUrl,
  extractAllWebUrls,
  normalizeWebUrl,
  DetectedWebUrl,
} from "@/lib/urlUtils";
import { PoweredBySerpApiBadge, SerpApiIcon } from "@/components/ui/serpapi";

const MAX_PROPOSAL_CHARS = 500;

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
};

export const EntryScreen: React.FC = () => {
  const { state, startExtracting, setActiveModal } = useCase();
  const [rawInput, setRawInput] = useState("");
  const [attachments, setAttachments] = useState<EntryAttachment[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [smartNotice, setSmartNotice] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<"auto" | "custom">("auto");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([
    ...DEFAULT_AGENT_IDS,
  ]);
  const [isAgentPanelExpanded, setIsAgentPanelExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    if (value.length > MAX_PROPOSAL_CHARS) {
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

    // 1. Check if pasted text contains URLs
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

    // 2. Full-block creation: If the pasted content exceeds character limit,
    // convert the ENTIRE pasted text into a context block attachment instead of chopping it.
    if (
      pasted.length > MAX_PROPOSAL_CHARS ||
      rawInput.length + pasted.length > MAX_PROPOSAL_CHARS
    ) {
      e.preventDefault();
      const blobCount =
        attachments.filter((a) => a.type === "text_blob").length + 1;
      const newBlob: EntryAttachment = {
        id: `blob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "text_blob",
        name: `Context Block #${blobCount}`,
        context: pasted,
        charCount: pasted.length,
      };
      setAttachments((prev) => [...prev, newBlob]);
      setSmartNotice(
        `Large text (${pasted.length.toLocaleString()} chars) attached as full context block.`,
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
      const res = isImage ? await ingestImage(file) : await ingestPdf(file);
      const label = isImage ? `Screenshot: ${file.name}` : file.name;
      const newFileAttachment: EntryAttachment = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "file",
        name: label,
        context: res.context,
        charCount: res.character_count,
      };
      setAttachments((prev) => [...prev, newFileAttachment]);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        "Failed to extract text from file.";
      setIngestError(errorMsg);
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
    const allowed = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    if (!allowed.includes(ext)) {
      setIngestError(
        "Only PDF documents and image screenshots (.png, .jpg, .jpeg, .webp) are supported.",
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
      <div className="flex flex-col w-full items-center justify-center pt-8 pb-12 px-space-4">
        {/* Subtle Ambient Glow */}
        <div className="relative w-full max-w-[640px]">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-40 bg-gradient-to-b from-primary-container/10 via-primary-container/5 to-transparent blur-3xl pointer-events-none -z-10" />

          {/* Header Module */}
          <div className="flex flex-col items-start mb-space-5">
            <div className="flex items-center justify-between w-full gap-2 mb-space-2 flex-wrap">
              <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider">
                Decision Proposal
              </span>
              <PoweredBySerpApiBadge variant="hero" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-2">
              What decision are you testing?
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Describe your proposal or strategic assumption. Crossfire
              identifies the core load-bearing claims and tests them against
              real-world evidence.
            </p>
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
                maxLength={MAX_PROPOSAL_CHARS}
                onChange={(e) => handleTextChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="e.g. We should offer an unlimited free tier for our AI coding assistant or pivot from custom enterprise deployments to a self-serve PLG tier with zero sales assistance..."
                rows={4}
                autoFocus
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-md text-body-md rounded-lg p-space-4 resize-none transition-all outline-none focus:bg-surface-container-low min-h-[130px] leading-relaxed border border-transparent focus:border-outline-variant"
              />
              {/* Character Limit Counter */}
              <div className="absolute bottom-3 right-3 flex items-center gap-space-2 pointer-events-none">
                <span
                  className={`font-code-sm text-code-sm px-space-1.5 py-0.5 rounded transition-colors ${
                    rawInput.length >= 480
                      ? "text-primary-container font-semibold"
                      : "text-outline"
                  }`}
                >
                  {rawInput.length} / {MAX_PROPOSAL_CHARS} characters
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
              accept=".pdf,.png,.jpg,.jpeg,.webp"
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
            <div className="flex flex-col gap-space-2 mt-space-3">
              <div
                id="dropzone"
                onClick={handleDropzoneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group bg-surface-container rounded-lg p-space-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-surface-container-high ${
                  isDragging
                    ? "ring-2 ring-primary bg-surface-container-high"
                    : ""
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDropzoneClick();
                  }}
                  className="flex items-center gap-space-2 text-outline group-hover:text-on-surface transition-colors min-w-0 bg-transparent border-0 p-0 text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary-container shrink-0">
                    attach_file
                  </span>
                  <span className="font-body-sm text-body-sm truncate text-outline group-hover:text-on-surface">
                    + Add reference link or upload document (PDF, Screenshot /
                    Image)
                  </span>
                </button>
                <div className="flex items-center gap-space-2 shrink-0 pl-space-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUrlInput(!showUrlInput);
                    }}
                    className="font-code-sm text-code-sm text-outline hover:text-on-surface px-space-2 py-0.5 rounded bg-surface-container-low transition-colors cursor-pointer"
                  >
                    {showUrlInput ? "Close" : "+ Web URL"}
                  </button>
                  <span className="font-code-sm text-code-sm text-outline">
                    Optional
                  </span>
                </div>
              </div>

              {showUrlInput && (
                <div className="flex items-center gap-space-2 bg-surface-container rounded-lg p-space-2 border border-outline-variant">
                  <span className="material-symbols-outlined text-[18px] text-outline ml-space-1">
                    link
                  </span>
                  <input
                    type="text"
                    value={urlInputValue}
                    onChange={(e) => setUrlInputValue(e.target.value)}
                    placeholder="example.com/spec or https://example.com"
                    className="flex-1 bg-transparent text-on-surface placeholder:text-outline font-body-sm text-body-sm px-space-2 py-1 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleManualUrlSubmit();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleManualUrlSubmit()}
                    disabled={!urlInputValue.trim()}
                    className="px-space-3 py-1 text-xs h-7 bg-primary-container hover:bg-blue-600 text-white rounded cursor-pointer transition-colors"
                  >
                    Attach URL
                  </Button>
                </div>
              )}
            </div>

            {/* Agent Suite Selection Panel (Auto vs Custom) */}
            <AgentSelectorPanel
              agentMode={agentMode}
              onAgentModeChange={setAgentMode}
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
                <span className="hidden md:inline-flex items-center gap-1.5 text-outline font-code-sm text-xs">
                  <SerpApiIcon size={12} />
                  <span>Grounding via SerpApi</span>
                </span>
              </div>

              {/* Primary CTA Trigger */}
              <Button
                type="submit"
                id="submit-run-btn"
                variant="primary"
                disabled={!canRunTest}
                className="inline-flex items-center justify-center gap-space-2 bg-primary-container hover:bg-blue-600 text-white font-headline-sm text-headline-sm px-space-6 py-space-2 rounded transition-colors active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  play_arrow
                </span>
                <span>Run stress test</span>
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
