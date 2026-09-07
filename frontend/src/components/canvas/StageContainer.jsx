import React, { useRef, useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import ConferenceRoom from './ConferenceRoom';
import CharacterSprite from './CharacterSprite';
import DevilBotSprite from './DevilBotSprite';
import { ROOM_DIMENSIONS } from '../../constants/roomLayout';
import { JUDGE_CONFIG } from '../../constants/agentConfigs';

// Register Pixi elements for declarative JSX usage in @pixi/react v8
extend({
  Container,
  Graphics,
  Sprite,
  Text,
});

const hasWebGL = typeof window !== 'undefined' && (() => {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
})();

/**
 * StageContainer Component
 * Manages Pixi canvas initialization, fixed 1000x650 viewport aspect ratio,
 * sortable depth container, and renders the 4 cubicle workstations + Judge Arbiter.
 */
export function StageContainer({
  agents = [],
  characterPositions = {},
  currentActionPacket = null,
  activeSpeakerId = null,
  hoveredAgentId = null,
  isJudgeExiting = false,
  onHoverAgent = () => {},
  onPositionUpdate = () => {},
  playSfx = () => {},
  children = null,
}) {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[1000/587] max-w-[1200px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-outline-variant/70 bg-surface-container-lowest flex items-center justify-center select-none"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {hasWebGL ? (
        <Application
          width={ROOM_DIMENSIONS.width}
          height={ROOM_DIMENSIONS.height}
          backgroundColor={0x0e0e11}
          backgroundAlpha={0}
          resolution={Math.min(window.devicePixelRatio || 1, 2)}
          autoDensity={true}
          antialias={true}
          className="w-full h-full object-contain pointer-events-auto"
        >
          {/* Main Stage Sortable Container: sortableChildren ensures 2.5D dynamic depth layering */}
          <pixiContainer sortableChildren={true}>
            {/* Room Floor, Acoustic Partitions, Judge Monolith Desk, 4 Cubicles */}
            <ConferenceRoom
              activeSpeakerId={activeSpeakerId}
              hoveredAgentId={hoveredAgentId}
              isJudgeExiting={isJudgeExiting}
            />

            {/* Crucible Arbiter (Judge) presiding at the center bench */}
            <DevilBotSprite
              key="judge"
              agent={JUDGE_CONFIG}
              characterPositions={characterPositions}
              currentActionPacket={currentActionPacket?.speaker_id === 'judge' ? currentActionPacket : null}
              isSpeaking={activeSpeakerId === 'judge'}
              isHovered={hoveredAgentId === 'judge'}
              onHover={onHoverAgent}
              onPositionUpdate={onPositionUpdate}
              playSfx={playSfx}
            />

            {/* Dynamic AI Evaluator Avatars at their dedicated cubicles */}
            {agents.map((agent) => (
              <DevilBotSprite
                key={agent.id}
                agent={agent}
                characterPositions={characterPositions}
                currentActionPacket={currentActionPacket}
                isSpeaking={activeSpeakerId === agent.id}
                isHovered={hoveredAgentId === agent.id}
                onHover={onHoverAgent}
                onPositionUpdate={onPositionUpdate}
                playSfx={playSfx}
              />
            ))}
          </pixiContainer>
        </Application>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-on-surface">
          <span className="material-symbols-outlined text-4xl text-primary mb-2">view_in_ar</span>
          <h3 className="font-code-md text-sm font-semibold text-on-surface mb-1">2.5D Evaluator Bullpen Stage</h3>
          <p className="font-body-xs text-xs text-outline max-w-sm">
            Canvas stage active. 4 Cubicle Workstations & Crucible Arbiter Bench.
          </p>
        </div>
      )}

      {/* Render in-world HUD and overlays aligned to canvas coordinate space */}
      {children}
    </div>
  );
}

export default StageContainer;
