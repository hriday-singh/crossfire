import React from "react";
import { ClaimStatus, TestExecutionState } from "@/types/crossfire";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconCircleHelp,
  IconCircleX,
} from "./KeylineIcons";

interface MorphingStatusIconProps {
  state?: TestExecutionState;
  verdict?: ClaimStatus | null;
  size?: number;
  className?: string;
}

export const MorphingStatusIcon: React.FC<MorphingStatusIconProps> = ({
  state = "queued",
  verdict,
  size = 18,
  className = "",
}) => {
  // If verdict is present, render final verdict icon with appropriate color
  if (verdict) {
    switch (verdict) {
      case "survived":
        return (
          <span className={`inline-flex items-center text-emerald-400 transition-all duration-200 transform scale-100 ${className}`}>
            <IconCheckCircle size={size} />
          </span>
        );
      case "weakened":
        return (
          <span className={`inline-flex items-center text-amber-400 transition-all duration-200 transform scale-100 ${className}`}>
            <IconAlertTriangle size={size} />
          </span>
        );
      case "broken":
        return (
          <span className={`inline-flex items-center text-rose-400 transition-all duration-200 transform scale-100 ${className}`}>
            <IconCircleX size={size} />
          </span>
        );
      case "unresolved":
        return (
          <span className={`inline-flex items-center text-indigo-400 transition-all duration-200 transform scale-100 ${className}`}>
            <IconCircleHelp size={size} />
          </span>
        );
    }
  }

  // Active state before final verdict
  if (state === "running") {
    return (
      <span className={`inline-flex items-center text-blue-400 ${className}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="animate-spin"
        >
          <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
          <path
            d="M12 3a9 9 0 0 1 9 9"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  if (state === "completed") {
    return (
      <span className={`inline-flex items-center text-blue-400/80 ${className}`}>
        <IconCheckCircle size={size} />
      </span>
    );
  }

  // Default: Queued (dashed circle)
  return (
    <span className={`inline-flex items-center text-zinc-500 ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray="3 3"
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
    </span>
  );
};
