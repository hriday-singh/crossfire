import { Case } from "@/types/crossfire";

export interface DecisionPreset {
  id: string;
  title: string;
  category: string;
  rawInput: string;
  contextHint?: string;
}

export const DECISION_PRESETS: DecisionPreset[] = [
  {
    id: "pricing-shift",
    title: "Usage-Based DevTool Pricing",
    category: "Pricing & Monetization",
    rawInput:
      "Shift from seat-based pricing to pure usage-based metering for developer tools.",
    contextHint: "Targets developer tooling and API infrastructure.",
  },
  {
    id: "gtm-sandbox",
    title: "Enterprise Sandbox vs Free Tier",
    category: "Go-To-Market",
    rawInput:
      "Eliminate the free tier entirely in favor of an interactive enterprise sandbox to stop CAC bleeding.",
    contextHint: "Targets high-touch B2B SaaS buyers with security compliance requirements.",
  },
  {
    id: "oss-adoption",
    title: "Open-Source Platform Core",
    category: "Product Architecture",
    rawInput:
      "Migrate our core platform to open-source to drive grassroots developer adoption before enterprise monetization.",
    contextHint: "Grassroots developer expansion paired with proprietary enterprise management plane.",
  },
  {
    id: "college-ai",
    title: "College Admissions AI Agent",
    category: "EdTech / Consumer",
    rawInput:
      "I want to build an AI that helps students apply to college, including submitting applications on their behalf.",
    contextHint: "Targets high school seniors in the US, covers Common App and direct school portals.",
  },
  {
    id: "unlimited-saas",
    title: "Unlimited Free-Tier AI SaaS",
    category: "B2B SaaS / DevTools",
    rawInput:
      "We should offer an unlimited free tier for our AI coding assistant to acquire developers at zero CAC, monetizing only on enterprise teams.",
    contextHint: "Assumes $0.002 per request inference costs will be offset by top 1% conversions.",
  },
  {
    id: "dentist-seo",
    title: "Micro-SaaS SEO Agent for Dentists",
    category: "Vertical AI / SMB",
    rawInput:
      "A niche vertical AI agent that crawls local dental clinic websites, auto-generates localized patient education blogs, and posts them via WordPress.",
    contextHint: "Targeting $99/mo per clinic, self-serve onboarding with automated schema markup.",
  },
  {
    id: "code-review-gate",
    title: "Automated Code Review PR Gate",
    category: "DevOps / Engineering",
    rawInput:
      "Require automated LLM code reviews to block pull requests before human review.",
    contextHint: "Gating pull requests behind automated LLM code review verification.",
  },
];

export const DEFAULT_COLLEGE_AI_CASE: Case = {
  id: "CRX-8821",
  raw_input:
    "Whether to build an AI that helps students apply to college, including submitting applications on their behalf.",
  context: "High school seniors applying to US colleges and universities",
  status: "done",
  claims: [
    {
      id: "C-01",
      statement: "Students will trust an AI to submit applications on their behalf.",
      load_bearing: true,
      status: "weakened",
      weakened_kind: "contested",
    },
    {
      id: "C-02",
      statement: "There's no existing competitor already solving this well.",
      load_bearing: true,
      status: "broken",
    },
    {
      id: "C-03",
      statement: "The onboarding screen should use a dark theme.",
      load_bearing: false,
      status: "survived",
    },
    {
      id: "C-04",
      statement:
        "The AI can reliably parse arbitrary college application portal formats without per-school custom integration.",
      load_bearing: true,
      status: "unresolved",
    },
  ],
  test_plan: [
    {
      id: "CLM-4019",
      target_claim: "C-02",
      failure_mode: "Market uniqueness & competitive moat",
      objective: "Identify existing market incumbents and direct competitors",
    },
    {
      id: "CLM-4020",
      target_claim: "C-04",
      failure_mode: "Technical feasibility",
      objective: "Assess DOM parsing resilience across target application portals",
    },
    {
      id: "CLM-4021",
      target_claim: "C-01",
      failure_mode: "Behavioral trust & delegation",
      objective: "Evaluate prospective applicant willingness to delegate autonomous submission",
    },
    {
      id: "CLM-4022",
      target_claim: "C-03",
      failure_mode: "User interface preference",
      objective: "Benchmark developer and applicant onboarding preference",
    },
  ],
  findings: [
    {
      claim_id: "C-02",
      test_id: "CLM-4019",
      evaluator: "receipts",
      result:
        "Evidence test cracked: Competitor CollegeAI raised $12M for an automated application system with human-in-the-loop review and deep CommonApp distribution.",
      evidence: [
        {
          title: "CollegeAI raises $12M for automated application platform",
          source_url:
            "https://techcrunch.com/2026/01/15/collegeai-series-a-application-automation",
          snippet:
            "CollegeAI already offers end-to-end application drafting and submission with human-in-the-loop review, live across 180 institutions.",
          retrieved_at: "2026-01-15T00:00:00Z",
        },
      ],
      reasoning: "400+ partner institutions verified across EdTech Index 2024.",
      confidence: 0.81,
      contradiction:
        "Critical Contradiction Discovered: Evidence test cracked: Competitor CollegeAI raised $12M for an automated application system with human-in-the-loop review and deep CommonApp distribution.",
    },
    {
      claim_id: "C-04",
      test_id: "CLM-4020",
      evaluator: "builder",
      result:
        "No public format standards exist across targets. Application forms use proprietary dynamic shadow DOM architectures with anti-bot shielding.",
      evidence: [],
      reasoning: "Target: DOM resilience spike",
      confidence: 0.4,
      contradiction:
        "Technical Feasibility Indeterminate: No public format standards exist across targets. Application forms use proprietary dynamic shadow DOM architectures with anti-bot shielding.",
    },
    {
      claim_id: "C-01",
      test_id: "CLM-4021",
      evaluator: "operator",
      result:
        "User interview and survey data reveals 42% refusal rate when submitting autonomously without explicit manual confirmation gates.",
      evidence: [],
      reasoning: "Sample: N=480 prospective applicants",
      confidence: 0.62,
      contradiction:
        "User Sentiment Regression: User interview and survey data reveals 42% refusal rate when submitting autonomously without explicit manual confirmation gates.",
    },
    {
      claim_id: "C-03",
      test_id: "CLM-4022",
      evaluator: "receipts",
      result:
        "Passed baseline usability heuristics and target audience aesthetic preference baselines.",
      evidence: [],
      reasoning: "Reference: Design System v3 Baseline",
      confidence: 0.9,
      contradiction: null,
    },
  ],
  consequences: [
    {
      claim_id: "C-02",
      impact: "critical",
      recommended_change:
        "Pivot strategy to differentiate on a verifiable transparent audit trail rather than first-to-market speed.",
      next_validation:
        "Run a direct product audit of CollegeAI to identify specific coverage gaps in student portals before writing code.",
      verdict_reasoning:
        "This is a load-bearing assumption. If a well-funded competitor already exists, the product thesis needs to shift immediately from first-mover to differentiation.",
    },
    {
      claim_id: "C-04",
      impact: "critical",
      recommended_change:
        "Execute a 3-day technical spike testing parsing reliability across the top 5 targeted university portals.",
      next_validation:
        "Execute a DOM parsing spike on CommonApp and 5 portal forms.",
      verdict_reasoning:
        "Technical feasibility indeterminate due to proprietary shadow DOM forms.",
    },
    {
      claim_id: "C-01",
      impact: "medium",
      recommended_change:
        "Reconfigure flow to a co-pilot workflow with mandatory student visual confirmation before submission.",
      next_validation:
        "A/B test a confirmation modal vs direct autonomous submission with 50 students.",
      verdict_reasoning:
        "High user friction around autonomous submissions without pre-flight review.",
    },
    {
      claim_id: "C-03",
      impact: "low",
      recommended_change: "Proceed as planned with dark theme styling tokens.",
      next_validation: null,
      verdict_reasoning: "Aesthetic preference confirmed by design baseline.",
    },
  ],
};
