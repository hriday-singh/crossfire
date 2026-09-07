import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { AnimatedSprite, Container } from 'pixi.js';
import { extend } from '@pixi/react';

extend({
  Container,
  AnimatedSprite,
});
import gsap from 'gsap';
import { WAYPOINTS } from '../../constants/roomLayout';

/**
 * DevilBotSprite Component
 * Renders the Devil Bot sprite using the provided 1024x1024 spritesheet.
 */
export function DevilBotSprite({
  agent,
  currentActionPacket,
  isSpeaking,
  isHovered = false,
  onHover = () => {},
  onPositionUpdate,
  playSfx,
}) {
  const initialWp = WAYPOINTS[agent.initialWaypoint] || WAYPOINTS.chair_north || { x: 400, y: 300, facing: 'south' };

  // Track position in local state & ref for GSAP updates
  const [pos, setPos] = useState({
    x: initialWp.x,
    y: initialWp.y,
    facing: initialWp.facing || 'south',
    state: 'idle', 
  });

  const posRef = useRef({
    x: initialWp.x,
    y: initialWp.y,
    facing: initialWp.facing || 'south',
  });

  const walkTweenRef = useRef(null);
  const lastProcessedPacketIdRef = useRef(null);

  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const framesRef = useRef({ walk: [], turn: [] });

  // Load the sprite sheet and slice frames on mount
  useEffect(() => {
    let isMounted = true;
    const loadTextures = async () => {
      // Load the base sprite sheet (assuming it's in public/assets/ or similar)
      const baseTexture = await PIXI.Assets.load('/devil_thing.webp');
      baseTexture.source.scaleMode = 'nearest'; // Keep pixel art sharp

      // Helper function to carve out sub-textures
      const sliceFrames = (boundsList) => {
        return boundsList.map((b) => {
          return new PIXI.Texture({
            source: baseTexture.source,
            frame: new PIXI.Rectangle(b.x, b.y, b.w, b.h),
          });
        });
      };

      const walkBounds = [
        // Row 1 (W-01 to W-05)
        { x: 35,  y: 70,  w: 180, h: 205 },
        { x: 228, y: 70,  w: 180, h: 205 },
        { x: 422, y: 70,  w: 180, h: 205 },
        { x: 616, y: 70,  w: 180, h: 205 },
        { x: 808, y: 70,  w: 180, h: 205 },
        // Row 2 (W-06 to W-10)
        { x: 35,  y: 345, w: 180, h: 205 },
        { x: 228, y: 345, w: 180, h: 205 },
        { x: 422, y: 345, w: 180, h: 205 },
        { x: 616, y: 345, w: 180, h: 205 },
        { x: 808, y: 345, w: 180, h: 205 },
      ];

      const turnBounds = [
        // Bottom Row (T-01 to T-08)
        // Indices: 0: Front, 1: Right, 2: Side, 3: Right Profile, 4: Back, 5: Left, 6: 3/4 View, 7: Front
        { x: 32,  y: 665, w: 124, h: 200 },
        { x: 153, y: 665, w: 124, h: 200 },
        { x: 271, y: 665, w: 124, h: 200 },
        { x: 390, y: 665, w: 124, h: 200 },
        { x: 508, y: 665, w: 124, h: 200 },
        { x: 627, y: 665, w: 124, h: 200 },
        { x: 746, y: 665, w: 124, h: 200 },
        { x: 864, y: 665, w: 124, h: 200 },
      ];

      if (isMounted) {
        framesRef.current = {
          walk: sliceFrames(walkBounds),
          turn: sliceFrames(turnBounds),
        };
        setTexturesLoaded(true);
      }
    };

    loadTextures();
    return () => { isMounted = false; };
  }, []);

  // Synchronize initial position
  useEffect(() => {
    onPositionUpdate?.(agent.id, initialWp.x, initialWp.y);
  }, [agent.id, initialWp.x, initialWp.y, onPositionUpdate]);

  // Handle incoming AI Action Packets
  useEffect(() => {
    if (!currentActionPacket || currentActionPacket.speaker_id !== agent.id) return;
    if (currentActionPacket.id && currentActionPacket.id === lastProcessedPacketIdRef.current) return;
    lastProcessedPacketIdRef.current = currentActionPacket.id;

    const { action, target } = currentActionPacket;

    // Actions that move the bot
    if (action === 'walk_to' && target && WAYPOINTS[target]) {
      const targetWp = WAYPOINTS[target];
      const startX = posRef.current.x;
      const startY = posRef.current.y;
      const targetX = targetWp.x;
      const targetY = targetWp.y;

      const dx = targetX - startX;
      const dy = targetY - startY;
      const distance = Math.hypot(dx, dy);

      let newFacing = posRef.current.facing;
      if (Math.abs(dx) > Math.abs(dy)) {
        newFacing = dx > 0 ? 'east' : 'west';
      } else {
        newFacing = dy > 0 ? 'south' : 'north';
      }

      posRef.current.facing = newFacing;
      setPos((prev) => ({ ...prev, facing: newFacing, state: 'walking' }));

      const walkingSpeed = 180;
      const duration = Math.max(0.5, distance / walkingSpeed);

      if (walkTweenRef.current) walkTweenRef.current.kill();

      walkTweenRef.current = gsap.to(posRef.current, {
        x: targetX,
        y: targetY,
        duration: duration,
        ease: 'none', // linear for pixel art walking
        onUpdate: () => {
          const curX = posRef.current.x;
          const curY = posRef.current.y;
          setPos((prev) => ({
            ...prev,
            x: curX,
            y: curY,
          }));
          onPositionUpdate?.(agent.id, curX, curY);
        },
        onComplete: () => {
          const finalFacing = targetWp.facing || newFacing;
          posRef.current.facing = finalFacing;
          setPos({
            x: targetX,
            y: targetY,
            facing: finalFacing,
            state: 'idle',
          });
          onPositionUpdate?.(agent.id, targetX, targetY);
        },
      });
    } else if (action === 'idle' || action === 'sit' || action === 'stand') {
      setPos((prev) => ({ ...prev, state: 'idle' }));
    }
  }, [currentActionPacket, agent.id, onPositionUpdate]);

  // Cleanup tweens
  useEffect(() => {
    return () => {
      if (walkTweenRef.current) walkTweenRef.current.kill();
    };
  }, []);

  const zIndex = Math.round(pos.y);
  
  if (!texturesLoaded) {
    return null; // Don't render until textures are sliced
  }

  const isWalking = pos.state === 'walking';
  
  let currentTextures = framesRef.current.turn; 
  let playing = false;
  let initialFrame = 0;

  if (isWalking) {
    currentTextures = framesRef.current.walk;
    playing = true;
  } else {
    playing = false;
    // Map facing to turn index:
    switch (pos.facing) {
      case 'north':
        initialFrame = 4; // Back
        break;
      case 'east':
        initialFrame = 2; // Side
        break;
      case 'west':
        initialFrame = 2; // Side (needs scale.x = -1)
        break;
      case 'south':
      default:
        initialFrame = 0; // Front
        break;
    }
  }

  // If facing west (left), flip the sprite horizontally
  const flipSprite = pos.facing === 'west';
  const scale = 0.5; // Adjust this scale to fit your room's grid size

  return (
    <pixiContainer
      x={pos.x}
      y={pos.y}
      zIndex={zIndex}
      eventMode="static"
      cursor="pointer"
      onpointerenter={() => onHover?.(agent.id)}
      onpointerleave={() => onHover?.(null)}
    >
      <pixiAnimatedSprite
        textures={currentTextures}
        isPlaying={playing}
        initialFrame={initialFrame}
        anchor={0.5}
        animationSpeed={isWalking ? 0.14 : 0.12}
        scale={{ x: flipSprite ? -scale : scale, y: scale }} 
      />
    </pixiContainer>
  );
}

export default DevilBotSprite;
