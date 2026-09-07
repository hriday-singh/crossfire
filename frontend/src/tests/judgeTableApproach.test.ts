import { describe, it, expect } from 'vitest';
import {
  WAYPOINTS,
  JUDGE_APPROACH_SPOTS,
  resolveApproachSpot,
} from '../constants/roomLayout';
import { getPathPoints } from '../components/canvas/DevilBotSprite';

describe('Judge Table Dynamic Approach & Collision Avoidance', () => {
  it('defines the required approach spots around the judge table with distinct coordinates', () => {
    expect(JUDGE_APPROACH_SPOTS).toContain('judge_approach');
    expect(JUDGE_APPROACH_SPOTS).toContain('judge_approach_west');
    expect(JUDGE_APPROACH_SPOTS).toContain('judge_approach_east');
    expect(JUDGE_APPROACH_SPOTS).toContain('judge_approach_south');

    const center = WAYPOINTS.judge_approach;
    const west = WAYPOINTS.judge_approach_west;
    const east = WAYPOINTS.judge_approach_east;
    const south = WAYPOINTS.judge_approach_south;

    expect(center).toBeDefined();
    expect(west).toBeDefined();
    expect(east).toBeDefined();
    expect(south).toBeDefined();

    // Center faces North towards the Judge Bench
    expect(center.x).toBe(500);
    expect(center.y).toBe(345);
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

  it('routes to the primary center judge_approach when no one is occupying the table', () => {
    const characterPositions = {
      devils_advocate: { x: 310, y: 425 }, // at cubicle 2
      receipts: { x: 679, y: 156 },        // at cubicle 3
      builder: { x: 321, y: 156 },         // at cubicle 1
      operator: { x: 690, y: 425 },        // at cubicle 4
      judge: { x: 500, y: 222 },           // presiding at bench
    };

    const targetSpot = resolveApproachSpot('devils_advocate', characterPositions, 'judge_approach');
    expect(targetSpot).toBe('judge_approach');

    // Works with aliases (e.g. podium_approach)
    const aliasSpot = resolveApproachSpot('receipts', characterPositions, 'podium_approach');
    expect(aliasSpot).toBe('judge_approach');
  });

  it('automatically redirects to judge_approach_west when an AI is already at the center spot', () => {
    const characterPositions = {
      // Devil's Advocate is already standing right at judge_approach
      devils_advocate: { x: 500, y: 345 },
      receipts: { x: 679, y: 156 },
      builder: { x: 321, y: 156 },
      operator: { x: 690, y: 425 },
      judge: { x: 500, y: 222 },
    };

    // Receipts approaches the table while Devil's Advocate is there
    const redirectedSpot = resolveApproachSpot('receipts', characterPositions, 'judge_approach');
    expect(redirectedSpot).toBe('judge_approach_west');
  });

  it('redirects to judge_approach_east when both center and west spots are occupied', () => {
    const characterPositions = {
      // Devil's Advocate at center
      devils_advocate: { x: 500, y: 345 },
      // Receipts at west approach
      receipts: { x: 430, y: 285 },
      builder: { x: 321, y: 156 },
      operator: { x: 690, y: 425 },
      judge: { x: 500, y: 222 },
    };

    // Builder approaches while center and west are both occupied
    const redirectedSpot = resolveApproachSpot('builder', characterPositions, 'judge_approach');
    expect(redirectedSpot).toBe('judge_approach_east');
  });

  it('redirects to judge_approach_south overflow when center, west, and east are all occupied', () => {
    const characterPositions = {
      devils_advocate: { x: 500, y: 345 },
      receipts: { x: 430, y: 285 },
      builder: { x: 570, y: 285 },
      operator: { x: 690, y: 425 },
      judge: { x: 500, y: 222 },
    };

    const redirectedSpot = resolveApproachSpot('operator', characterPositions, 'podium_approach');
    expect(redirectedSpot).toBe('judge_approach_south');
  });

  it('frees up the spot when the occupying agent returns to their desk', () => {
    let characterPositions = {
      devils_advocate: { x: 500, y: 345 }, // occupied
      receipts: { x: 679, y: 156 },
      judge: { x: 500, y: 222 },
    };

    expect(resolveApproachSpot('receipts', characterPositions, 'judge_approach')).toBe('judge_approach_west');

    // Devil's Advocate walks back to desk
    characterPositions = {
      devils_advocate: { x: 310, y: 425 },
      receipts: { x: 679, y: 156 },
      judge: { x: 500, y: 222 },
    };

    expect(resolveApproachSpot('receipts', characterPositions, 'judge_approach')).toBe('judge_approach');
  });

  it('does not consider non-approach waypoints as approach targets', () => {
    const characterPositions = {
      devils_advocate: { x: 500, y: 345 },
    };

    // Asking to walk to cubicle desk should remain cubicle desk
    expect(resolveApproachSpot('receipts', characterPositions, 'cubicle_3_desk')).toBe('cubicle_3_desk');
  });

  it('calculates collision-free path points avoiding the central table for west and east approaches', () => {
    // Top-Left to West Approach
    const pathTLtoWest = getPathPoints(321, 156, WAYPOINTS.judge_approach_west);
    expect(pathTLtoWest.length).toBeGreaterThan(0);
    const destWest = pathTLtoWest[pathTLtoWest.length - 1];
    expect(destWest.x).toBe(430);
    expect(destWest.y).toBe(285);
    expect(destWest.facing).toBe('east');

    // Top-Right to East Approach
    const pathTRtoEast = getPathPoints(679, 156, WAYPOINTS.judge_approach_east);
    expect(pathTRtoEast.length).toBeGreaterThan(0);
    const destEast = pathTRtoEast[pathTRtoEast.length - 1];
    expect(destEast.x).toBe(570);
    expect(destEast.y).toBe(285);
    expect(destEast.facing).toBe('west');

    // Return from West Approach to Cubicle 2
    const pathWestReturn = getPathPoints(430, 285, WAYPOINTS.cubicle_2_desk);
    expect(pathWestReturn.length).toBeGreaterThan(0);
    expect(pathWestReturn[pathWestReturn.length - 1].x).toBe(WAYPOINTS.cubicle_2_desk.x);
  });
});
