import React from "react";
import { Case, Claim } from "@/types/crossfire";
import { cleanUiText } from "@/lib/formatters";
import { SerpApiText } from "@/components/ui/serpapi";

/**
 * Layer 0-1 of the dashboard: the call, the single thing that forced it, and
 * what to do before committing. Everything here is anchored - every row and
 * every action clicks through to the claim whose test produced it.
 */

interface VerdictBlockProps {
  currentCase: Case;
  onSelectClaim: (claimId: string) => void;
  isTesting: boolean;
}

const HEADLINES: Record<string, string> = {
  drop: "Don't proceed as written.",
  hold: "Not decidable yet.",
  proceed_with_changes: "Survives, but only with changes.",
  proceed: "Holds up.",
};

const HEADLINE_COLORS: Record<string, string> = {
  drop: "text-error",
  hold: "text-secondary",
  proceed_with_changes: "text-tertiary",
  proceed: "text-primary-container",
};

const STATUS_WORDS: Record<string, string> = {
  broken: "Refuted",
  weakened: "Weakened",
  unresolved: "Unproven",
  survived: "Held up",
};

const STATUS_COLORS: Record<string, string> = {
  broken: "text-error",
  weakened: "text-tertiary",
  unresolved: "text-secondary",
  survived: "text-primary-container",
};

// Same ordering the claim list uses: load-bearing first, then worst outcome first.
const severityRank: Record<string, number> = {
  broken: 1,
  unresolved: 2,
  weakened: 3,
  survived: 4,
};

function rankClaims(claims: Claim[]): Claim[] {
  return [...claims].sort((a, b) => {
    if (a.load_bearing && !b.load_bearing) return -1;
    if (!a.load_bearing && b.load_bearing) return 1;
    const rankA = a.status ? severityRank[a.status] || 99 : 99;
    const rankB = b.status ? severityRank[b.status] || 99 : 99;
    return rankA - rankB;
  });
}

export const VerdictBlock: React.FC<VerdictBlockProps> = ({
  currentCase,
  onSelectClaim,
  isTesting,
}) => {
  const verdict = currentCase.case_verdict;

  if (!verdict) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low px-space-5 py-space-5">
        <p className="font-body-md text-body-md text-on-surface-variant">
          {isTesting
            ? "The call lands here once every claim has been tested."
            : "No verdict for this run."}
        </p>
      </div>
    );
  }

  const headline = HEADLINES[verdict.decision_state] ?? "Result";
  const headlineColor = HEADLINE_COLORS[verdict.decision_state] ?? "text-on-surface";

  const failedClaims = rankClaims(
    currentCase.claims.filter((c) => c.status && c.status !== "survived")
  );

  const decidingSentence = (claimId: string) =>
    currentCase.consequences.find((c) => c.claim_id === claimId)?.verdict_reasoning || "";

  const sourceCredit = (claimId: string) =>
    currentCase.findings.find((f) => f.claim_id === claimId && f.evidence.length > 0)
      ?.evidence[0]?.title || "";

  const counts = [
    verdict.broken.length ? `${verdict.broken.length} refuted` : "",
    verdict.unproven.length ? `${verdict.unproven.length} unproven` : "",
    verdict.survived.length ? `${verdict.survived.length} held` : "",
  ].filter(Boolean);

  return (
    <section
      aria-label="Verdict"
      className="rounded-xl border border-outline-variant bg-surface-container-low px-space-5 py-space-5 space-y-space-5"
    >
      {/* Layer 0 - the call */}
      <div className="space-y-space-2">
        <h2
          className={`font-headline-lg text-headline-lg font-semibold leading-tight ${headlineColor}`}
        >
          {headline}
        </h2>
        <p className="font-body-md text-body-md text-on-surface leading-relaxed">
          <SerpApiText text={cleanUiText(verdict.summary)} />
        </p>
        {counts.length > 0 && (
          <p className="font-code-sm text-code-sm text-outline">{counts.join(" · ")}</p>
        )}
      </div>

      {/* Layer 1 - what broke it */}
      {failedClaims.length > 0 && (
        <div className="space-y-space-2">
          <h3 className="font-code-sm text-code-sm text-on-surface-variant font-semibold">
            What broke it
          </h3>
          <ul className="space-y-space-2">
            {failedClaims.map((claim) => {
              const reasoning = decidingSentence(claim.id);
              const source = sourceCredit(claim.id);
              return (
                <li key={claim.id}>
                  <button
                    type="button"
                    onClick={() => onSelectClaim(claim.id)}
                    className="w-full text-left rounded-lg border border-outline-variant bg-surface-container px-space-3 py-space-3 hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-space-3">
                      <span className="font-body-md text-body-md text-on-surface">
                        <SerpApiText text={cleanUiText(claim.statement)} />
                      </span>
                      <span
                        className={`font-code-sm text-code-sm font-semibold shrink-0 ${
                          STATUS_COLORS[claim.status || ""] || "text-outline"
                        }`}
                      >
                        {STATUS_WORDS[claim.status || ""] || "Untested"}
                      </span>
                    </div>
                    {reasoning && (
                      <p className="mt-1 font-body-md text-body-md text-on-surface-variant leading-relaxed">
                        <SerpApiText text={cleanUiText(reasoning)} />
                      </p>
                    )}
                    {source && (
                      <p className="mt-1 font-code-sm text-code-sm text-outline">
                        <SerpApiText text={cleanUiText(source)} />
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Layer 1 - what to do about it */}
      {verdict.next_actions.length > 0 && (
        <div className="space-y-space-2">
          <h3 className="font-code-sm text-code-sm text-on-surface-variant font-semibold">
            Before you commit
          </h3>
          <ul className="space-y-space-2">
            {verdict.next_actions.map((next, idx) => {
              const anchor = next.claim_ids[0];
              return (
                <li
                  key={`${idx}-${next.action.slice(0, 24)}`}
                  className="flex items-start justify-between gap-space-3"
                >
                  <span className="font-body-md text-body-md text-on-surface leading-relaxed">
                    <SerpApiText text={cleanUiText(next.action)} />
                  </span>
                  {anchor && (
                    <button
                      type="button"
                      onClick={() => onSelectClaim(anchor)}
                      className="shrink-0 font-code-sm text-code-sm px-2.5 py-0.5 rounded border border-outline-variant text-primary-container hover:bg-surface-container-high transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>{next.claim_ids.length} claim{next.claim_ids.length > 1 ? "s" : ""}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
