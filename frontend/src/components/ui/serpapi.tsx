import React, { useId } from "react";

export interface SerpApiIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * SerpApi official logo icon extracted directly from SerpApi brand assets.
 * Uses the signature #377FEA -> #8C45EF linear gradient.
 */
export const SerpApiIcon: React.FC<SerpApiIconProps> = ({
  size = 16,
  className = "",
  ...props
}) => {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 726.54 726.54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 inline-block align-middle ${className}`}
      aria-label="SerpApi logo"
      role="img"
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="73.56"
          y1="719.28"
          x2="653.89"
          y2="63.57"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#377FEA" />
          <stop offset="1" stopColor="#8C45EF" />
        </linearGradient>
      </defs>
      <path
        d="m 141.299,530.374 c 8.977,31.839 35.67,56.769 69.397,64.614 V 726.54 H 208.88 C 97.7879,726.54 6.95296,639.815 0.381836,530.374 Z m 69.397,-398.823 c -41.703,9.701 -72.653,45.522 -72.653,88.227 0,50.157 42.693,90.818 95.358,90.818 52.665,0 95.359,-40.661 95.359,-90.818 0,-42.705 -30.951,-78.526 -72.655,-88.227 V 0 H 517.66 C 629.366,2.23588e-4 720.592,87.6865 726.261,197.982 H 583.916 c -10.25,-39.63 -47.818,-69.021 -92.594,-69.021 -52.665,0 -95.358,40.66 -95.358,90.817 0,42.706 30.951,78.526 72.654,88.227 v 110.529 c -41.703,9.701 -72.654,45.522 -72.654,88.228 0,42.705 30.951,78.526 72.654,88.226 V 726.54 H 256.105 V 594.988 c 41.704,-9.701 72.655,-45.521 72.655,-88.226 0,-50.157 -42.694,-90.817 -95.359,-90.818 -44.776,0 -82.343,29.392 -92.593,69.022 H 0 V 208.88 C 1.97918e-4,93.5188 93.5188,1.97969e-4 208.88,0 h 1.816 z M 726.54,517.66 c 0,115.361 -93.519,208.88 -208.88,208.88 h -3.633 V 594.988 c 41.703,-9.701 72.654,-45.521 72.654,-88.226 0,-42.706 -30.95,-78.527 -72.654,-88.228 V 308.005 c 33.728,-7.846 60.421,-32.775 69.398,-64.614 H 726.54 Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
};

export interface PoweredBySerpApiProps {
  variant?: "hero" | "banner" | "inline" | "header";
  className?: string;
}

export const PoweredBySerpApiBadge: React.FC<PoweredBySerpApiProps> = ({
  variant = "inline",
  className = "",
}) => {
  if (variant === "hero") {
    return (
      <a
        href="https://serpapi.com?utm_source=crossfire&utm_medium=hero_badge"
        target="_blank"
        rel="noopener noreferrer"
        className={`group inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/70 hover:border-primary/50 transition-all hover:bg-surface-container-high hover:shadow-sm text-on-surface ${className}`}
        title="Search & web grounding powered by SerpApi"
      >
        <SerpApiIcon size={16} className="transition-transform group-hover:scale-110" />
        <span className="font-code-sm text-xs text-on-surface font-medium flex items-center gap-1.5">
          <span>Powered by</span>
          <span className="font-semibold text-primary group-hover:underline">SerpApi</span>
        </span>
        <span className="w-1 h-1 rounded-full bg-outline-variant" />
        <span className="font-code-sm text-[11px] text-outline group-hover:text-on-surface-variant transition-colors">
          Real-time Web Grounding
        </span>
        <span className="material-symbols-outlined text-[13px] text-outline group-hover:text-primary transition-colors">
          open_in_new
        </span>
      </a>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={`w-full rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3 text-left ${className}`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/40 shrink-0 shadow-xs">
            <SerpApiIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold text-sm">
                Evidence Grounding powered by SerpApi
              </span>
              <span className="font-code-sm text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold">
                Live Search API
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-0.5 leading-relaxed">
              Every load-bearing assumption is cross-checked against live web search evidence via SerpApi to uncover opposing facts and market reality.
            </p>
          </div>
        </div>
        <a
          href="https://serpapi.com?utm_source=crossfire&utm_medium=claims_banner"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-code-sm text-xs font-medium text-primary hover:underline flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-low border border-outline-variant hover:border-primary/40 transition-colors"
        >
          <span>About SerpApi</span>
          <span className="material-symbols-outlined text-[13px]">open_in_new</span>
        </a>
      </div>
    );
  }

  if (variant === "header") {
    return (
      <a
        href="https://serpapi.com?utm_source=crossfire&utm_medium=section_header"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-code-sm text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/15 transition-colors shrink-0 ${className}`}
        title="Live evidence retrieved via SerpApi Google Search API"
      >
        <SerpApiIcon size={13} />
        <span className="font-medium">powered by SerpApi</span>
        <span className="material-symbols-outlined text-[12px] opacity-70">open_in_new</span>
      </a>
    );
  }

  // Default: inline pill for evidence items
  return (
    <a
      href="https://serpapi.com?utm_source=crossfire&utm_medium=evidence_pill"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 transition-colors shrink-0 ${className}`}
      title="Verified live web result via SerpApi"
    >
      <SerpApiIcon size={12} />
      <span>via SerpApi</span>
    </a>
  );
};
