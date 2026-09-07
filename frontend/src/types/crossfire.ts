/**
 * TypeScript definitions strictly mirroring backend/core/models.py and 00-CONTRACTS.md.
 */

export type ClaimStatus = "survived" | "weakened" | "broken" | "unresolved";
export type WeakenedKind = "qualified" | "contested";

export type FailureMode =
  | "assumption"
  | "evidence"
  | "feasibility"
  | "operational_friction"
  | "edge-case";

export type ConsequenceImpact = "high" | "medium" | "low" | string;

export type CaseStatus =
  | "extracting"
  | "needs_input"
  | "awaiting_confirmation"
  | "testing"
  | "done"
  | "error";

export interface Claim {
  id: string;
  statement: string;
  provisional?: boolean;
  load_bearing: boolean | null;
  load_bearing_reason?: string | null;
  status: ClaimStatus | null;
  weakened_kind?: WeakenedKind | null;
  confidence?: number | null;
  fatal_flaw?: string | null;
  salvaged_claim?: string | null;
  tradeoff_acknowledged?: string | null;
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
  provider?: string; // "serpapi" | "duckduckgo" | "fixture"
  source_class?: string;
}

export interface Finding {
  claim_id: string;
  test_id: string;
  evaluator: string; // "devils_advocate" | "researcher" | "builder" | "operator" | "researcher" | "overthinker"
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
  fatal_flaw?: string | null;
  salvaged_claim?: string | null;
  tradeoff_acknowledged?: string | null;
}

export interface NextAction {
  action: string;
  claim_ids: string[];
}

export interface DecidingFactor {
  claim_id: string;
  evaluator: string;
  the_fact: string;
  source_url?: string | null;
  source_title?: string | null;
  gate_fired?: boolean;
}

export interface CaseVerdict {
  decision_state: "proceed" | "proceed_with_changes" | "hold" | "drop" | string;
  /** Generated per case. Empty on older runs — fall back to HEADLINES. */
  headline?: string;
  summary: string;
  deciding_factor?: DecidingFactor | null;
  survived: string[];
  broken: string[];
  weakened?: string[];
  unproven: string[];
  next_actions: NextAction[];
}

export interface Case {
  id: string;
  raw_input: string;
  context: string | null;
  claims: Claim[];
  test_plan: TestPlanItem[];
  findings: Finding[];
  consequences: DecisionConsequence[];
  case_verdict?: CaseVerdict | null;
  status: CaseStatus;
  gate_message?: string | null;
  clarify_missing?: string[];
  clarify_interpretation?: string | null;
  clarify_round?: number;
  started_at?: number | null;

  completed_at?: number | null;
  agent_mode?: "auto" | "custom";
  selected_agents?: string[];
  agent_rationales?: Record<string, string>;
  telemetry?: CaseTelemetry | null;
  activities?: ActivityItem[];
}

export interface AgentTokenUsage {
  agent: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface CaseTelemetry {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_estimated_cost_usd: number;
  agent_breakdown: AgentTokenUsage[];
  duration_ms: number;
}

export interface RetestClaimRequest {
  action?: "test_salvaged" | "counter_evidence";
  counter_evidence?: string | null;
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

export interface IngestMarkdownRequest {
  markdown_text?: string | null;
  markdown_base64?: string | null;
  claim_statement?: string | null;
}

export interface IngestResponse {
  context: string;
  character_count: number;
}

export interface ActivityItem {
  id: string;
  case_id?: string;
  timestamp: string;
  tag: string;
  text: string;
  claim_id?: string | null;
  action?: string | null;
}

// SSE Event frames
export type SSEEventName =
  | "claim_map_ready"
  | "awaiting_confirmation"
  | "load_bearing_ready"
  | "test_started"
  | "finding_ready"
  | "verdict_ready"
  | "consequence_ready"
  | "case_verdict"
  | "telemetry_ready"
  | "run_complete"
  | "error"
  | "activity";

export interface SSEActivityData {
  tag: string;
  text: string;
  claim_id?: string | null;
  action?: string | null;
  timestamp: string;
}

export interface SSELoadBearingReadyData {
  claim_id: string;
  load_bearing: boolean;
  reason: string;
}

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
  weakened_kind?: WeakenedKind | null;
  verdict_reasoning?: string;
  fatal_flaw?: string | null;
  salvaged_claim?: string | null;
  tradeoff_acknowledged?: string | null;
}

export interface SSEConsequenceReadyData {
  consequence: DecisionConsequence;
}

export interface SSECaseVerdictData {
  case_verdict: CaseVerdict;
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
