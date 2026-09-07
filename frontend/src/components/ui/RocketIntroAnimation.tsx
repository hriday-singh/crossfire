import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MechanicalBlueprintRocket } from "./MechanicalBlueprintRocket";

export interface RocketAnimationConfig {
  delay?: number; // Initial delay before launch in seconds (default: 0.1)
  duration?: number; // Transit duration in seconds (default: 1.29, scaled for 0.7x speed)
  heroRevealProgress?: number; // Progress 0-1 at which hero UI begins revealing (default: 0.65)
}

interface RocketIntroAnimationProps {
  onHeroReveal?: () => void;
  onComplete?: () => void;
  config?: RocketAnimationConfig;
  autoStart?: boolean;
}

export const RocketIntroAnimation: React.FC<RocketIntroAnimationProps> = ({
  onHeroReveal,
  onComplete,
  config = {},
  autoStart = true,
}) => {
  const {
    delay = 0.1,
    duration = 1.29,
    heroRevealProgress = 0.65,
  } = config;

  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const rocketContainerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const onHeroRevealRef = useRef(onHeroReveal);
  const onCompleteRef = useRef(onComplete);

  onHeroRevealRef.current = onHeroReveal;
  onCompleteRef.current = onComplete;

  // Viewport dimensions & Responsive rocket sizing
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Extra Large Foreground Scale (~50-60% viewport height)
  const isMobile = dimensions.width < 768;
  const rocketHeight = Math.max(
    isMobile ? 240 : 380,
    Math.min(isMobile ? 360 : 580, dimensions.height * 0.58)
  );
  const rocketWidth = rocketHeight * (540 / 260); // 540:260 technical blueprint ratio (~2.08)

  // Centered Linear Trajectory: Passes directly through the dead center (width/2, height/2)
  const centerX = dimensions.width * 0.5;
  const centerY = dimensions.height * 0.5;
  const spanX = (dimensions.width + rocketWidth * 1.5) / 2;
  const angleRad = (-18 * Math.PI) / 180; // Crisp -18deg diagonal vector
  const spanY = -Math.tan(angleRad) * spanX;

  const startX = centerX - spanX;
  const startY = centerY + spanY;
  const endX = centerX + spanX;
  const endY = centerY - spanY;

  // Fixed linear angle along the straight centered diagonal vector
  const linearAngle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setIsFinished(true);
      onHeroRevealRef.current?.();
      onCompleteRef.current?.();
    }
  }, []);

  const finishImmediately = useCallback(() => {
    if (isFinished) return;
    setIsFinished(true);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    onHeroRevealRef.current?.();
    onCompleteRef.current?.();
  }, [isFinished]);

  // Keyboard shortcut (Esc / Space / Enter) to skip if desired
  useEffect(() => {
    if (isFinished) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        finishImmediately();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFinished, finishImmediately]);

  // Linear ticker loop for exact time-based hero reveal trigger
  useEffect(() => {
    if (!autoStart || isFinished) return;

    let timeoutId: number;
    let heroTriggerFired = false;

    timeoutId = window.setTimeout(() => {
      setHasStarted(true);
      startTimeRef.current = performance.now();

      const updateTicker = (now: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = now;
        }
        const elapsed = (now - startTimeRef.current) / 1000;
        const progress = Math.min(elapsed / duration, 1); // Pure linear progress

        // Trigger Hero UI reveal when rocket reaches ~65%
        if (progress >= heroRevealProgress && !heroTriggerFired) {
          heroTriggerFired = true;
          onHeroRevealRef.current?.();
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(updateTicker);
        } else {
          // Linear animation finished completely
          setIsFinished(true);
          onCompleteRef.current?.();
        }
      };

      animFrameRef.current = requestAnimationFrame(updateTicker);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoStart, delay, duration, heroRevealProgress, isFinished]);

  if (isFinished) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
      style={{ perspective: "1600px" }}
      aria-label="3D Mechanical Rocket Blueprint Centered Linear Animation"
      role="presentation"
    >
      {/* 3D Mechanical Blueprint Rocket (Centered, Linear, Speed 0.7x, No Booster) */}
      <AnimatePresence>
        {hasStarted && !isFinished && (
          <motion.div
            ref={rocketContainerRef}
            initial={{
              x: startX,
              y: startY,
              rotateX: 10,
              rotateY: -6,
              rotateZ: linearAngle,
              opacity: 0.98,
            }}
            animate={{
              x: endX,
              y: endY,
              rotateX: 10,
              rotateY: -6,
              rotateZ: linearAngle,
              opacity: 0.98,
            }}
            transition={{
              duration: duration,
              ease: "linear", // Strictly linear constant-velocity transit (1.29s, 0.7x speed)
            }}
            style={{
              position: "absolute",
              width: rocketWidth,
              height: rocketHeight,
              marginLeft: -rocketWidth / 2,
              marginTop: -rocketHeight / 2,
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
            className="pointer-events-none filter drop-shadow-[0_24px_64px_rgba(2,132,199,0.45)]"
          >
            {/* Clean Mechanical CAD Blueprint without booster flame */}
            <MechanicalBlueprintRocket isThrusting={false} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Skip Hint (Power user accessibility) */}
      <div className="fixed bottom-3 left-4 z-50 pointer-events-auto opacity-40 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={finishImmediately}
          className="font-code-sm text-[11px] text-outline hover:text-primary px-2.5 py-1 rounded bg-surface-container-lowest/85 border border-primary/40 text-primary-container backdrop-blur cursor-pointer shadow-sm"
          title="Skip intro animation"
        >
          Skip intro [Esc]
        </button>
      </div>
    </div>
  );
};

export default RocketIntroAnimation;
