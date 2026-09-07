import { describe, it, expect } from 'vitest';
import {
  WAYPOINTS,
  STEELMAN_APPROACH_SPOTS,
  resolveApproachSpot,
} from '../constants/roomLayout';
import { getPathPoints } from '../components/canvas/DevilBotSprite';

describe('Steelman Table Dynamic Approach & Collision Avoidance', () => {
  it('defines the required approach spots around the steelman table with distinct coordinates', () => {
    expect(STEELMAN_APPROACH_SPOTS).toContain('steelman_approach');
    expect(STEELMAN_APPROACH_SPOTS).toContain('steelman_approach_west');
    expect(STEELMAN_APPROACH_SPOTS).toContain('steelman_approach_east');
    expect(STEELMAN_APPROACH_SPOTS).toContain('steelman_approach_south');

    const center = WAYPOINTS.steelman_approach;
    const west = WAYPOINTS.steelman_approach_west;
    const east = WAYPOINTS.steelman_approach_east;
    const south = WAYPOINTS.steelman_approach_south;

    expect(center).toBeDefined();
    expect(west).toBeDefined();
    expect(east).toBeDefined();
    expect(south).toBeDefined();

    // Center faces North towards the Steelman Bench
    expect(center.x).toBe(500);
    expect(center.y).toBe(360);
    expect(center.facing).toBe('north');

    // West approach is to the left facing East
    expect(west.x).toBeLessThan(center.x);
    expect(west.facing).toBe('east');

    // East approach is to the right facing West
    expect(east.x).toBeGreaterThan(center.x);
    expect(east.facing).toBe('west');

    // Overflow South is further back facing North
    expect(south.y).toBeGreaterThan(center.y);
    expect(south.facing).toBe('north');
  });

  it('routes each evaluator to their dedicated clearance spot when approaching steelman table', () => {
    const characterPositions = {
      devils_advocate: { x: 236, y: 421 },
      researcher: { x: 718, y: 159 },
      builder: { x: 284, y: 159 },
      operator: { x: 766, y: 421 },
      steelman: { x: 500, y: 215 },
    };

    expect(resolveApproachSpot('devils_advocate', characterPositions, 'steelman_approach')).toBe('steelman_spot_devils_advocate');
    expect(resolveApproachSpot('researcher', characterPositions, 'podium_approach')).toBe('steelman_spot_researcher');
    expect(resolveApproachSpot('builder', characterPositions, 'steelman_approach')).toBe('steelman_spot_builder');
    expect(resolveApproachSpot('operator', characterPositions, 'steelman_approach')).toBe('steelman_spot_operator');
  });

  it('does not consider non-approach waypoints as approach targets', () => {
    const characterPositions = {
      devils_advocate: { x: 500, y: 360 },
    };

    // Asking to walk to cubicle desk should remain cubicle desk
    expect(resolveApproachSpot('researcher', characterPositions, 'cubicle_3_desk')).toBe('cubicle_3_desk');
  });

  it('calculates collision-free path points avoiding the central table for dedicated clearance spots', () => {
    // Top-Left to Builder spot
    const pathTLtoBuilder = getPathPoints(284, 159, WAYPOINTS.steelman_spot_builder);
    expect(pathTLtoBuilder.length).toBeGreaterThan(0);
    const destBuilder = pathTLtoBuilder[pathTLtoBuilder.length - 1];
    expect(destBuilder.x).toBe(395);
    expect(destBuilder.y).toBe(245);
    expect(destBuilder.facing).toBe('east');

    // Top-Right to Researcher spot
    const pathTRtoResearcher = getPathPoints(718, 159, WAYPOINTS.steelman_spot_researcher);
    expect(pathTRtoResearcher.length).toBeGreaterThan(0);
    const destResearcher = pathTRtoResearcher[pathTRtoResearcher.length - 1];
    expect(destResearcher.x).toBe(605);
    expect(destResearcher.y).toBe(245);
    expect(destResearcher.facing).toBe('west');
  });
});
