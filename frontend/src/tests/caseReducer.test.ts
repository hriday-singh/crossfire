import { describe, it, expect } from "vitest";
import { caseReducer, INITIAL_STATE } from "@/context/caseReducer";
import { Case } from "@/types/crossfire";

describe("caseReducer", () => {
  it("should handle START_EXTRACTING and transition state", () => {
    const state = caseReducer(INITIAL_STATE, {
      type: "START_EXTRACTING",
      payload: { rawInput: "Should we build an AI agent for college admissions?" },
    });

    expect(state.isExtracting).toBe(true);
    expect(state.currentCase?.raw_input).toBe("Should we build an AI agent for college admissions?");
    expect(state.currentCase?.status).toBe("extracting");
    expect(state.error).toBeNull();
  });

  it("should handle EXTRACTING_SUCCESS and switch to confirm screen", () => {
    const mockCase: Case = {
      id: "case-123",
      raw_input: "Test input",
      context: null,
      status: "awaiting_confirmation",
      claims: [
        { id: "c1", statement: "Claim 1", load_bearing: null, status: null },
      ],
      test_plan: [],
      findings: [],
      consequences: [],
    };

    const state = caseReducer(INITIAL_STATE, {
      type: "EXTRACTING_SUCCESS",
      payload: mockCase,
    });

    expect(state.isExtracting).toBe(false);
    expect(state.activeScreen).toBe("confirm");
    expect(state.currentCase?.claims).toHaveLength(1);
  });

  it("should handle UPDATE_CLAIM_STATEMENT, REMOVE_CLAIM, and ADD_CLAIM", () => {
    const initialStateWithCase = {
      ...INITIAL_STATE,
      currentCase: {
        id: "case-123",
        raw_input: "Test input",
        context: null,
        status: "awaiting_confirmation" as const,
        claims: [
          { id: "c1", statement: "Initial Claim 1", load_bearing: null, status: null },
          { id: "c2", statement: "Initial Claim 2", load_bearing: null, status: null },
        ],
        test_plan: [],
        findings: [],
        consequences: [],
      },
    };

    // Update
    let state = caseReducer(initialStateWithCase, {
      type: "UPDATE_CLAIM_STATEMENT",
      payload: { claimId: "c1", statement: "Updated Claim 1" },
    });
    expect(state.currentCase?.claims[0].statement).toBe("Updated Claim 1");

    // Remove
    state = caseReducer(state, {
      type: "REMOVE_CLAIM",
      payload: { claimId: "c2" },
    });
    expect(state.currentCase?.claims).toHaveLength(1);
    expect(state.currentCase?.claims[0].id).toBe("c1");

    // Add
    state = caseReducer(state, {
      type: "ADD_CLAIM",
      payload: { statement: "Newly Added Claim" },
    });
    expect(state.currentCase?.claims).toHaveLength(2);
    expect(state.currentCase?.claims[1].statement).toBe("Newly Added Claim");

    // Toggle load bearing
    state = caseReducer(state, {
      type: "TOGGLE_CLAIM_LOAD_BEARING",
      payload: { claimId: "c1" },
    });
    expect(state.currentCase?.claims[0].load_bearing).toBe(true);

    state = caseReducer(state, {
      type: "TOGGLE_CLAIM_LOAD_BEARING",
      payload: { claimId: "c1" },
    });
    expect(state.currentCase?.claims[0].load_bearing).toBe(false);
  });

  it("should process SSE events deterministically and update findings & verdicts", () => {
    const stateWithCase = {
      ...INITIAL_STATE,
      currentCase: {
        id: "case-123",
        raw_input: "Test",
        context: null,
        status: "testing" as const,
        claims: [
          { id: "c1", statement: "Claim 1", load_bearing: true, status: null },
        ],
        test_plan: [],
        findings: [],
        consequences: [],
      },
      activeScreen: "runner" as const,
      isStreaming: true,
    };

    // test_started
    let state = caseReducer(stateWithCase, {
      type: "SSE_EVENT",
      payload: {
        event: "test_started",
        data: { test_id: "t1", target_claim_id: "c1", evaluator: "receipts", failure_mode: "evidence" },
      },
    });
    expect(state.activeTests["t1"]).toBeDefined();
    expect(state.activeTests["t1"].state).toBe("running");
    expect(state.activeTests["t1"].failure_mode).toBe("evidence");

    // finding_ready
    state = caseReducer(state, {
      type: "SSE_EVENT",
      payload: {
        event: "finding_ready",
        data: {
          finding: {
            claim_id: "c1",
            test_id: "t1",
            evaluator: "receipts",
            result: "Competitor exists",
            evidence: [],
            reasoning: "Public record",
            confidence: 0.85,
            contradiction: null,
          },
          target_claim_id: "c1",
        },
      },
    });
    expect(state.currentCase?.findings).toHaveLength(1);
    expect(state.activeTests["t1"].state).toBe("completed");

    // verdict_ready
    state = caseReducer(state, {
      type: "SSE_EVENT",
      payload: {
        event: "verdict_ready",
        data: { claim_id: "c1", status: "broken" },
      },
    });
    expect(state.currentCase?.claims[0].status).toBe("broken");

    // run_complete
    state = caseReducer(state, {
      type: "SSE_EVENT",
      payload: {
        event: "run_complete",
        data: { case_id: "case-123" },
      },
    });
    expect(state.currentCase?.status).toBe("done");
    expect(state.activeScreen).toBe("dashboard");
    expect(state.isStreaming).toBe(false);
    expect(state.caseHistory).toHaveLength(1);
  });

  it("should handle CLEAR_HISTORY and DELETE_HISTORY_ITEM", () => {
    const mockCase1: Case = {
      id: "case-1",
      raw_input: "Input 1",
      context: null,
      status: "done",
      claims: [],
      test_plan: [],
      findings: [],
      consequences: [],
    };
    const mockCase2: Case = {
      id: "case-2",
      raw_input: "Input 2",
      context: null,
      status: "done",
      claims: [],
      test_plan: [],
      findings: [],
      consequences: [],
    };

    let state = {
      ...INITIAL_STATE,
      caseHistory: [mockCase1, mockCase2],
    };

    // Delete item
    state = caseReducer(state, {
      type: "DELETE_HISTORY_ITEM",
      payload: "case-1",
    });
    expect(state.caseHistory).toHaveLength(1);
    expect(state.caseHistory[0].id).toBe("case-2");

    // Clear history
    state = caseReducer(state, {
      type: "CLEAR_HISTORY",
    });
    expect(state.caseHistory).toHaveLength(0);
  });

  it("should handle SET_ENGINE_INFO", () => {
    const state = caseReducer(INITIAL_STATE, {
      type: "SET_ENGINE_INFO",
      payload: { status: "ok", provider: "openai_compat", model: "gemini-3.7-flash" },
    });
    expect(state.engineInfo?.model).toBe("gemini-3.7-flash");
    expect(state.engineInfo?.provider).toBe("openai_compat");
  });

  it("should handle SET_AGENT_MODE, TOGGLE_AGENT_SELECTION, and SET_SELECTED_AGENTS", () => {
    const initialStateWithCase = {
      ...INITIAL_STATE,
      currentCase: {
        id: "case-agents",
        raw_input: "Test input",
        context: null,
        status: "awaiting_confirmation" as const,
        agent_mode: "auto" as const,
        selected_agents: ["devils_advocate", "receipts", "builder"],
        claims: [],
        test_plan: [],
        findings: [],
        consequences: [],
      },
    };

    // Set agent mode
    let state = caseReducer(initialStateWithCase, {
      type: "SET_AGENT_MODE",
      payload: "custom",
    });
    expect(state.currentCase?.agent_mode).toBe("custom");

    // Toggle out existing agent
    state = caseReducer(state, {
      type: "TOGGLE_AGENT_SELECTION",
      payload: "builder",
    });
    expect(state.currentCase?.selected_agents).toEqual(["devils_advocate", "receipts"]);

    // Toggle in non-existing agent
    state = caseReducer(state, {
      type: "TOGGLE_AGENT_SELECTION",
      payload: "overthinker",
    });
    expect(state.currentCase?.selected_agents).toEqual([
      "devils_advocate",
      "receipts",
      "overthinker",
    ]);

    // Explicitly set selected agents
    state = caseReducer(state, {
      type: "SET_SELECTED_AGENTS",
      payload: ["receipts"],
    });
    expect(state.currentCase?.selected_agents).toEqual(["receipts"]);
  });
});
