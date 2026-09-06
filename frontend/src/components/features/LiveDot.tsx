import React from "react";
import { cn } from "@/lib/utils";

interface LiveDotProps {
  isLive?: boolean;
  className?: string;
  label?: string;
}

export const LiveDot: React.FC<LiveDotProps> = ({
  isLive = true,
  className = "",
  label = "LIVE STREAM",
}) => {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {isLive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75 duration-1000" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            isLive ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" : "bg-zinc-600"
          )}
        />
      </span>
      {label && (
        <span
          className={cn(
            "font-mono text-xs tracking-wider uppercase",
            isLive ? "text-blue-400" : "text-zinc-500"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
};
