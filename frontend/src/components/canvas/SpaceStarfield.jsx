import React, { useEffect, useRef } from 'react';

/**
 * SpaceStarfield Component
 * Renders glowing, twinkling stars slowly drifting across space behind/under the main floor.
 */
export function SpaceStarfield({
  className = "absolute inset-0 w-full h-full pointer-events-none z-0",
  backgroundColor = "#000000",
} = {}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;

    // Generate stars with varied depth, twinkle, and slow drift velocity
    let stars = [];

    const initStars = (w, h) => {
      stars = [];
      // Consistent star density matching the original bullpen stage look across any display size
      const count = Math.max(90, Math.floor((w * h) / 8500));
      for (let i = 0; i < count; i++) {
        // Star depth layer (0 = far/tiny, 1 = mid, 2 = near/bright)
        const depth = Math.random();
        // 1.3x bigger stars
        const baseRadius = depth < 0.65 ? 0.6 + Math.random() * 0.5 : depth < 0.9 ? 1.1 + Math.random() * 0.4 : 1.6 + Math.random() * 0.6;
        const radius = Number((baseRadius * 1.3).toFixed(2));
        // 1.3x brighter base alpha
        const baseAlpha = Math.min(1.0, (0.35 + Math.random() * 0.5) * 1.25);
        const twinkleSpeed = 0.018 + Math.random() * 0.038;
        const phase = Math.random() * Math.PI * 2;
        // 1.5x faster motion drift
        const speed = (0.08 + radius * 0.06) * 1.5;
        const vx = speed * (0.8 + Math.random() * 0.4);
        const vy = -speed * (0.3 + Math.random() * 0.3);

        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius,
          baseAlpha,
          currentAlpha: baseAlpha,
          twinkleSpeed,
          phase,
          vx,
          vy,
          hasGlow: radius > 1.4,
        });
      }
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      if (stars.length === 0) {
        initStars(width, height);
      }
    };

    handleResize();
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas);
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 16.666, 2.0); // Normalize to 60fps delta
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Outside the spaceship: pure pitch black space
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Draw all stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Animate position (1.5x faster motion)
        star.x += star.vx * dt;
        star.y += star.vy * dt;

        // Wrap around borders
        if (star.x > width + 10) {
          star.x = -10;
          star.y = Math.random() * height;
        } else if (star.x < -10) {
          star.x = width + 10;
        }

        if (star.y < -10) {
          star.y = height + 10;
          star.x = Math.random() * width;
        } else if (star.y > height + 10) {
          star.y = -10;
        }

        // Animate twinkle (1.3x brighter)
        star.phase += star.twinkleSpeed * dt;
        const twinkleFactor = Math.sin(star.phase);
        star.currentAlpha = Math.max(0.25, Math.min(1.0, star.baseAlpha + twinkleFactor * 0.35));

        // Draw star with glow if applicable
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);

        if (star.hasGlow) {
          ctx.shadowBlur = 5 * star.radius;
          ctx.shadowColor = `rgba(255, 255, 255, ${star.currentAlpha})`;
          ctx.fillStyle = `rgba(255, 255, 255, ${star.currentAlpha})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(255, 255, 255, ${star.currentAlpha})`;
        }

        ctx.fill();
      }

      // Reset shadow blur
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
    />
  );
}

export default SpaceStarfield;
