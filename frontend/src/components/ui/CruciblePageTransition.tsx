import React, { useEffect, useState } from 'react';

interface CruciblePageTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  verdictHeadline?: string;
  verdictState?: string;
}

/**
 * CruciblePageTransition Component
 * Seamless, non-intrusive viewport transition when the Steelman exits the bullpen.
 * Dissolves smoothly into the Decision Memo without modal popups or dialogue boxes.
 */
export const CruciblePageTransition: React.FC<CruciblePageTransitionProps> = ({
  isActive,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'idle' | 'dissolving' | 'fade_complete'>('idle');

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    setPhase('dissolving');

    // Stage 1: Chamber doorway light bloom & smooth fade (600ms)
    const t1 = setTimeout(() => {
      setPhase('fade_complete');
    }, 600);

    // Stage 2: Hand off seamlessly to next screen (950ms)
    const t2 = setTimeout(() => {
      onComplete();
    }, 950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div
      data-testid="crucible-page-transition"
      onClick={onComplete}
      className={`fixed inset-0 z-50 pointer-events-auto transition-opacity duration-700 ease-out select-none flex items-center justify-center overflow-hidden ${
        phase === 'fade_complete' ? 'bg-background opacity-100' : 'bg-background/80 backdrop-blur-sm opacity-90'
      }`}
    >
      {/* Doorway Light Bloom expanding from the right chamber door */}
      <div
        className={`absolute right-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none transition-all duration-700 ease-out ${
          phase === 'dissolving'
            ? 'scale-100 opacity-60 bg-radial from-primary/30 via-indigo-500/15 to-transparent'
            : 'scale-150 opacity-100 bg-radial from-background via-background/90 to-background'
        }`}
      />

      {/* Cinematic Horizontal Light Streak */}
      <div
        className={`absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent shadow-[0_0_24px_rgba(34,211,238,0.5)] transition-all duration-500 pointer-events-none ${
          phase === 'dissolving' ? 'opacity-100 top-1/2 scale-x-100' : 'opacity-0 top-1/2 scale-x-0'
        }`}
      />

      {/* Subtle Minimalist Status Indicator (no modal popup box) */}
      <div className="relative z-10 flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface-container-high/60 border border-outline-variant/40 backdrop-blur-md text-xs font-mono text-outline animate-in fade-in duration-300">
        <span className="w-2 h-2 rounded-full bg-verdict-survived animate-ping" />
        <span className="tracking-wide">Entering Decision Memo...</span>
      </div>
    </div>
  );
};

export default CruciblePageTransition;
