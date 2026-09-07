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
      return "text-verdict-survived bg-verdict-survived/10 border-verdict-survived/25";
    }
    if (t.includes("feasibility")) {
      return "text-verdict-weakened bg-verdict-weakened/10 border-verdict-weakened/25";
    }
    if (t.includes("assumption")) {
      return "text-verdict-unresolved bg-verdict-unresolved/10 border-verdict-unresolved/25";
    }
    if (t.includes("friction") || t.includes("operator") || t.includes("edge")) {
      return "text-primary bg-primary/10 border-primary/25";
    }
    if (t.includes("steelman") || t.includes("reconcil")) {
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
        className="flex items-center justify-between px-space-4 py-space-3 bg-surface border-b border-outline-variant/60 select-none cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-space-2.5">
          {isStreaming ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-verdict-survived" />
            </span>
          )}

          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface tracking-tight">
            Live Investigation Feed
          </h3>

          <span className="font-mono text-xs text-outline">
            [{activities.length} op{activities.length === 1 ? "" : "s"}]
          </span>
        </div>

        <div className="flex items-center gap-space-2">
          {isStreaming && (
            <span className="font-mono text-[10px] text-primary animate-pulse hidden sm:inline uppercase">
              Scrutiny in Progress...
            </span>
          )}
          <span className="text-xs font-mono text-outline uppercase">
            {isExpanded ? "Hide" : "Show"}
          </span>
        </div>
      </div>

      {/* Collapsible Activity Body */}
      {isExpanded && (
        <div className="relative">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            data-testid="activity-feed-container"
            className="p-space-3 max-h-56 overflow-y-auto space-y-1 font-mono text-xs select-text scrollbar-thin scrollbar-thumb-outline scrollbar-track-surface-container"
          >
            {activities.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-outline gap-1">
                <p className="font-mono text-[10px] text-on-surface-variant uppercase">
                  Initializing...
                </p>
              </div>
            ) : (
              activities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-surface-container transition-colors group"
                >
                  <span className="text-outline text-xs shrink-0 pt-0.5 select-none">
                    {formatActivityTime(item.timestamp)}
                  </span>

                  <span
                    className={cn(
                      "font-semibold text-xs tracking-wider uppercase px-2 py-0.5 rounded border shrink-0 select-none",
                      getTagBadgeStyle(item.tag)
                    )}
                  >
                    {item.tag}
                  </span>

                  <span className="text-on-surface-variant leading-relaxed text-sm break-words font-sans group-hover:text-on-surface">
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
                className="px-2.5 py-1 text-[10px] font-mono uppercase bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center cursor-pointer"
              >
                Resume Auto-Scroll
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
