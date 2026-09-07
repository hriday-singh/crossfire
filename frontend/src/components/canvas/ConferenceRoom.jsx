import React, { useState, useEffect, useCallback } from 'react';
import { Assets, Texture } from 'pixi.js';
import {
  ROOM_DIMENSIONS,
  JUDGE_TABLE_CONFIG,
  CUBICLE_LAYOUTS,
} from '../../constants/roomLayout';

/**
 * ConferenceRoom (CubicleOffice) Component
 * Renders the high-resolution isometric floor plan from public/flplan.webp
 * and provides interactive station illumination when an evaluator or Judge is active or hovered.
 */
export function ConferenceRoom({ activeSpeakerId, hoveredAgentId, isJudgeExiting = false }) {
  const [floorTexture, setFloorTexture] = useState(() => {
    try {
      return Texture.from('/bg.png');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;
    Assets.load('/bg.png')
      .then((tex) => {
        if (isMounted) setFloorTexture(tex);
      })
      .catch((err) => {
        console.warn('Fallback: Assets.load /bg.png failed', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Subtle interactive neon lighting over workstations and door when hovered or active
  const drawHighlights = useCallback(
    (g) => {
      g.clear();

      // 1. Cubicle highlights on hover or when actively testing
      CUBICLE_LAYOUTS.forEach((c) => {
        const isHovered = hoveredAgentId === c.agentId;
        const isActive = activeSpeakerId === c.agentId;

        if (isHovered || isActive) {
          const { x, y, width, height } = c.bounds;
          // Outer subtle aura
          g.roundRect(x - 4, y - 4, width + 8, height + 8, 12).stroke({
            width: isHovered ? 2 : 1.5,
            color: c.colorHex,
            alpha: isHovered ? 0.75 : 0.45,
          });
          // Inner ambient glow
          g.roundRect(x, y, width, height, 10).fill({
            color: c.colorHex,
            alpha: isHovered ? 0.08 : 0.04,
          });
        }
      });

      // 2. Judge Bench highlight on hover or during verdict delivery
      const isJudgeHovered = hoveredAgentId === 'judge';
      const isJudgeActive = activeSpeakerId === 'judge' || activeSpeakerId === 'arbiter';

      if (isJudgeHovered || isJudgeActive) {
        g.ellipse(JUDGE_TABLE_CONFIG.x, JUDGE_TABLE_CONFIG.y, 140, 60).stroke({
          width: isJudgeHovered ? 2 : 1.5,
          color: 0x60a5fa,
          alpha: isJudgeHovered ? 0.85 : 0.5,
        });
        g.ellipse(JUDGE_TABLE_CONFIG.x, JUDGE_TABLE_CONFIG.y, 140, 60).fill({
          color: 0x60a5fa,
          alpha: isJudgeHovered ? 0.1 : 0.05,
        });
      }

      // 3. Right Chamber Door exit portal aura (when Judge is exiting or hovered)
      if (isJudgeExiting) {
        // Outer pulsing portal ring
        g.ellipse(897, 246, 30, 48).stroke({
          width: 3,
          color: 0x34d399,
          alpha: 0.9,
        });
        // Inner portal radiance
        g.ellipse(897, 246, 26, 44).fill({
          color: 0x34d399,
          alpha: 0.25,
        });
        g.ellipse(897, 246, 12, 24).fill({
          color: 0xffffff,
          alpha: 0.4,
        });
      }
    },
    [hoveredAgentId, activeSpeakerId, isJudgeExiting]
  );

  return (
    <pixiContainer zIndex={0}>
      {/* Sci-Fi Bullpen Floor Plan Sprite */}
      {floorTexture && (
        <pixiSprite
          texture={floorTexture}
          width={ROOM_DIMENSIONS.width}
          height={ROOM_DIMENSIONS.height}
        />
      )}

      {/* Interactive Workstation Illumination Overlay */}
      <pixiGraphics draw={drawHighlights} />
    </pixiContainer>
  );
}

export default ConferenceRoom;
