import { describe, it, expect } from "vitest";
import { detectWebUrl } from "@/lib/urlUtils";

describe("detectWebUrl", () => {
  it("detects standard https URLs", () => {
    const result = detectWebUrl("https://techcrunch.com/article/ai-startup");
    expect(result).not.toBeNull();
    expect(result?.cleanUrl).toBe("https://techcrunch.com/article/ai-startup");
    expect(result?.hostname).toBe("techcrunch.com");
    expect(result?.remainingText).toBe("");
  });

  it("detects http URLs", () => {
    const result = detectWebUrl("http://localhost:8000/docs");
    expect(result).not.toBeNull();
    expect(result?.cleanUrl).toBe("http://localhost:8000/docs");
    expect(result?.hostname).toBe("localhost");
  });

  it("detects www URLs and prepends https://", () => {
    const result = detectWebUrl("Check out www.nytimes.com/front-page today");
    expect(result).not.toBeNull();
    expect(result?.cleanUrl).toBe("https://www.nytimes.com/front-page");
    expect(result?.hostname).toBe("www.nytimes.com");
    expect(result?.remainingText).toBe("Check out today");
  });

  it("trims trailing punctuation from the end of URLs", () => {
    const result = detectWebUrl("We should test this: https://example.com/api/v1.");
    expect(result).not.toBeNull();
    expect(result?.cleanUrl).toBe("https://example.com/api/v1");
    expect(result?.remainingText).toBe("We should test this:");
  });

  it("extracts embedded URLs and preserves clean surrounding proposal text", () => {
    const result = detectWebUrl(
      "Our team should pivot to self-serve billing like https://stripe.com/billing for lower churn."
    );
    expect(result).not.toBeNull();
    expect(result?.cleanUrl).toBe("https://stripe.com/billing");
    expect(result?.remainingText).toBe(
      "Our team should pivot to self-serve billing like for lower churn."
    );
  });

  it("ignores non-URL tokens like node.js, numbers, or abbreviations", () => {
    expect(detectWebUrl("We are using node.js for our backend service")).toBeNull();
    expect(detectWebUrl("Version 3.14.15 is deployed")).toBeNull();
    expect(detectWebUrl("e.g. we want lower latency")).toBeNull();
    expect(detectWebUrl("")).toBeNull();
  });
});
