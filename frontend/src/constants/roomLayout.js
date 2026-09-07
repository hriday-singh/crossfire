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
  y: 281,
  width: 240,
  height: 120,
  depthY: 281,
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
    bounds: { x: 185, y: 60, width: 200, height: 170 },
    desk: { x: 275, y: 140, width: 90, height: 40 },
    chair: { x: 284, y: 159 },
    stand: { x: 329, y: 200 },
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
    bounds: { x: 185, y: 340, width: 200, height: 180 },
    desk: { x: 240, y: 405, width: 90, height: 40 },
    chair: { x: 236, y: 421 },
    stand: { x: 329, y: 381 },
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
    bounds: { x: 615, y: 60, width: 200, height: 170 },
    desk: { x: 715, y: 140, width: 90, height: 40 },
    chair: { x: 718, y: 159 },
    stand: { x: 670, y: 200 },
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
    bounds: { x: 615, y: 340, width: 200, height: 180 },
    desk: { x: 760, y: 405, width: 90, height: 40 },
    chair: { x: 766, y: 421 },
    stand: { x: 670, y: 381 },
    colorHex: 0x60a5fa,
    accentHex: 0xbfdbfe,
  },
];

export const WAYPOINTS = {
  // Cubicle 1: Builder (NW)
  cubicle_1_desk: {
    id: 'cubicle_1_desk',
    name: 'Cubicle 01 Desk (Builder)',
    x: 284,
    y: 159,
    facing: 'north',
    isChair: true,
    depth: 159,
  },
  cubicle_1_stand: {
    id: 'cubicle_1_stand',
    name: 'Cubicle 01 Architecture Stand',
    x: 329,
    y: 200,
    facing: 'south',
    isChair: false,
    depth: 200,
  },

  // Cubicle 2: Devil's Advocate (SW)
  cubicle_2_desk: {
    id: 'cubicle_2_desk',
    name: "Cubicle 02 Desk (Devil's Advocate)",
    x: 236,
    y: 421,
    facing: 'south',
    isChair: true,
    depth: 421,
  },
  cubicle_2_stand: {
    id: 'cubicle_2_stand',
    name: "Cubicle 02 Pinboard Stand",
    x: 329,
    y: 381,
    facing: 'north',
    isChair: false,
    depth: 381,
  },

  // Cubicle 3: Receipts / Researcher (NE)
  cubicle_3_desk: {
    id: 'cubicle_3_desk',
    name: 'Cubicle 03 Desk (Receipts)',
    x: 718,
    y: 159,
    facing: 'north',
    isChair: true,
    depth: 159,
  },
  cubicle_3_stand: {
    id: 'cubicle_3_stand',
    name: 'Cubicle 03 Citations Stand',
    x: 670,
    y: 200,
    facing: 'south',
    isChair: false,
    depth: 200,
  },

  // Cubicle 4: Operator (SE)
  cubicle_4_desk: {
    id: 'cubicle_4_desk',
    name: 'Cubicle 04 Desk (Operator)',
    x: 766,
    y: 421,
    facing: 'south',
    isChair: true,
    depth: 421,
  },
  cubicle_4_stand: {
    id: 'cubicle_4_stand',
    name: 'Cubicle 04 Policy Stand',
    x: 670,
    y: 381,
    facing: 'north',
    isChair: false,
    depth: 381,
  },

  // Center: Crucible Judge Table & Arbiter Bench
  judge_chair: {
    id: 'judge_chair',
    name: 'Crucible Judge Bench Chair',
    x: 500,
    y: 215,
    facing: 'south',
    isChair: true,
    depth: 215,
  },
  judge_desk: {
    id: 'judge_desk',
    name: 'Crucible Judge Station',
    x: 500,
    y: 281,
    facing: 'south',
    isChair: false,
    depth: 281,
  },

  // Safe Navigation Corridors (around the central table)
  corridor_nw: {
    id: 'corridor_nw',
    name: 'North-West Corridor',
    x: 355,
    y: 200,
    facing: 'south',
    isChair: false,
    depth: 200,
  },
  corridor_ne: {
    id: 'corridor_ne',
    name: 'North-East Corridor',
    x: 645,
    y: 200,
    facing: 'south',
    isChair: false,
    depth: 200,
  },
  corridor_west: {
    id: 'corridor_west',
    name: 'West Corridor',
    x: 355,
    y: 380,
    facing: 'south',
    isChair: false,
    depth: 380,
  },
  corridor_east: {
    id: 'corridor_east',
    name: 'East Corridor',
    x: 645,
    y: 380,
    facing: 'south',
    isChair: false,
    depth: 380,
  },
  corridor_south: {
    id: 'corridor_south',
    name: 'South Corridor',
    x: 500,
    y: 380,
    facing: 'north',
    isChair: false,
    depth: 380,
  },

  // Central Walkway and Room Entrance
  center_floor: {
    id: 'center_floor',
    name: 'Central Bullpen Hallway',
    x: 500,
    y: 380,
    facing: 'north',
    isChair: false,
    depth: 380,
  },
  doorway: {
    id: 'doorway',
    name: 'Bullpen Main Entrance',
    x: 500,
    y: 535,
    facing: 'north',
    isChair: false,
    depth: 535,
  },

  // Backward compatibility aliases for legacy scenarios
  chair_north: {
    id: 'chair_north',
    name: 'North Workstation (Cubicle 1)',
    x: 284,
    y: 159,
    facing: 'south',
    isChair: true,
    depth: 159,
  },
  chair_west: {
    id: 'chair_west',
    name: 'West Workstation (Cubicle 2)',
    x: 236,
    y: 421,
    facing: 'north',
    isChair: true,
    depth: 421,
  },
  chair_east: {
    id: 'chair_east',
    name: 'East Workstation (Cubicle 3)',
    x: 718,
    y: 159,
    facing: 'south',
    isChair: true,
    depth: 159,
  },
  chair_south: {
    id: 'chair_south',
    name: 'South Workstation (Cubicle 4)',
    x: 766,
    y: 421,
    facing: 'north',
    isChair: true,
    depth: 421,
  },
  whiteboard: {
    id: 'whiteboard',
    name: 'Cubicle 1 Pinboard',
    x: 329,
    y: 200,
    facing: 'south',
    isChair: false,
    depth: 200,
  },
  presentation_podium: {
    id: 'presentation_podium',
    name: 'Crucible Judge Monolith',
    x: 500,
    y: 281,
    facing: 'south',
    isChair: false,
    depth: 281,
  },
  podium_approach: {
    id: 'podium_approach',
    name: 'Judge Approach',
    x: 500,
    y: 360,
    facing: 'north',
    isChair: false,
    depth: 360,
  },
  judge_approach: {
    id: 'judge_approach',
    name: 'Judge Approach',
    x: 500,
    y: 360,
    facing: 'north',
    isChair: false,
    depth: 360,
  },
  judge_approach_west: {
    id: 'judge_approach_west',
    name: 'West Judge Table Approach',
    x: 395,
    y: 245,
    facing: 'east',
    isChair: false,
    depth: 245,
  },
  judge_approach_east: {
    id: 'judge_approach_east',
    name: 'East Judge Table Approach',
    x: 605,
    y: 245,
    facing: 'west',
    isChair: false,
    depth: 245,
  },
  judge_approach_south: {
    id: 'judge_approach_south',
    name: 'South Judge Approach (Overflow)',
    x: 500,
    y: 400,
    facing: 'north',
    isChair: false,
    depth: 400,
  },
  whiteboard_approach: {
    id: 'whiteboard_approach',
    name: 'Cubicle 1 Approach',
    x: 329,
    y: 200,
    facing: 'north',
    isChair: false,
    depth: 200,
  },

  // Dedicated Table Spots per AI Evaluator (Diagonal clearance spots around Judge table)
  judge_spot_builder: {
    id: 'judge_spot_builder',
    name: 'Judge Table NW Spot (Builder)',
    x: 395,
    y: 245,
    facing: 'east',
    isChair: false,
    depth: 245,
  },
  judge_spot_devils_advocate: {
    id: 'judge_spot_devils_advocate',
    name: "Judge Table SW Spot (Devil's Advocate)",
    x: 415,
    y: 335,
    facing: 'east',
    isChair: false,
    depth: 335,
  },
  judge_spot_receipts: {
    id: 'judge_spot_receipts',
    name: 'Judge Table NE Spot (Receipts)',
    x: 605,
    y: 245,
    facing: 'west',
    isChair: false,
    depth: 245,
  },
  judge_spot_operator: {
    id: 'judge_spot_operator',
    name: 'Judge Table SE Spot (Operator)',
    x: 585,
    y: 335,
    facing: 'west',
    isChair: false,
    depth: 335,
  },

  // Right Chamber Door (Exit for Judge upon discussion completion)
  right_door: {
    id: 'right_door',
    name: 'Right Chamber Door (Exit)',
    x: 897,
    y: 246,
    facing: 'east',
    isChair: false,
    depth: 246,
  },
};

export const AGENT_JUDGE_SPOTS = {
  builder: 'judge_spot_builder',
  agent_1: 'judge_spot_builder',
  devils_advocate: 'judge_spot_devils_advocate',
  agent_2: 'judge_spot_devils_advocate',
  receipts: 'judge_spot_receipts',
  researcher: 'judge_spot_receipts',
  agent_3: 'judge_spot_receipts',
  operator: 'judge_spot_operator',
  agent_4: 'judge_spot_operator',
  judge: 'judge_chair',
};

export const JUDGE_APPROACH_SPOTS = [
  'judge_spot_builder',
  'judge_spot_devils_advocate',
  'judge_spot_receipts',
  'judge_spot_operator',
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
  'judge_table',
  'judge_spot_builder',
  'judge_spot_devils_advocate',
  'judge_spot_receipts',
  'judge_spot_operator',
];

/**
 * Resolves the dedicated, deterministic spot at the judge table for each AI agent.
 * Each AI evaluator goes to their assigned spot every single time using the shortest path.
 */
export function resolveApproachSpot(agentId, characterPositions, requestedTargetId) {
  if (requestedTargetId === 'right_door') {
    return 'right_door';
  }

  if (!requestedTargetId || !JUDGE_APPROACH_ALIASES.includes(requestedTargetId)) {
    return requestedTargetId;
  }

  if (agentId && AGENT_JUDGE_SPOTS[agentId]) {
    return AGENT_JUDGE_SPOTS[agentId];
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
  AGENT_JUDGE_SPOTS,
  CHAIR_IDS,
};
