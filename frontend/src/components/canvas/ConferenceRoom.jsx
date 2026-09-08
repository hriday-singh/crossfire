import React, { useState, useEffect, useCallback } from 'react';
import { Assets, Texture } from 'pixi.js';
import {
  ROOM_DIMENSIONS,
  STEELMAN_TABLE_CONFIG,
} from '../../constants/roomLayout';

/**
 * ConferenceRoom (CubicleOffice) Component
 * Renders the high-resolution isometric floor plan from public/flplan.webp
 * and provides interactive station illumination when an evaluator or Steelman is active or hovered.
 */
export function ConferenceRoom({ activeSpeakerId, hoveredAgentId, isSteelmanExiting = false }) {
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

      // Cubicle stations get no box highlight; the hover pill above the desk is the affordance.

      // 2. Steelman Bench highlight on hover or during verdict delivery
      const isSteelmanHovered = hoveredAgentId === 'steelman';
      const isSteelmanActive = activeSpeakerId === 'steelman' || activeSpeakerId === 'arbiter';

      if (isSteelmanHovered || isSteelmanActive) {
        g.ellipse(STEELMAN_TABLE_CONFIG.x, STEELMAN_TABLE_CONFIG.y, 140, 60).stroke({
          width: isSteelmanHovered ? 2 : 1.5,
          color: 0x60a5fa,
          alpha: isSteelmanHovered ? 0.85 : 0.5,
        });
        g.ellipse(STEELMAN_TABLE_CONFIG.x, STEELMAN_TABLE_CONFIG.y, 140, 60).fill({
          color: 0x60a5fa,
          alpha: isSteelmanHovered ? 0.1 : 0.05,
        });
      }

      // 3. Right Chamber Door exit portal aura (when Steelman is exiting or hovered)
      if (isSteelmanExiting) {
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
    [hoveredAgentId, activeSpeakerId, isSteelmanExiting]
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
