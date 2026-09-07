import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { AnimatedSprite, Container, Graphics } from 'pixi.js';
import { extend } from '@pixi/react';

extend({
  Container,
  AnimatedSprite,
  Graphics,
});
import gsap from 'gsap';
import { WAYPOINTS, resolveApproachSpot } from '../../constants/roomLayout';
import { getSpriteConfig } from '../../constants/spriteConfigs';

/**
 * DevilBotSprite (AgentBotSprite) Component
 * Renders an animated 2.5D evaluator bot or Arbiter sprite using its dedicated spritesheet:
 * - Devil's Advocate: /devil_thing.webp
 * - Operator: /operator_thing.webp
 * - Builder: /builder_thing.webp
 * - Receipts / Researcher: /researcher_thing.webp
 * - Crucible Arbiter / Judge: /judge_thing.webp
 */
/**
 * Calculates a collision-free, shortest waypoint path around the central table.
 * Dedicated clearance spots per AI (standing back from table):
 * - Builder: NW Clearance Spot (380, 355)
 * - Devil's Advocate: SW Clearance Spot (430, 380)
 * - Receipts: NE Clearance Spot (620, 355)
 * - Operator: SE Clearance Spot (570, 380)
 * - Judge Exit: Right Chamber Door (880, 285)
 */
export function getPathPoints(startX, startY, targetWp) {
  const targetX = targetWp.x;
  const targetY = targetWp.y;
  const targetId = targetWp.id;

  // --- 1. Right Chamber Door Exit (Judge Exit Sequence) ---
  if (targetId === 'right_door') {
    if (startY < 235) {
      // From Judge Chair (500, 215) -> move around right of table towards door
      return [
        { x: 620, y: 246 },
        { x: targetX, y: targetY, facing: 'east' },
      ];
    } else if (startY > 300) {
      // From South zone
      return [
        { x: 645, y: 380 },
        { x: 645, y: 246 },
        { x: targetX, y: targetY, facing: 'east' },
      ];
    } else {
      return [{ x: targetX, y: targetY, facing: 'east' }];
    }
  }

  // --- 2. Dedicated Table Spots (Direct Diagonal Paths from/to Cubicles) ---
  // Builder: Cubicle 1 (NW) <-> NW Table Spot (395, 245)
  if (targetId === 'judge_spot_builder') {
    return [
      { x: 329, y: 200 },
      { x: targetX, y: targetY, facing: 'east' },
    ];
  }
  const isStartingFromBuilderSpot = Math.hypot(startX - 395, startY - 245) < 40;
  if (isStartingFromBuilderSpot && (targetId === 'cubicle_1_desk' || targetId === 'cubicle_1_stand')) {
    return [
      { x: 329, y: 200 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }

  // Devil's Advocate: Cubicle 2 (SW) <-> SW Table Spot (415, 335)
  if (targetId === 'judge_spot_devils_advocate') {
    return [
      { x: 329, y: 381 },
      { x: targetX, y: targetY, facing: 'east' },
    ];
  }
  const isStartingFromDevilSpot = Math.hypot(startX - 415, startY - 335) < 40;
  if (isStartingFromDevilSpot && (targetId === 'cubicle_2_desk' || targetId === 'cubicle_2_stand')) {
    return [
      { x: 329, y: 381 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
    ];
  }

  // Receipts / Researcher: Cubicle 3 (NE) <-> NE Table Spot (605, 245)
  if (targetId === 'judge_spot_receipts') {
    return [
      { x: 670, y: 200 },
      { x: targetX, y: targetY, facing: 'west' },
    ];
  }
  const isStartingFromReceiptsSpot = Math.hypot(startX - 605, startY - 245) < 40;
  if (isStartingFromReceiptsSpot && (targetId === 'cubicle_3_desk' || targetId === 'cubicle_3_stand')) {
    return [
      { x: 670, y: 200 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }

  // Operator: Cubicle 4 (SE) <-> SE Table Spot (585, 335)
  if (targetId === 'judge_spot_operator') {
    return [
      { x: 670, y: 381 },
      { x: targetX, y: targetY, facing: 'west' },
    ];
  }
  const isStartingFromOperatorSpot = Math.hypot(startX - 585, startY - 335) < 40;
  if (isStartingFromOperatorSpot && (targetId === 'cubicle_4_desk' || targetId === 'cubicle_4_stand')) {
    return [
      { x: 670, y: 381 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
    ];
  }

  // --- 3. Center Podium Target / Start (Legacy fallback) ---
  const isCenterPodiumTarget =
    targetId === 'podium_approach' ||
    targetId === 'judge_approach' ||
    targetId === 'judge_approach_south' ||
    targetId === 'presentation_podium';
  const isStartingFromCenterPodium = startY >= 310 && startY <= 410 && startX >= 440 && startX <= 560;

  const isWestApproachTarget = targetId === 'judge_approach_west';
  const isStartingFromWestApproach = startY >= 250 && startY <= 320 && startX >= 400 && startX <= 460;

  const isEastApproachTarget = targetId === 'judge_approach_east';
  const isStartingFromEastApproach = startY >= 250 && startY <= 320 && startX >= 540 && startX <= 600;

  if (isCenterPodiumTarget && startX < 420 && startY < 235) {
    return [
      { x: 365, y: 230 },
      { x: 365, y: 355 },
      { x: 500, y: 355 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }
  if (isStartingFromCenterPodium && targetX < 420 && targetY < 235) {
    return [
      { x: 500, y: 355 },
      { x: 365, y: 355 },
      { x: 365, y: 230 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }

  if (isCenterPodiumTarget && startX > 580 && startY < 235) {
    return [
      { x: 635, y: 230 },
      { x: 635, y: 355 },
      { x: 500, y: 355 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }
  if (isStartingFromCenterPodium && targetX > 580 && targetY < 235) {
    return [
      { x: 500, y: 355 },
      { x: 635, y: 355 },
      { x: 635, y: 230 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }

  if (isCenterPodiumTarget && startX < 420 && startY > 300) {
    return [
      { x: 365, y: 360 },
      { x: 500, y: 360 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }
  if (isStartingFromCenterPodium && targetX < 420 && targetY > 300) {
    return [
      { x: 500, y: 360 },
      { x: 365, y: 360 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
    ];
  }

  if (isCenterPodiumTarget && startX > 580 && startY > 300) {
    return [
      { x: 635, y: 360 },
      { x: 500, y: 360 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'north' },
    ];
  }
  if (isStartingFromCenterPodium && targetX > 580 && targetY > 300) {
    return [
      { x: 500, y: 360 },
      { x: 635, y: 360 },
      { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
    ];
  }

  // --- 4. West Approach Target / Start ---
  if (isWestApproachTarget) {
    if (startX <= 450) {
      return [
        { x: 365, y: startY < 250 ? 230 : 340 },
        { x: 365, y: 285 },
        { x: targetX, y: targetY, facing: 'east' },
      ];
    } else {
      return [
        { x: 635, y: 360 },
        { x: 500, y: 360 },
        { x: 365, y: 360 },
        { x: 365, y: 285 },
        { x: targetX, y: targetY, facing: 'east' },
      ];
    }
  }

  if (isStartingFromWestApproach) {
    if (targetX <= 450) {
      return [
        { x: 365, y: 285 },
        { x: 365, y: targetY < 250 ? 230 : 340 },
        { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
      ];
    } else {
      return [
        { x: 365, y: 285 },
        { x: 365, y: 360 },
        { x: 500, y: 360 },
        { x: 635, y: 360 },
        { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
      ];
    }
  }

  // --- 5. East Approach Target / Start ---
  if (isEastApproachTarget) {
    if (startX >= 550) {
      return [
        { x: 635, y: startY < 250 ? 230 : 340 },
        { x: 635, y: 285 },
        { x: targetX, y: targetY, facing: 'west' },
      ];
    } else {
      return [
        { x: 365, y: 360 },
        { x: 500, y: 360 },
        { x: 635, y: 360 },
        { x: 635, y: 285 },
        { x: targetX, y: targetY, facing: 'west' },
      ];
    }
  }

  if (isStartingFromEastApproach) {
    if (targetX >= 550) {
      return [
        { x: 635, y: 285 },
        { x: 635, y: targetY < 250 ? 230 : 340 },
        { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
      ];
    } else {
      return [
        { x: 635, y: 285 },
        { x: 635, y: 360 },
        { x: 500, y: 360 },
        { x: 365, y: 360 },
        { x: targetX, y: targetY, facing: targetWp.facing || 'south' },
      ];
    }
  }

  // Default: Direct path
  return [{ x: targetX, y: targetY, facing: targetWp.facing }];
}

export function DevilBotSprite({
  agent,
  characterPositions = {},
  currentActionPacket = null,
  isSpeaking = false,
  isHovered = false,
  onHover = () => {},
  onPositionUpdate = () => {},
  playSfx = () => {},
}) {
  const spriteConfig = getSpriteConfig(agent?.id);
  const initialWp = (agent?.initialWaypoint && WAYPOINTS[agent.initialWaypoint]) || WAYPOINTS.chair_north || { x: 400, y: 300, facing: 'south' };
  const initialFacing = agent?.initialFacing || initialWp.facing || 'south';

  // Track position in local state & ref for GSAP updates
  const [pos, setPos] = useState({
    x: initialWp.x,
    y: initialWp.y,
    facing: initialFacing,
    state: 'idle', 
  });

  const posRef = useRef({
    x: initialWp.x,
    y: initialWp.y,
    facing: initialFacing,
  });

  const walkTweenRef = useRef(null);
  const lastProcessedPacketIdRef = useRef(null);

  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const framesRef = useRef({ walk: [], turn: [] });

  // Load the sprite sheet and slice frames on mount or when sprite changes
  useEffect(() => {
    let isMounted = true;
    setTexturesLoaded(false);

    const loadTextures = async () => {
      try {
        const baseTexture = await PIXI.Assets.load(spriteConfig.assetUrl);
        if (baseTexture?.source) {
          baseTexture.source.scaleMode = 'nearest'; // Keep pixel art sharp
        }

        // Helper function to carve out sub-textures
        const sliceFrames = (boundsList) => {
          return boundsList.map((b) => {
            return new PIXI.Texture({
              source: baseTexture.source,
              frame: new PIXI.Rectangle(b.x, b.y, b.w, b.h),
            });
          });
        };

        if (isMounted) {
          framesRef.current = {
            walk: sliceFrames(spriteConfig.walkBounds),
            turn: sliceFrames(spriteConfig.turnBounds),
          };
          setTexturesLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load sprite textures for', agent?.id, err);
      }
    };

    loadTextures();
    return () => { isMounted = false; };
  }, [spriteConfig.assetUrl, agent?.id]);

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
    if (action === 'walk_to' && target) {
      const resolvedTargetId = resolveApproachSpot(agent.id, characterPositions, target);
      const targetWp = WAYPOINTS[resolvedTargetId] || WAYPOINTS[target];
      if (!targetWp) return;
      const startX = posRef.current.x;
      const startY = posRef.current.y;
      const targetX = targetWp.x;
      const targetY = targetWp.y;

      const walkingSpeed = 190;
      const waypointsToVisit = getPathPoints(startX, startY, targetWp);

      if (walkTweenRef.current) walkTweenRef.current.kill();

      const tl = gsap.timeline({
        onComplete: () => {
          const finalFacing = targetWp.facing || posRef.current.facing;
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

      let currentX = startX;
      let currentY = startY;

      waypointsToVisit.forEach((wp) => {
        const segDx = wp.x - currentX;
        const segDy = wp.y - currentY;
        const segDist = Math.hypot(segDx, segDy);
        if (segDist < 1) return;

        let segFacing = posRef.current.facing;
        if (Math.abs(segDx) > Math.abs(segDy)) {
          segFacing = segDx > 0 ? 'east' : 'west';
        } else {
          segFacing = segDy > 0 ? 'south' : 'north';
        }

        const segDuration = Math.max(0.15, segDist / walkingSpeed);

        tl.to(posRef.current, {
          x: wp.x,
          y: wp.y,
          duration: segDuration,
          ease: 'none',
          onStart: () => {
            posRef.current.facing = segFacing;
            setPos((prev) => ({ ...prev, facing: segFacing, state: 'walking' }));
          },
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
        });

        currentX = wp.x;
        currentY = wp.y;
      });

      walkTweenRef.current = tl;
    } else if (action === 'idle' || action === 'sit' || action === 'stand') {
      const targetWp = target && WAYPOINTS[target] ? WAYPOINTS[target] : (action === 'sit' ? initialWp : null);
      const finalFacing = targetWp?.facing || (target && WAYPOINTS[target]?.facing) || posRef.current.facing;
      posRef.current.facing = finalFacing;

      if (targetWp && (action === 'sit' || action === 'idle')) {
        posRef.current.x = targetWp.x;
        posRef.current.y = targetWp.y;
        setPos({
          x: targetWp.x,
          y: targetWp.y,
          state: 'idle',
          facing: finalFacing,
        });
        onPositionUpdate?.(agent.id, targetWp.x, targetWp.y);
      } else {
        setPos((prev) => ({ ...prev, state: 'idle', facing: finalFacing }));
      }
    }
  }, [currentActionPacket, agent.id, initialWp, onPositionUpdate, characterPositions]);

  // Cleanup tweens
  useEffect(() => {
    return () => {
      if (walkTweenRef.current) walkTweenRef.current.kill();
    };
  }, []);

  const spriteRef = useRef(null);

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
        initialFrame = 4; // Back View
        break;
      case 'east':
        initialFrame = 2; // Side (East)
        break;
      case 'west':
        initialFrame = 2; // Side (West, mirrored)
        break;
      case 'south':
      default:
        initialFrame = 0; // Front View
        break;
    }
  }

  // Synchronize frame with Pixi AnimatedSprite instance
  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite || !texturesLoaded) return;
    if (isWalking) {
      if (!sprite.playing && typeof sprite.play === 'function') {
        sprite.play();
      }
    } else {
      if (sprite.playing && typeof sprite.stop === 'function') {
        sprite.stop();
      }
      if (typeof sprite.gotoAndStop === 'function') {
        sprite.gotoAndStop(initialFrame);
      }
    }
  }, [isWalking, initialFrame, texturesLoaded, currentTextures]);

  const auraColor =
    agent?.id === 'devils_advocate' || agent?.id === 'agent_1'
      ? 0x818cf8
      : agent?.id === 'builder' || agent?.id === 'agent_3'
      ? 0xfbbf24
      : agent?.id === 'receipts' || agent?.id === 'agent_2'
      ? 0x34d399
      : agent?.id === 'operator' || agent?.id === 'agent_4'
      ? 0x60a5fa
      : 0x3b82f6;

  const drawShadowAndAura = useCallback(
    (g) => {
      g.clear();
      // 1. Ground Drop Shadow (grounds all evaluator bots firmly on the isometric floor)
      g.ellipse(0, 36, 20, 6.5).fill({
        color: 0x05070c,
        alpha: 0.45,
      });
      g.ellipse(0, 36, 12, 4).fill({
        color: 0x000000,
        alpha: 0.35,
      });

      // 2. Active Speaking / Hovering Cybernetic Aura Glow
      if (isSpeaking || isHovered) {
        g.ellipse(0, 10, 26, 36).stroke({
          width: isHovered ? 2 : 1.5,
          color: auraColor,
          alpha: isHovered ? 0.85 : 0.55,
        });
        g.ellipse(0, 10, 24, 34).fill({
          color: auraColor,
          alpha: isHovered ? 0.16 : 0.08,
        });
      }
    },
    [isSpeaking, isHovered, auraColor]
  );

  const zIndex = Math.round(pos.y);

  if (!texturesLoaded) {
    return null; // Don't render until textures are sliced
  }

  // If facing west (left), flip the sprite horizontally
  const flipSprite = pos.facing === 'west';
  const scale = spriteConfig.scale || 0.5;

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
      <pixiGraphics draw={drawShadowAndAura} />
      <pixiAnimatedSprite
        ref={spriteRef}
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

export { DevilBotSprite as AgentBotSprite };
export default DevilBotSprite;
