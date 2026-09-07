import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DevilBotSprite from '../components/canvas/DevilBotSprite';
import * as PIXI from 'pixi.js';

// Mock PIXI and @pixi/react
vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn().mockResolvedValue({ source: { scaleMode: '' } }) },
  Texture: vi.fn().mockImplementation(() => ({})),
  Rectangle: vi.fn(),
  AnimatedSprite: class {},
  Container: class {},
  Graphics: class {}
}));

vi.mock('@pixi/react', () => ({
  extend: vi.fn()
}));

vi.mock('gsap', () => ({
  default: {
    to: vi.fn(() => ({ kill: vi.fn() }))
  }
}));

describe('DevilBotSprite', () => {
  const mockAgent = { id: 'agent_1', initialWaypoint: 'cubicle_1_desk' };
  const baseProps = {
    agent: mockAgent,
    currentActionPacket: null,
    isSpeaking: false,
    onPositionUpdate: vi.fn(),
    playSfx: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initially renders nothing while textures are loading', () => {
    const { container } = render(<DevilBotSprite {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('loads textures and renders pixi elements', async () => {
    const { container } = render(<DevilBotSprite {...baseProps} />);
    
    // Wait for the PIXI.Assets.load promise to resolve and state to update
    await waitFor(() => {
      // Because jsdom doesn't know about pixiContainer, it renders it as a lowercase custom element
      expect(container.querySelector('pixicontainer')).toBeInTheDocument();
      expect(container.querySelector('pixianimatedsprite')).toBeInTheDocument();
    });

    expect(PIXI.Assets.load).toHaveBeenCalledWith('/devil_thing.webp');
  });

  it('calls onPositionUpdate with initial coordinates', async () => {
    const onPositionUpdate = vi.fn();
    render(<DevilBotSprite {...baseProps} onPositionUpdate={onPositionUpdate} />);
    
    await waitFor(() => {
      expect(onPositionUpdate).toHaveBeenCalled();
    });
  });

  it('loads specific spritesheets for operator, builder, researcher, and steelman', async () => {
    render(<DevilBotSprite agent={{ id: 'operator', initialWaypoint: 'cubicle_4_desk' }} />);
    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalledWith('/operator_thing.webp');
    });

    render(<DevilBotSprite agent={{ id: 'builder', initialWaypoint: 'cubicle_3_desk' }} />);
    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalledWith('/builder_thing.webp');
    });

    render(<DevilBotSprite agent={{ id: 'researcher', initialWaypoint: 'cubicle_2_desk' }} />);
    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalledWith('/researcher_thing.webp');
    });

    render(<DevilBotSprite agent={{ id: 'steelman', initialWaypoint: 'steelman_chair' }} />);
    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalledWith('/judge_thing.webp');
    });
  });

  it('sets initialFrame to 4 (back view) for agents situated at top desks facing north', async () => {
    const { container } = render(
      <DevilBotSprite agent={{ id: 'builder', initialWaypoint: 'cubicle_3_desk', initialFacing: 'north' }} />
    );

    await waitFor(() => {
      const sprite = container.querySelector('pixianimatedsprite');
      expect(sprite).toBeInTheDocument();
      // In JSDOM with custom tags, initialFrame renders as attribute or prop
      expect(sprite?.getAttribute('initialframe') || sprite?.getAttribute('initialFrame')).toBe('4');
    });
  });
});
