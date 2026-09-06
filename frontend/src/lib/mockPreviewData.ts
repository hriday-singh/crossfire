import { Case, ActiveTestRow, SSEEventLogItem } from "@/types/crossfire";

/**
 * Hardcoded realistic case fixture used for zero-backend UI preview.
 * Simulates a completed stress-test of an enterprise AI proposal.
 */
export const MOCK_PREVIEW_CASE: Case = {
  id: "case-preview-sample",
  raw_input:
    "Launch an autonomous AI contract review agent for enterprise SaaS procurement, replacing external legal review with automated clause redlining.",
  context:
    "Targeting Fortune 500 procurement teams dealing with high-volume standard vendor MSAs and NDAs.",
  status: "done",
  started_at: 1725638400000,
  completed_at: 1725638414500,
  claims: [
    {
      id: "c-preview-1",
      statement:
        "Enterprise general counsel and risk officers will accept automated AI contract redlining without mandatory human legal review.",
      load_bearing: true,
      status: "broken",
    },
    {
      id: "c-preview-2",
      statement:
        "Procurement cycles will accelerate by over 60% compared to traditional internal legal review queues.",
      load_bearing: true,
      status: "weakened",
    },
    {
      id: "c-preview-3",
      statement:
        "Standard vendor MSAs exhibit sufficient structural consistency across liability and indemnification clauses for deterministic extraction.",
      load_bearing: true,
      status: "survived",
    },
    {
      id: "c-preview-4",
      statement:
        "In-house IT and security teams will grant OAuth access to corporate contract repositories without dedicated SOC-2 Type II attestation.",
      load_bearing: false,
      status: "unresolved",
    },
  ],
  test_plan: [
    {
      id: "test-c1-receipts",
      target_claim: "c-preview-1",
      failure_mode: "evidence",
      objective: "Verify whether enterprise legal departments allow autonomous non-human signoff on liability agreements.",
    },
    {
      id: "test-c1-builder",
      target_claim: "c-preview-1",
      failure_mode: "feasibility",
      objective: "Assess liability insurance and regulatory exposure when autonomous AI redlines vendor agreements.",
    },
    {
      id: "test-c2-receipts",
      target_claim: "c-preview-2",
      failure_mode: "evidence",
      objective: "Gather benchmarks on time savings in legal AI redlining pilot studies.",
    },
    {
      id: "test-c3-receipts",
      target_claim: "c-preview-3",
      failure_mode: "evidence",
      objective: "Evaluate empirical MSA structural variation and clause categorization accuracy.",
    },
    {
      id: "test-c4-overthinker",
      target_claim: "c-preview-4",
      failure_mode: "edge-case",
      objective: "Explore enterprise CISO gatekeeping and repository permissioning friction.",
    },
  ],
  findings: [
    {
      claim_id: "c-preview-1",
      test_id: "test-c1-receipts",
      evaluator: "receipts",
      result: "Broken",
      confidence: 0.94,
      contradiction:
        "American Bar Association Ethics Formal Opinion 512 and enterprise insurance underwriters require licensed human supervision for binding contract execution.",
      reasoning:
        "Public enterprise risk policies and ABA regulatory guidelines mandate attorney review for indemnification and intellectual property terms. Fully autonomous signoff exposes companies to uninsurable liabilities.",
      evidence: [
        {
          source_url: "https://www.americanbar.org/groups/professional_responsibility/publications/ethics_opinions/formal_opinion_512/",
          title: "ABA Formal Opinion 512: Generative Artificial Intelligence Tools in Legal Practice",
          snippet:
            "Lawyers utilizing generative AI must maintain supervisory control over outputs and cannot delegate final professional judgment or client representation duties solely to autonomous tools.",
          retrieved_at: "2026-09-06T18:12:00Z",
        },
        {
          source_url: "https://www.gartner.com/en/newsroom/press-releases/2024-legal-risk-ai-governance",
          title: "Gartner Survey on Enterprise Legal AI Adoption",
          snippet:
            "92% of enterprise General Counsels state they will not permit autonomous contract redlines to be executed without in-house lawyer review through 2027.",
          retrieved_at: "2026-09-06T18:12:30Z",
        },
      ],
    },
    {
      claim_id: "c-preview-2",
      test_id: "test-c2-receipts",
      evaluator: "receipts",
      result: "Weakened",
      confidence: 0.82,
      contradiction:
        "While initial redlines generate in seconds, attorney review bottlenecks shift from drafting to verifying AI suggestions, cutting realized time savings to 25–35%.",
      reasoning:
        "Benchmarked pilot data shows that while first-pass redlining is instant, attorneys spend significant time verifying hallucinated citations and fine-print exceptions, limiting turnaround gains.",
      evidence: [
        {
          source_url: "https://law.stanford.edu/codex-the-stanford-center-for-legal-informatics/",
          title: "Stanford Codex: Benchmarking AI-Assisted Contract Review Workflows",
          snippet:
            "Human-in-the-loop validation of AI redlines delivered median cycle reduction of 28%, significantly lower than vendor claims of 60-80% due to verification caution.",
          retrieved_at: "2026-09-06T18:13:00Z",
        },
      ],
    },
    {
      claim_id: "c-preview-3",
      test_id: "test-c3-receipts",
      evaluator: "receipts",
      result: "Survived",
      confidence: 0.91,
      contradiction: null,
      reasoning:
        "High degree of linguistic and semantic standardization in B2B SaaS agreements across indemnification, limitation of liability, and confidentiality clauses.",
      evidence: [
        {
          source_url: "https://commonaccord.org/open-standard-contracts-study",
          title: "Open Contract Standards & Empirical Clause Distribution",
          snippet:
            "Over 84% of top 100 SaaS vendors utilize standard CommonAccord or Bonterms-derived liability frameworks with predictable section schemas.",
          retrieved_at: "2026-09-06T18:13:45Z",
        },
      ],
    },
    {
      claim_id: "c-preview-4",
      test_id: "test-c4-overthinker",
      evaluator: "overthinker",
      result: "Unresolved",
      confidence: 0.65,
      contradiction:
        "Mid-market firms frequently allow API ingestion via Google Workspace/M365 OAuth, but Fortune 500 companies enforce strict InfoSec vendor assessments.",
      reasoning:
        "Data access friction is bifurcated: early-stage companies readily connect repositories, but enterprise accounts uniformly block integrations pending lengthy third-party audits.",
      evidence: [],
    },
  ],
  consequences: [
    {
      claim_id: "c-preview-1",
      impact: "high",
      verdict_reasoning:
        "Enterprise legal teams cannot legally or contractually deploy a 'zero human review' solution without violating insurance and bar guidelines.",
      recommended_change:
        "Reposition as an 'Attorney-in-the-Loop Copilot' that drafts redlines with rationale notes for 1-click legal approval, rather than autonomous signoff.",
      next_validation:
        "Interview 5 General Counsels to determine if 1-click human ratification satisfies their risk and compliance policies.",
    },
    {
      claim_id: "c-preview-2",
      impact: "medium",
      verdict_reasoning:
        "The 60% turnaround acceleration claim is overly optimistic based on real-world verification bottlenecks.",
      recommended_change:
        "Advertise 30% verified cycle time reduction and focus messaging on error detection and risk mitigation rather than raw speed.",
      next_validation:
        "Run a 2-week pilot with a design partner measuring total attorney hours before and after tool introduction.",
    },
    {
      claim_id: "c-preview-3",
      impact: "low",
      verdict_reasoning:
        "Strong structural convergence in standard vendor agreements validates technical extraction feasibility.",
      recommended_change:
        "Focus initial parsing engine specifically on Bonterms and standard SaaS MSAs before expanding to custom enterprise paper.",
      next_validation: null,
    },
    {
      claim_id: "c-preview-4",
      impact: "medium",
      verdict_reasoning:
        "Enterprise adoption will stall at the security review stage without local data residency and SOC-2 certification.",
      recommended_change:
        "Provide a secure on-premise Docker container or VPC deployment option for enterprise evaluation.",
      next_validation:
        "Test customer willingness to upload single PDFs manually versus requiring full OAuth repository access.",
    },
  ],
};

/**
 * Mock active tests for previewing the Live Runner screen.
 */
export const MOCK_PREVIEW_TESTS: Record<string, ActiveTestRow> = {
  "test-c1-receipts": {
    test_id: "test-c1-receipts",
    target_claim: "c-preview-1",
    failure_mode: "evidence",
    objective: "Verify enterprise legal acceptance of autonomous contract redlines",
    state: "completed",
    finding: MOCK_PREVIEW_CASE.findings[0],
  },
  "test-c1-builder": {
    test_id: "test-c1-builder",
    target_claim: "c-preview-1",
    failure_mode: "feasibility",
    objective: "Simulate liability insurance and regulatory exposure under autonomous execution",
    state: "running",
  },
  "test-c2-receipts": {
    test_id: "test-c2-receipts",
    target_claim: "c-preview-2",
    failure_mode: "evidence",
    objective: "Gather benchmarks on turnaround time savings in legal AI deployments",
    state: "completed",
    finding: MOCK_PREVIEW_CASE.findings[1],
  },
  "test-c3-receipts": {
    test_id: "test-c3-receipts",
    target_claim: "c-preview-3",
    failure_mode: "evidence",
    objective: "Evaluate empirical MSA structural consistency across vendors",
    state: "completed",
    finding: MOCK_PREVIEW_CASE.findings[2],
  },
  "test-c4-overthinker": {
    test_id: "test-c4-overthinker",
    target_claim: "c-preview-4",
    failure_mode: "edge-case",
    objective: "Explore enterprise CISO gatekeeping and repository OAuth friction",
    state: "running",
  },
};

/**
 * Mock SSE telemetry logs for previewing the Live Logs drawer.
 */
export const MOCK_PREVIEW_LOGS: SSEEventLogItem[] = [
  {
    id: "log-5",
    timestamp: "2026-09-06T18:14:14Z",
    event: "run_complete",
    data: { case_id: "case-preview-sample" },
  },
  {
    id: "log-4",
    timestamp: "2026-09-06T18:14:08Z",
    event: "verdict_ready",
    data: {
      claim_id: "c-preview-1",
      status: "broken",
      verdict_reasoning:
        "American Bar Association Opinion 512 and corporate risk insurers require licensed human supervision.",
    },
  },
  {
    id: "log-3",
    timestamp: "2026-09-06T18:13:52Z",
    event: "finding_ready",
    data: {
      claim_id: "c-preview-1",
      test_id: "test-c1-receipts",
      finding: MOCK_PREVIEW_CASE.findings[0],
    },
  },
  {
    id: "log-2",
    timestamp: "2026-09-06T18:13:10Z",
    event: "test_started",
    data: {
      test_id: "test-c1-receipts",
      target_claim_id: "c-preview-1",
      evaluator: "receipts",
    },
  },
  {
    id: "log-1",
    timestamp: "2026-09-06T18:12:00Z",
    event: "claim_map_ready",
    data: { claims: MOCK_PREVIEW_CASE.claims },
  },
];

/**
 * Mock historical cases for previewing the Case History modal.
 */
export const MOCK_PREVIEW_HISTORY: Case[] = [
  MOCK_PREVIEW_CASE,
  {
    id: "case-history-prev-1",
    raw_input:
      "We should offer an unlimited free tier for our AI developer tool to acquire users at zero CAC.",
    context: "Developer tooling market targeting open-source contributors.",
    status: "done",
    started_at: 1725552000000,
    completed_at: 1725552012000,
    claims: [
      {
        id: "c-h1",
        statement: "Developer word-of-mouth creates viral zero-CAC adoption.",
        load_bearing: true,
        status: "survived",
      },
      {
        id: "c-h2",
        statement: "Free tier inference compute costs remain under $0.02 per active user per day.",
        load_bearing: true,
        status: "broken",
      },
      {
        id: "c-h3",
        statement: "10% of free developers convert to paid team seats within 60 days.",
        load_bearing: true,
        status: "weakened",
      },
    ],
    test_plan: [],
    findings: [],
    consequences: [],
  },
];
