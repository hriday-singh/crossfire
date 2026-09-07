import React from 'react';
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
  Container: class {}
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initially renders nothing while textures are loading', () => {
    const { container } = render(<DevilBotSprite agent={mockAgent} />);
    expect(container.firstChild).toBeNull();
  });

  it('loads textures and renders pixi elements', async () => {
    const { container } = render(<DevilBotSprite agent={mockAgent} />);
    
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
    render(<DevilBotSprite agent={mockAgent} onPositionUpdate={onPositionUpdate} />);
    
    await waitFor(() => {
      expect(onPositionUpdate).toHaveBeenCalled();
    });
  });
});
