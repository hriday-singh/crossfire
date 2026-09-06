import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestRow } from "@/components/features/TestRow";

describe("TestRow", () => {
  it("renders queued state with masked CI test label", () => {
    render(
      <TestRow
        testId="t-1"
        failureMode="evidence"
        state="queued"
      />
    );

    expect(screen.getByText(/evidence test/i)).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("renders running state with active indicator", () => {
    render(
      <TestRow
        testId="t-2"
        failureMode="feasibility"
        state="running"
      />
    );

    expect(screen.getByText(/feasibility test/i)).toBeInTheDocument();
    expect(screen.getByText("Running...")).toBeInTheDocument();
  });

  it("renders activeActivity badge when running", () => {
    render(
      <TestRow
        testId="t-2"
        failureMode="feasibility"
        state="running"
        activeActivity="Evaluating API rate limits and docker container sandbox..."
      />
    );

    expect(
      screen.getByText("Evaluating API rate limits and docker container sandbox...")
    ).toBeInTheDocument();
  });

  it("renders completed state with finding details and confidence", () => {
    render(
      <TestRow
        testId="t-3"
        failureMode="assumption"
        state="completed"
        finding={{
          claim_id: "c-1",
          test_id: "t-3",
          evaluator: "devils_advocate",
          result: "Behavioral resistance high",
          evidence: [
            {
              source_url: "https://example.com",
              title: "Survey",
              snippet: "Detailed snippet",
              retrieved_at: "2026-09-06",
            },
          ],
          reasoning: "Detailed reasoning explanation",
          confidence: 0.75,
          contradiction: null,
        }}
      />
    );

    expect(screen.getByText(/assumption test/i)).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Behavioral resistance high")).toBeInTheDocument();
    expect(screen.getByText("Detailed reasoning explanation")).toBeInTheDocument();
    expect(screen.getByText("conf: 0.75")).toBeInTheDocument();
    expect(screen.getByText("1 source verified")).toBeInTheDocument();
  });
});
