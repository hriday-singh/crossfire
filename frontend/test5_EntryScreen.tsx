import React, { useState, useEffect, useRef } from "react";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import { ingestImage, ingestPdf, ingestUrl } from "@/lib/api";

const isImageFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
};

export const EntryScreen: React.FC = () => {
  const { state, startExtracting, setActiveModal } = useCase();
  const [rawInput, setRawInput] = useState("");
  const [attachedContext, setAttachedContext] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(130, textareaRef.current.scrollHeight)}px`;
    }
  }, [rawInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawInput.trim() || state.isExtracting || isIngesting) return;
    startExtracting(rawInput.trim(), attachedContext);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const processFile = async (file: File) => {
    setIngestError(null);
    setIsIngesting(true);

    try {
      const isImage = isImageFile(file.name);
      const res = isImage ? await ingestImage(file) : await ingestPdf(file);
      setAttachedContext(res.context);
      const label = isImage ? `Screenshot: ${file.name}` : file.name;
      setAttachmentName(`${label} (${res.character_count.toLocaleString()} chars)`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message || "Failed to extract text from file.";
      setIngestError(errorMsg);
      setAttachedContext(null);
      setAttachmentName(null);
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
      setIngestError("Only PDF documents and image screenshots (.png, .jpg, .jpeg, .webp) are supported.");
      return;
    }

    await processFile(file);
  };

  const handleUrlSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInputValue.trim() || isIngesting) return;

    setIngestError(null);
    setIsIngesting(true);

    try {
      const res = await ingestUrl(urlInputValue.trim());
      setAttachedContext(res.context);
      let displayUrl = urlInputValue.trim();
      try {
        const parsed = new URL(displayUrl);
        displayUrl = parsed.hostname;
      } catch {
        // keep raw
      }
      setAttachmentName(`${displayUrl} (${res.character_count.toLocaleString()} chars)`);
      setShowUrlInput(false);
      setUrlInputValue("");
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message || "Failed to ingest URL.";
      setIngestError(errorMsg);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleRemoveAttachment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachedContext(null);
    setAttachmentName(null);
    setIngestError(null);
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  if (state.isExtracting) {
    return (
      <div className="flex flex-col w-full items-center justify-center py-24 px-space-4">
        <div className="flex flex-col items-center justify-center space-y-4 bg-surface-container-low border border-outline-variant rounded-xl p-space-8 max-w-[480px] w-full text-center shadow-xl">
          <span className="material-symbols-outlined text-[32px] text-primary-container animate-spin">
            progress_activity
          </span>
          <div className="space-y-1">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Extracting Core Assumptions...
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Deconstructing your proposal into testable, load-bearing assertions.
            </p>
          </div>
          <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary-container h-full w-2/3 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] justify-between">
      <div className="flex flex-col w-full items-center justify-center py-16 px-space-4">
        {/* Subtle Ambient Glow */}
        <div className="relative w-full max-w-[640px]">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-40 bg-gradient-to-b from-primary-container/10 via-primary-container/5 to-transparent blur-3xl pointer-events-none -z-10" />

          {/* Header Module */}
          <div className="flex flex-col items-start mb-space-5">
            <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider mb-space-2">
              Decision Proposal
            </span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-space-2">
              What decision are you testing?
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Describe your proposal or strategic assumption. Crossfire identifies the core load-bearing claims and tests them against real-world evidence.
            </p>
          </div>

          {/* Form Container */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col w-full bg-surface-container-low rounded-xl p-space-4 shadow-xl"
          >
            {/* Textarea Workspace */}
            <div className="relative w-full">
              <label className="sr-only" htmlFor="proposal-input">
                Decision proposal statement
              </label>
              <textarea
                ref={textareaRef}
                id="proposal-input"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. We should offer an unlimited free tier for our AI coding assistant or pivot from custom enterprise deployments to a self-serve PLG tier with zero sales assistance..."
                rows={4}
                autoFocus
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-md text-body-md rounded-lg p-space-4 resize-none transition-all outline-none focus:bg-surface-container-low min-h-[130px] leading-relaxed border border-transparent focus:border-outline-variant"
              />
              {/* Inline Token/Character Counter */}
              <div className="absolute bottom-3 right-3 flex items-center gap-space-2 pointer-events-none">
                <span className="font-code-sm text-code-sm text-outline px-space-1.5 py-0.5">
                  {rawInput.length} characters
                </span>
              </div>
            </div>

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
                className="mt-space-3 bg-red-950/40 border border-red-800/60 rounded-lg p-space-3 flex items-center justify-between text-red-300"
              >
                <div className="flex items-center gap-space-2 min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-red-400 shrink-0">
                    error
                  </span>
                  <span className="font-body-sm text-body-sm truncate">{ingestError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIngestError(null)}
                  className="text-red-400 hover:text-red-200 p-1 rounded transition-colors"
                  aria-label="Dismiss error"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
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
                    Extracting and curating context...
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-outline">Processing</span>
              </div>
            )}

            {/* Attached Context Badge */}
            {!isIngesting && attachmentName && (
              <div className="mt-space-3 bg-surface-container rounded-lg p-space-3 flex items-center justify-between border border-outline-variant/60">
                <div className="flex items-center gap-space-2 text-on-surface min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                    check_circle
                  </span>
                  <span className="font-body-sm text-body-sm text-primary font-medium truncate">
                    Attached: {attachmentName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="text-outline hover:text-on-surface p-1 rounded transition-colors cursor-pointer"
                  aria-label="Remove attachment"
                  title="Remove attachment"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}

            {/* Default Dropzone and URL Trigger */}
            {!isIngesting && !attachmentName && (
              <div className="flex flex-col gap-space-2">
                <div
                  id="dropzone"
                  onClick={handleDropzoneClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`group mt-space-3 bg-surface-container rounded-lg p-space-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-surface-container-high ${
                    isDragging ? "ring-2 ring-primary bg-surface-container-high" : ""
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
                      + Add reference link or upload document (PDF, Screenshot / Image)
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
                    <span className="font-code-sm text-code-sm text-outline">Optional</span>
                  </div>
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-space-2 bg-surface-container rounded-lg p-space-2 border border-outline-variant">
                    <span className="material-symbols-outlined text-[18px] text-outline ml-space-1">
                      link
                    </span>
                    <input
                      type="url"
                      value={urlInputValue}
                      onChange={(e) => setUrlInputValue(e.target.value)}
                      placeholder="https://example.com/article-or-spec"
                      className="flex-1 bg-transparent text-on-surface placeholder:text-outline font-body-sm text-body-sm px-space-2 py-1 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleUrlSubmit();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => handleUrlSubmit()}
                      disabled={!urlInputValue.trim() || isIngesting}
                      className="px-space-3 py-1 text-xs h-7 bg-primary-container text-on-primary-container rounded"
                    >
                      Attach URL
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Action Row */}
            <div className="mt-space-4 pt-space-3 flex items-center justify-between">
              {/* Keyboard Shortcut Hint */}
              <div className="flex items-center gap-space-1.5 text-outline font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[14px]">keyboard_command_key</span>
                <span>Press</span>
                <kbd className="px-space-1.5 py-0.5 bg-surface-container font-code-sm text-code-sm text-on-surface rounded">
                  ⌘
                </kbd>
                <span>+</span>
                <kbd className="px-space-1.5 py-0.5 bg-surface-container font-code-sm text-code-sm text-on-surface rounded">
                  Enter
                </kbd>
                <span>to analyze</span>
              </div>

              {/* Primary CTA Trigger */}
              <Button
                type="submit"
                id="submit-run-btn"
                disabled={!rawInput.trim() || state.isExtracting || isIngesting}
                className="inline-flex items-center justify-center gap-space-2 bg-primary-container text-on-primary-container font-headline-sm text-headline-sm px-space-6 py-space-2 rounded transition-transform active:scale-[0.98] hover:brightness-110 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                <span>Run stress test</span>
                <span className="sr-only">Test Decision</span>
              </Button>
            </div>
          </form>

          {/* Recent Runs Quick-Jump Bar */}
          <div className="mt-space-6 flex items-start gap-space-2 text-outline font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">
              lightbulb
            </span>
            <div className="flex flex-wrap items-center gap-x-space-3 gap-y-1 font-body-sm text-body-sm">
              <span className="text-outline">Example proposals:</span>
              <button
                type="button"
                onClick={() =>
                  setRawInput(
                    "I want to build an AI that helps students apply to college, including submitting applications on their behalf."
                  )
                }
                className="text-on-surface-variant hover:text-primary-container transition-colors underline decoration-outline-variant underline-offset-4 cursor-pointer"
              >
                <span>College application submission AI</span>
                <span className="sr-only">College Admissions AI Agent</span>
              </button>
              <span className="text-outline-variant">·</span>
              <button
                type="button"
                onClick={() =>
                  setRawInput(
                    "We should offer an unlimited free tier for our AI coding assistant to acquire developers at zero CAC, monetizing only on enterprise teams."
                  )
                }
                className="text-on-surface-variant hover:text-primary-container transition-colors underline decoration-outline-variant underline-offset-4 cursor-pointer"
              >
                Unlimited free-tier SaaS unit economics
              </button>
              <span className="text-outline-variant">·</span>
              <button
                type="button"
                onClick={() =>
                  setRawInput(
                    "A niche vertical AI agent that crawls local dental clinic websites, auto-generates localized patient education blogs, and posts them via WordPress."
                  )
                }
                className="text-on-surface-variant hover:text-primary-container transition-colors underline decoration-outline-variant underline-offset-4 cursor-pointer"
              >
                SEO automation for local practices
              </button>
            </div>
          </div>

          {/* FAQ Discovery Quick-Link */}
          <div className="mt-space-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setActiveModal("faq")}
              className="flex items-center gap-1.5 text-outline hover:text-on-surface font-code-sm text-code-sm transition-colors cursor-pointer group"
            >
              <span className="material-symbols-outlined text-[15px] text-outline group-hover:text-primary-container">
                help_outline
              </span>
              <span>How does Crossfire work? View FAQ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant py-space-3 px-space-6 flex items-center justify-between">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-outline font-code-sm text-code-sm">
          <span>Crossfire - Open-source decision testing platform.</span>
          <div className="flex items-center gap-space-4">
            <a
              className="hover:text-on-surface transition-colors"
              href="https://github.com/hriday-singh/crossfire"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={() => setActiveModal("faq")}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("logs")}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Telemetry
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("history")}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              History
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
