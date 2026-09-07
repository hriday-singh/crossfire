/**
 * Agent Configurations for Crossfire Evaluator Cubicle Bullpen Simulation
 * Maps directly to the official Crossfire evaluators in src/lib/agents.ts:
 * - Devil's Advocate (Assumption Test)
 * - Receipts (Evidence Test)
 * - Builder (Feasibility Test)
 * - Operator (Operational Friction Test)
 * Plus the Crucible Arbiter / Judge at the center bench.
 */

export const AGENT_CONFIGS = [
  {
    id: 'devils_advocate',
    name: "Devil's Advocate",
    testName: 'Assumption Test',
    role: 'Assumption Stress-Tester',
    shortRole: 'Premises & contradictions',
    cubicle: 'Cubicle 01 (NW)',
    organization: 'Adversarial Logic Core',
    color: '#818cf8', // Indigo/Purple
    primaryColorHex: 0x818cf8,
    accentColor: '#c7d2fe',
    accentColorHex: 0xc7d2fe,
    clothingColor: 0x312e81,
    skinToneHex: 0xf5d0b0,
    initialWaypoint: 'cubicle_1_desk',
    initialFacing: 'north',
    audioPitch: 1.05,
    audioFrequency: 240,
    avatarBadge: 'DA',
    icon: 'psychology',
  },
  {
    id: 'receipts',
    name: 'Receipts',
    testName: 'Evidence Test',
    role: 'Empirical Evidence Analyst',
    shortRole: 'Empirical market reality',
    cubicle: 'Cubicle 02 (SW)',
    organization: 'Market Signal & Citations Lab',
    color: '#34d399', // Verdict-survived emerald
    primaryColorHex: 0x34d399,
    accentColor: '#a7f3d0',
    accentColorHex: 0xa7f3d0,
    clothingColor: 0x065f46,
    skinToneHex: 0xf3c59a,
    initialWaypoint: 'cubicle_2_desk',
    initialFacing: 'north',
    audioPitch: 1.25,
    audioFrequency: 330,
    avatarBadge: 'RC',
    icon: 'fact_check',
  },
  {
    id: 'builder',
    name: 'Builder',
    testName: 'Feasibility Test',
    role: 'Feasibility & Systems Architect',
    shortRole: 'Engineering bottlenecks',
    cubicle: 'Cubicle 03 (NE)',
    organization: 'Architecture & Compute Operations',
    color: '#fbbf24', // Verdict-weakened amber
    primaryColorHex: 0xfbbf24,
    accentColor: '#fde68a',
    accentColorHex: 0xfde68a,
    clothingColor: 0x92400e,
    skinToneHex: 0xdeb887,
    initialWaypoint: 'cubicle_3_desk',
    initialFacing: 'north',
    audioPitch: 0.85,
    audioFrequency: 175,
    avatarBadge: 'BL',
    icon: 'construction',
  },
  {
    id: 'operator',
    name: 'Operator',
    testName: 'Operational Friction Test',
    role: 'Operational & Governance Director',
    shortRole: 'Adoption & bureaucracy',
    cubicle: 'Cubicle 04 (SE)',
    organization: 'Enterprise Governance & Procurement',
    color: '#60a5fa', // Crossfire primary blue
    primaryColorHex: 0x60a5fa,
    accentColor: '#bfdbfe',
    accentColorHex: 0xbfdbfe,
    clothingColor: 0x1e40af,
    skinToneHex: 0xffdfc4,
    initialWaypoint: 'cubicle_4_desk',
    initialFacing: 'north',
    audioPitch: 1.35,
    audioFrequency: 380,
    avatarBadge: 'OP',
    icon: 'policy',
  },
];

export const JUDGE_CONFIG = {
  id: 'judge',
  name: 'Crucible Arbiter',
  role: 'Final Decision Magistrate',
  shortRole: 'Synthesizes verdict',
  organization: 'Crossfire Crucible Court',
  color: '#e4e1e6',
  primaryColorHex: 0xe4e1e6,
  accentColor: '#a4c9ff',
  accentColorHex: 0xa4c9ff,
  clothingColor: 0x1f1f22,
  skinToneHex: 0xf5d0b0,
  initialWaypoint: 'judge_chair',
  initialFacing: 'south',
  audioPitch: 0.9,
  audioFrequency: 160,
  avatarBadge: 'CRX',
  icon: 'balance',
};

/** @type {Record<string, any>} */
const baseAgentMap = {
  judge: JUDGE_CONFIG,
  arbiter: JUDGE_CONFIG,
};

// Comprehensive AGENT_MAP supporting both evaluator IDs and legacy agent_1..4 IDs
export const AGENT_MAP = AGENT_CONFIGS.reduce((acc, agent, idx) => {
  acc[agent.id] = agent;
  acc[`agent_${idx + 1}`] = agent; // backward compatibility
  return acc;
}, baseAgentMap);

export default AGENT_CONFIGS;
