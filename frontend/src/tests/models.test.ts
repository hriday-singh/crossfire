import { describe, it, expect } from "vitest";
import { formatModelName, formatProviderName } from "@/lib/models";

describe("formatModelName", () => {
  it("says Connecting only while there is no health answer at all", () => {
    expect(formatModelName(undefined)).toBe("Connecting...");
    expect(formatModelName(null)).toBe("Connecting...");
  });

  it("says No model set when the backend answered with an empty model", () => {
    expect(formatModelName("")).toBe("No model set");
    expect(formatModelName("   ")).toBe("No model set");
  });

  it("shows a custom endpoint's model id as-is and prettifies known Gemini ids", () => {
    expect(formatModelName("qwen2.5-72b-instruct")).toBe("qwen2.5-72b-instruct");
    expect(formatModelName("gemini-3.7-flash")).toBe("Gemini 3.7 Flash");
  });
});

describe("formatProviderName", () => {
  it("prefers the backend label, e.g. a custom endpoint's name", () => {
    expect(formatProviderName("custom:my-gateway", "my-gateway")).toBe("my-gateway");
    expect(formatProviderName("gemini", "Google Gemini")).toBe("Google Gemini");
  });

  it("falls back to the legacy protocol names without a label", () => {
    expect(formatProviderName("openai_compat")).toBe("OpenAI-Compatible REST API");
    expect(formatProviderName("ollama")).toBe("ollama");
    expect(formatProviderName(undefined)).toBe("Connecting...");
  });
});
