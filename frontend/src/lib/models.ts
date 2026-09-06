export interface SupportedModel {
  id: string;
  name: string;
  description: string;
  tag?: string;
}

export const GEMINI_WEB_MODELS: SupportedModel[] = [
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    description: "Default high-speed engine with balanced reasoning and low latency.",
    tag: "Default",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    description: "Stable flash release for high-throughput decision parsing.",
  },
  {
    id: "gemini-3.5-flash-thinking",
    name: "Gemini 3.5 Flash Thinking",
    description: "Extended thinking budget for multi-step logical stress testing.",
    tag: "Reasoning",
  },
  {
    id: "gemini-flash-lite",
    name: "Gemini Flash Lite",
    description: "Lightweight, ultra-fast model for rapid initial evaluation.",
  },
];

/**
 * Converts a raw model ID string into a human-readable title.
 */
export function formatModelName(rawModel?: string | null): string {
  if (!rawModel) return "Connecting...";
  const trimmed = rawModel.trim();
  const matched = GEMINI_WEB_MODELS.find((m) => m.id.toLowerCase() === trimmed.toLowerCase());
  if (matched) return matched.name;

  // Fallback prettification for known conventions
  if (trimmed.startsWith("gemini-")) {
    return trimmed
      .split("-")
      .map((part) => (part === "flash" ? "Flash" : part === "thinking" ? "Thinking" : part === "lite" ? "Lite" : part.toUpperCase()))
      .join(" ");
  }

  return trimmed;
}

/**
 * Converts a raw provider protocol string into a human-readable title.
 */
export function formatProviderName(rawProvider?: string | null): string {
  if (!rawProvider) return "Connecting...";
  const lower = rawProvider.trim().toLowerCase();
  if (lower === "openai_compat") {
    return "OpenAI-Compatible REST API";
  }
  if (lower === "gemini") {
    return "Google Gemini API";
  }
  if (lower === "anthropic") {
    return "Anthropic Claude API";
  }
  return rawProvider;
}
