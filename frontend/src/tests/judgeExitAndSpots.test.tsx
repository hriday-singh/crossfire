import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  WAYPOINTS,
  AGENT_STEELMAN_SPOTS,
  resolveApproachSpot,
} from '@/constants/roomLayout';
import { getPathPoints } from '@/components/canvas/DevilBotSprite';
import { CruciblePageTransition } from '@/components/ui/CruciblePageTransition';

describe('AI 1: Dedicated Steelman Table Spots & Shortest Path Navigation', () => {
  it('maps each evaluator to their dedicated spot at the steelman table', () => {
    expect(AGENT_STEELMAN_SPOTS.builder).toBe('steelman_spot_builder');
    expect(AGENT_STEELMAN_SPOTS.devils_advocate).toBe('steelman_spot_devils_advocate');
    expect(AGENT_STEELMAN_SPOTS.researcher).toBe('steelman_spot_researcher');
    expect(AGENT_STEELMAN_SPOTS.researcher).toBe('steelman_spot_researcher');
    expect(AGENT_STEELMAN_SPOTS.operator).toBe('steelman_spot_operator');
  });

  it('defines valid coordinates and orientations for all dedicated spots', () => {
    const builderSpot = WAYPOINTS.steelman_spot_builder;
    const devilSpot = WAYPOINTS.steelman_spot_devils_advocate;
    const researcherSpot = WAYPOINTS.steelman_spot_researcher;
    const operatorSpot = WAYPOINTS.steelman_spot_operator;
    const rightDoor = WAYPOINTS.right_door;

    expect(builderSpot).toBeDefined();
    expect(builderSpot.x).toBe(395);
    expect(builderSpot.y).toBe(245);
    expect(builderSpot.facing).toBe('east');

    expect(devilSpot).toBeDefined();
    expect(devilSpot.x).toBe(415);
    expect(devilSpot.y).toBe(335);
    expect(devilSpot.facing).toBe('east');

    expect(researcherSpot).toBeDefined();
    expect(researcherSpot.x).toBe(605);
    expect(researcherSpot.y).toBe(245);
    expect(researcherSpot.facing).toBe('west');

    expect(operatorSpot).toBeDefined();
    expect(operatorSpot.x).toBe(585);
    expect(operatorSpot.y).toBe(335);
    expect(operatorSpot.facing).toBe('west');

    expect(rightDoor).toBeDefined();
    expect(rightDoor.x).toBe(897);
    expect(rightDoor.y).toBe(246);
    expect(rightDoor.facing).toBe('east');
  });

  it('resolves each AI to their dedicated spot every time when approaching steelman', () => {
    const characterPositions = {
      builder: { x: 284, y: 195 },
      devils_advocate: { x: 246, y: 355 },
      researcher: { x: 715, y: 195 },
      operator: { x: 754, y: 355 },
      steelman: { x: 500, y: 250 },
    };

    expect(resolveApproachSpot('builder', characterPositions, 'steelman_approach')).toBe('steelman_spot_builder');
    expect(resolveApproachSpot('builder', characterPositions, 'podium_approach')).toBe('steelman_spot_builder');
    expect(resolveApproachSpot('devils_advocate', characterPositions, 'steelman_approach')).toBe('steelman_spot_devils_advocate');
    expect(resolveApproachSpot('researcher', characterPositions, 'steelman_approach')).toBe('steelman_spot_researcher');
    expect(resolveApproachSpot('operator', characterPositions, 'steelman_approach')).toBe('steelman_spot_operator');
  });

  it('computes shortest collision-free path for Builder to NW clearance spot and back', () => {
    const toSpot = getPathPoints(284, 195, WAYPOINTS.steelman_spot_builder);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(395);
    expect(toSpot[toSpot.length - 1].y).toBe(245);

    const toDesk = getPathPoints(395, 245, WAYPOINTS.cubicle_1_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(284);
    expect(toDesk[toDesk.length - 1].y).toBe(195);
  });

  it('computes shortest collision-free path for Devil\'s Advocate to SW clearance spot and back', () => {
    const toSpot = getPathPoints(246, 355, WAYPOINTS.steelman_spot_devils_advocate);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(415);
    expect(toSpot[toSpot.length - 1].y).toBe(335);

    const toDesk = getPathPoints(415, 335, WAYPOINTS.cubicle_2_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(246);
    expect(toDesk[toDesk.length - 1].y).toBe(355);
  });

  it('computes shortest collision-free path for Researcher to NE clearance spot and back', () => {
    const toSpot = getPathPoints(715, 195, WAYPOINTS.steelman_spot_researcher);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(605);
    expect(toSpot[toSpot.length - 1].y).toBe(245);

    const toDesk = getPathPoints(605, 245, WAYPOINTS.cubicle_3_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(715);
    expect(toDesk[toDesk.length - 1].y).toBe(195);
  });

  it('computes shortest collision-free path for Operator to SE clearance spot and back', () => {
    const toSpot = getPathPoints(754, 355, WAYPOINTS.steelman_spot_operator);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(585);
    expect(toSpot[toSpot.length - 1].y).toBe(335);

    const toDesk = getPathPoints(585, 335, WAYPOINTS.cubicle_4_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(754);
    expect(toDesk[toDesk.length - 1].y).toBe(355);
  });

  it('computes shortest path for Steelman to walk to right chamber door', () => {
    const steelmanExitPath = getPathPoints(500, 250, WAYPOINTS.right_door);
    expect(steelmanExitPath.length).toBeGreaterThanOrEqual(2);
    expect(steelmanExitPath[steelmanExitPath.length - 1].x).toBe(897);
    expect(steelmanExitPath[steelmanExitPath.length - 1].y).toBe(246);
    expect(steelmanExitPath[steelmanExitPath.length - 1].facing).toBe('east');
  });
});

describe('AI 1: Crucible Page Transition Animation', () => {
  it('renders seamless transition overlay without popup modals and calls onComplete', () => {
    const handleComplete = vi.fn();

    render(
      <CruciblePageTransition
        isActive={true}
        onComplete={handleComplete}
        verdictHeadline="Autonomous Copilot Test Survived"
        verdictState="PROCEED"
      />
    );

    const transitionOverlay = screen.getByTestId('crucible-page-transition');
    expect(transitionOverlay).toBeInTheDocument();
    expect(screen.getByText(/Entering Decision Memo/i)).toBeInTheDocument();

    // Clicking anywhere on transition overlay skips smoothly
    fireEvent.click(transitionOverlay);
    expect(handleComplete).toHaveBeenCalledTimes(1);
  });
});
