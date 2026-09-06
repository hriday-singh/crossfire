/**
 * Centralized agent catalog and UI presentation rules for Crossfire evaluators.
 * Adheres strictly to DESIGN.md Section 1.3:
 * Internal evaluator IDs ('devils_advocate', 'receipts', 'builder', 'overthinker')
 * are masked to human test names in all user-facing views.
 */

export type AgentId = "devils_advocate" | "receipts" | "builder" | "overthinker";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  testName: string;
  shortRole: string;
  description: string;
  icon: string;
}

export const ALL_AGENTS: AgentDefinition[] = [
  {
    id: "devils_advocate",
    name: "Devil's Advocate",
    testName: "Assumption Test",
    shortRole: "Premises & contradictions",
    description: "Applies adversarial pressure to unearth unstated premises, user incentives, and logical contradictions.",
    icon: "psychology",
  },
  {
    id: "receipts",
    name: "Receipts Search",
    testName: "Evidence Test",
    shortRole: "Empirical market reality",
    description: "Retrieves verifiable market signals, web sources, unit economics, and public citations via live search.",
    icon: "fact_check",
  },
  {
    id: "builder",
    name: "Builder",
    testName: "Feasibility Test",
    shortRole: "Engineering bottlenecks",
    description: "Evaluates implementation bottlenecks, API constraints, latency limits, and architectural feasibility.",
    icon: "construction",
  },
  {
    id: "overthinker",
    name: "Overthinker",
    testName: "Edge-Case Test",
    shortRole: "Tail risks & boundary failures",
    description: "Explores worst-case user exploits, boundary conditions, edge vulnerabilities, and second-order failures.",
    icon: "crisis_alert",
  },
];

export const DEFAULT_AGENT_IDS: AgentId[] = [
  "devils_advocate",
  "receipts",
  "builder",
  "overthinker",
];

export function getAgentById(id: string): AgentDefinition | undefined {
  return ALL_AGENTS.find((agent) => agent.id === id);
}

export function getAgentTestName(id: string): string {
  const agent = getAgentById(id);
  return agent ? agent.testName : "Adversarial Test";
}
