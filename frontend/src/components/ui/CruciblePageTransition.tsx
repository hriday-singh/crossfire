import React, { useEffect, useState } from 'react';
import { ShieldCheck, Sparkles, ArrowRight, Activity } from 'lucide-react';

interface CruciblePageTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  verdictHeadline?: string;
  verdictState?: string;
}

export const CruciblePageTransition: React.FC<CruciblePageTransitionProps> = ({
  isActive,
  onComplete,
  verdictHeadline = 'Crucible Evaluation Complete',
  verdictState = 'PROCEED',
}) => {
  const [phase, setPhase] = useState<'idle' | 'portal_open' | 'warp' | 'fade_out'>('idle');

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    setPhase('portal_open');

    // Stage 1: Door portal charge (800ms)
    const t1 = setTimeout(() => {
      setPhase('warp');
    }, 800);

    // Stage 2: Warp / shutter sweep (1800ms)
    const t2 = setTimeout(() => {
      setPhase('fade_out');
    }, 2200);

    // Stage 3: Complete transition (2700ms)
    const t3 = setTimeout(() => {
      onComplete();
    }, 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div
      data-testid="crucible-page-transition"
      className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center overflow-hidden bg-surface-container-lowest/90 backdrop-blur-md transition-all duration-700 select-none animate-in fade-in"
    >
      {/* Sci-Fi Grid Background Lines */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(96, 165, 250, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(96, 165, 250, 0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Holographic Radial Portal Beam */}
      <div
        className={`absolute w-[600px] h-[600px] rounded-full transition-all duration-1000 ease-out pointer-events-none ${
          phase === 'portal_open'
            ? 'scale-75 opacity-40 bg-radial from-primary-container via-blue-500/10 to-transparent animate-pulse'
            : phase === 'warp'
            ? 'scale-150 opacity-80 bg-radial from-verdict-survived via-primary to-transparent'
            : 'scale-[2.5] opacity-0'
        }`}
      />

      {/* Horizontal Light Sweep Beam */}
      <div
        className={`absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#22d3ee] transition-all duration-700 ${
          phase === 'warp' ? 'opacity-100 top-1/2 scale-x-100' : 'opacity-0 top-1/2 scale-x-0'
        }`}
      />

      {/* Central Hologram Telemetry HUD */}
      <div className="relative z-10 max-w-lg w-full mx-4 p-8 rounded-2xl bg-surface-container-high/95 border border-primary/40 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center space-y-5 animate-in zoom-in-95 duration-500">
        {/* Status Indicator Icon */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary-container/20 border border-primary/50 flex items-center justify-center text-primary-container shadow-[0_0_25px_rgba(96,165,250,0.3)]">
            <ShieldCheck className="w-8 h-8 text-verdict-survived animate-pulse" />
          </div>
          <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-spin" style={{ animationDuration: '6s' }} />
        </div>

        {/* Status Text & Phase */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-[11px] font-mono font-bold tracking-widest text-primary uppercase">
            <span className="w-2 h-2 rounded-full bg-verdict-survived animate-ping" />
            <span>Judge Adjudication Concluded</span>
          </div>
          <h2 className="font-sans font-bold text-xl sm:text-2xl text-on-surface tracking-tight">
            Transitioning to Decision Memo
          </h2>
          <p className="font-mono text-xs text-outline max-w-sm mx-auto leading-relaxed">
            {verdictHeadline}
          </p>
        </div>

        {/* Progress bar stream */}
        <div className="w-full space-y-2">
          <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant/40">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all ease-out"
              style={{
                width: phase === 'portal_open' ? '35%' : phase === 'warp' ? '85%' : '100%',
                transitionDuration: phase === 'portal_open' ? '800ms' : '1400ms',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-outline px-1">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-primary-container animate-spin inline" />
              <span>EXITING VIA CHAMBER DOOR</span>
            </span>
            <span className="uppercase font-semibold text-verdict-survived">{verdictState}</span>
          </div>
        </div>

        {/* Instant Skip / Manual Navigation Button */}
        <button
          type="button"
          onClick={onComplete}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-surface-container-highest hover:bg-surface-container border border-outline-variant text-xs font-mono font-semibold text-on-surface hover:text-primary transition-all cursor-pointer shadow-sm active:scale-95 group"
        >
          <span>Open Decision Memo Now</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default CruciblePageTransition;
