/**
 * Procedural Texture & Graphics Helpers
 * Creates clean, professional canvas textures and drawing routines for the 2.5D simulation.
 */

// Generate a boardroom floor tile texture (subtle executive slate & warm wood grid)
export function createFloorCanvas(width = 1000, height = 650) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Deep modern dark boardroom floor background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0f172a'); // slate-900
  bgGrad.addColorStop(0.5, '#111827'); // gray-900
  bgGrad.addColorStop(1, '#0b0f19');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Modern floor grid lines
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)'; // slate-700 subtle
  ctx.lineWidth = 1;
  const tileSize = 50;

  for (let x = 0; x <= width; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Large subtle conference rug beneath the table area
  const rugX = 260;
  const rugY = 220;
  const rugW = 480;
  const rugH = 280;
  const rugRadius = 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rugX, rugY, rugW, rugH, rugRadius);
  const rugGrad = ctx.createLinearGradient(rugX, rugY, rugX, rugY + rugH);
  rugGrad.addColorStop(0, 'rgba(30, 41, 59, 0.7)');
  rugGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
  ctx.fillStyle = rugGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)'; // sky-400 accent ring
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rug inner perimeter accent
  ctx.beginPath();
  ctx.roundRect(rugX + 8, rugY + 8, rugW - 16, rugH - 16, rugRadius - 4);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Ambient lighting glow above table
  const lightGlow = ctx.createRadialGradient(500, 360, 40, 500, 360, 340);
  lightGlow.addColorStop(0, 'rgba(96, 165, 250, 0.12)');
  lightGlow.addColorStop(0.6, 'rgba(96, 165, 250, 0.03)');
  lightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lightGlow;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

// Generate an audio beep/speech synth sound buffer using Web Audio API
export function createSpeechAudioBlip(frequency = 260, duration = 0.08, type = 'sine') {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.15, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // AudioContext autoplay might be blocked before first gesture
    console.warn('Audio play prevented', e);
  }
}
