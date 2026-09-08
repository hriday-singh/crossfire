import React, { useRef, useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import ConferenceRoom from './ConferenceRoom';
import CharacterSprite from './CharacterSprite';
import DevilBotSprite from './DevilBotSprite';
import { ROOM_DIMENSIONS } from '../../constants/roomLayout';
import { STEELMAN_CONFIG } from '../../constants/agentConfigs';

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
 * sortable depth container, and renders the 4 cubicle workstations + Steelman Arbiter.
 */
export function StageContainer({
  agents = [],
  selectedAgentIds = null,
  isSynthesisDone = false,
  isLoadingDone = false,
  loadingProgress = 0,
  characterPositions = {},
  currentActionPacket = null,
  activeSpeakerId = null,
  hoveredAgentId = null,
  isSteelmanExiting = false,
  onHoverAgent = () => { },
  onPositionUpdate = () => { },
  playSfx = () => { },
  children = null,
}) {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[1000/587] max-w-[min(1200px,calc((100vh-15rem)*1.70358))] mx-auto rounded-xl overflow-hidden shadow-2xl border border-outline-variant/70 bg-surface-container-lowest flex items-center justify-center select-none"
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
          className="w-full h-full object-fill pointer-events-auto"
        >
          {/* Main Stage Sortable Container: sortableChildren ensures 2.5D dynamic depth layering */}
          <pixiContainer sortableChildren={true}>
            {/* Room Floor, Acoustic Partitions, Steelman Monolith Desk, 4 Cubicles */}
            <ConferenceRoom
              activeSpeakerId={activeSpeakerId}
              hoveredAgentId={hoveredAgentId}
              isSteelmanExiting={isSteelmanExiting}
            />

            {/* Crucible Arbiter (Steelman) presiding at the center bench */}
            <DevilBotSprite
              key="steelman"
              agent={STEELMAN_CONFIG}
              isSelected={true}
              isSynthesisDone={isSynthesisDone}
              isLoadingDone={isLoadingDone}
              loadingProgress={loadingProgress}
              characterPositions={characterPositions}
              currentActionPacket={currentActionPacket?.speaker_id === 'steelman' ? currentActionPacket : null}
              isSpeaking={activeSpeakerId === 'steelman'}
              isHovered={hoveredAgentId === 'steelman'}
              onHover={onHoverAgent}
              onPositionUpdate={onPositionUpdate}
              playSfx={playSfx}
            />

            {/* Dynamic AI Evaluator Avatars at their dedicated cubicles */}
            {agents.map((agent) => {
              const isSelected = selectedAgentIds ? selectedAgentIds.includes(agent.id) : true;
              return (
                <DevilBotSprite
                  key={agent.id}
                  agent={agent}
                  isSelected={isSelected}
                  characterPositions={characterPositions}
                  currentActionPacket={isSelected ? currentActionPacket : null}
                  isSpeaking={isSelected && activeSpeakerId === agent.id}
                  isHovered={hoveredAgentId === agent.id}
                  onHover={onHoverAgent}
                  onPositionUpdate={onPositionUpdate}
                  playSfx={playSfx}
                />
              );
            })}
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
