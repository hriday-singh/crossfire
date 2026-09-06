import React from "react";
import { Button } from "@/components/ui/button";

interface EntryDropzoneBarProps {
  isDragging: boolean;
  showUrlInput: boolean;
  urlInputValue: string;
  onDropzoneClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onToggleUrlInput: () => void;
  onUrlInputChange: (val: string) => void;
  onUrlSubmit: (e?: React.FormEvent) => void;
}

export const EntryDropzoneBar: React.FC<EntryDropzoneBarProps> = ({
  isDragging,
  showUrlInput,
  urlInputValue,
  onDropzoneClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleUrlInput,
  onUrlInputChange,
  onUrlSubmit,
}) => {
  return (
    <div className="flex flex-col gap-space-2 mt-space-3">
      <div
        id="dropzone"
        onClick={onDropzoneClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group bg-surface-container rounded-lg p-space-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-surface-container-high ${
          isDragging ? "ring-2 ring-primary bg-surface-container-high" : ""
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDropzoneClick();
          }}
          className="flex items-center gap-space-2 text-outline group-hover:text-on-surface transition-colors min-w-0 bg-transparent border-0 p-0 text-left cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary-container shrink-0">
            attach_file
          </span>
          <span className="font-body-sm text-body-sm truncate text-outline group-hover:text-on-surface">
            + Add reference link or upload document (PDF, MD, Image)
          </span>
        </button>
        <div className="flex items-center gap-space-2 shrink-0 pl-space-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleUrlInput();
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
            type="text"
            value={urlInputValue}
            onChange={(e) => onUrlInputChange(e.target.value)}
            placeholder="example.com/spec or https://example.com"
            className="flex-1 bg-transparent text-on-surface placeholder:text-outline font-body-sm text-body-sm px-space-2 py-1 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onUrlSubmit();
              }
            }}
          />
          <Button
            type="button"
            variant="primary"
            onClick={() => onUrlSubmit()}
            disabled={!urlInputValue.trim()}
            className="px-space-3 py-1 text-xs h-7 bg-primary-container hover:bg-blue-600 text-white rounded cursor-pointer transition-colors"
          >
            Attach URL
          </Button>
        </div>
      )}
    </div>
  );
};
