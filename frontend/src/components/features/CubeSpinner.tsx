import React, { useEffect, useState } from 'react';

export const CubeSpinner: React.FC = () => {
  const [accentBlocks, setAccentBlocks] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Dynamic accent shifting
    const interval = setInterval(() => {
      const newAccents: Record<string, boolean> = {};
      const totalBlocks = 6 * 9;
      for (let i = 0; i < 15; i++) {
        const randomIdx = Math.floor(Math.random() * totalBlocks);
        newAccents[randomIdx] = true;
      }
      setAccentBlocks(newAccents);
    }, 2000);

    const startTime = Date.now();
    const timeInterval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    // Initial random accents
    const initialAccents: Record<string, boolean> = {};
    for (let i = 0; i < 54; i++) {
      if (Math.random() > 0.7) {
        initialAccents[i] = true;
      }
    }
    setAccentBlocks(initialAccents);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const faces = ['front', 'right', 'back', 'left', 'top', 'bottom'];

  return (
    <div className="flex flex-col items-center max-w-md w-full px-8 gap-8">
      <style>{`
        .scene {
            width: 120px;
            height: 120px;
            perspective: 800px;
            margin: 0 auto;
        }

        .cube {
            width: 100%;
            height: 100%;
            position: relative;
            transform-style: preserve-3d;
            transform: translateZ(-60px) rotateX(-30deg) rotateY(45deg);
            animation: spin 8s infinite linear;
        }

        .face {
            position: absolute;
            width: 120px;
            height: 120px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 2px;
            background-color: transparent;
            border: 1px solid rgba(63, 63, 70, 0.2);
        }

        .face-front  { transform: rotateY(  0deg) translateZ(60px); }
        .face-right  { transform: rotateY( 90deg) translateZ(60px); }
        .face-back   { transform: rotateY(180deg) translateZ(60px); }
        .face-left   { transform: rotateY(-90deg) translateZ(60px); }
        .face-top    { transform: rotateX( 90deg) translateZ(60px); }
        .face-bottom { transform: rotateX(-90deg) translateZ(60px); }

        .block {
            background-color: #1a1b22;
            border: 1px solid #27272a;
            position: relative;
            overflow: hidden;
            transition: background-color 0.5s, border-color 0.5s;
        }
        
        .block::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(56, 189, 248, 0.1);
            opacity: 0;
            transition: opacity 0.5s;
        }

        .block.accent {
            background-color: rgba(56, 189, 248, 0.1);
            border-color: rgba(56, 189, 248, 0.3);
        }
        
        .block.accent::after {
            opacity: 1;
            animation: pulse-glow 2s infinite alternate;
        }

        @keyframes spin {
            0% { transform: translateZ(-60px) rotateX(-30deg) rotateY(45deg); }
            100% { transform: translateZ(-60px) rotateX(-30deg) rotateY(405deg); }
        }
        
        @keyframes pulse-glow {
            0% { box-shadow: inset 0 0 4px rgba(56, 189, 248, 0.2); }
            100% { box-shadow: inset 0 0 12px rgba(56, 189, 248, 0.6); }
        }
      `}</style>
      
      {/* 3D Animation Container */}
      <div className="scene">
        <div className="cube">
          {faces.map((faceClass, faceIdx) => (
            <div key={faceClass} className={`face face-${faceClass}`}>
              {Array.from({ length: 9 }).map((_, blockIdx) => {
                const absoluteIdx = faceIdx * 9 + blockIdx;
                const isAccent = accentBlocks[absoluteIdx];
                return (
                  <div key={blockIdx} className={`block ${isAccent ? 'accent' : ''}`} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Typography */}
      <div className="flex flex-col items-center text-center gap-2 w-full mt-4">
        <h1 className="font-mono text-lg text-zinc-100 tracking-tight font-semibold min-w-[280px] text-left">
          <span className="sr-only">Extracting Core Assumptions...</span>
          <div aria-hidden="true" className="flex justify-center w-full">
            <span>Extracting Core Assumptions</span>
            <span className="inline-block w-6 text-left">{dots}</span>
          </div>
        </h1>
        <p className="font-mono text-xs text-zinc-400 uppercase tracking-widest leading-relaxed">Deconstructing your proposal into testable, load-bearing assertions.</p>
      </div>
      
      {/* Telemetry Data */}
      <div className="w-full max-w-[240px] font-mono text-xs text-outline text-center mt-[-0.5rem]">
        <span>Time Elapsed: <span>{formatElapsed(elapsedSeconds)}</span></span>
      </div>
    </div>
  );
};
