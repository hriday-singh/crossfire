/**
 * Utility functions for smart web URL detection, normalization, and extraction.
 */

export interface DetectedWebUrl {
  rawUrl: string;
  cleanUrl: string;
  remainingText: string;
  hostname: string;
}

/**
 * Detects whether a string contains a valid web URL (http://, https://, or www.)
 * Returns the matched raw URL, cleaned normalized URL (with https://), remaining text without the URL, and hostname.
 */
export const detectWebUrl = (text: string): DetectedWebUrl | null => {
  if (!text || typeof text !== "string") return null;

  // Matches http://, https://, or www. domain with path/query
  const urlRegex = /(https?:\/\/[^\s<>"'`)]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"'`)]*)/i;
  const match = text.match(urlRegex);
  if (!match) return null;

  const rawUrl = match[0];
  // Strip trailing punctuation often typed at the end of a sentence or link
  let cleanUrl = rawUrl.replace(/[.,;!?)>]+$/, "");
  if (cleanUrl.startsWith("www.")) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    // Must contain a valid domain (at least one dot or localhost)
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      return null;
    }
    // Ensure TLD has at least 2 characters if not localhost
    if (parsed.hostname !== "localhost") {
      const parts = parsed.hostname.split(".");
      const tld = parts[parts.length - 1];
      if (!tld || tld.length < 2 || /\d/.test(tld)) {
        return null;
      }
    }

    const index = match.index ?? 0;
    const before = text.slice(0, index);
    const after = text.slice(index + rawUrl.length);
    const remainingText = `${before} ${after}`.replace(/\s+/g, " ").trim();

    return {
      rawUrl,
      cleanUrl,
      remainingText,
      hostname: parsed.hostname,
    };
  } catch {
    return null;
  }
};
