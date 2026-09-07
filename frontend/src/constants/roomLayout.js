/**
 * Room Layout & Coordinate System (1000 x 650)
 * Crossfire Evaluator Cubicle Bullpen & Crucible Judge Court.
 *
 * Architecture:
 * - Center (x: 500): The Crucible Judge Table & Arbiter Bench presiding over verdicts.
 * - Left Side: 2 Modular Cubicles (Cubicle 01: Devil's Advocate, Cubicle 02: Receipts).
 * - Right Side: 2 Modular Cubicles (Cubicle 03: Builder, Cubicle 04: Operator).
 * - Central Corridor connecting all workstations with telemetry consoles.
 */

export const ROOM_DIMENSIONS = {
  width: 1000,
  height: 587,
};

export const JUDGE_TABLE_CONFIG = {
  x: 500,
  y: 240,
  width: 280,
  height: 110,
  depthY: 240,
};

// Backward-compatible alias for existing components
export const TABLE_CONFIG = JUDGE_TABLE_CONFIG;

export const CUBICLE_LAYOUTS = [
  {
    id: 'cubicle_1',
    agentId: 'builder',
    name: 'Cubicle 01 // BUILDER',
    testName: 'Feasibility Test',
    side: 'left',
    row: 'top',
    bounds: { x: 210, y: 63, width: 195, height: 170 },
    desk: { x: 295, y: 145, width: 90, height: 40 },
    chair: { x: 321, y: 156 },
    stand: { x: 352, y: 195 },
    colorHex: 0xfbbf24,
    accentHex: 0xfde68a,
  },
  {
    id: 'cubicle_2',
    agentId: 'devils_advocate',
    name: "Cubicle 02 // DEVIL'S ADVOCATE",
    testName: 'Assumption Test',
    side: 'left',
    row: 'bottom',
    bounds: { x: 210, y: 330, width: 195, height: 180 },
    desk: { x: 295, y: 440, width: 90, height: 40 },
    chair: { x: 310, y: 425 },
    stand: { x: 352, y: 385 },
    colorHex: 0x818cf8,
    accentHex: 0xc7d2fe,
  },
  {
    id: 'cubicle_3',
    agentId: 'receipts',
    name: 'Cubicle 03 // RESEARCHER',
    testName: 'Evidence Test',
    side: 'right',
    row: 'top',
    bounds: { x: 595, y: 63, width: 195, height: 170 },
    desk: { x: 705, y: 145, width: 90, height: 40 },
    chair: { x: 679, y: 156 },
    stand: { x: 648, y: 195 },
    colorHex: 0x34d399,
    accentHex: 0xa7f3d0,
  },
  {
    id: 'cubicle_4',
    agentId: 'operator',
    name: 'Cubicle 04 // OPERATOR',
    testName: 'Operational Friction Test',
    side: 'right',
    row: 'bottom',
    bounds: { x: 595, y: 330, width: 195, height: 180 },
    desk: { x: 705, y: 440, width: 90, height: 40 },
    chair: { x: 690, y: 425 },
    stand: { x: 648, y: 385 },
    colorHex: 0x60a5fa,
    accentHex: 0xbfdbfe,
  },
];

export const WAYPOINTS = {
  // Cubicle 1: Builder (NW)
  cubicle_1_desk: {
    id: 'cubicle_1_desk',
    name: 'Cubicle 01 Desk (Builder)',
    x: 321,
    y: 156,
    facing: 'north',
    isChair: true,
    depth: 156,
  },
  cubicle_1_stand: {
    id: 'cubicle_1_stand',
    name: 'Cubicle 01 Architecture Stand',
    x: 352,
    y: 195,
    facing: 'south',
    isChair: false,
    depth: 195,
  },

  // Cubicle 2: Devil's Advocate (SW)
  cubicle_2_desk: {
    id: 'cubicle_2_desk',
    name: "Cubicle 02 Desk (Devil's Advocate)",
    x: 310,
    y: 425,
    facing: 'south',
    isChair: true,
    depth: 425,
  },
  cubicle_2_stand: {
    id: 'cubicle_2_stand',
    name: "Cubicle 02 Pinboard Stand",
    x: 352,
    y: 385,
    facing: 'south',
    isChair: false,
    depth: 385,
  },

  // Cubicle 3: Receipts / Researcher (NE)
  cubicle_3_desk: {
    id: 'cubicle_3_desk',
    name: 'Cubicle 03 Desk (Receipts)',
    x: 679,
    y: 156,
    facing: 'north',
    isChair: true,
    depth: 156,
  },
  cubicle_3_stand: {
    id: 'cubicle_3_stand',
    name: 'Cubicle 03 Citations Stand',
    x: 648,
    y: 195,
    facing: 'south',
    isChair: false,
    depth: 195,
  },

  // Cubicle 4: Operator (SE)
  cubicle_4_desk: {
    id: 'cubicle_4_desk',
    name: 'Cubicle 04 Desk (Operator)',
    x: 690,
    y: 425,
    facing: 'south',
    isChair: true,
    depth: 425,
  },
  cubicle_4_stand: {
    id: 'cubicle_4_stand',
    name: 'Cubicle 04 Policy Stand',
    x: 648,
    y: 385,
    facing: 'south',
    isChair: false,
    depth: 385,
  },

  // Safe Navigation Corridors (around the central table)
  corridor_nw: {
    id: 'corridor_nw',
    name: 'North-West Corridor',
    x: 365,
    y: 230,
    facing: 'south',
    isChair: false,
    depth: 230,
  },
  corridor_ne: {
    id: 'corridor_ne',
    name: 'North-East Corridor',
    x: 635,
    y: 230,
    facing: 'south',
    isChair: false,
    depth: 230,
  },
  corridor_west: {
    id: 'corridor_west',
    name: 'West Corridor',
    x: 365,
    y: 355,
    facing: 'south',
    isChair: false,
    depth: 355,
  },
  corridor_east: {
    id: 'corridor_east',
    name: 'East Corridor',
    x: 635,
    y: 355,
    facing: 'south',
    isChair: false,
    depth: 355,
  },
  corridor_south: {
    id: 'corridor_south',
    name: 'South Corridor',
    x: 500,
    y: 360,
    facing: 'north',
    isChair: false,
    depth: 360,
  },

  // Center: Crucible Judge Table
  judge_chair: {
    id: 'judge_chair',
    name: 'Crucible Judge Bench Chair',
    x: 500,
    y: 195,
    facing: 'south',
    isChair: true,
    depth: 195,
  },
  judge_desk: {
    id: 'judge_desk',
    name: 'Crucible Judge Station',
    x: 500,
    y: 275,
    facing: 'south',
    isChair: false,
    depth: 275,
  },

  // Central Walkway and Room Entrance
  center_floor: {
    id: 'center_floor',
    name: 'Central Bullpen Hallway',
    x: 500,
    y: 370,
    facing: 'north',
    isChair: false,
    depth: 370,
  },
  doorway: {
    id: 'doorway',
    name: 'Bullpen Main Entrance',
    x: 500,
    y: 520,
    facing: 'north',
    isChair: false,
    depth: 520,
  },

  // Backward compatibility aliases for legacy scenarios
  chair_north: {
    id: 'chair_north',
    name: 'North Workstation (Cubicle 1)',
    x: 321,
    y: 156,
    facing: 'south',
    isChair: true,
    depth: 156,
  },
  chair_west: {
    id: 'chair_west',
    name: 'West Workstation (Cubicle 2)',
    x: 310,
    y: 425,
    facing: 'north',
    isChair: true,
    depth: 425,
  },
  chair_east: {
    id: 'chair_east',
    name: 'East Workstation (Cubicle 3)',
    x: 679,
    y: 156,
    facing: 'south',
    isChair: true,
    depth: 156,
  },
  chair_south: {
    id: 'chair_south',
    name: 'South Workstation (Cubicle 4)',
    x: 690,
    y: 425,
    facing: 'north',
    isChair: true,
    depth: 425,
  },
  whiteboard: {
    id: 'whiteboard',
    name: 'Cubicle 1 Pinboard',
    x: 352,
    y: 195,
    facing: 'south',
    isChair: false,
    depth: 195,
  },
  presentation_podium: {
    id: 'presentation_podium',
    name: 'Crucible Judge Monolith',
    x: 500,
    y: 275,
    facing: 'south',
    isChair: false,
    depth: 275,
  },
  podium_approach: {
    id: 'podium_approach',
    name: 'Judge Approach',
    x: 500,
    y: 345,
    facing: 'north',
    isChair: false,
    depth: 345,
  },
  judge_approach: {
    id: 'judge_approach',
    name: 'Judge Approach',
    x: 500,
    y: 345,
    facing: 'north',
    isChair: false,
    depth: 345,
  },
  judge_approach_west: {
    id: 'judge_approach_west',
    name: 'West Judge Table Approach',
    x: 430,
    y: 285,
    facing: 'east',
    isChair: false,
    depth: 285,
  },
  judge_approach_east: {
    id: 'judge_approach_east',
    name: 'East Judge Table Approach',
    x: 570,
    y: 285,
    facing: 'west',
    isChair: false,
    depth: 285,
  },
  judge_approach_south: {
    id: 'judge_approach_south',
    name: 'South Judge Approach (Overflow)',
    x: 500,
    y: 410,
    facing: 'north',
    isChair: false,
    depth: 410,
  },
  whiteboard_approach: {
    id: 'whiteboard_approach',
    name: 'Cubicle 1 Approach',
    x: 352,
    y: 195,
    facing: 'north',
    isChair: false,
    depth: 195,
  },
};

export const JUDGE_APPROACH_SPOTS = [
  'judge_approach',
  'judge_approach_west',
  'judge_approach_east',
  'judge_approach_south',
];

export const JUDGE_APPROACH_ALIASES = [
  'podium_approach',
  'presentation_podium',
  'judge_approach',
  'judge_desk',
];

/**
 * Resolves the best collision-free spot around the judge table.
 * If another AI agent is already occupying the primary center spot,
 * routes the incoming agent to west, east, or south overflow spots.
 */
export function resolveApproachSpot(agentId, characterPositions, requestedTargetId) {
  if (!requestedTargetId || !JUDGE_APPROACH_ALIASES.includes(requestedTargetId)) {
    return requestedTargetId;
  }

  if (!characterPositions) {
    return 'judge_approach';
  }

  const OCCUPANCY_RADIUS = 42;

  const isSpotOccupied = (spotId) => {
    const spotWp = WAYPOINTS[spotId];
    if (!spotWp) return false;
    return Object.entries(characterPositions).some(([id, pos]) => {
      if (id === agentId || id === 'judge' || !pos) return false;
      return Math.hypot(pos.x - spotWp.x, pos.y - spotWp.y) < OCCUPANCY_RADIUS;
    });
  };

  for (const spotId of JUDGE_APPROACH_SPOTS) {
    if (!isSpotOccupied(spotId)) {
      return spotId;
    }
  }

  return 'judge_approach';
}

export const CHAIR_IDS = [
  'cubicle_1_desk',
  'cubicle_2_desk',
  'cubicle_3_desk',
  'cubicle_4_desk',
  'judge_chair',
  'chair_north',
  'chair_south',
  'chair_west',
  'chair_east',
];

export default {
  ROOM_DIMENSIONS,
  JUDGE_TABLE_CONFIG,
  TABLE_CONFIG,
  CUBICLE_LAYOUTS,
  WAYPOINTS,
  CHAIR_IDS,
};
