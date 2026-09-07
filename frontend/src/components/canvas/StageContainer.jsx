import React, { useRef, useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import ConferenceRoom from './ConferenceRoom';
import CharacterSprite from './CharacterSprite';
import DevilBotSprite from './DevilBotSprite';
import { ROOM_DIMENSIONS } from '../../constants/roomLayout';
import { JUDGE_CONFIG } from '../../constants/agentConfigs';
import { useCursorLighting } from '../../hooks/useCursorLighting';

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
  onHoverAgent = () => { },
  onPositionUpdate = () => { },
  playSfx = () => { },
  children = null,
}) {
  const containerRef = useRef(null);
  const { isEnabled: isCursorLightingEnabled } = useCursorLighting();
  const [stagePointer, setStagePointer] = useState({ x: 50, y: 50, active: false });

  const handlePointerMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 1000;
    const height = rect.height > 0 ? rect.height : 587;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / height) * 100));
    setStagePointer({ x, y, active: true });
  };

  const handlePointerLeave = () => {
    setStagePointer((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      className="relative w-full aspect-[1000/587] max-w-[1200px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-outline-variant/70 bg-surface-container-lowest flex items-center justify-center select-none"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 2.5D Bullpen Ambient Inspection Spotlight */}
      <div
        data-testid="stage-cursor-lighting"
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-10 ${stagePointer.active && isCursorLightingEnabled ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          background: `radial-gradient(circle 260px at ${stagePointer.x}% ${stagePointer.y}%, rgba(96, 165, 250, 0.15) 0%, rgba(96, 165, 250, 0.03) 45%, transparent 70%)`,
          mixBlendMode: 'screen',
        }}
      />
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
