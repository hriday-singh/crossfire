import { Case, Claim } from "@/types/crossfire";

/**
 * Returns claims that have a Steel Man salvage proposal available.
 * Typically failed claims (broken, weakened, or unresolved) that carry a salvaged_claim.
 */
export function getSalvageableClaims(currentCase: Case | null | undefined): Claim[] {
  if (!currentCase || !currentCase.claims) return [];
  return currentCase.claims.filter((c) => {
    const hasSalvage = Boolean(
      c.salvaged_claim ||
        currentCase.consequences?.find((cq) => cq.claim_id === c.id)?.salvaged_claim
    );
    const isFailed =
      c.status === "broken" ||
      c.status === "weakened" ||
      c.status === "unresolved";
    return hasSalvage && isFailed;
  });
}

export function getClaimSalvagedText(claim: Claim, currentCase?: Case | null): string {
  if (claim.salvaged_claim) return claim.salvaged_claim;
  const cq = currentCase?.consequences?.find((item) => item.claim_id === claim.id);
  return cq?.salvaged_claim || "";
}

function extractWords(text: string): Set<string> {
  const matches = text.toLowerCase().match(/\b[a-z]{3,}\b/g);
  return new Set(matches || []);
}

/**
 * Deterministically substitutes original claim statements with Steel Man solutions.
 * Multi-stage:
 * 1. Exact string match
 * 2. Case-insensitive substring match
 * 3. Sentence-level token overlap
 * 4. Fallback: appends [Steel Man Adjustments]
 */
export function generateImprovedPrompt(
  originalPrompt: string,
  claims: Claim[],
  selectedClaimIds: Set<string> | string[],
  currentCase?: Case | null
): string {
  if (!originalPrompt) return "";
  const selectedSet =
    selectedClaimIds instanceof Set ? selectedClaimIds : new Set(selectedClaimIds);
  if (selectedSet.size === 0) return originalPrompt;

  const targetClaims = claims.filter((c) => selectedSet.has(c.id));
  if (targetClaims.length === 0) return originalPrompt;

  let improved = originalPrompt;
  const unmatched: Array<{ statement: string; salvage: string }> = [];

  for (const claim of targetClaims) {
    const original = claim.statement.trim();
    const salvage = getClaimSalvagedText(claim, currentCase).trim();
    if (!original || !salvage) continue;

    // 1. Exact match
    if (improved.includes(original)) {
      improved = improved.replace(original, salvage);
      continue;
    }

    // 2. Case-insensitive match
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    if (regex.test(improved)) {
      improved = improved.replace(regex, salvage);
      continue;
    }

    // 3. Sentence-level token overlap
    const claimWords = extractWords(original);
    if (claimWords.size > 0) {
      // Split into sentences using punctuation boundaries
      const sentenceRegex = /(?<=[.!?])\s+/;
      const sentences = improved.split(sentenceRegex);
      let bestIdx = -1;
      let bestOverlap = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentenceWords = extractWords(sentences[i]);
        if (sentenceWords.size === 0) continue;
        let intersectionCount = 0;
        for (const w of claimWords) {
          if (sentenceWords.has(w)) intersectionCount++;
        }
        const overlap = intersectionCount / Math.max(claimWords.size, 1);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestOverlap >= 0.28) {
        sentences[bestIdx] = salvage;
        improved = sentences.join(" ");
        continue;
      }
    }

    unmatched.push({ statement: original, salvage });
  }

  if (unmatched.length > 0) {
    const notes = unmatched.map((u) => `- ${u.salvage}`).join("\n");
    improved = `${improved.trim()}\n\n${notes}`;
  }

  return improved.trim();
}

export function calculatePromptStats(originalPrompt: string, improvedPrompt: string) {
  const originalLen = originalPrompt.length;
  const improvedLen = improvedPrompt.length;
  const charDelta = improvedLen - originalLen;
  const isModified = originalPrompt.trim() !== improvedPrompt.trim();
  return {
    originalLen,
    improvedLen,
    charDelta,
    isModified,
  };
}
