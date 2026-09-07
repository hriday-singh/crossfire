import React from "react";
import { Case, Claim } from "@/types/crossfire";
import { cleanUiText } from "@/lib/formatters";
import { SerpApiText } from "@/components/ui/serpapi";

/**
 * The call, the one fact that forced it, and what to do before committing.
 *
 * Everything on this page is anchored — every row clicks through to the claim
 * whose test produced it. Only three things sit above the fold; the remaining
 * failed claims are one disclosure down, because a flat list of every failure
 * gives the reader no way to tell which one actually decided the case.
 */

interface VerdictBlockProps {
  currentCase: Case;
  onSelectClaim: (claimId: string) => void;
  isTesting: boolean;
}

// The floor when the backend could not generate a headline for this case.
// Kept in sync with synthesis.FALLBACK_HEADLINES.
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

const EVALUATOR_NAMES: Record<string, string> = {
  devils_advocate: "Devil's Advocate",
  receipts: "Researcher",
  researcher: "Researcher",
  builder: "Builder",
  operator: "Operator",
  overthinker: "Operator",
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

  // Generated per case; the static map is only the floor for older runs and for
  // synthesis failures. Four fixed strings read identically across unrelated
  // decisions, which is exactly what this replaces.
  const headline =
    cleanUiText(verdict.headline || "") || HEADLINES[verdict.decision_state] || "Result";
  const headlineColor = HEADLINE_COLORS[verdict.decision_state] ?? "text-on-surface";

  const deciding = verdict.deciding_factor ?? null;

  const failedClaims = rankClaims(
    currentCase.claims.filter((c) => c.status && c.status !== "survived")
  );
  // The deciding claim is already shown in full above; repeating it in the list
  // below is the duplication that made this page feel long.
  const otherFailedClaims = failedClaims.filter((c) => c.id !== deciding?.claim_id);

  const decidingClaim = deciding
    ? currentCase.claims.find((c) => c.id === deciding.claim_id)
    : undefined;

  const decidingSentence = (claimId: string) =>
    currentCase.consequences.find((c) => c.claim_id === claimId)?.verdict_reasoning || "";

  const claimsWithStatus = currentCase.claims.filter((c) => c.status);
  const hasClaimStatuses = claimsWithStatus.length > 0;

  const brokenCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "broken").length
    : verdict.broken.length;

  const weakenedCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "weakened").length
    : (verdict.weakened?.length ?? 0);

  const unresolvedCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "unresolved").length
    : Math.max(0, verdict.unproven.length - (verdict.weakened?.length ?? 0));

  const survivedCount = hasClaimStatuses
    ? currentCase.claims.filter((c) => c.status === "survived").length
    : verdict.survived.length;

  const counts = [
    brokenCount ? `${brokenCount} refuted` : "",
    weakenedCount ? `${weakenedCount} weakened` : "",
    unresolvedCount ? `${unresolvedCount} unproven` : "",
    survivedCount ? `${survivedCount} held` : "",
  ].filter(Boolean);

  return (
    <section
      aria-label="Verdict"
      className="rounded-xl border border-outline-variant bg-surface-container-low px-space-5 py-space-5 space-y-space-5"
    >
      {/* The call */}
      <div className="space-y-space-2">
        <h2
          className={`font-headline-lg text-headline-lg font-semibold leading-tight ${headlineColor}`}
        >
          <SerpApiText text={headline} />
        </h2>
        <p className="font-body-md text-body-md text-on-surface leading-relaxed">
          <SerpApiText text={cleanUiText(verdict.summary)} />
        </p>
        {counts.length > 0 && (
          <p className="font-code-sm text-code-sm text-outline">{counts.join(" · ")}</p>
        )}
      </div>

      {/* What decided it — one finding, resolved server-side */}
      {deciding && (
        <div className="space-y-space-2">
          <h3 className="font-code-sm text-code-sm text-on-surface-variant font-semibold">
            What decided it
          </h3>
          <button
            type="button"
            onClick={() => onSelectClaim(deciding.claim_id)}
            className="w-full text-left rounded-lg border border-outline-variant bg-surface-container px-space-3 py-space-3 hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-space-3">
              <span className="font-body-md text-body-md text-on-surface">
                <SerpApiText text={cleanUiText(deciding.the_fact)} />
              </span>
              {decidingClaim?.status && (
                <span
                  className={`font-code-sm text-code-sm font-semibold shrink-0 ${
                    STATUS_COLORS[decidingClaim.status] || "text-outline"
                  }`}
                >
                  {STATUS_WORDS[decidingClaim.status] || "Untested"}
                </span>
              )}
            </div>
            <p className="mt-1 font-code-sm text-code-sm text-outline">
              {EVALUATOR_NAMES[deciding.evaluator] || deciding.evaluator}
              {deciding.source_title ? (
                <>
                  {" · "}
                  <SerpApiText text={cleanUiText(deciding.source_title)} />
                </>
              ) : null}
            </p>
            {/* Where the panel attacked but nobody could cite it. Showing the
                refusal is the point: it is the opposite of a model that agrees. */}
            {deciding.gate_fired && (
              <p className="mt-1 font-code-sm text-code-sm text-secondary">
                Not refuted — the panel attacked this but no source backed it.
              </p>
            )}
          </button>
        </div>
      )}

      {/* What to do about it */}
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

      {/* Everything else that failed. Native disclosure: keyboard and screen
          reader support for free, and no open/closed state to keep in sync. */}
      {otherFailedClaims.length > 0 && (
        <details className="group">
          <summary className="font-code-sm text-code-sm text-on-surface-variant font-semibold cursor-pointer list-none inline-flex items-center gap-1 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-90">
              chevron_right
            </span>
            {otherFailedClaims.length} more claim{otherFailedClaims.length > 1 ? "s" : ""} didn't hold
          </summary>
          <ul className="mt-space-2 space-y-space-2">
            {otherFailedClaims.map((claim) => {
              const reasoning = decidingSentence(claim.id);
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
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
};
