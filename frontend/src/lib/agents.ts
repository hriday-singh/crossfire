/**
 * Centralized agent catalog and UI presentation rules for Crossfire evaluators.
 * Adheres strictly to DESIGN.md Section 1.3:
 * Internal evaluator IDs ('devils_advocate', 'researcher', 'builder', 'operator')
 * are masked to human test names in all user-facing views.
 */

export type AgentId = "devils_advocate" | "researcher" | "builder" | "operator" | "researcher" | "overthinker";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  testName: string;
  shortRole: string;
  description: string;
  icon: string;
  emoji: string;
}

export const ALL_AGENTS: AgentDefinition[] = [
  {
    id: "devils_advocate",
    name: "Devil's Advocate",
    testName: "Assumption Test",
    shortRole: "Premises & contradictions",
    description: "Applies adversarial pressure to unearth unstated premises, user incentives, and logical contradictions.",
    icon: "psychology",
    emoji: "/emoji/devils_advocate.png",
  },
  {
    id: "researcher",
    name: "Researcher",
    testName: "Evidence Test",
    shortRole: "Empirical market reality",
    description: "Retrieves verifiable market signals, web sources, unit economics, and public citations via live search.",
    icon: "fact_check",
    emoji: "/emoji/researcher.png",
  },
  {
    id: "builder",
    name: "Builder",
    testName: "Feasibility Test",
    shortRole: "Engineering bottlenecks",
    description: "Evaluates implementation bottlenecks, API constraints, latency limits, and architectural feasibility.",
    icon: "construction",
    emoji: "/emoji/builder.png",
  },
  {
    id: "operator",
    name: "Operator",
    testName: "Operational Friction Test",
    shortRole: "Adoption & bureaucracy",
    description: "Stress-tests organizational friction, human inertia, enterprise procurement red tape, regulatory liability, and process drag.",
    icon: "policy",
    emoji: "/emoji/operator.png",
  },
];

export const DEFAULT_AGENT_IDS: AgentId[] = [
  "devils_advocate",
  "researcher",
  "builder",
  "operator",
];

export function getAgentById(id: string): AgentDefinition | undefined {
  const normalized = id === "overthinker" ? "operator" : id === "researcher" ? "researcher" : id;
  return ALL_AGENTS.find((agent) => agent.id === normalized);
}

export function getAgentTestName(id: string): string {
  const agent = getAgentById(id);
  return agent ? agent.testName : "Adversarial Test";
}
