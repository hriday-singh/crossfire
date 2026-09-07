import React, { useEffect, useRef } from "react";

export interface BlueprintParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
  type: "ring" | "marker" | "streak" | "data_node";
  length?: number;
  angle?: number;
}

interface RocketTrailCanvasProps {
  active: boolean;
  emitterPos: { x: number; y: number; angle: number; speed: number } | null;
  className?: string;
}

export const RocketTrailCanvas: React.FC<RocketTrailCanvasProps> = ({
  active,
  emitterPos,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<BlueprintParticle[]>([]);
  const animIdRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Handle high DPI
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const bpColors = [
      "rgba(56, 189, 248, ", // Technical Cyan (#38bdf8)
      "rgba(96, 165, 250, ", // Electric Blueprint Blue (#60a5fa)
      "rgba(103, 232, 249, ", // Laser Cyan (#67e8f9)
      "rgba(224, 242, 254, ", // Pure Luminous White-Blue
    ];

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Spawn blueprint particles if emitter is active
      if (active && emitterPos && emitterPos.speed > 0.01) {
        const emitInterval = 14; // ms
        if (time - lastEmitRef.current > emitInterval) {
          lastEmitRef.current = time;

          // Compute backward velocity vector based on rocket heading angle
          const rad = (emitterPos.angle * Math.PI) / 180;
          const backX = -Math.cos(rad);
          const backY = -Math.sin(rad);

          // 1. Technical CAD Shock Ring (Expanding wireframe circle)
          particlesRef.current.push({
            x: emitterPos.x,
            y: emitterPos.y,
            vx: backX * 45 + (Math.random() - 0.5) * 15,
            vy: backY * 45 + (Math.random() - 0.5) * 15,
            radius: 8,
            maxRadius: 36 + Math.random() * 24,
            alpha: 0.85,
            maxLife: 0.6,
            life: 0,
            color: bpColors[0],
            type: "ring",
          });

          // 2. Blueprint Telemetry Cross Marker / Data Node
          if (Math.random() > 0.3) {
            particlesRef.current.push({
              x: emitterPos.x + (Math.random() - 0.5) * 16,
              y: emitterPos.y + (Math.random() - 0.5) * 16,
              vx: backX * (80 + Math.random() * 80) + (Math.random() - 0.5) * 20,
              vy: backY * (80 + Math.random() * 80) + (Math.random() - 0.5) * 20,
              radius: 4,
              maxRadius: 4,
              alpha: 0.9,
              maxLife: 0.45 + Math.random() * 0.25,
              life: 0,
              color: bpColors[Math.floor(Math.random() * bpColors.length)],
              type: "marker",
            });
          }

          // 3. Technical Laser Velocity Streak
          if (Math.random() > 0.4) {
            particlesRef.current.push({
              x: emitterPos.x + (Math.random() - 0.5) * 14,
              y: emitterPos.y + (Math.random() - 0.5) * 14,
              vx: backX * (160 + Math.random() * 140),
              vy: backY * (160 + Math.random() * 140),
              radius: 1.5,
              maxRadius: 1,
              alpha: 0.8,
              maxLife: 0.3 + Math.random() * 0.2,
              life: 0,
              color: bpColors[3],
              type: "streak",
              length: 20 + Math.random() * 35,
              angle: emitterPos.angle,
            });
          }
        }
      }

      // Update and draw all active particles
      const remaining: BlueprintParticle[] = [];

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        p.life += dt;
        const progress = p.life / p.maxLife;

        if (progress >= 1) continue;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;

        const currentAlpha = p.alpha * (1 - Math.pow(progress, 1.2));
        const currentRadius = p.radius + (p.maxRadius - p.radius) * progress;

        ctx.strokeStyle = `${p.color}${currentAlpha.toFixed(3)})`;
        ctx.fillStyle = `${p.color}${currentAlpha.toFixed(3)})`;

        if (p.type === "ring") {
          // CAD wireframe circle with dashed stroke
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, currentRadius), 0, Math.PI * 2);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else if (p.type === "marker") {
          // Technical CAD Plus Crosshair
          const size = 3.5;
          ctx.beginPath();
          ctx.moveTo(p.x - size, p.y);
          ctx.lineTo(p.x + size, p.y);
          ctx.moveTo(p.x, p.y - size);
          ctx.lineTo(p.x, p.y + size);
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (p.type === "streak") {
          // High-speed Laser Vector Streak
          const streakLen = p.length || 20;
          const rad = ((p.angle || 0) * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(rad) * streakLen, p.y - Math.sin(rad) * streakLen);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        remaining.push(p);
      }

      particlesRef.current = remaining;

      if (active || remaining.length > 0) {
        animIdRef.current = requestAnimationFrame(render);
      }
    };

    animIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [active, emitterPos]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-30 ${className}`}
      aria-hidden="true"
    />
  );
};

export default RocketTrailCanvas;
