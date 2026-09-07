import React, { useEffect, useState } from 'react';

/**
 * Minimalist Loading Spinner for Proposal Extraction
 * Clean, borderless, and distraction-free with zero bounding rectangles or verbose subtext.
 */
export const CubeSpinner: React.FC = () => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none">
      {/* Minimalist Geometric Orbit / Core Spinner */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Outer subtle glow ring */}
        <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-30" />
        
        {/* Rotating gradient arc */}
        <div className="w-10 h-10 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin" style={{ animationDuration: '1.2s' }} />
        
        {/* Inner pulsing core point */}
        <div className="absolute w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>

      {/* Minimal Single-Line Indicator */}
      <div className="flex items-center font-mono text-sm text-zinc-300 font-medium tracking-tight">
        <span>Extracting Core Assumptions</span>
        <span className="inline-block w-4 text-left font-mono">{dots}</span>
      </div>
    </div>
  );
};

export default CubeSpinner;
