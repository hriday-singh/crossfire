/**
 * Room Layout & Coordinate System (1000 x 650)
 * Crossfire Evaluator Cubicle Bullpen & Crucible Steelman Court.
 *
 * Architecture:
 * - Center (x: 500): The Crucible Steelman Table & Arbiter Bench presiding over verdicts.
 * - Left Side: 2 Modular Cubicles (Cubicle 01: Devil's Advocate, Cubicle 02: Researcher).
 * - Right Side: 2 Modular Cubicles (Cubicle 03: Builder, Cubicle 04: Operator).
 * - Central Corridor connecting all workstations with telemetry consoles.
 */

export const ROOM_DIMENSIONS = {
  width: 1000,
  height: 587,
};

export const STEELMAN_TABLE_CONFIG = {
  x: 500,
  y: 281,
  width: 240,
  height: 120,
  depthY: 281,
};

// Backward-compatible alias for existing components
export const TABLE_CONFIG = STEELMAN_TABLE_CONFIG;

export const CUBICLE_LAYOUTS = [
  {
    id: 'cubicle_1',
    agentId: 'builder',
    name: 'Cubicle 01 // BUILDER',
    testName: 'Feasibility Test',
    side: 'left',
    row: 'top',
    bounds: { x: 175, y: 80, width: 210, height: 180 },
    desk: { x: 275, y: 165, width: 90, height: 40 },
    chair: { x: 284, y: 159 },
    stand: { x: 330, y: 210 },
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
    bounds: { x: 175, y: 320, width: 200, height: 130 },
    desk: { x: 235, y: 350, width: 80, height: 35 },
    chair: { x: 246, y: 355 },
    stand: { x: 310, y: 365 },
    colorHex: 0x818cf8,
    accentHex: 0xc7d2fe,
  },
  {
    id: 'cubicle_3',
    agentId: 'researcher',
    name: 'Cubicle 03 // RESEARCHER',
    testName: 'Evidence Test',
    side: 'right',
    row: 'top',
    bounds: { x: 605, y: 80, width: 210, height: 180 },
    desk: { x: 715, y: 165, width: 90, height: 40 },
    chair: { x: 718, y: 159 },
    stand: { x: 670, y: 210 },
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
    bounds: { x: 625, y: 320, width: 200, height: 130 },
    desk: { x: 745, y: 350, width: 80, height: 35 },
    chair: { x: 754, y: 355 },
    stand: { x: 680, y: 365 },
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
    facing: 'south',
    isChair: true,
    depth: 159,
  },
  cubicle_1_stand: {
    id: 'cubicle_1_stand',
    name: 'Cubicle 01 Architecture Stand',
    x: 330,
    y: 210,
    facing: 'south',
    isChair: false,
    depth: 210,
  },

  // Cubicle 2: Devil's Advocate (SW)
  cubicle_2_desk: {
    id: 'cubicle_2_desk',
    name: "Cubicle 02 Desk (Devil's Advocate)",
    x: 246,
    y: 355,
    facing: 'north',
    isChair: true,
    depth: 355,
  },
  cubicle_2_stand: {
    id: 'cubicle_2_stand',
    name: "Cubicle 02 Pinboard Stand",
    x: 310,
    y: 365,
    facing: 'north',
    isChair: false,
    depth: 365,
  },

  // Cubicle 3: Researcher / Researcher (NE)
  cubicle_3_desk: {
    id: 'cubicle_3_desk',
    name: 'Cubicle 03 Desk (Researcher)',
    x: 718,
    y: 159,
    facing: 'south',
    isChair: true,
    depth: 159,
  },
  cubicle_3_stand: {
    id: 'cubicle_3_stand',
    name: 'Cubicle 03 Citations Stand',
    x: 670,
    y: 210,
    facing: 'south',
    isChair: false,
    depth: 210,
  },

  // Cubicle 4: Operator (SE)
  cubicle_4_desk: {
    id: 'cubicle_4_desk',
    name: 'Cubicle 04 Desk (Operator)',
    x: 754,
    y: 355,
    facing: 'north',
    isChair: true,
    depth: 355,
  },
  cubicle_4_stand: {
    id: 'cubicle_4_stand',
    name: 'Cubicle 04 Policy Stand',
    x: 680,
    y: 365,
    facing: 'north',
    isChair: false,
    depth: 365,
  },

  // Center: Crucible Steelman Table & Arbiter Bench
  steelman_chair: {
    id: 'steelman_chair',
    name: 'Crucible Steelman Bench Chair',
    x: 500,
    y: 250,
    facing: 'south',
    isChair: true,
    depth: 250,
  },
  steelman_desk: {
    id: 'steelman_desk',
    name: 'Crucible Steelman Station',
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
    x: 246,
    y: 355,
    facing: 'north',
    isChair: true,
    depth: 355,
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
    x: 754,
    y: 355,
    facing: 'north',
    isChair: true,
    depth: 355,
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
    name: 'Crucible Steelman Monolith',
    x: 500,
    y: 281,
    facing: 'south',
    isChair: false,
    depth: 281,
  },
  podium_approach: {
    id: 'podium_approach',
    name: 'Steelman Approach',
    x: 500,
    y: 360,
    facing: 'north',
    isChair: false,
    depth: 360,
  },
  steelman_approach: {
    id: 'steelman_approach',
    name: 'Steelman Approach',
    x: 500,
    y: 360,
    facing: 'north',
    isChair: false,
    depth: 360,
  },
  steelman_approach_west: {
    id: 'steelman_approach_west',
    name: 'West Steelman Table Approach',
    x: 395,
    y: 245,
    facing: 'east',
    isChair: false,
    depth: 245,
  },
  steelman_approach_east: {
    id: 'steelman_approach_east',
    name: 'East Steelman Table Approach',
    x: 605,
    y: 245,
    facing: 'west',
    isChair: false,
    depth: 245,
  },
  steelman_approach_south: {
    id: 'steelman_approach_south',
    name: 'South Steelman Approach (Overflow)',
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

  // Dedicated Table Spots per AI Evaluator (Diagonal clearance spots around Steelman table)
  steelman_spot_builder: {
    id: 'steelman_spot_builder',
    name: 'Steelman Table NW Spot (Builder)',
    x: 395,
    y: 245,
    facing: 'east',
    isChair: false,
    depth: 245,
  },
  steelman_spot_devils_advocate: {
    id: 'steelman_spot_devils_advocate',
    name: "Steelman Table SW Spot (Devil's Advocate)",
    x: 415,
    y: 335,
    facing: 'east',
    isChair: false,
    depth: 335,
  },
  steelman_spot_researcher: {
    id: 'steelman_spot_researcher',
    name: 'Steelman Table NE Spot (Researcher)',
    x: 605,
    y: 245,
    facing: 'west',
    isChair: false,
    depth: 245,
  },
  steelman_spot_operator: {
    id: 'steelman_spot_operator',
    name: 'Steelman Table SE Spot (Operator)',
    x: 585,
    y: 335,
    facing: 'west',
    isChair: false,
    depth: 335,
  },

  // Right Chamber Door (Exit for Steelman upon discussion completion)
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

export const AGENT_STEELMAN_SPOTS = {
  builder: 'steelman_spot_builder',
  agent_1: 'steelman_spot_builder',
  devils_advocate: 'steelman_spot_devils_advocate',
  agent_2: 'steelman_spot_devils_advocate',
  researcher: 'steelman_spot_researcher',
  researcher: 'steelman_spot_researcher',
  agent_3: 'steelman_spot_researcher',
  operator: 'steelman_spot_operator',
  agent_4: 'steelman_spot_operator',
  steelman: 'steelman_chair',
};

export const STEELMAN_APPROACH_SPOTS = [
  'steelman_spot_builder',
  'steelman_spot_devils_advocate',
  'steelman_spot_researcher',
  'steelman_spot_operator',
  'steelman_approach',
  'steelman_approach_west',
  'steelman_approach_east',
  'steelman_approach_south',
];

export const STEELMAN_APPROACH_ALIASES = [
  'podium_approach',
  'presentation_podium',
  'steelman_approach',
  'steelman_desk',
  'steelman_table',
  'steelman_spot_builder',
  'steelman_spot_devils_advocate',
  'steelman_spot_researcher',
  'steelman_spot_operator',
];

/**
 * Resolves the dedicated, deterministic spot at the steelman table for each AI agent.
 * Each AI evaluator goes to their assigned spot every single time using the shortest path.
 */
export function resolveApproachSpot(agentId, characterPositions, requestedTargetId) {
  if (requestedTargetId === 'right_door') {
    return 'right_door';
  }

  if (!requestedTargetId || !STEELMAN_APPROACH_ALIASES.includes(requestedTargetId)) {
    return requestedTargetId;
  }

  if (agentId && AGENT_STEELMAN_SPOTS[agentId]) {
    return AGENT_STEELMAN_SPOTS[agentId];
  }

  return 'steelman_approach';
}

export const CHAIR_IDS = [
  'cubicle_1_desk',
  'cubicle_2_desk',
  'cubicle_3_desk',
  'cubicle_4_desk',
  'steelman_chair',
  'chair_north',
  'chair_south',
  'chair_west',
  'chair_east',
];

export default {
  ROOM_DIMENSIONS,
  STEELMAN_TABLE_CONFIG,
  TABLE_CONFIG,
  CUBICLE_LAYOUTS,
  WAYPOINTS,
  AGENT_STEELMAN_SPOTS,
  CHAIR_IDS,
};
