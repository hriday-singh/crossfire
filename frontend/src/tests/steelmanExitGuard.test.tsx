import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DevilBotSprite from '../components/canvas/DevilBotSprite';
import { WAYPOINTS } from '../constants/roomLayout';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';

// Mock PIXI and @pixi/react
vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn().mockResolvedValue({ source: { scaleMode: '' } }) },
  Texture: vi.fn().mockImplementation(() => ({})),
  Rectangle: vi.fn(),
  AnimatedSprite: class {},
  Container: class {},
  Graphics: class {},
}));

vi.mock('@pixi/react', () => ({
  extend: vi.fn(),
}));

vi.mock('gsap', () => {
  const timelineMock = {
    to: vi.fn().mockReturnThis(),
    kill: vi.fn(),
  };
  return {
    default: {
      to: vi.fn(() => ({ kill: vi.fn() })),
      timeline: vi.fn(() => {
        return timelineMock;
      }),
    },
  };
});

describe('Steelman Judge Table vs Door Exit Guard Protocol', () => {
  const steelmanAgent = {
    id: 'steelman',
    initialWaypoint: 'steelman_chair',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Steelman stationed strictly at the Judge Table initially', async () => {
    const onPositionUpdate = vi.fn();

    render(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        onPositionUpdate={onPositionUpdate}
      />
    );

    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalledWith('/judge_thing.webp');
    });

    // Steelman initial waypoint is steelman_chair at (500, 250)
    expect(WAYPOINTS.steelman_chair.x).toBe(500);
    expect(WAYPOINTS.steelman_chair.y).toBe(250);
    expect(WAYPOINTS.steelman_chair.facing).toBe('south');

    expect(onPositionUpdate).toHaveBeenCalledWith(
      'steelman',
      WAYPOINTS.steelman_chair.x,
      WAYPOINTS.steelman_chair.y
    );
  });

  it('REJECTS exit command to right_door when synthesis is NOT done (stays at judge table)', async () => {
    const onPositionUpdate = vi.fn();
    const prematureExitPacket = {
      id: 'premature_exit_cmd_1',
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      stage: 'Evaluating Claims',
      isSynthesisDone: false,
      isLoadingDone: false,
    };

    const { rerender } = render(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={false}
        currentActionPacket={null}
        onPositionUpdate={onPositionUpdate}
      />
    );

    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalled();
    });

    onPositionUpdate.mockClear();

    // Send premature exit packet before synthesis and before loading 100%
    rerender(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={false}
        currentActionPacket={prematureExitPacket}
        onPositionUpdate={onPositionUpdate}
      />
    );

    // gsap timeline should NOT have been invoked to walk to right door
    expect(gsap.timeline).not.toHaveBeenCalled();
  });

  it('REJECTS exit command when synthesis is DONE but loading is NOT 100% (stays at judge table)', async () => {
    const onPositionUpdate = vi.fn();
    const synthesisDoneLoadingIncompletePacket = {
      id: 'premature_exit_cmd_loading_incomplete',
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      stage: 'Crucible Synthesis Complete',
      isSynthesisDone: true,
      isLoadingDone: false,
      progress: 75,
    };

    const { rerender } = render(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={true}
        isLoadingDone={false}
        loadingProgress={75}
        currentActionPacket={null}
        onPositionUpdate={onPositionUpdate}
      />
    );

    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalled();
    });

    onPositionUpdate.mockClear();

    // Send exit packet where synthesis is true, but loading progress is 75%
    rerender(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={true}
        isLoadingDone={false}
        loadingProgress={75}
        currentActionPacket={synthesisDoneLoadingIncompletePacket}
        onPositionUpdate={onPositionUpdate}
      />
    );

    expect(gsap.timeline).not.toHaveBeenCalled();
  });

  it('REJECTS exit command when loading is 100% but synthesis is NOT done (stays at judge table)', async () => {
    const onPositionUpdate = vi.fn();
    const loadingDoneSynthesisPendingPacket = {
      id: 'premature_exit_cmd_synthesis_pending',
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      stage: 'Evaluating Claims',
      isSynthesisDone: false,
      isLoadingDone: true,
      progress: 100,
    };

    const { rerender } = render(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={true}
        loadingProgress={100}
        currentActionPacket={null}
        onPositionUpdate={onPositionUpdate}
      />
    );

    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalled();
    });

    onPositionUpdate.mockClear();

    // Send exit packet where loading is 100%, but synthesis is false
    rerender(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={true}
        loadingProgress={100}
        currentActionPacket={loadingDoneSynthesisPendingPacket}
        onPositionUpdate={onPositionUpdate}
      />
    );

    expect(gsap.timeline).not.toHaveBeenCalled();
  });

  it('ALLOWS exit command to right_door ONLY when BOTH isSynthesisDone is true AND isLoadingDone is true (100%)', async () => {
    const onPositionUpdate = vi.fn();
    const authorizedExitPacket = {
      id: 'synthesis_exit_cmd_authorized',
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      stage: 'Exiting Bullpen to Decision Memo',
      isSynthesisDone: true,
      isLoadingDone: true,
      progress: 100,
    };

    const { rerender } = render(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={false}
        currentActionPacket={null}
        onPositionUpdate={onPositionUpdate}
      />
    );

    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalled();
    });

    // Send authorized exit packet with synthesis complete AND loading 100%
    rerender(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={true}
        isLoadingDone={true}
        loadingProgress={100}
        currentActionPacket={authorizedExitPacket}
        onPositionUpdate={onPositionUpdate}
      />
    );

    // gsap timeline MUST be invoked to animate Steelman to the right exit door
    expect(gsap.timeline).toHaveBeenCalled();
    expect(WAYPOINTS.right_door.x).toBe(897);
    expect(WAYPOINTS.right_door.y).toBe(246);
  });

  it('allows exit when packet contains synthesis and 100% progress indicators', async () => {
    const onPositionUpdate = vi.fn();
    const dualConditionPacket = {
      id: 'synthesis_exit_cmd_dual',
      speaker_id: 'steelman',
      action: 'walk_to',
      target: 'right_door',
      stage: 'Crucible Synthesis Complete',
      progress: 100,
      isLoadingDone: true,
    };

    const { rerender } = render(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={false}
        currentActionPacket={null}
        onPositionUpdate={onPositionUpdate}
      />
    );

    await waitFor(() => {
      expect(PIXI.Assets.load).toHaveBeenCalled();
    });

    rerender(
      <DevilBotSprite
        agent={steelmanAgent}
        isSynthesisDone={false}
        isLoadingDone={false}
        currentActionPacket={dualConditionPacket}
        onPositionUpdate={onPositionUpdate}
      />
    );

    // Allowed because packet indicates both synthesis and 100% loading
    expect(gsap.timeline).toHaveBeenCalled();
  });
});
