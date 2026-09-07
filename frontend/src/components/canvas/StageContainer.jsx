import React, { useRef } from 'react';
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

/**
 * StageContainer Component
 * Manages Pixi canvas initialization, fixed 1000x650 viewport aspect ratio,
 * sortable depth container, and renders the 4 cubicle workstations + Judge Arbiter.
 */
export function StageContainer({
  agents = [],
  currentActionPacket = null,
  activeSpeakerId = null,
  hoveredAgentId = null,
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
        backgroundImage: "url('/flpan.webp')",
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
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
          />

          {/* Crucible Arbiter (Judge) presiding at the center bench */}
          <CharacterSprite
            key="judge"
            agent={JUDGE_CONFIG}
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

      {/* Render in-world HUD and overlays aligned to canvas coordinate space */}
      {children}
    </div>
  );
}

export default StageContainer;
