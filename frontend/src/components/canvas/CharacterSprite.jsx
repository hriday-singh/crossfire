import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { WAYPOINTS, CHAIR_IDS } from '../../constants/roomLayout';

/**
 * CharacterSprite Component
 * Renders an interactive 2D/2.5D character avatar in Pixi.js:
 * - GSAP waypoint tweening with dynamic duration based on 180px/s walking speed
 * - Walking bounce/bob tween during motion
 * - Realistic seated, idle, pointing, nodding (agree), and talking gesture states
 * - Dynamic zIndex sorting (zIndex = character.y) for natural 2.5D depth behind/in front of the table
 * - Procedural fallback graphics (shadow, body, head, directional indicator, speech waves, gesture arms)
 */
export function CharacterSprite({
  agent,
  currentActionPacket,
  isSpeaking,
  isHovered = false,
  onHover = () => {},
  onPositionUpdate,
  playSfx,
}) {
  const initialWp = WAYPOINTS[agent.initialWaypoint] || WAYPOINTS.chair_north;

  // Track position in local state & ref for GSAP updates
  const [pos, setPos] = useState({
    x: initialWp.x,
    y: initialWp.y,
    facing: initialWp.facing || 'south',
    state: initialWp.isChair ? 'seated' : 'idle',
  });

  const [gestureState, setGestureState] = useState('idle'); // 'idle' | 'point' | 'agree' | 'talk' | 'listen'
  const [bobOffset, setBobOffset] = useState({ y: 0, scaleY: 1, armAngle: 0, nodOffset: 0 });

  const posRef = useRef({
    x: initialWp.x,
    y: initialWp.y,
    facing: initialWp.facing || 'south',
  });

  const walkTweenRef = useRef(null);
  const bobTweenRef = useRef(null);
  const gestureTweenRef = useRef(null);
  const lastProcessedPacketIdRef = useRef(null);

  // Synchronize initial position with parent overlay
  useEffect(() => {
    onPositionUpdate?.(agent.id, initialWp.x, initialWp.y);
  }, [agent.id, initialWp.x, initialWp.y, onPositionUpdate]);

  // Handle incoming AI Action Packets directed to this agent
  useEffect(() => {
    if (!currentActionPacket || currentActionPacket.speaker_id !== agent.id) return;
    if (currentActionPacket.id && currentActionPacket.id === lastProcessedPacketIdRef.current) return;
    lastProcessedPacketIdRef.current = currentActionPacket.id;

    const { action, target, gesture } = currentActionPacket;

    // 1. Gesture & Workstation Activity processing
    if (gesture || action === 'type' || action === 'inspect' || action === 'think') {
      const activeGesture = gesture || action;
      setGestureState(activeGesture);
      if (gestureTweenRef.current) gestureTweenRef.current.kill();

      if (activeGesture === 'type') {
        playSfx?.('keystroke');
        // Fast rhythmic typing bob
        gestureTweenRef.current = gsap.to(bobOffset, {
          y: -2,
          armAngle: 0.3,
          duration: 0.09,
          repeat: 7,
          yoyo: true,
          ease: 'power1.inOut',
          onUpdate: () => setBobOffset((prev) => ({ ...prev, y: bobOffset.y, armAngle: bobOffset.armAngle })),
          onComplete: () => {
            setBobOffset((prev) => ({ ...prev, y: 0, armAngle: 0 }));
            setGestureState('idle');
          },
        });
      } else if (activeGesture === 'inspect') {
        playSfx?.('blip');
        // Lean forward into the monitor
        gestureTweenRef.current = gsap.to(bobOffset, {
          y: -4,
          scaleY: 0.94,
          duration: 0.3,
          yoyo: true,
          repeat: 3,
          ease: 'sine.inOut',
          onUpdate: () => setBobOffset((prev) => ({ ...prev, y: bobOffset.y, scaleY: bobOffset.scaleY })),
          onComplete: () => {
            setBobOffset((prev) => ({ ...prev, y: 0, scaleY: 1 }));
            setGestureState('idle');
          },
        });
      } else if (activeGesture === 'think') {
        playSfx?.('blip');
        // Thoughtful nod
        gestureTweenRef.current = gsap.to(bobOffset, {
          nodOffset: 4,
          duration: 0.2,
          repeat: 3,
          yoyo: true,
          ease: 'power1.inOut',
          onUpdate: () => setBobOffset((prev) => ({ ...prev, nodOffset: bobOffset.nodOffset })),
          onComplete: () => {
            setBobOffset((prev) => ({ ...prev, nodOffset: 0 }));
            setGestureState('idle');
          },
        });
      } else if (activeGesture === 'agree') {
        playSfx?.('agree');
        gestureTweenRef.current = gsap.to(bobOffset, {
          nodOffset: 5,
          duration: 0.16,
          repeat: 3,
          yoyo: true,
          ease: 'power1.inOut',
          onUpdate: () => setBobOffset((prev) => ({ ...prev, nodOffset: bobOffset.nodOffset })),
          onComplete: () => {
            setBobOffset((prev) => ({ ...prev, nodOffset: 0 }));
            setGestureState('idle');
          },
        });
      } else if (activeGesture === 'point') {
        playSfx?.('point');
        gestureTweenRef.current = gsap.to(bobOffset, {
          armAngle: 0.8,
          duration: 0.35,
          ease: 'back.out(2)',
          onUpdate: () => setBobOffset((prev) => ({ ...prev, armAngle: bobOffset.armAngle })),
          onComplete: () => {
            gsap.delayedCall(1.8, () => {
              gsap.to(bobOffset, {
                armAngle: 0,
                duration: 0.3,
                ease: 'power2.out',
                onUpdate: () => setBobOffset((prev) => ({ ...prev, armAngle: bobOffset.armAngle })),
                onComplete: () => setGestureState('idle'),
              });
            });
          },
        });
      }
    }

    // 2. Action: Stand Up at Cubicle
    if (action === 'stand') {
      playSfx?.('stand');
      const standWpKey = `${agent.id.replace('agent_1', 'cubicle_1').replace('agent_2', 'cubicle_2').replace('agent_3', 'cubicle_3').replace('agent_4', 'cubicle_4')}_stand`;
      const standWp = (target && WAYPOINTS[target]) ? WAYPOINTS[target] : (WAYPOINTS[standWpKey] || null);

      if (standWp) {
        setPos((prev) => ({
          ...prev,
          x: standWp.x,
          y: standWp.y,
          facing: standWp.facing || 'south',
          state: 'standing',
        }));
        posRef.current.x = standWp.x;
        posRef.current.y = standWp.y;
        posRef.current.facing = standWp.facing || 'south';
        onPositionUpdate?.(agent.id, standWp.x, standWp.y);
      } else {
        setPos((prev) => ({ ...prev, state: 'standing', facing: 'south' }));
      }
    }

    // 3. Action: Sit Down at Desk Chair
    else if (action === 'sit') {
      playSfx?.('sit');
      const deskWpKey = `${agent.id.replace('agent_1', 'cubicle_1').replace('agent_2', 'cubicle_2').replace('agent_3', 'cubicle_3').replace('agent_4', 'cubicle_4')}_desk`;
      const deskWp = (target && WAYPOINTS[target]) ? WAYPOINTS[target] : (WAYPOINTS[deskWpKey] || WAYPOINTS[agent.initialWaypoint]);

      if (deskWp) {
        setPos((prev) => ({
          ...prev,
          x: deskWp.x,
          y: deskWp.y,
          facing: deskWp.facing || 'north',
          state: 'seated',
        }));
        posRef.current.x = deskWp.x;
        posRef.current.y = deskWp.y;
        posRef.current.facing = deskWp.facing || 'north';
        onPositionUpdate?.(agent.id, deskWp.x, deskWp.y);
      } else {
        setPos((prev) => ({ ...prev, state: 'seated' }));
      }
    }

    // 4. Action: Walk To Waypoint
    else if (action === 'walk_to' && target && WAYPOINTS[target]) {
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
      if (bobTweenRef.current) bobTweenRef.current.kill();

      bobTweenRef.current = gsap.to(bobOffset, {
        y: -6,
        scaleY: 1.05,
        duration: 0.18,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        onUpdate: () => {
          setBobOffset((prev) => ({ ...prev, y: bobOffset.y, scaleY: bobOffset.scaleY }));
        },
      });

      walkTweenRef.current = gsap.to(posRef.current, {
        x: targetX,
        y: targetY,
        duration: duration,
        ease: 'power1.inOut',
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
          if (bobTweenRef.current) {
            bobTweenRef.current.kill();
            bobTweenRef.current = null;
          }
          setBobOffset((prev) => ({ ...prev, y: 0, scaleY: 1 }));

          const isChairWaypoint = CHAIR_IDS.includes(target) || Boolean(targetWp.isChair);
          const finalFacing = targetWp.facing || newFacing;

          posRef.current.facing = finalFacing;
          setPos({
            x: targetX,
            y: targetY,
            facing: finalFacing,
            state: isChairWaypoint ? 'seated' : (targetWp.isStanding ? 'standing' : 'idle'),
          });

          if (isChairWaypoint) {
            playSfx?.('sit');
          }

          onPositionUpdate?.(agent.id, targetX, targetY);
        },
      });
    }

    // 5. Action: Idle
    else if (action === 'idle') {
      setPos((prev) => ({ ...prev, state: CHAIR_IDS.includes(target) ? 'seated' : prev.state }));
      setGestureState('idle');
    }
  }, [currentActionPacket, agent.id, onPositionUpdate, playSfx, bobOffset]);

  // Clean up tweens on unmount
  useEffect(() => {
    return () => {
      if (walkTweenRef.current) walkTweenRef.current.kill();
      if (bobTweenRef.current) bobTweenRef.current.kill();
      if (gestureTweenRef.current) gestureTweenRef.current.kill();
    };
  }, []);

  // Procedural Avatar Graphic Drawer
  const drawCharacter = useCallback((g) => {
    g.clear();

    const isWalking = pos.state === 'walking';
    const isSeated = pos.state === 'seated';
    const isStanding = pos.state === 'standing';
    const facing = pos.facing; // 'north', 'south', 'east', 'west'

    const primaryColor = agent.primaryColorHex || 0x60a5fa;
    const accentColor = agent.accentColorHex || 0x93c5fd;
    const skinTone = agent.skinToneHex || 0xf5d0b0;
    const clothingDark = agent.clothingColor || 0x1e3a8a;

    // Seated vs Standing height adjustment
    const baseOffsetY = isSeated ? 10 : 0;
    const currentBobY = bobOffset.y + bobOffset.nodOffset;

    // 1. Drop Shadow under feet or chair
    const shadowScale = isWalking ? (1 - (Math.abs(currentBobY) * 0.04)) : (isStanding ? 1.1 : 0.9);
    g.ellipse(0, 20 + baseOffsetY, 18 * shadowScale, 7 * shadowScale).fill({ color: 0x000000, alpha: 0.5 });

    // 2. Evaluator Active / Hover Glow
    if (isHovered || isSpeaking) {
      const glowAlpha = isHovered ? 0.85 : 0.65;
      g.ellipse(0, -6 + currentBobY + baseOffsetY, 36, 42).stroke({
        width: isHovered ? 2.5 : 2,
        color: accentColor,
        alpha: glowAlpha,
      });
      g.ellipse(0, -6 + currentBobY + baseOffsetY, 42, 48).stroke({
        width: 1.5,
        color: accentColor,
        alpha: isHovered ? 0.5 : 0.35,
      });
    }

    // 3. Legs & Shoes (Drawn when standing or walking)
    const torsoY = 2 + currentBobY + baseOffsetY;
    if (!isSeated) {
      g.roundRect(-12, torsoY + 20, 9, 16, 2).fill({ color: clothingDark, alpha: 1 });
      g.roundRect(3, torsoY + 20, 9, 16, 2).fill({ color: clothingDark, alpha: 1 });
      // Polished dark shoes
      g.roundRect(-13, torsoY + 34, 11, 5, 2).fill({ color: 0x111114, alpha: 1 });
      g.roundRect(2, torsoY + 34, 11, 5, 2).fill({ color: 0x111114, alpha: 1 });
    }

    // 4. Torso / Body (Executive tailored suit/blazer)
    g.roundRect(-16, torsoY, 32, 22, 6).fill({ color: clothingDark, alpha: 1 });
    g.roundRect(-16, torsoY, 32, 22, 6).stroke({ width: 1.5, color: primaryColor, alpha: 0.9 });

    // Shirt collar / tie if not facing away
    if (facing !== 'north') {
      g.poly([-6, torsoY, 0, torsoY + 12, 6, torsoY]).fill({ color: 0xffffff, alpha: 0.95 });
      g.poly([-2, torsoY + 2, 0, torsoY + 14, 2, torsoY + 2]).fill({ color: primaryColor, alpha: 1 });
    }

    // 5. Arms & Workstation Gestures
    const armY = torsoY + 2;
    if (gestureState === 'type') {
      // Rapid keyboard typing arms over desk
      const typingBob = (Math.sin(Date.now() / 60) * 2);
      g.roundRect(-16, armY, 6, 12 + typingBob, 2).fill({ color: clothingDark, alpha: 1 });
      g.roundRect(10, armY, 6, 12 - typingBob, 2).fill({ color: clothingDark, alpha: 1 });
      g.circle(-13, armY + 12 + typingBob, 3).fill({ color: skinTone, alpha: 1 });
      g.circle(13, armY + 12 - typingBob, 3).fill({ color: skinTone, alpha: 1 });
    } else if (gestureState === 'point' || bobOffset.armAngle > 0) {
      const reachX = facing === 'west' ? -32 : 32;
      g.moveTo(facing === 'west' ? -14 : 14, armY + 4)
        .lineTo(reachX, armY - 8)
        .stroke({ width: 5, color: clothingDark, alpha: 1 });
      g.circle(reachX, armY - 8, 4).fill({ color: skinTone, alpha: 1 });
      g.moveTo(reachX, armY - 8)
        .lineTo(reachX + (facing === 'west' ? -36 : 36), armY - 18)
        .stroke({ width: 2, color: accentColor, alpha: 0.7 });
    } else {
      // Normal arms
      g.roundRect(-18, armY, 6, 16, 3).fill({ color: clothingDark, alpha: 1 });
      g.roundRect(12, armY, 6, 16, 3).fill({ color: clothingDark, alpha: 1 });
      g.circle(-15, armY + 16, 3).fill({ color: skinTone, alpha: 1 });
      g.circle(15, armY + 16, 3).fill({ color: skinTone, alpha: 1 });
    }

    // 6. Head & Face
    const headY = -14 + currentBobY + baseOffsetY;
    const headRadius = 14;

    // Hair base
    g.circle(0, headY, headRadius + 1).fill({ color: 0x1c1917, alpha: 1 });
    // Face skin
    g.circle(0, headY, headRadius).fill({ color: skinTone, alpha: 1 });
    // Hair styling
    g.roundRect(-headRadius, headY - headRadius, headRadius * 2, 9, 4).fill({ color: 0x1c1917, alpha: 1 });

    if (facing === 'north') {
      // Facing monitors: Headset band and back of hair
      g.circle(0, headY - 1, headRadius).fill({ color: 0x1c1917, alpha: 1 });
      g.moveTo(-headRadius, headY).quadraticCurveTo(0, headY - headRadius + 2, headRadius, headY).stroke({ width: 2.5, color: primaryColor, alpha: 0.9 });
    } else if (facing === 'south') {
      // Facing viewer: Eyes, glasses, expression
      g.ellipse(-4, headY, 2, 2.5).fill({ color: 0x1e293b, alpha: 1 });
      g.ellipse(4, headY, 2, 2.5).fill({ color: 0x1e293b, alpha: 1 });
      // Smart glasses / visor
      g.roundRect(-9, headY - 4, 8, 7, 2).stroke({ width: 1.5, color: primaryColor, alpha: 0.9 });
      g.roundRect(1, headY - 4, 8, 7, 2).stroke({ width: 1.5, color: primaryColor, alpha: 0.9 });
      g.moveTo(-1, headY).lineTo(1, headY).stroke({ width: 1.5, color: primaryColor, alpha: 0.9 });
      // Mouth
      g.moveTo(-3, headY + 7).lineTo(3, headY + 7).stroke({ width: 1.2, color: 0x78350f, alpha: 0.8 });
    } else if (facing === 'east') {
      g.ellipse(4, headY, 2, 2.5).fill({ color: 0x1e293b, alpha: 1 });
      g.poly([8, headY, 11, headY + 2, 8, headY + 4]).fill({ color: skinTone, alpha: 1 });
      g.moveTo(4, headY + 7).lineTo(7, headY + 7).stroke({ width: 1.2, color: 0x78350f, alpha: 0.8 });
    } else if (facing === 'west') {
      g.ellipse(-4, headY, 2, 2.5).fill({ color: 0x1e293b, alpha: 1 });
      g.poly([-8, headY, -11, headY + 2, -8, headY + 4]).fill({ color: skinTone, alpha: 1 });
      g.moveTo(-7, headY + 7).lineTo(-4, headY + 7).stroke({ width: 1.2, color: 0x78350f, alpha: 0.8 });
    }

    // 7. Evaluator Badge Tag Pill (Directly above character)
    const tagY = headY - 24;
    g.roundRect(-24, tagY, 48, 14, 4).fill({ color: 0x131316, alpha: 0.95 });
    g.roundRect(-24, tagY, 48, 14, 4).stroke({ width: isHovered ? 2 : 1.5, color: (isSpeaking || isHovered) ? accentColor : primaryColor, alpha: 1 });

    // Status dot
    const statusColor = isSpeaking ? 0x38bdf8 : (isStanding ? 0xa78bfa : (gestureState === 'type' ? 0x34d399 : 0x60a5fa));
    g.circle(-16, tagY + 7, 3).fill({ color: statusColor, alpha: 1 });
  }, [agent, pos, gestureState, bobOffset, isSpeaking, isHovered]);

  const zIndex = Math.round(pos.y);

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
      <pixiGraphics draw={drawCharacter} />
    </pixiContainer>
  );
}

export default CharacterSprite;
