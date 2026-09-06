# Crossfire — The Idea, Final Form (Pre-Technical)

This is the merged, final version of the idea-level plan: both original knowledge-transfer docs, the USP pivot, the input-model addendum, the feature-versus-review-checkpoint mapping, and a detailed outside critique of that mapping, all reconciled into one document. Nothing below is a stack decision, a library choice, or a line of code, that conversation comes next. This is what the team should agree on before anyone opens an editor.

One housekeeping note: the critique pasted into this round arrived as two identical copies of the same text rather than two distinct model outputs. It's been treated as one input here since there was nothing to reconcile between two copies of itself.

## 1. The thesis, locked

One line: don't ask AI whether your idea is good, make it survive Crossfire.

Crossfire takes a decision someone is about to commit real time or money to, breaks it into the specific claims that decision depends on, decides which of those claims actually matter, runs independent tests designed to break each one, grounds the important findings in evidence, and hands back what survived, what broke, and what's still unproven, along with what that should change about the decision.

The precise technical description, now that every part of this has been argued through: Crossfire is a model-agnostic testing layer that turns messy human intent into a structured set of decision-critical claims, then allocates independent tests against those claims and converts the findings into a decision update. Central metaphor, unchanged: a crash test for decisions. A crash test is valuable because it's built to find failure, not because the rig is smarter than the engineers who designed the car.

## 2. The one thing the MVP has to prove

Every decision in this document should be judged against a single sentence: Crossfire can take messy intent, identify the claims that matter, investigate them in meaningfully different ways, and produce a finding that changes what the user should do.

Not: Crossfire has five agents. Not: Crossfire supports three model providers. Not: Crossfire has a polished interface. If a feature doesn't make that one sentence more true, it's future-proofing, and future-proofing is exactly what a 48-hour build with two hard review gates can't afford. Everything from here down has been re-checked against this sentence, and a few things that survived the last pass didn't survive this one.

## 3. What's changed across the three planning passes

The first pass established the core loop, the four verdict states, the five-role panel identity, and the demo anchor, and none of that changed. The second pass added the model provider layer and the input model, the idea that a run starts from messy text, gets interpreted into a claim map, and that map gets confirmed before testing begins. This third pass, built from an outside critique of the review-checkpoint mapping, changes three things that matter: it separates what's core from what's eventual more aggressively (evidence and decision consequence are core, a third model provider and a fifth evaluator are not), it moves the plain-model comparison from a final demo step to an ongoing internal test that starts as early as possible, and it adds a way to actually check, before the team is fully committed, whether the finished thing is useful or just confidently negative.

## 4. The input model: what starts a run

The opening question is "What are you considering?" not "What's your idea?" Crossfire accepts a formed idea or a rough, unsettled direction, "I have this problem, not sure what to build," but draws a firm line at pure ideation, "I want to build something cool, no idea what," and at open-ended life advice, "I don't know what to do with my career." In both of those cases Crossfire should ask the user to name an actual decision rather than attempt to invent or resolve one. The product converges toward a concrete decision before it starts testing; it never stays ambiguous through a whole run.

For the 48 hours, plain text is the input. A document upload or a pasted URL are real, valuable next steps, since either becomes context for the case rather than a second product, but both need a parsing step the schedule hasn't accounted for, so they're a stretch item, not a guaranteed one. Screenshots and voice stay out entirely.

## 5. The Case and its contracts

Everything a run touches is a single object called a Case: the decision, the context supplied with it, the claims extracted from it, the tests run, the evidence found, the findings, and the resulting decision state. Because three people are implementing this from one person's specification, the shapes below need to be agreed on before anyone splits off to work in parallel. The exact field names can still move; the shape can't, once people start building against it.

```text
Claim
- id
- statement
- importance        (see section 6 for how this gets set, not a raw score)
- status            (survived / weakened / broken / unresolved)

Test
- id
- target_claim
- failure_mode       (what kind of failure this test is designed to catch)
- objective          (what it's actually trying to find out)

Finding
- claim_id
- test_id
- result
- evidence           (list of sources or observations, can be empty)
- reasoning
- confidence
- contradiction       (what pushes the other way, if anything)

DecisionConsequence
- claim_id
- impact              (how much this claim matters to the overall decision)
- recommended_change
- next_validation      (the smallest real-world check that would resolve it)
```

DecisionConsequence is listed as its own contract, not folded into Finding, because it's now understood to be part of the actual product rather than a nice-to-have summary at the end. A Finding says what was discovered. A DecisionConsequence says what that discovery means for what the user does next. Keeping them separate keeps that distinction honest in the data, not just in the copy.

## 6. The core loop, test-plan first

The loop: idea or decision in, then a claim map, which Crossfire states back to the user for confirmation before anything else runs (section 11), then which of the confirmed claims are load-bearing, then a test plan chosen for that specific decision, then independent testing, then evidence, then claim status, then decision consequence, then, if something is still uncertain, the smallest real-world experiment that would resolve it.

The team should think in terms of tests a claim requires, not agents available to run. "Users will pay for this" calls for an evidence test, an alternative test, a behavior test. "This architecture will scale" calls for a constraint test, an alternative test, a failure-mode test. Different claims, different tests, same panel underneath. Starting from "which agent should handle this" instead of "which test does this claim need" is exactly how the product quietly turns into a chat room with costumes.

Load-bearing status should be set by an explicit, checkable question, not a raw confidence number from a model. The question is: if this claim turns out to be false, would the recommended decision materially change? Yes maps to high impact, no maps to low impact. An LLM can help estimate the answer, but the system should be asking that specific question, not returning an unexplained score, because "load-bearing because a model said 87" isn't a finding a user can actually evaluate.

Independence has to be structurally real, not a suggestion. Each evaluator forms its own first finding before seeing anyone else's:

```text
Claim
 |-- Evaluator A -> finding A
 |-- Evaluator B -> finding B
 `-- Evaluator C -> finding C
              |
        Reconciliation
```

not a chain where each evaluator sees what came before it. This isn't cosmetic. A 2026 ACL paper (When Identity Skews Debate: Anonymization for Bias-Reduced Multi-Agent Reasoning, Choi, Zhu, and Li, fetched and read for this document) measures exactly this failure mode directly, finding that agents in multi-agent debate are prone to identity-driven sycophancy and self-bias, uncritically adopting a peer's view or stubbornly sticking to their own prior output, and that sycophancy toward peers is the more common of the two. That's the concrete, measured version of the vaguer "conformity" worry from the earlier drafts, and it's the reason independent-first isn't optional. See section 21 for how this fits with the other three sources already backing the architecture.

## 7. Verdict states and how conflicts get resolved

Four states, all genuinely reachable: survived, weakened, broken, unresolved. Unresolved is the signal that the system measured something instead of defaulting to an opinion.

When evaluators disagree, the resolution is evidence quality and traceability plus how critical the claim is, never a vote. When the evidence is genuinely conflicting or thin, the claim stays unresolved rather than being forced to a winner.

## 8. The evaluator set: what v1 actually builds versus what the product is

The pitch panel, Devil's Advocate, Overthinker, Builder, Receipts, Judge, stays the product's identity and doesn't change. What changes is which of those five are load-bearing for the 48-hour build versus which are strengthening additions.

Mandatory for v1: Devil's Advocate (the Assumption Test), Receipts (the Evidence Test), and Judge (reconciliation). That loop, attack, verify, adjudicate, is already a complete demonstration of the thesis in section 2 on its own.

Next, once that loop is solid: Builder (the Feasibility Test), but only after the evidence path is actually working, not before. See section 9 for why that ordering matters more than it looks like it should.

Deprioritized for v1, not cut from the product: Overthinker. Its function, edge cases and second-order effects, overlaps meaningfully with what Devil's Advocate and Receipts already cover, whereas Receipts is doing something genuinely different from the other two. For the hackathon, Overthinker is closer to a personality flourish on top of an already-working loop than a distinct core evaluator, and it competes for time with document and URL ingestion at the same priority tier in the schedule below.

## 9. Evidence as identity, not a feature

The most repeated skeptical question this project has gotten, across every review of every draft, is some version of: how do you know the criticism is grounded in reality? That question doesn't get answered by adding more personas. It gets answered by Receipts actually working, with real evidence behind findings rather than an evaluator asserting something confidently and the system trusting the assertion.

This is why the build order in section 18 puts real evidence integration ahead of Builder, reversing the earlier plan's priority. A fourth evaluator adds coverage. A working evidence path is what keeps the whole system from being, as the critique that prompted this section put it plainly, just a hater with good formatting.

## 10. Decision consequence and the evidence drawer

Decision consequence is mandatory core, not something bundled in alongside Builder as an extra. Every significant claim should be able to produce the full chain:

```text
CLAIM
  |
WHY IT MATTERS
  |
TESTS RUN
  |
EVIDENCE FOUND
  |
CONTRADICTIONS
  |
STATUS
  |
DECISION IMPACT
  |
WHAT CHANGES
  |
NEXT VALIDATION
```

At least one broken or unresolved load-bearing claim per run needs a real next-validation suggestion, the smallest concrete thing that would resolve the uncertainty, not "do more research." That's the moment a user should be able to say "okay, what am I doing differently now," and it's a separate bar from decision consequence existing at all: the consequence needs to exist for every significant claim, but the smallest-next-experiment needs to actually be concrete for at least the one that matters most.

The content structure behind this, not its visual design, is also what an evidence drawer needs: click a broken or weakened claim and see why it failed, the sources for and against it, the decision impact, what changes, and what to check next. This is the feature that answers "why should I believe Crossfire" without the product ever having to say "trust our AI." Building the visual drawer itself is UI/UX and out of scope for this pass; making sure every Finding and DecisionConsequence actually carries the fields that drawer would need is not, and belongs in the contracts in section 5.

## 11. The claim-confirmation checkpoint, made visible

Whether the user sees anything between claim extraction and testing is a feature decision, not a UI polish decision, and the feature decision is yes. Crossfire states back what it thinks the user is deciding and lists the claims it found; the user can confirm or edit that list before any test runs. This does two things at once: it stops wasted compute when a rough or messy input gets misread, and it's the moment that shows the system is constructing a structured case first rather than just prompting a pile of agents. Keeping this screen small and plain is fine and expected. Hiding it entirely is the part being corrected here, versus the earlier pass that filed this purely as backend logic. Exactly how it looks is still deferred to the UI/UX conversation; that it exists and is visible is decided here.

## 12. The model provider layer, sequenced around the first review

The eventual product architecture is unchanged: one internal interface, three real code paths (an OpenAI-compatible adapter covering OpenAI, Ollama, and custom endpoints; an Anthropic adapter; a Gemini adapter), one provider selected per run. What changes is when each piece gets built.

Before the first review, exactly one provider gets wired end to end, Gemini as the working example for now, with the final choice confirmed in the technical pass that follows this document. The interface should still be written generically from hour zero, so adding a second provider later is a matter of writing one more adapter behind the same contract, not restructuring anything. A second provider gets added only after the full core loop already works on the first one, and a third only if it turns out to be genuinely painless once the second one is in, otherwise it's cut and the pitch still holds, since the architecture demonstrably supports it even if the demo only shows two providers running. Building three production-quality integrations before the loop itself works risks losing three to five hours to SDK differences, auth, and response-format quirks that have nothing to do with proving the thesis in section 2.

The local and open-source story gets the same treatment: architect for it, don't implement it. The OpenAI-compatible adapter should be written so that pointing it at a local Ollama endpoint is just a different base URL, not a special case, but no hackathon hours go toward tuning or babysitting a local model's output quality. That distinction, designed-for versus built-and-polished, is what lets the pitch keep saying "runs on your own model" honestly without betting the demo on it.

## 13. Differentiation, sharpened

|  | A raw prompt to a frontier model | An AI council | An AI fact-checker | Crossfire |
|---|---|---|---|---|
| What it optimizes for | The best single answer | Surfacing several opinions | Whether a statement is true | Reducing the uncertainty that could change a decision |
| Typical failure | Drifts toward agreement, and what gets investigated depends on how the prompt was written | Converges into consensus or a vote, disagreement stays unresolved | Can only check backward-looking, already-settled facts | None claimed to be immune, but load-bearing claims get independent, evidence-grounded attention by design |
| How disagreement is resolved | Usually nothing to resolve, it's one voice | Majority vote or an averaged score | Not applicable | Evidence quality and how critical the claim is, never a vote; unresolved is valid |
| What you get back | A recommendation | A transcript or a consensus score | A true or false label | A claim-by-claim verdict tied to what to do next |

The line the table exists to support: a normal model might already know a competitor exists. Crossfire's value is knowing that the competitor invalidates a load-bearing assumption, so the plan needs to change. That gap, between a fact being known and a fact being connected to a decision, is the actual thing being demonstrated.

## 14. The certainty framing, locked

Crossfire does not promise truth, correctness, or the elimination of error. It exposes the assumptions, evidence, contradictions, and uncertainties behind a decision clearly enough that the user can decide what to do next. No language implying guaranteed correctness belongs in the application text or the pitch.

## 15. Internal validation: how the team checks whether this actually works

This section is for the team, not for judges or the application. Before trusting the system on a single cherry-picked demo idea, build a small internal evaluation set, five to ten decisions chosen deliberately, each with a known property: an obvious flaw, a subtle flaw, a misleading assumption, at least one claim that's actually true and should survive, and at least one claim where the evidence is genuinely mixed. Run each one through both a plain model call and Crossfire.

Two things to watch for. The first is whether Crossfire is useful rather than just more negative: a claim like "I want to build a calculator app" should mostly survive, and if Crossfire manufactures a load-bearing objection to something that obviously doesn't need one, that's Devil's Advocate turning into hater mode, and it's as real a failure as missing an actual flaw. The second is whether findings are grounded: a negative finding with no traceable evidence behind it is the exact failure this whole architecture exists to prevent, and it should be rare, not just theoretically avoided.

Two soft metrics are worth tracking across that test set, not for a paper, just for the team's own confidence: how many cases produced a finding a reasonable user would actually act on, and how many negative findings had no real evidence behind them. Neither needs to be rigorous. Both are far more informative than "does the demo look good."

The plain-model-versus-Crossfire comparison should start this way, as an internal check running from roughly the point the core loop first works, not as a scripted final reveal built once at the end. Waiting until hour 35 to find out whether the core hypothesis holds is waiting until there's no time left to react if it doesn't. And the bar for that comparison isn't "Crossfire wins nearly every time," which isn't a claim that can honestly be made or verified in 48 hours anyway. The bar is whether Crossfire reliably surfaces a useful, inspectable decision consequence that a normal answer doesn't naturally structure or investigate. That's checkable, and it's the actual hypothesis behind the whole project.

## 16. The external demo

Separate from the internal check above: the demo built for judges stays the college-application anchor, with a specific claim, that students will trust autonomous submission, chosen to break in a memorable way. The mechanism is the same live side-by-side, the same input into a plain model call and into Crossfire, at the same time, without engineering the plain call to look weak. Live web research and any live local-model call stay bonuses layered on top of a prepared, reproducible piece of evidence for the one claim the demo actually depends on, never the single point of failure holding up the strongest moment of the pitch.

## 17. Application answers — status and suggested touch-ups

The application text is editable. Leave alone the answers on what problem is being solved, on conflicting findings not being resolved by vote count, and on broken versus unproven claims needing different responses, all three already tested well. Worth a one-sentence addition to the "what is this" and "how does it work" answers reflecting that Crossfire works with whichever model the user already trusts rather than reading as a single fixed model, additive to the existing text, not a replacement.

## 18. The 48-hour build plan

Hour 0 to 2: lock the five contracts in section 5 across all three backend developers before anyone branches off. Build the provider interface with one provider wired end to end, Gemini as the working default pending the technical pass. Sketch the test-plan schema so claims can be routed to different test types later.

Hour 2 to 8: the smallest complete loop, end to end, on one fixed input: claim decomposition, Devil's Advocate, Receipts (with real evidence from the start if at all feasible, not a placeholder to fill in later), Judge, a real four-state verdict out the other end.

Hour 8 to 11, the progress-review target: generalize just enough that it isn't only the one hardcoded input. The bar is input in, claim extraction, at least two genuinely different tests, real evidence, a claim result, even if the output is ugly. An ugly, real result is worth more at this checkpoint than a polished screen wrapping fake orchestration, and it's what actually proves the thesis in section 2 is alive.

Hour 11 to 18: generalize claim extraction across varied inputs, add the load-bearing question from section 6, add test-plan selection so different claims genuinely route to different tests instead of the same three every time.

Hour 18 to 25: decision consequence and next-validation as mandatory core, unresolved handling done properly. Add Builder here if the loop and the evidence path are both solid; skip it without guilt if they aren't.

Hour 25 to 30: now that the loop is stable, add the second provider. Strengthen the evidence integration's reliability while there's still runway to react if it's flaky.

Hour 30 to 35, the prototype-evaluation target: integration hardening, not new features. Run the loop against several inputs, not just the one it was built on. Wire in the claim-confirmation checkpoint and the evidence-drawer data (ugly is fine, the content needs to be there, the look doesn't yet). Reserve real time here for the seams between three people's components, since that's where a parallel build actually breaks.

Hour 35 to 38: make the side-by-side demo-ready. It should already have been running informally since around hour 18 to 20 as an internal check per section 15; this slot is about presentation, not discovery.

Hour 38 to 42: run the five-to-ten-case internal evaluation set from section 15, fix the worst false negatives and the worst unsupported-criticism cases it turns up.

Hour 42 to 46: final polish, two rehearsals on the provider the demo will actually run on, the prepared fallback evidence locked in.

Hour 46 to 48: buffer.

Third provider, Overthinker, and document or URL ingestion all remain explicitly optional and are only attempted if the hour 38 checkpoint shows real slack, in that priority order, third provider first since it's the cheapest if the second one went smoothly, the other two competing for whatever's left.

## 19. Consolidated risks

Close competitors with large selectable-advisor panels and consensus scoring remain the biggest category risk; the mitigation is unchanged, claim-tracking has to be structurally real, not colored labels over a chat log.

The product not clearly outperforming a well-written prompt is still the core intellectual risk, and section 15 is now the actual answer to it, an internal test rather than a hope.

Reflexive negativity, the system finding a flaw in everything regardless of merit, now has a concrete check attached to it (the false-negative test) instead of only a stated principle, and unsupported criticism now has a metric instead of only a design intention.

A slow or weak local model or a shaky third provider chosen under time pressure could make a live run worse for reasons that have nothing to do with Crossfire's logic; the demo runs on whichever provider is actually fastest and most reliable regardless of what the settings screen supports.

If the written application still contains any certainty language left over from the earlier pitch draft, it directly contradicts the unresolved-as-a-feature answer that already tested well; worth a dedicated read-through before submission specifically hunting for that.

## 20. Explicitly cut from this build

Voice, images, and screenshots as input; an ideation mode; a persistent multi-session decision journal; a provider marketplace beyond the five named; one-on-one chat with a single persona outside the claim record; per-persona model selection; user accounts. Local and open-source support gets the narrower treatment from section 12, architected for, not built out, which is different from a straight cut and worth keeping distinct in conversation with the team so nobody either promises Ollama support that isn't there or quietly spends hours polishing it. Overthinker, a third provider, and document or URL ingestion are stretch items competing for the same end-of-build slack, not guaranteed features, and shouldn't be described as done in any pitch material until they actually are.

## 21. Research grounding

Four sources now back the architecture, each read in full and cited only for the specific, conditional claim it actually supports.

"When Identity Skews Debate: Anonymization for Bias-Reduced Multi-Agent Reasoning" (Choi, Zhu, and Li, ACL 2026, aclanthology.org/2026.acl-long.650), fetched and read for this document: measures identity-driven sycophancy and self-bias directly in multi-agent debate, finding sycophancy toward peers is more common than self-bias, and proposes anonymizing responses to force evaluation on content rather than source. This is the concrete backing for independent-first evaluation in section 6.

"Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical Reasoning" (arxiv.org/abs/2511.07784): debate effectiveness tracks the agents' own reasoning strength and how genuinely different they are, not the act of debating itself, and majority pressure suppresses independent correction.

"Demystifying Multi-Agent Debate: The Role of Confidence and Diversity" (aclanthology.org/2026.findings-acl.1694): vanilla multi-agent debate often underperforms simple majority vote, but diversity-aware initialization and confidence-modulated updates outperform both, backing evidence-weighted reconciliation over vote counting.

"Free-MAD: Consensus-Free Multi-Agent Debate" (aclanthology.org/2026.findings-acl.1600): token overhead, error propagation from an incorrect early response, and unfairness from majority voting are the problems this design avoids by keeping evaluators independent and never voting.

Left out deliberately: "Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline" (arxiv.org/html/2601.12307v1), since its finding is the wrapper accusation handed to a judge in citation form, usable only inside a specific defensive frame. Two market-report links that came up in an earlier discussion (a validation-tool alternatives page and a 2026 idea-validation roundup) stay off this list too, since nobody on the team has fetched and read them, the same standard applied to everything else here.

## 22. Open items for the technical pass

These are the questions worth carrying into the technical conversation, not resolved here because they depend on the stack: exactly how claim extraction is implemented, one structured call or a small chain, and how reliable that needs to be before it's trusted to run unattended. What the real evidence-search integration is, which service, how it's called, and what the fallback looks like if it's flaky mid-demo. Whether Gemini stays the first provider once the actual SDKs are compared, or a different one turns out to be less friction for hour zero to two. How the load-bearing question in section 6 actually gets implemented, a structured prompt, a small classifier, or something else. And whether hour 38's internal evaluation run surfaces problems specific enough that a technical fix (a prompt change, a different evidence source) is obviously the answer, versus a deeper design issue that would need to come back to this document instead.
