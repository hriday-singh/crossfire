/**
 * Utility functions for smart web URL detection, normalization, and extraction.
 */

export interface DetectedWebUrl {
  rawUrl: string;
  cleanUrl: string;
  remainingText: string;
  hostname: string;
}

// Common Top-Level Domains to recognize bare domains reliably
const COMMON_TLDS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int",
  "io", "ai", "co", "dev", "app", "tech", "cloud",
  "info", "biz", "xyz", "me", "so", "tv", "cc", "sh",
  "uk", "ca", "de", "fr", "au", "in", "jp", "cn", "nl", "eu", "ch", "se", "no", "es", "br"
]);

// Non-domain abbreviations and software libraries that look like domains
const IGNORED_TOKENS = new Set([
  "node.js", "next.js", "vue.js", "react.js", "vite.js", "express.js", "d3.js", "three.js"
]);

/**
 * Normalizes any input string into a valid http(s) URL.
 * Defaults to 'https://' if no protocol is specified.
 */
export const normalizeWebUrl = (input: string): string | null => {
  if (!input || typeof input !== "string") return null;
  let trimmed = input.trim().replace(/[.,;!?)>]+$/, "");
  if (!trimmed) return null;

  if (IGNORED_TOKENS.has(trimmed.toLowerCase())) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith("www.")) {
      trimmed = `https://${trimmed}`;
    } else {
      trimmed = `https://${trimmed}`;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.hostname === "localhost") return trimmed;

    if (!parsed.hostname.includes(".")) return null;

    const parts = parsed.hostname.split(".");
    const tld = parts[parts.length - 1]?.toLowerCase();
    if (!tld || tld.length < 2 || /\d/.test(tld)) return null;

    return trimmed;
  } catch {
    return null;
  }
};

/**
 * Regex matching:
 * 1. Protocol URLs: http:// or https://
 * 2. www. prefixed URLs
 * 3. Bare domains with paths: [subdomain.]domain.tld[/path]
 */
const URL_CANDIDATE_REGEX = /(https?:\/\/[^\s<>"'`)]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"'`)]*|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"'`)]*)?)/gi;

/**
 * Detects whether a string contains a valid web URL.
 * Automatically adds https:// by default if missing.
 */
export const detectWebUrl = (text: string): DetectedWebUrl | null => {
  if (!text || typeof text !== "string") return null;

  const matches = Array.from(text.matchAll(URL_CANDIDATE_REGEX));
  for (const match of matches) {
    const rawMatch = match[0];
    const cleanCandidate = rawMatch.replace(/[.,;!?)>]+$/, "");
    if (!cleanCandidate) continue;

    if (IGNORED_TOKENS.has(cleanCandidate.toLowerCase())) continue;
    // Disallow pure version numbers e.g. 3.14.15
    if (/^\d+(\.\d+)+$/.test(cleanCandidate)) continue;
    // Disallow abbreviation words like e.g. or i.e.
    if (/^[a-zA-Z]\.[a-zA-Z](\.|$)/.test(cleanCandidate)) continue;

    // For bare domains (without protocol or www), require a known TLD or explicit slash path
    const hasProtocolOrWww = /^https?:\/\/|www\./i.test(cleanCandidate);
    if (!hasProtocolOrWww) {
      const firstPart = cleanCandidate.split("/")[0].toLowerCase();
      const parts = firstPart.split(".");
      const tld = parts[parts.length - 1];
      if (!tld || !COMMON_TLDS.has(tld)) {
        continue;
      }
    }

    const cleanUrl = normalizeWebUrl(cleanCandidate);
    if (!cleanUrl) continue;

    try {
      const parsed = new URL(cleanUrl);
      const matchIndex = match.index ?? 0;
      const before = text.slice(0, matchIndex);
      const after = text.slice(matchIndex + rawMatch.length);
      const remainingText = `${before} ${after}`.replace(/\s+/g, " ").trim();

      return {
        rawUrl: rawMatch,
        cleanUrl,
        remainingText,
        hostname: parsed.hostname,
      };
    } catch {
      continue;
    }
  }

  return null;
};

/**
 * Extracts all web URLs from a string, returning the list of cleaned URLs
 * and the remaining text stripped of all URLs.
 */
export const extractAllWebUrls = (
  text: string
): { urls: DetectedWebUrl[]; remainingText: string } => {
  if (!text || typeof text !== "string") {
    return { urls: [], remainingText: "" };
  }

  const urls: DetectedWebUrl[] = [];
  let currentText = text;

  // Progressively extract detected URLs
  let detected = detectWebUrl(currentText);
  while (detected) {
    urls.push(detected);
    currentText = detected.remainingText;
    detected = detectWebUrl(currentText);
  }

  return {
    urls,
    remainingText: currentText.trim(),
  };
};
