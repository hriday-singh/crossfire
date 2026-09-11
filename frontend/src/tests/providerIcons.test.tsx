import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderIcon } from "@/components/ui/providerIcons";

describe("ProviderIcon", () => {
  it.each([
    ["openai", "OpenAI"],
    ["anthropic", "Claude"],
    ["ollama", "Ollama"],
    ["gemini", "Google Gemini"],
  ])("renders the %s brand mark", (providerId, label) => {
    render(<ProviderIcon providerId={providerId} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it("falls back to a neutral glyph for user-added endpoints", () => {
    render(<ProviderIcon providerId="custom:vllm-box" />);
    expect(screen.getByLabelText("Custom endpoint")).toBeInTheDocument();
  });

  it("honours the requested size and namespaces the gemini gradient per instance", () => {
    const { container } = render(
      <>
        <ProviderIcon providerId="gemini" size={32} />
        <ProviderIcon providerId="gemini" size={32} />
      </>
    );

    const svgs = container.querySelectorAll("svg");
    expect(svgs[0]).toHaveAttribute("width", "32");

    const gradientIds = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(gradientIds).toHaveLength(2);
    expect(new Set(gradientIds).size).toBe(2);
  });
});
