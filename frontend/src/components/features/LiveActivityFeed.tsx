import React, { useEffect, useRef, useState } from "react";
import { ActivityItem } from "@/types/crossfire";
import { cn } from "@/lib/utils";
import { SerpApiText } from "@/components/ui/serpapi";

interface LiveActivityFeedProps {
  activities: ActivityItem[];
  isStreaming: boolean;
  className?: string;
}

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({
  activities,
  isStreaming,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    }
  }, [isStreaming]);

  // Auto-scroll to bottom of container when streaming and autoScroll is active
  useEffect(() => {
    if (isExpanded && autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [activities.length, isExpanded, autoScroll, isStreaming]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 30;
    setAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  const getTagBadgeStyle = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes("evidence")) {
      return "text-primary-container bg-primary-container/10 border-primary-container/25";
    }
    if (t.includes("feasibility")) {
      return "text-tertiary bg-tertiary/10 border-tertiary/25";
    }
    if (t.includes("assumption")) {
      return "text-secondary bg-secondary/10 border-secondary/25";
    }
    if (t.includes("friction") || t.includes("operator") || t.includes("edge")) {
      return "text-on-surface-variant bg-surface-container-highest border-outline-variant";
    }
    if (t.includes("steelman") || t.includes("steelman") || t.includes("reconcil")) {
      return "text-primary-container bg-surface-container-highest border-primary-container/40";
    }
    return "text-outline bg-surface-container-high border-outline-variant/60";
  };

  const formatActivityTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={cn(
        "bg-surface-container-low border border-outline-variant/80 rounded-xl overflow-hidden transition-all shadow-md",
        className
      )}
    >
      {/* Header Bar */}
      <div 
        className="flex items-center justify-between px-space-4 py-space-3 bg-surface-container border-b border-outline-variant/60 select-none cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-space-2.5">
          {isStreaming ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-container" />
            </span>
          ) : (
            <span className="material-symbols-outlined text-[16px] text-verdict-survived">
              check_circle
            </span>
          )}

          <h3 className="font-headline-sm text-sm font-semibold text-on-surface tracking-tight">
            Live Investigation Feed
          </h3>

          <span className="font-code-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high text-outline border border-outline-variant/60">
            {activities.length} operation{activities.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-space-2">
          {isStreaming && (
            <span className="font-code-sm text-xs text-primary-container animate-pulse hidden sm:inline">
              Active Scrutiny in Progress...
            </span>
          )}
          <button
            type="button"
            className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-container-high transition-colors flex items-center justify-center pointer-events-none"
            aria-label={isExpanded ? "Collapse activity feed" : "Expand activity feed"}
          >
            <span 
              className="material-symbols-outlined text-[20px] transition-transform duration-200"
              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Activity Body */}
      {isExpanded && (
        <div className="relative">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            data-testid="activity-feed-container"
            className="p-space-3 max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs select-text scrollbar-thin scrollbar-thumb-outline scrollbar-track-surface-container"
          >
            {activities.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-outline gap-1">
                <span className="material-symbols-outlined text-[20px] animate-spin">
                  progress_activity
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Initializing adversarial test runners and web search pipelines...
                </p>
              </div>
            ) : (
              activities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-surface-container transition-colors group"
                >
                  <span className="text-outline text-[11px] shrink-0 pt-0.5 select-none">
                    {formatActivityTime(item.timestamp)}
                  </span>

                  <span
                    className={cn(
                      "font-semibold text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded border shrink-0 select-none",
                      getTagBadgeStyle(item.tag)
                    )}
                  >
                    {item.tag}
                  </span>

                  <span className="text-on-surface-variant leading-relaxed text-xs break-words font-sans group-hover:text-on-surface">
                    <SerpApiText text={item.text} />
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Floating Resume Auto-Scroll Button when user has scrolled up */}
          {!autoScroll && activities.length > 0 && (
            <div className="absolute bottom-2.5 right-3 z-10">
              <button
                type="button"
                onClick={scrollToBottom}
                aria-label="Resume auto-scroll"
                className="px-2.5 py-1 text-[11px] font-code-sm rounded-full bg-primary-container text-white shadow-md hover:bg-blue-600 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Resume auto-scroll</span>
                <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
