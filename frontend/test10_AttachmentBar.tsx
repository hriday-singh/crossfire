import React, { useState } from "react";

export interface EntryAttachment {
  id: string;
  type: "url" | "file" | "text_blob";
  name: string;
  url?: string;
  context?: string;
  charCount?: number;
}

interface AttachmentBarProps {
  attachments: EntryAttachment[];
  onRemoveAttachment: (id: string) => void;
}

export const AttachmentBar: React.FC<AttachmentBarProps> = ({
  attachments,
  onRemoveAttachment,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewingBlob, setPreviewingBlob] = useState<EntryAttachment | null>(null);

  if (attachments.length === 0) return null;

  const visibleAttachments = isExpanded ? attachments : attachments.slice(0, 2);
  const overflowCount = attachments.length - 2;

  const getIcon = (type: EntryAttachment["type"]) => {
    switch (type) {
      case "url":
        return "link";
      case "file":
        return "attach_file";
      case "text_blob":
        return "subject";
    }
  };

  return (
    <div data-testid="attachment-bar" className="mt-space-3 space-y-space-2">
      {/* Pills Container */}
      <div className="flex flex-wrap items-center gap-space-2">
        {visibleAttachments.map((item, index) => (
          <div
            key={item.id}
            data-testid={`attachment-pill-${index}`}
            className="flex items-center gap-1.5 bg-surface-container border border-outline-variant/60 rounded-full px-space-3 py-1 text-xs font-body-sm text-on-surface shadow-xs transition-colors hover:border-outline-variant"
          >
            <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
              {getIcon(item.type)}
            </span>
            <button
              type="button"
              onClick={() => {
                if (item.type === "text_blob") {
                  setPreviewingBlob(item);
                }
              }}
              className={`truncate max-w-[170px] text-left cursor-pointer hover:underline text-on-surface ${
                item.type === "text_blob" ? "font-medium" : ""
              }`}
              title={item.name}
            >
              {item.name}
            </button>
            {item.charCount !== undefined && item.charCount > 0 && (
              <span className="font-code-sm text-[10px] text-outline shrink-0">
                ({item.charCount.toLocaleString()}c)
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAttachment(item.id);
              }}
              aria-label={`Remove attachment ${item.name}`}
              className="text-outline hover:text-error ml-0.5 p-0.5 rounded-full transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        ))}

        {/* Compact Overflow Pill (+1, +2, etc.) */}
        {overflowCount > 0 && !isExpanded && (
          <button
            type="button"
            data-testid="attachment-overflow-pill"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 bg-surface-container-high border border-outline-variant/70 rounded-full px-space-2.5 py-1 text-xs font-code-sm text-primary hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer shadow-xs"
            aria-label={`Show ${overflowCount} more attachment${overflowCount > 1 ? "s" : ""}`}
          >
            <span>+{overflowCount}</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
        )}

        {isExpanded && attachments.length > 2 && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="flex items-center gap-0.5 text-xs font-code-sm text-outline hover:text-on-surface px-space-2 py-1 rounded transition-colors cursor-pointer"
          >
            <span>Compact</span>
            <span className="material-symbols-outlined text-[14px]">expand_less</span>
          </button>
        )}
      </div>

      {/* Text Blob Preview Modal */}
      {previewingBlob && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50"
        >
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-space-5 max-w-lg w-full shadow-2xl space-y-space-3">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  subject
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  {previewingBlob.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingBlob(null)}
                className="text-outline hover:text-on-surface p-1 rounded transition-colors cursor-pointer"
                aria-label="Close preview"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-3 max-h-[300px] overflow-y-auto text-body-sm font-body-sm text-on-surface whitespace-pre-wrap leading-relaxed">
              {previewingBlob.context}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="font-code-sm text-code-sm text-outline">
                {previewingBlob.charCount?.toLocaleString() || 0} characters
              </span>
              <button
                type="button"
                onClick={() => setPreviewingBlob(null)}
                className="px-4 py-1.5 text-xs font-body-sm bg-primary-container text-on-primary-container rounded-lg hover:brightness-110 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
