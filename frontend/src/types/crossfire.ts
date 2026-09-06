/**
 * TypeScript definitions strictly mirroring backend/core/models.py and 00-CONTRACTS.md.
 */

export type ClaimStatus = "survived" | "weakened" | "broken" | "unresolved";

export type FailureMode = "assumption" | "evidence" | "feasibility" | "edge-case";

export type ConsequenceImpact = "high" | "medium" | "low" | string;

export type CaseStatus =
  | "extracting"
  | "awaiting_confirmation"
  | "testing"
  | "done"
  | "error";

export interface Claim {
  id: string;
  statement: string;
  load_bearing: boolean | null;
  status: ClaimStatus | null;
}

export interface TestPlanItem {
  id: string;
  target_claim: string;
  failure_mode: string;
  objective: string;
}

export interface EvidenceItem {
  source_url: string;
  title: string | null;
  snippet: string;
  retrieved_at: string;
}

export interface Finding {
  claim_id: string;
  test_id: string;
  evaluator: string; // "devils_advocate" | "receipts" | "builder" | "overthinker"
  result: string;
  evidence: EvidenceItem[];
  reasoning: string;
  confidence: number;
  contradiction: string | null;
}

export interface DecisionConsequence {
  claim_id: string;
  impact: string;
  recommended_change: string;
  next_validation: string | null;
  verdict_reasoning: string;
}

export interface Case {
  id: string;
  raw_input: string;
  context: string | null;
  claims: Claim[];
  test_plan: TestPlanItem[];
  findings: Finding[];
  consequences: DecisionConsequence[];
  status: CaseStatus;
  started_at?: number | null;
  completed_at?: number | null;
  agent_mode?: "auto" | "custom";
  selected_agents?: string[];
  agent_rationales?: Record<string, string>;
}

// API schema types
export interface CreateCaseRequest {
  raw_input: string;
  context?: string | null;
  agent_mode?: "auto" | "custom";
  selected_agents?: string[];
}

export interface ConfirmCaseRequest {
  claims?: Claim[];
  selected_agents?: string[];
}

export interface ConfirmCaseResponse {
  case_id: string;
  status: string;
  message: string;
}

export interface IngestUrlRequest {
  url: string;
  claim_statement?: string | null;
}

export interface IngestPdfRequest {
  pdf_base64: string;
  claim_statement?: string | null;
}

export interface IngestImageRequest {
  image_base64: string;
  claim_statement?: string | null;
}

export interface IngestResponse {
  context: string;
  character_count: number;
}

// SSE Event frames
export type SSEEventName =
  | "claim_map_ready"
  | "awaiting_confirmation"
  | "test_started"
  | "finding_ready"
  | "verdict_ready"
  | "consequence_ready"
  | "run_complete"
  | "error";

export interface SSEClaimMapReadyData {
  claims: Claim[];
}

export interface SSETestStartedData {
  test_id: string;
  target_claim_id: string;
  evaluator: string;
}

export interface SSEFindingReadyData {
  finding: Finding;
  target_claim_id: string;
}

export interface SSEVerdictReadyData {
  claim_id: string;
  status: ClaimStatus;
  verdict_reasoning?: string;
}

export interface SSEConsequenceReadyData {
  consequence: DecisionConsequence;
}

export interface SSERunCompleteData {
  case_id: string;
}

export interface SSEErrorData {
  stage: string;
  message: string;
}

export interface SSEEventLogItem {
  id: string;
  timestamp: string;
  event: SSEEventName | string;
  data: Record<string, unknown>;
}

// Active Test State in the CI matrix
export type TestExecutionState = "queued" | "running" | "completed" | "failed";

export interface ActiveTestRow {
  test_id: string;
  target_claim: string;
  failure_mode: string;
  objective: string;
  state: TestExecutionState;
  finding?: Finding;
}
