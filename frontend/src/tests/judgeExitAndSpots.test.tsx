import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  WAYPOINTS,
  AGENT_JUDGE_SPOTS,
  resolveApproachSpot,
} from '@/constants/roomLayout';
import { getPathPoints } from '@/components/canvas/DevilBotSprite';
import { CruciblePageTransition } from '@/components/ui/CruciblePageTransition';

describe('AI 1: Dedicated Judge Table Spots & Shortest Path Navigation', () => {
  it('maps each evaluator to their dedicated spot at the judge table', () => {
    expect(AGENT_JUDGE_SPOTS.builder).toBe('judge_spot_builder');
    expect(AGENT_JUDGE_SPOTS.devils_advocate).toBe('judge_spot_devils_advocate');
    expect(AGENT_JUDGE_SPOTS.receipts).toBe('judge_spot_receipts');
    expect(AGENT_JUDGE_SPOTS.researcher).toBe('judge_spot_receipts');
    expect(AGENT_JUDGE_SPOTS.operator).toBe('judge_spot_operator');
  });

  it('defines valid coordinates and orientations for all dedicated spots', () => {
    const builderSpot = WAYPOINTS.judge_spot_builder;
    const devilSpot = WAYPOINTS.judge_spot_devils_advocate;
    const receiptsSpot = WAYPOINTS.judge_spot_receipts;
    const operatorSpot = WAYPOINTS.judge_spot_operator;
    const rightDoor = WAYPOINTS.right_door;

    expect(builderSpot).toBeDefined();
    expect(builderSpot.x).toBe(395);
    expect(builderSpot.y).toBe(245);
    expect(builderSpot.facing).toBe('east');

    expect(devilSpot).toBeDefined();
    expect(devilSpot.x).toBe(415);
    expect(devilSpot.y).toBe(335);
    expect(devilSpot.facing).toBe('east');

    expect(receiptsSpot).toBeDefined();
    expect(receiptsSpot.x).toBe(605);
    expect(receiptsSpot.y).toBe(245);
    expect(receiptsSpot.facing).toBe('west');

    expect(operatorSpot).toBeDefined();
    expect(operatorSpot.x).toBe(585);
    expect(operatorSpot.y).toBe(335);
    expect(operatorSpot.facing).toBe('west');

    expect(rightDoor).toBeDefined();
    expect(rightDoor.x).toBe(897);
    expect(rightDoor.y).toBe(246);
    expect(rightDoor.facing).toBe('east');
  });

  it('resolves each AI to their dedicated spot every time when approaching judge', () => {
    const characterPositions = {
      builder: { x: 284, y: 159 },
      devils_advocate: { x: 236, y: 421 },
      receipts: { x: 718, y: 159 },
      operator: { x: 766, y: 421 },
      judge: { x: 500, y: 215 },
    };

    expect(resolveApproachSpot('builder', characterPositions, 'judge_approach')).toBe('judge_spot_builder');
    expect(resolveApproachSpot('builder', characterPositions, 'podium_approach')).toBe('judge_spot_builder');
    expect(resolveApproachSpot('devils_advocate', characterPositions, 'judge_approach')).toBe('judge_spot_devils_advocate');
    expect(resolveApproachSpot('receipts', characterPositions, 'judge_approach')).toBe('judge_spot_receipts');
    expect(resolveApproachSpot('operator', characterPositions, 'judge_approach')).toBe('judge_spot_operator');
  });

  it('computes shortest collision-free path for Builder to NW clearance spot and back', () => {
    const toSpot = getPathPoints(284, 159, WAYPOINTS.judge_spot_builder);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(395);
    expect(toSpot[toSpot.length - 1].y).toBe(245);

    const toDesk = getPathPoints(395, 245, WAYPOINTS.cubicle_1_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(284);
    expect(toDesk[toDesk.length - 1].y).toBe(159);
  });

  it('computes shortest collision-free path for Devil\'s Advocate to SW clearance spot and back', () => {
    const toSpot = getPathPoints(236, 421, WAYPOINTS.judge_spot_devils_advocate);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(415);
    expect(toSpot[toSpot.length - 1].y).toBe(335);

    const toDesk = getPathPoints(415, 335, WAYPOINTS.cubicle_2_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(236);
    expect(toDesk[toDesk.length - 1].y).toBe(421);
  });

  it('computes shortest collision-free path for Receipts to NE clearance spot and back', () => {
    const toSpot = getPathPoints(718, 159, WAYPOINTS.judge_spot_receipts);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(605);
    expect(toSpot[toSpot.length - 1].y).toBe(245);

    const toDesk = getPathPoints(605, 245, WAYPOINTS.cubicle_3_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(718);
    expect(toDesk[toDesk.length - 1].y).toBe(159);
  });

  it('computes shortest collision-free path for Operator to SE clearance spot and back', () => {
    const toSpot = getPathPoints(766, 421, WAYPOINTS.judge_spot_operator);
    expect(toSpot.length).toBeGreaterThanOrEqual(2);
    expect(toSpot[toSpot.length - 1].x).toBe(585);
    expect(toSpot[toSpot.length - 1].y).toBe(335);

    const toDesk = getPathPoints(585, 335, WAYPOINTS.cubicle_4_desk);
    expect(toDesk.length).toBeGreaterThanOrEqual(2);
    expect(toDesk[toDesk.length - 1].x).toBe(766);
    expect(toDesk[toDesk.length - 1].y).toBe(421);
  });

  it('computes shortest path for Judge to walk to right chamber door', () => {
    const judgeExitPath = getPathPoints(500, 215, WAYPOINTS.right_door);
    expect(judgeExitPath.length).toBeGreaterThanOrEqual(2);
    expect(judgeExitPath[judgeExitPath.length - 1].x).toBe(897);
    expect(judgeExitPath[judgeExitPath.length - 1].y).toBe(246);
    expect(judgeExitPath[judgeExitPath.length - 1].facing).toBe('east');
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
