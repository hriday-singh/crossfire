import React, { useEffect, useRef, useState } from "react";
import { useCursorLighting } from "@/hooks/useCursorLighting";

interface Position {
  x: number;
  y: number;
}

interface AgentColorConfig {
  primary: string;
  glow: string;
  glowFade: string;
}

const AGENT_COLORS: Record<string, AgentColorConfig> = {
  devils_advocate: {
    primary: "#f87171",
    glow: "rgba(248, 113, 113, 0.18)",
    glowFade: "rgba(248, 113, 113, 0.04)",
  },
  receipts: {
    primary: "#34d399",
    glow: "rgba(52, 211, 153, 0.18)",
    glowFade: "rgba(52, 211, 153, 0.04)",
  },
  builder: {
    primary: "#c084fc",
    glow: "rgba(192, 132, 252, 0.18)",
    glowFade: "rgba(192, 132, 252, 0.04)",
  },
  operator: {
    primary: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.18)",
    glowFade: "rgba(251, 191, 36, 0.04)",
  },
  judge: {
    primary: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.20)",
    glowFade: "rgba(96, 165, 250, 0.04)",
  },
  default: {
    primary: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.15)",
    glowFade: "rgba(96, 165, 250, 0.03)",
  },
};

/**
 * CursorLighting Component
 * Creates an ambient inspection spotlight and tactical cybernetic reticle
 * that dynamically illuminates dark surfaces and reacts to interactive elements.
 */
export const CursorLighting: React.FC = () => {
  const { isEnabled } = useCursorLighting();

  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>("default");

  // DOM Refs for high performance transform updates (avoiding React re-renders)
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const shockwaveRef = useRef<HTMLDivElement | null>(null);

  // Position references
  const targetPos = useRef<Position>({ x: -200, y: -200 });
  const reticlePos = useRef<Position>({ x: -200, y: -200 });
  const spotlightPos = useRef<Position>({ x: -200, y: -200 });
  const animFrameId = useRef<number | null>(null);

  // Detect touch devices / coarse pointers
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const media = window.matchMedia("(pointer: coarse)");
      setIsCoarsePointer(media.matches);
      const listener = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
      } else if (typeof media.addListener === "function") {
        media.addListener(listener);
        return () => media.removeListener(listener);
      }
    }
  }, []);

  // Animation loop with spring / lerp interpolation
  useEffect(() => {
    if (!isEnabled || isCoarsePointer) return;

    const render = () => {
      // Snappy lerp for tactical reticle (factor ~ 0.4)
      reticlePos.current.x += (targetPos.current.x - reticlePos.current.x) * 0.4;
      reticlePos.current.y += (targetPos.current.y - reticlePos.current.y) * 0.4;

      // Organic low-pass lerp for ambient spotlight (factor ~ 0.14)
      spotlightPos.current.x += (targetPos.current.x - spotlightPos.current.x) * 0.14;
      spotlightPos.current.y += (targetPos.current.y - spotlightPos.current.y) * 0.14;

      if (reticleRef.current) {
        reticleRef.current.style.transform = `translate3d(${reticlePos.current.x}px, ${reticlePos.current.y}px, 0)`;
      }

      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${spotlightPos.current.x}px, ${spotlightPos.current.y}px, 0)`;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isEnabled, isCoarsePointer]);

  // Pointer event listeners
  useEffect(() => {
    if (!isEnabled || isCoarsePointer) return;

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);

      // Check if hovering interactive element or agent
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === "function") {
        const interactive = target.closest(
          'button, a, input, textarea, [role="button"], .cursor-pointer, [data-interactive="true"]'
        );
        setIsHovered(!!interactive);

        // Detect agent context
        const agentEl = target.closest(
          '[data-agent], [data-agent-id], .agent-avatar, [data-evaluator]'
        );
        if (agentEl) {
          const agentId =
            agentEl.getAttribute("data-agent") ||
            agentEl.getAttribute("data-agent-id") ||
            agentEl.getAttribute("data-evaluator") ||
            "";
          if (agentId.includes("devil")) setActiveTheme("devils_advocate");
          else if (agentId.includes("receipt") || agentId.includes("researcher"))
            setActiveTheme("receipts");
          else if (agentId.includes("builder")) setActiveTheme("builder");
          else if (agentId.includes("operator")) setActiveTheme("operator");
          else if (agentId.includes("judge") || agentId.includes("arbiter"))
            setActiveTheme("judge");
          else setActiveTheme("default");
        } else {
          setActiveTheme("default");
        }
      }
    };

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (shockwaveRef.current) {
        shockwaveRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(0.4)`;
        shockwaveRef.current.style.opacity = "0.9";
        // Force reflow
        void shockwaveRef.current.offsetWidth;
        shockwaveRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(2.6)`;
        shockwaveRef.current.style.opacity = "0";
      }
    };

    const handlePointerUp = () => {};

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener("pointermove", handlePointerMove as EventListener, { passive: true });
    window.addEventListener("mousemove", handlePointerMove as EventListener, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown as EventListener, { passive: true });
    window.addEventListener("mousedown", handlePointerDown as EventListener, { passive: true });
    window.addEventListener("pointerup", handlePointerUp as EventListener, { passive: true });
    window.addEventListener("mouseup", handlePointerUp as EventListener, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove as EventListener);
      window.removeEventListener("mousemove", handlePointerMove as EventListener);
      window.removeEventListener("pointerdown", handlePointerDown as EventListener);
      window.removeEventListener("mousedown", handlePointerDown as EventListener);
      window.removeEventListener("pointerup", handlePointerUp as EventListener);
      window.removeEventListener("mouseup", handlePointerUp as EventListener);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [isEnabled, isCoarsePointer, isVisible]);

  if (!isEnabled || isCoarsePointer) return null;

  const colorConfig = AGENT_COLORS[activeTheme] || AGENT_COLORS.default;

  return (
    <div
      data-testid="cursor-lighting-container"
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-[99999] transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* 1. Ambient Dynamic Spotlight Beam */}
      <div
        ref={spotlightRef}
        data-testid="cursor-spotlight"
        className="absolute top-0 left-0 -ml-[250px] -mt-[250px] w-[500px] h-[500px] rounded-full pointer-events-none transition-all duration-200 ease-out will-change-transform"
        style={{
          background: `radial-gradient(circle 250px at center, ${colorConfig.glow} 0%, ${colorConfig.glowFade} 45%, transparent 70%)`,
          transform: `translate3d(${spotlightPos.current.x}px, ${spotlightPos.current.y}px, 0)`,
          filter: isHovered ? "brightness(1.25)" : "none",
        }}
      />

      {/* 2. Light Core - Clean, dot-free reticle anchor */}
      <div
        ref={reticleRef}
        data-testid="cursor-reticle"
        className="absolute top-0 left-0 pointer-events-none will-change-transform flex items-center justify-center -ml-[6px] -mt-[6px] w-[12px] h-[12px]"
        style={{
          transform: `translate3d(${reticlePos.current.x}px, ${reticlePos.current.y}px, 0)`,
        }}
      />

      {/* 3. Crucible Ignition Shockwave (Click Pulse) */}
      <div
        ref={shockwaveRef}
        data-testid="cursor-shockwave"
        className="absolute top-0 left-0 -ml-[25px] -mt-[25px] w-[50px] h-[50px] rounded-full pointer-events-none transition-all duration-350 ease-out opacity-0 border-2"
        style={{
          borderColor: colorConfig.primary,
          boxShadow: `0 0 16px ${colorConfig.primary}`,
        }}
      />
    </div>
  );
};

export default CursorLighting;
