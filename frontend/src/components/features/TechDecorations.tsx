import React from "react";

interface TechDecorationsProps {
  isTyping?: boolean;
}

export const TechDecorations: React.FC<TechDecorationsProps> = ({ isTyping = false }) => {
  return (
    <div className="relative w-full h-11 mb-1 pointer-events-none select-none">
      <style>{`
        /* Sentry Bot File Delivery Journey */
        @keyframes sentry-file-delivery {
          /* 1. At Left Paper Stack: picking up document */
          0% {
            left: 36px;
            transform: scaleX(1);
          }
          8% {
            left: 36px;
            transform: scaleX(1);
          }
          /* 2. Carrying file from Left -> Right across box width */
          46% {
            left: calc(100% - 74px);
            transform: scaleX(1);
          }
          /* 3. At Right Folder Slot: dropping file */
          53% {
            left: calc(100% - 74px);
            transform: scaleX(1);
          }
          /* 4. Turn around to face left */
          57% {
            left: calc(100% - 74px);
            transform: scaleX(-1);
          }
          /* 5. Returning empty-handed from Right -> Left */
          93% {
            left: 36px;
            transform: scaleX(-1);
          }
          /* 6. Turn around to face right for next file */
          97%, 100% {
            left: 36px;
            transform: scaleX(1);
          }
        }

        /* Carried Document visibility and dropping into slot */
        @keyframes carried-file-lifecycle {
          0% {
            opacity: 0;
            transform: scale(0.6) translateY(6px);
          }
          6% {
            opacity: 1;
            transform: scale(1) translateY(0px);
          }
          46% {
            opacity: 1;
            transform: scale(1) translateY(0px);
          }
          /* Dropping into the filing cabinet slot */
          49% {
            opacity: 1;
            transform: scale(0.9) translateY(4px) rotate(12deg);
          }
          52% {
            opacity: 0;
            transform: scale(0.3) translateY(14px) rotate(20deg);
          }
          53%, 100% {
            opacity: 0;
            transform: scale(0.3) translateY(14px);
          }
        }

        /* Folder Slot Glowing Reception Pulse */
        @keyframes slot-receive-pulse {
          0%, 46%, 56%, 100% {
            filter: drop-shadow(0 0 4px rgba(56, 189, 248, 0.25));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.9)) brightness(1.25);
            transform: scale(1.04);
          }
        }

        /* Paper Stack Ambient Float */
        @keyframes stack-hover {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-1.5px);
          }
        }

        /* Tread Movement Jitter */
        @keyframes tread-jitter {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-0.5px); }
        }

        /* Eye Blinking */
        @keyframes eye-blink {
          0%, 90%, 100% { opacity: 1; transform: scaleY(1); }
          95% { opacity: 0.2; transform: scaleY(0.1); }
        }

        .animate-sentry-delivery {
          animation: sentry-file-delivery 9s ease-in-out infinite;
        }
        .animate-carried-doc {
          animation: carried-file-lifecycle 9s ease-in-out infinite;
        }
        .animate-slot-pulse {
          animation: slot-receive-pulse 9s ease-in-out infinite;
        }
        .animate-stack-float {
          animation: stack-hover 3s ease-in-out infinite;
        }
        .animate-treads {
          animation: tread-jitter 0.25s infinite;
        }
        .animate-eye-blink {
          animation: eye-blink 4s infinite;
        }
      `}</style>

      {/* 1. LEFT SIDE: File1 Paper Stack */}
      <div className="absolute bottom-0 left-0 flex flex-col items-center animate-stack-float z-10" title="Ingestion Files Source">
        <img
          src="/file_stack.webp"
          alt="File Stack"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.35)]"
        />
        <div className="w-8 h-[2px] bg-sky-400/30 blur-[1px] rounded-full mt-[-2px]" />
      </div>

      {/* 2. SUBTLE LASER GUIDEWAY TRACK between Paper Stack and Folder Slot */}
      <div className="absolute bottom-0 left-9 right-11 h-[1px] bg-gradient-to-r from-sky-500/40 via-sky-400/20 to-sky-500/40" />
      <div className="absolute bottom-[-1px] left-9 right-11 flex justify-between px-2 opacity-40">
        <span className="w-1 h-1 bg-sky-400/60 rounded-full" />
        <span className="w-1 h-1 bg-sky-400/60 rounded-full" />
      </div>

      {/* 3. TINY SENTRY BOT WITH CARRIED FILE */}
      <div className="absolute bottom-0 animate-sentry-delivery z-20" style={{ width: "32px" }}>
        <div className="flex flex-col items-center animate-treads relative">
          {/* CARRIED DOCUMENT: held by bot during transit */}
          <div className="absolute -top-3.5 -right-2 z-30 animate-carried-doc pointer-events-none">
            <div className="w-4 h-5 bg-white/95 border border-sky-400 rounded-[2px] shadow-[0_0_8px_rgba(56,189,248,0.9)] flex flex-col justify-center p-[2px] gap-[1.5px] transform rotate-6">
              {/* Document Text Line Mimics */}
              <div className="w-full h-[1.5px] bg-sky-600 rounded-full" />
              <div className="w-2.5 h-[1px] bg-sky-500/80 rounded-full" />
              <div className="w-full h-[1px] bg-sky-500/80 rounded-full" />
              <div className="w-2 h-[1px] bg-sky-500/60 rounded-full" />
            </div>
          </div>

          {/* Antenna with Status LED */}
          <div className="flex flex-col items-center mb-[-1px]">
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                isTyping
                  ? "bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-ping"
                  : "bg-emerald-400 shadow-[0_0_6px_#34d399]"
              }`}
            />
            <div className="w-[1px] h-1.5 bg-outline-variant" />
          </div>

          {/* Sentry Head & Cyclops Visor */}
          <div className="w-7 h-5 bg-surface-container-highest border border-emerald-400/60 rounded-[3px] flex items-center justify-center relative shadow-[0_0_8px_rgba(52,211,153,0.3)]">
            <div className="w-3.5 h-2 bg-emerald-400/20 border border-emerald-400/80 rounded-full flex items-center justify-center overflow-hidden">
              <div
                className={`w-1.5 h-1 rounded-full bg-emerald-300 shadow-[0_0_4px_#34d399] ${
                  isTyping ? "animate-ping" : "animate-pulse"
                }`}
              />
            </div>
          </div>

          {/* Tank Treads */}
          <div className="w-8 h-2.5 bg-surface-container-lowest border border-outline-variant rounded-[2px] flex justify-between px-1 items-center shadow-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-outline/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-outline/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-outline/60" />
          </div>
        </div>
      </div>

      {/* 4. RIGHT SIDE: Folder 1 Filing Cabinet / Archive Slot (Themed Neon Blue & Dark Grey) */}
      <div className="absolute bottom-0 right-0 flex flex-col items-center animate-slot-pulse z-10" title="Ingestion Archive Slot">
        <img
          src="/folder_slot.webp"
          alt="Folder Slot"
          className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.4)]"
        />
        <div className="w-9 h-[2px] bg-sky-400/40 blur-[1px] rounded-full mt-[-2px]" />
      </div>

      {/* 5. PERCHED MINI COMPANION BOT HEAD (Above the folder cabinet on top right) */}
      <div className="absolute -top-3.5 right-1 sm:right-2 flex items-end gap-1.5 opacity-85 hover:opacity-100 transition-opacity z-20">
        {isTyping && (
          <div className="bg-sky-950/80 border border-sky-500/40 text-sky-300 font-mono text-[9px] px-1.5 py-0.5 rounded shadow-lg animate-bounce">
            Evaluating...
          </div>
        )}
        <div className="relative flex flex-col items-center">
          {/* Antenna */}
          <div className="w-[1px] h-1.5 bg-sky-400" />
          <div className={`w-1 h-1 rounded-full ${isTyping ? "bg-amber-400 animate-ping" : "bg-sky-400"}`} />
          {/* Head */}
          <div className="w-7 h-5 bg-zinc-900 border border-sky-400/70 rounded-md flex items-center justify-center gap-1 p-0.5 shadow-[0_0_8px_rgba(56,189,248,0.2)]">
            <div className="w-1.5 h-1.5 rounded-[1px] bg-sky-400 animate-eye-blink flex items-center justify-center">
              <div className="w-0.5 h-0.5 bg-white rounded-full" />
            </div>
            <div className="w-1.5 h-1.5 rounded-[1px] bg-sky-400 animate-eye-blink flex items-center justify-center">
              <div className="w-0.5 h-0.5 bg-white rounded-full" />
            </div>
          </div>
          {/* Base */}
          <div className="w-5 h-1 bg-zinc-800 border-x border-b border-zinc-700 rounded-b-sm flex items-center justify-center">
            <div className="w-2 h-0.5 bg-emerald-400/80 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
